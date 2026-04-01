import ConfiguracaoModel from '../models/ConfiguracaoModel.js';
import ProdutoModel from '../models/ProdutoModel.js';
import VendaModel from '../models/VendaModel.js';
import VendaItemModel from '../models/VendaItemModel.js';
import HistoricoModel from '../models/HistoricoModel.js';
import { dbGet, dbRun, initializeTenantDatabase, listTenants, runWithTenant } from '../database/database.js';
import crypto from 'crypto';
import { broadcast } from './realtimeService.js';

const DEFAULT_MATCH_THRESHOLD = 0.68;
const DEFAULT_INVENTORY_MODE = 'ao_pronto';
const INVENTORY_MODES = new Set(['na_abertura', 'ao_pronto']);
const IFOOD_AUTH_BASE = 'https://merchant-api.ifood.com.br/authentication/v1.0/oauth';
const IFOOD_API_BASE = 'https://merchant-api.ifood.com.br';
const MERCHANT_ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizarTexto(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

function tokenizar(valor) {
  return normalizarTexto(valor)
    .split(/\s+/)
    .filter(Boolean);
}

function levenshtein(a, b) {
  const s = normalizarTexto(a);
  const t = normalizarTexto(b);
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const prev = Array.from({ length: t.length + 1 }, (_, i) => i);
  for (let i = 1; i <= s.length; i += 1) {
    let current = [i];
    for (let j = 1; j <= t.length; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      current[j] = Math.min(
        prev[j] + 1,
        current[j - 1] + 1,
        prev[j - 1] + cost
      );
    }
    for (let j = 0; j <= t.length; j += 1) prev[j] = current[j];
  }
  return prev[t.length];
}

function similaridadeTexto(a, b) {
  const aa = normalizarTexto(a);
  const bb = normalizarTexto(b);
  if (!aa || !bb) return 0;
  if (aa === bb) return 1;
  if (aa.includes(bb) || bb.includes(aa)) return 0.95;

  const tokensA = tokenizar(aa);
  const tokensB = tokenizar(bb);
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let inter = 0;
  for (const token of setA) {
    if (setB.has(token)) inter += 1;
  }
  const union = new Set([...tokensA, ...tokensB]).size || 1;
  const jaccard = inter / union;
  const dist = levenshtein(aa, bb);
  const maxLen = Math.max(aa.length, bb.length) || 1;
  const editScore = 1 - dist / maxLen;
  return Math.max(0, Math.min(1, (jaccard * 0.55) + (editScore * 0.45)));
}

function normalizarNumero(valor, fallback = null) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : fallback;
}

function extrairMerchantIdsValidos(valor) {
  const raw = Array.isArray(valor)
    ? valor
    : String(valor || '')
      .split(',')
      .map((v) => String(v || '').trim())
      .filter(Boolean);
  return raw.filter((v) => MERCHANT_ID_REGEX.test(v));
}

function descreverErroIfood(error) {
  if (!error) return 'erro desconhecido';
  if (typeof error === 'string') return error;
  if (error instanceof Error) {
    const detalhes = [];
    if (error.status) detalhes.push(`status=${error.status}`);
    if (error.code) detalhes.push(`code=${error.code}`);
    if (error.payload && Object.keys(error.payload || {}).length) {
      try {
        detalhes.push(`payload=${JSON.stringify(error.payload)}`);
      } catch {
        detalhes.push('payload=[unserializable]');
      }
    }
    return detalhes.length ? `${error.message} (${detalhes.join(', ')})` : error.message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function calcularAssinaturaIfood(rawBody, secret) {
  const hmac = crypto.createHmac('sha256', String(secret || ''));
  hmac.update(Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody || '')));
  return hmac.digest('hex');
}

async function webhookJaProcessado(eventId) {
  if (!eventId) return false;
  const row = await dbGet('SELECT event_id FROM ifood_eventos_processados WHERE event_id = ? LIMIT 1', [String(eventId)]);
  return !!row;
}

async function marcarWebhookProcessado({ eventId, orderId = null, eventType = null }) {
  if (!eventId) return false;
  await dbRun(
    `INSERT OR REPLACE INTO ifood_eventos_processados (event_id, order_id, event_type, processed_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
    [String(eventId), orderId ? String(orderId) : null, eventType ? String(eventType) : null]
  );
  return true;
}

function formatarNomeComanda(nomeCliente, codigo) {
  const cliente = String(nomeCliente || 'Cliente').trim() || 'Cliente';
  const codigoPedido = String(codigo || '').trim() || '--';
  return `iFood - ${cliente} (${codigoPedido})`;
}

function mapearStatusLocal(statusRaw) {
  const status = normalizarTexto(statusRaw).replace(/\s+/g, '_');
  if (['ready', 'ready_for_pickup', 'pronto', 'preparado', 'pickup_ready'].includes(status)) return 'pronta';
  if (['accepted', 'confirmed', 'in_preparation', 'preparing', 'em_preparo'].includes(status)) return 'em_preparo';
  return 'em_preparo';
}

function extrairObjetoPedido(payload = {}) {
  return payload.order || payload.data || payload.payload || payload;
}

function extrairCodigoPedido(pedido = {}, payload = {}) {
  const candidatos = [
    pedido.displayCode,
    pedido.code,
    pedido.orderCode,
    pedido.orderId,
    pedido.id,
    payload.displayCode,
    payload.code,
    payload.orderId,
    payload.id
  ];
  const codigo = candidatos.find((v) => String(v || '').trim());
  return String(codigo || '').trim();
}

function extrairNomeCliente(pedido = {}, payload = {}) {
  const candidatos = [
    pedido?.customer?.name,
    pedido?.customerName,
    pedido?.client?.name,
    pedido?.recipient?.name,
    payload?.customer?.name,
    payload?.customerName,
    payload?.client?.name
  ];
  const nome = candidatos.find((v) => String(v || '').trim());
  return String(nome || 'Cliente').trim() || 'Cliente';
}

function extrairStatusPedido(pedido = {}, payload = {}) {
  return (
    pedido.status ||
    pedido.orderStatus ||
    pedido.currentStatus ||
    payload.status ||
    payload.eventType ||
    payload.event ||
    'accepted'
  );
}

function extrairMerchantId(payload = {}) {
  const candidatos = [
    payload?.merchantId,
    payload?.merchant?.id,
    payload?.merchant?.merchantId,
    payload?.data?.merchantId,
    payload?.data?.merchant?.id,
    payload?.order?.merchantId,
    payload?.order?.merchant?.id
  ];
  const merchantId = candidatos.find((v) => String(v || '').trim());
  return String(merchantId || '').trim();
}

function extrairTempos(pedido = {}, payload = {}) {
  const delivery = pedido.delivery || pedido.deliveryInfo || payload.delivery || {};
  const tempos = {
    entrega_estimativa_minutos:
      normalizarNumero(delivery.estimatedTimeInMinutes)
      ?? normalizarNumero(delivery.estimatedDeliveryTimeInMinutes)
      ?? normalizarNumero(delivery.deliveryTimeInMinutes)
      ?? normalizarNumero(delivery.etaInMinutes)
      ?? normalizarNumero(pedido.estimatedTimeInMinutes)
      ?? null,
    tempo_ate_entregador_minutos:
      normalizarNumero(delivery.courierEtaInMinutes)
      ?? normalizarNumero(delivery.timeToCourierInMinutes)
      ?? normalizarNumero(delivery.driverEtaInMinutes)
      ?? normalizarNumero(pedido.courierEtaInMinutes)
      ?? null,
    tempo_preparo_minutos:
      normalizarNumero(delivery.preparationTimeInMinutes)
      ?? normalizarNumero(delivery.kitchenTimeInMinutes)
      ?? normalizarNumero(pedido.preparationTimeInMinutes)
      ?? null
  };
  return tempos;
}

function extrairItensPedido(pedido = {}, payload = {}) {
  const candidatos = [
    pedido.items,
    pedido.orderItems,
    pedido.products,
    pedido.basket?.products,
    payload.items,
    payload.orderItems,
    payload.products,
    payload.basket?.products
  ];
  const itens = candidatos.find((arr) => Array.isArray(arr)) || [];
  return itens.map((item, index) => ({
    index,
    nome: String(item?.name || item?.title || item?.productName || item?.description || '').trim(),
    quantidade: Math.max(1, Number(item?.quantity || item?.qty || 1)),
    preco_unitario: normalizarNumero(item?.unitPrice)
      ?? normalizarNumero(item?.price)
      ?? normalizarNumero(item?.pricePerUnit)
      ?? null,
    observacoes: String(item?.notes || item?.observation || item?.observationText || '').trim(),
    sku: String(item?.sku || item?.merchantSku || item?.id || '').trim()
  })).filter((item) => item.nome);
}

function pontuarProduto(itemNome, produto) {
  const candidatos = [produto?.nome, produto?.categoria, produto?.nome && `${produto.nome} ${produto.categoria || ''}`];
  let melhor = 0;
  for (const candidato of candidatos) {
    melhor = Math.max(melhor, similaridadeTexto(itemNome, candidato));
  }
  return melhor;
}

function localizarMelhorProduto(itemNome, produtos, threshold) {
  let melhor = null;
  let melhorScore = 0;
  for (const produto of produtos || []) {
    const score = pontuarProduto(itemNome, produto);
    if (score > melhorScore) {
      melhorScore = score;
      melhor = produto;
    }
  }
  if (!melhor || melhorScore < threshold) return { produto: null, score: melhorScore };
  return { produto: melhor, score: melhorScore };
}

async function obterConfigIfood() {
  const map = await ConfiguracaoModel.obterPorPrefixo('ifood_');
  return {
    ativo: String(map.ifood_ativo || '0') === '1',
    mode: String(map.ifood_mode || 'distributed').toLowerCase(),
    client_id: String(map.ifood_client_id || '').trim(),
    client_secret: String(map.ifood_client_secret || '').trim(),
    webhook_secret: String(map.ifood_webhook_secret || '').trim(),
    access_token: String(map.ifood_access_token || '').trim(),
    refresh_token: String(map.ifood_refresh_token || '').trim(),
    authorization_code_verifier: String(map.ifood_authorization_code_verifier || '').trim(),
    merchant_id: String(map.ifood_merchant_id || '').trim(),
    api_base_url: String(map.ifood_api_base_url || '').trim(),
    inventory_mode: INVENTORY_MODES.has(String(map.ifood_inventory_mode || '').toLowerCase())
      ? String(map.ifood_inventory_mode).toLowerCase()
      : DEFAULT_INVENTORY_MODE,
    match_threshold: Math.max(
      0,
      Math.min(1, normalizarNumero(map.ifood_match_threshold, DEFAULT_MATCH_THRESHOLD))
    )
  };
}

async function salvarConfigIfood(parcial = {}) {
  const atual = await obterConfigIfood();
  const next = {
    ativo: parcial.ativo === undefined ? atual.ativo : !!parcial.ativo,
    mode: ['distributed', 'centralized'].includes(String(parcial.mode || '').toLowerCase())
      ? String(parcial.mode).toLowerCase()
      : atual.mode,
    client_id: String(parcial.client_id ?? atual.client_id ?? '').trim(),
    client_secret: String(parcial.client_secret ?? atual.client_secret ?? '').trim(),
    webhook_secret: String(parcial.webhook_secret ?? atual.webhook_secret ?? '').trim(),
    access_token: String(parcial.access_token ?? atual.access_token ?? '').trim(),
    refresh_token: String(parcial.refresh_token ?? atual.refresh_token ?? '').trim(),
    authorization_code_verifier: String(
      parcial.authorization_code_verifier ?? atual.authorization_code_verifier ?? ''
    ).trim(),
    merchant_id: String(parcial.merchant_id ?? atual.merchant_id ?? '').trim(),
    api_base_url: String(parcial.api_base_url ?? atual.api_base_url ?? '').trim(),
    inventory_mode: INVENTORY_MODES.has(String(parcial.inventory_mode || '').toLowerCase())
      ? String(parcial.inventory_mode).toLowerCase()
      : atual.inventory_mode,
    match_threshold: Math.max(
      0,
      Math.min(1, normalizarNumero(parcial.match_threshold, atual.match_threshold))
    )
  };

  await Promise.all([
    ConfiguracaoModel.definir('ifood_ativo', next.ativo ? '1' : '0'),
    ConfiguracaoModel.definir('ifood_mode', next.mode),
    ConfiguracaoModel.definir('ifood_client_id', next.client_id),
    ConfiguracaoModel.definir('ifood_client_secret', next.client_secret),
    ConfiguracaoModel.definir('ifood_webhook_secret', next.webhook_secret),
    ConfiguracaoModel.definir('ifood_access_token', next.access_token),
    ConfiguracaoModel.definir('ifood_refresh_token', next.refresh_token),
    ConfiguracaoModel.definir('ifood_authorization_code_verifier', next.authorization_code_verifier),
    ConfiguracaoModel.definir('ifood_merchant_id', next.merchant_id),
    ConfiguracaoModel.definir('ifood_api_base_url', next.api_base_url),
    ConfiguracaoModel.definir('ifood_inventory_mode', next.inventory_mode),
    ConfiguracaoModel.definir('ifood_match_threshold', String(next.match_threshold))
  ]);

  return next;
}

async function registrarHistoricoIfood(acao, vendaId, detalhes = null) {
  try {
    await HistoricoModel.registrar({
      tipo_entidade: 'venda',
      entidade_id: vendaId,
      acao,
      detalhes
    });
  } catch (error) {
    console.warn('Falha ao registrar histórico iFood:', error.message);
  }
}

async function requestIfoodToken(formData) {
  const response = await fetch(`${IFOOD_AUTH_BASE}/token`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(formData)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error_description || payload.message || payload.error || 'Falha ao autenticar no iFood');
  }
  return payload;
}

async function ifoodRequest(pathname, { method = 'GET', headers = {}, body = null } = {}, cfg = null) {
  const config = cfg || await obterConfigIfood();
  const base = String(config.api_base_url || IFOOD_API_BASE).replace(/\/+$/, '') || IFOOD_API_BASE;
  const response = await fetch(`${base}${pathname}`, {
    method,
    headers: {
      accept: 'application/json',
      ...(config.access_token ? { Authorization: `Bearer ${config.access_token}` } : {}),
      ...headers
    },
    body
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const rawError = payload.error_description || payload.message || payload.error || payload;
    const msg = typeof rawError === 'string' ? rawError : (rawError?.message || rawError?.description || `iFood API falhou (${response.status})`);
    const err = new Error(msg);
    err.status = response.status;
    err.payload = payload;
    if (response.status === 403 && payload?.unauthorizedMerchants) {
      err.message = `iFood recusou merchants sem permissão: ${Array.isArray(payload.unauthorizedMerchants) ? payload.unauthorizedMerchants.join(', ') : JSON.stringify(payload.unauthorizedMerchants)}`;
    }
    if (response.status === 400 && /too many polling merchants/i.test(msg)) {
      err.message = 'iFood rejeitou o polling: muitos merchants no filtro x-polling-merchants';
    }
    throw err;
  }
  return payload;
}

async function listarMerchantsIfood(cfg = null) {
  const config = cfg || await obterConfigIfood();
  return ifoodRequest('/merchant/v1.0/merchants?page=1&size=100', { method: 'GET' }, config);
}

async function iniciarLoginIfood() {
  const cfg = await obterConfigIfood();
  if (!cfg.client_id) {
    throw new Error('Defina o client_id do app iFood antes de iniciar o login');
  }

  const response = await fetch(`${IFOOD_AUTH_BASE}/userCode`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({ clientId: cfg.client_id })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error_description || payload.message || payload.error || 'Falha ao gerar código do iFood');
  }

  await Promise.all([
    ConfiguracaoModel.definir('ifood_authorization_code_verifier', payload.authorizationCodeVerifier || ''),
    ConfiguracaoModel.definir('ifood_user_code', payload.userCode || ''),
    ConfiguracaoModel.definir('ifood_verification_url_complete', payload.verificationUrlComplete || '')
  ]);

  return {
    user_code: payload.userCode || '',
    verification_url: payload.verificationUrl || '',
    verification_url_complete: payload.verificationUrlComplete || '',
    expires_in: payload.expiresIn || 600,
    authorization_code_verifier: payload.authorizationCodeVerifier || ''
  };
}

async function finalizarLoginIfood({ authorization_code, client_id, client_secret }) {
  const cfg = await obterConfigIfood();
  const code = String(authorization_code || '').trim();
  if (!code) throw new Error('authorization_code é obrigatório');
  const finalClientId = String(client_id || cfg.client_id || '').trim();
  const finalClientSecret = String(client_secret || cfg.client_secret || '').trim();
  const verifier = String(cfg.authorization_code_verifier || '').trim();
  if (!finalClientId || !finalClientSecret) {
    throw new Error('client_id e client_secret são obrigatórios para concluir o login');
  }
  if (!verifier) {
    throw new Error('authorization_code_verifier não encontrado. Inicie o login novamente');
  }

  const token = await requestIfoodToken({
    grantType: 'authorization_code',
    clientId: finalClientId,
    clientSecret: finalClientSecret,
    authorizationCode: code,
    authorizationCodeVerifier: verifier
  });

  const next = {
    ...cfg,
    client_id: finalClientId,
    client_secret: finalClientSecret,
    access_token: token.accessToken || token.access_token || '',
    refresh_token: token.refreshToken || token.refresh_token || '',
    merchant_id: token.merchantId || token.merchant_id || cfg.merchant_id || '',
    ativo: true
  };

  await Promise.all([
    ConfiguracaoModel.definir('ifood_client_id', next.client_id),
    ConfiguracaoModel.definir('ifood_client_secret', next.client_secret),
    ConfiguracaoModel.definir('ifood_access_token', next.access_token),
    ConfiguracaoModel.definir('ifood_refresh_token', next.refresh_token),
    ConfiguracaoModel.definir('ifood_merchant_id', next.merchant_id),
    ConfiguracaoModel.definir('ifood_ativo', '1')
  ]);

  try {
    const merchants = await listarMerchantsIfood({ ...next, access_token: next.access_token });
    const lista = Array.isArray(merchants) ? merchants : Array.isArray(merchants?.items) ? merchants.items : [];
    const ids = lista.map((m) => String(m?.id || '').trim()).filter(Boolean);
    if (ids.length) {
      await ConfiguracaoModel.definir('ifood_merchant_ids_json', JSON.stringify(ids));
      if (!next.merchant_id) {
        next.merchant_id = ids[0];
        await ConfiguracaoModel.definir('ifood_merchant_id', next.merchant_id);
      }
    }
  } catch (error) {
    console.warn('Não foi possível listar merchants após login iFood:', descreverErroIfood(error));
  }

  return {
    ativo: true,
    client_id: next.client_id,
    merchant_id: next.merchant_id,
    access_token_ok: !!next.access_token,
    refresh_token_ok: !!next.refresh_token
  };
}

async function renovarTokenIfood() {
  const cfg = await obterConfigIfood();
  if (!cfg.client_id || !cfg.client_secret || !cfg.refresh_token) {
    throw new Error('Configuração insuficiente para renovar o token');
  }
  const token = await requestIfoodToken({
    grantType: 'refresh_token',
    clientId: cfg.client_id,
    clientSecret: cfg.client_secret,
    refreshToken: cfg.refresh_token
  });
  await Promise.all([
    ConfiguracaoModel.definir('ifood_access_token', token.accessToken || token.access_token || ''),
    ConfiguracaoModel.definir('ifood_refresh_token', token.refreshToken || token.refresh_token || cfg.refresh_token)
  ]);
  return {
    access_token: token.accessToken || token.access_token || '',
    refresh_token: token.refreshToken || token.refresh_token || cfg.refresh_token
  };
}

async function obterMerchantIdsPolling(cfg = null) {
  const config = cfg || await obterConfigIfood();
  const idsConfigurados = extrairMerchantIdsValidos(config.merchant_id);
  if (idsConfigurados.length) return idsConfigurados;

  try {
    const armazenados = JSON.parse(await ConfiguracaoModel.obter('ifood_merchant_ids_json', '[]'));
    const idsArmazenados = extrairMerchantIdsValidos(armazenados);
    if (idsArmazenados.length) return idsArmazenados;
  } catch {
    // ignore
  }

  try {
    const merchants = await listarMerchantsIfood(config);
    const lista = Array.isArray(merchants) ? merchants : Array.isArray(merchants?.items) ? merchants.items : [];
    const ids = lista.map((m) => String(m?.id || '').trim()).filter(Boolean);
    if (ids.length) {
      await ConfiguracaoModel.definir('ifood_merchant_ids_json', JSON.stringify(ids));
      if (!config.merchant_id) {
        await ConfiguracaoModel.definir('ifood_merchant_id', ids[0]);
      }
      return ids;
    }
  } catch (error) {
    console.warn('Falha ao descobrir merchants do iFood:', descreverErroIfood(error));
  }

  return [];
}

async function buscarPedidoDetalhadoIfood(orderId, cfg = null) {
  const config = cfg || await obterConfigIfood();
  return ifoodRequest(`/logistics/v1.0/orders/${encodeURIComponent(orderId)}`, { method: 'GET' }, config)
    .catch(async (err) => {
      if (err.status === 404) {
        return ifoodRequest(`/order/v1.0/orders/${encodeURIComponent(orderId)}`, { method: 'GET' }, config);
      }
      throw err;
    });
}

async function listarEventosIfood(cfg = null) {
  const config = cfg || await obterConfigIfood();
  const merchantIds = await obterMerchantIdsPolling(config);

  return ifoodRequest(
    `/events/v1.0/events:polling`,
    {
      method: 'GET',
      headers: merchantIds.length
        ? { 'x-polling-merchants': merchantIds.slice(0, 100).join(',') }
        : {}
    },
    config
  );
}

async function ackEventosIfood(eventIds, cfg = null) {
  const config = cfg || await obterConfigIfood();
  const merchantIds = await obterMerchantIdsPolling(config);
  if (!Array.isArray(eventIds) || eventIds.length === 0) return null;

  return ifoodRequest(
    `/events/v1.0/events:acknowledgment`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(merchantIds.length ? { 'x-polling-merchants': merchantIds.slice(0, 100).join(',') } : {})
      },
      body: JSON.stringify(eventIds)
    },
    config
  );
}

async function baixarEstoquePendentesDaVenda(vendaId) {
  const itens = await VendaItemModel.obterPorVenda(vendaId);
  const itensPendentes = (itens || []).filter((item) => Number(item.estoque_baixado || 0) !== 1);
  for (const item of itensPendentes) {
    const produto = await ProdutoModel.obterPorId(item.produto_id);
    const consumo = Math.max(1, Number(item.consumo_estoque || 1));
    if (produto && !(produto.nome && produto.nome.startsWith('Avulso')) && Number(produto.estoque || 0) < 9999) {
      await ProdutoModel.atualizarEstoque(item.produto_id, -(Number(item.quantidade || 0) * consumo));
    }
    await VendaItemModel.atualizar(item.id, { estoque_baixado: 1 });
  }
  return itensPendentes.length;
}

async function processarPedidoIfood(payload = {}) {
  const cfg = await obterConfigIfood();
  if (!cfg.ativo) {
    throw new Error('Integração iFood desativada');
  }

  const pedido = extrairObjetoPedido(payload);
  const codigo = extrairCodigoPedido(pedido, payload);
  if (!codigo) {
    throw new Error('Pedido iFood sem código identificável');
  }

  const clienteNome = extrairNomeCliente(pedido, payload);
  const statusRaw = extrairStatusPedido(pedido, payload);
  const statusLocal = mapearStatusLocal(statusRaw);
  const tempos = extrairTempos(pedido, payload);
  const itensOriginais = extrairItensPedido(pedido, payload);
  const produtos = await ProdutoModel.obterTodos(true);
  const existe = await VendaModel.obterPorOrigem('ifood', codigo);
  const nomeComanda = formatarNomeComanda(clienteNome, codigo);
  const origemPayloadJson = JSON.stringify(payload);
  const itensMapeados = [];
  const itensNaoMapeados = [];

  for (const item of itensOriginais) {
    const { produto, score } = localizarMelhorProduto(item.nome, produtos, cfg.match_threshold);
    if (!produto) {
      itensNaoMapeados.push({ ...item, score });
      continue;
    }
    itensMapeados.push({ ...item, produto, score });
  }

  const vendaBase = {
    tipo: 'fastfood',
    status: statusLocal,
    origem: 'ifood',
    origem_codigo: codigo,
    cliente_nome_externo: clienteNome,
    nome_comanda: nomeComanda,
    origem_payload_json: origemPayloadJson,
    entrega_estimativa_minutos: tempos.entrega_estimativa_minutos,
    tempo_ate_entregador_minutos: tempos.tempo_ate_entregador_minutos,
    tempo_preparo_minutos: tempos.tempo_preparo_minutos,
    entrega_status_texto: String(statusRaw || '').trim(),
    mesa: null
  };

  let venda = existe;
  if (!venda) {
    venda = await VendaModel.criar(vendaBase);
  } else {
    await VendaModel.atualizar(existe.id, vendaBase);
    venda = await VendaModel.obterPorId(existe.id);
  }

  if ((!existe || Number(existe.total || 0) === 0) && itensMapeados.length > 0) {
    for (const item of itensMapeados) {
      const quantidade = Math.max(1, Number(item.quantidade || 1));
      const precoUnitario = Number(item.preco_unitario ?? item.produto.preco ?? 0);
      const consumo = 1;
      const estoqueBaixado = cfg.inventory_mode === 'na_abertura';
      await VendaItemModel.criar({
        venda_id: venda.id,
        produto_id: item.produto.id,
        quantidade,
        preco_unitario: precoUnitario,
        consumo_estoque: consumo,
        estoque_baixado: estoqueBaixado,
        subtotal: Number((quantidade * precoUnitario).toFixed(2)),
        observacoes: item.observacoes || null
      });
      if (estoqueBaixado) {
        await ProdutoModel.atualizarEstoque(item.produto.id, -(quantidade * consumo));
      }
    }
    await VendaModel.obterTotal(venda.id);
  }

  if (statusLocal === 'pronta' && cfg.inventory_mode === 'ao_pronto') {
    await baixarEstoquePendentesDaVenda(venda.id);
  }

  const vendaAtualizada = await VendaModel.obterPorId(venda.id);
  await registrarHistoricoIfood('ifood_pedido_sincronizado', venda.id, {
    codigo,
    status: statusLocal,
    itens_mapeados: itensMapeados.length,
    itens_nao_mapeados: itensNaoMapeados.length
  });
  broadcast('venda.atualizada', {
    id: venda.id,
    origem: 'ifood',
    origem_codigo: codigo,
    status: statusLocal
  });
  if (statusLocal) {
    broadcast('venda.status', { id: venda.id, status: statusLocal, origem: 'ifood' });
  }

  return {
    venda: vendaAtualizada,
    codigo,
    cliente_nome: clienteNome,
    nome_comanda: nomeComanda,
    status_local: statusLocal,
    itens_mapeados: itensMapeados.length,
    itens_nao_mapeados: itensNaoMapeados,
    tempos
  };
}

async function sincronizarBaixaPorPronto(vendaId) {
  const venda = await VendaModel.obterPorId(vendaId);
  if (!venda) throw new Error('Venda não encontrada');
  const cfg = await obterConfigIfood();
  if (String(venda.origem || '').toLowerCase() !== 'ifood') {
    throw new Error('A venda informada não é iFood');
  }
  const baixados = cfg.inventory_mode === 'ao_pronto' ? await baixarEstoquePendentesDaVenda(venda.id) : 0;
  await VendaModel.atualizar(venda.id, {
    status: 'pronta',
    entrega_status_texto: venda.entrega_status_texto || 'pronta'
  });
  broadcast('venda.status', { id: venda.id, status: 'pronta', origem: 'ifood' });
  return { venda_id: venda.id, itens_baixados: baixados };
}

async function encontrarTenantIfoodPorMerchantId(merchantId) {
  const alvo = String(merchantId || '').trim();
  if (!alvo) return null;
  const tenants = await listTenants();
  for (const tenant of tenants || []) {
    let encontrado = null;
    await initializeTenantDatabase(tenant.code);
    await runWithTenant(tenant.code, async () => {
      const cfg = await obterConfigIfood();
      if (cfg.ativo && String(cfg.merchant_id || '').trim() === alvo) {
        encontrado = tenant.code;
      }
    });
    if (encontrado) return encontrado;
  }
  return null;
}

async function processarEventoIfood(evento, cfg = null) {
  const config = cfg || await obterConfigIfood();
  const eventId = String(evento?.eventId || evento?.id || evento?.event_id || '').trim();
  if (eventId && await webhookJaProcessado(eventId)) {
    return { skipped: true, reason: 'duplicado' };
  }
  const orderId = String(
    evento?.orderId
    || evento?.resourceId
    || evento?.data?.orderId
    || evento?.payload?.orderId
    || evento?.data?.id
    || evento?.id
    || ''
  ).trim();
  const eventType = String(evento?.type || evento?.eventType || evento?.event || '').trim();

  if (!orderId && eventId) {
    await marcarWebhookProcessado({ eventId, orderId: null, eventType });
    return { skipped: true, reason: 'sem_order_id' };
  }

  const detalhes = await buscarPedidoDetalhadoIfood(orderId, config);
  const resultado = await processarPedidoIfood({
    event: evento,
    order: detalhes,
    status: detalhes?.status || evento?.status || eventType
  });

  if (eventId) {
    await marcarWebhookProcessado({ eventId, orderId, eventType });
  }

  return resultado;
}

async function processarWebhookIfood(payload, rawBody, signatureHeader) {
  const cfg = await obterConfigIfood();
  if (payload?.code === 'KEEPALIVE' || payload?.event === 'KEEPALIVE') {
    return { keepalive: true };
  }

  if (cfg.client_secret) {
    const assinaturaEsperada = calcularAssinaturaIfood(rawBody, cfg.client_secret);
    const assinaturaRecebida = String(signatureHeader || '').trim().toLowerCase();
    if (!assinaturaRecebida || assinaturaRecebida !== assinaturaEsperada.toLowerCase()) {
      throw new Error('Assinatura do webhook inválida');
    }
  }

  return processarEventoIfood(payload, cfg);
}

async function processarWebhookIfoodPublic(payload, rawBody, signatureHeader) {
  if (payload?.code === 'KEEPALIVE' || payload?.event === 'KEEPALIVE') {
    return { keepalive: true };
  }

  const merchantId = extrairMerchantId(payload);
  if (!merchantId) {
    throw new Error('Webhook iFood sem merchantId identificável');
  }

  const tenantCode = await encontrarTenantIfoodPorMerchantId(merchantId);
  if (!tenantCode) {
    throw new Error(`Nenhum tenant associado ao merchantId ${merchantId}`);
  }

  await initializeTenantDatabase(tenantCode);
  return runWithTenant(tenantCode, () => processarWebhookIfood(payload, rawBody, signatureHeader));
}

async function sincronizarEventosIfood() {
  const tenants = await listTenants();
  const resultados = [];
  for (const tenant of tenants || []) {
    const code = tenant.code;
    await initializeTenantDatabase(code);
    await runWithTenant(code, async () => {
      const cfg = await obterConfigIfood();
      if (!cfg.ativo || !cfg.access_token || !cfg.merchant_id) return;
      let eventos = null;
      try {
        eventos = await listarEventosIfood(cfg);
      } catch (error) {
        if (error.status === 401 && cfg.refresh_token) {
          await renovarTokenIfood();
          const reloaded = await obterConfigIfood();
          eventos = await listarEventosIfood(reloaded);
        } else {
          throw new Error(descreverErroIfood(error));
        }
      }

      const lista = Array.isArray(eventos?.events) ? eventos.events : Array.isArray(eventos) ? eventos : [];
      const eventIds = [];
      for (const evento of lista) {
        const eventId = String(evento?.eventId || evento?.id || '').trim();
        if (!eventId) continue;
        if (await webhookJaProcessado(eventId)) continue;
        try {
          await processarEventoIfood(evento, cfg);
          eventIds.push(eventId);
        } catch (error) {
          console.warn(`Falha ao processar evento iFood (${code}):`, descreverErroIfood(error));
        }
      }
      if (eventIds.length) {
        try {
          await ackEventosIfood(eventIds, cfg);
        } catch (error) {
          console.warn(`Falha ao ack dos eventos iFood (${code}):`, descreverErroIfood(error));
        }
      }
      resultados.push({ tenant: code, eventos_processados: eventIds.length });
    });
  }
  return resultados;
}

let pollingIfoodTimer = null;
let pollingIfoodRunning = false;

function iniciarPollingIfood({ intervalMs = 30000 } = {}) {
  if (pollingIfoodTimer) return pollingIfoodTimer;
  const tick = async () => {
    if (pollingIfoodRunning) return;
    pollingIfoodRunning = true;
    try {
      await sincronizarEventosIfood();
    } catch (error) {
      console.warn('Falha no polling iFood:', descreverErroIfood(error));
    } finally {
      pollingIfoodRunning = false;
    }
  };
  void tick();
  pollingIfoodTimer = setInterval(() => {
    void tick();
  }, intervalMs);
  return pollingIfoodTimer;
}

export {
  obterConfigIfood,
  salvarConfigIfood,
  iniciarLoginIfood,
  finalizarLoginIfood,
  renovarTokenIfood,
  processarWebhookIfood,
  processarWebhookIfoodPublic,
  sincronizarEventosIfood,
  iniciarPollingIfood,
  processarPedidoIfood,
  sincronizarBaixaPorPronto,
  baixarEstoquePendentesDaVenda,
  formatarNomeComanda
};
