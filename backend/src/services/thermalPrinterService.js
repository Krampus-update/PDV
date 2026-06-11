import net from 'net';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import ConfiguracaoModel from '../models/ConfiguracaoModel.js';

const DEFAULTS = {
  habilitada: false,
  tipo: 'rede',
  host: '',
  porta: 9100,
  impressora_local: '',
  auto_fechamento: false,
  auto_cozinha_item: false,
  nome: 'Impressora Termica',
  largura: 42,
  corte: true
};

const LEGACY_PREFIX = 'impressora_';
const PRINTER_FIELDS = [
  'auto_cozinha_item',
  'auto_fechamento',
  'impressora_local',
  'habilitada',
  'tipo',
  'host',
  'porta',
  'local',
  'nome',
  'largura',
  'corte'
].sort((a, b) => b.length - a.length);

function normalizeDestino(value, fallback = 'balcao') {
  const raw = String(value || fallback).toLowerCase().trim();
  const slug = raw
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/_+/g, '_')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}

function toBool(value, fallback = false) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const v = String(value).toLowerCase().trim();
  return v === '1' || v === 'true' || v === 'sim' || v === 'yes';
}

function toInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeConfig(raw = {}) {
  const cfg = {
    habilitada: toBool(raw.habilitada, DEFAULTS.habilitada),
    tipo: String(raw.tipo || DEFAULTS.tipo).toLowerCase().trim() === 'local' ? 'local' : 'rede',
    host: String(raw.host || '').trim(),
    porta: toInt(raw.porta, DEFAULTS.porta),
    impressora_local: String(raw.impressora_local || '').trim(),
    auto_fechamento: toBool(raw.auto_fechamento, DEFAULTS.auto_fechamento),
    auto_cozinha_item: toBool(raw.auto_cozinha_item, DEFAULTS.auto_cozinha_item),
    nome: String(raw.nome || DEFAULTS.nome).trim(),
    largura: toInt(raw.largura, DEFAULTS.largura),
    corte: toBool(raw.corte, DEFAULTS.corte)
  };
  if (cfg.largura < 32 || cfg.largura > 64) cfg.largura = DEFAULTS.largura;
  if (cfg.porta < 1 || cfg.porta > 65535) cfg.porta = DEFAULTS.porta;
  return cfg;
}

function getSectionValue(map, sectionPrefix, key, fallback = undefined) {
  const sectionKey = `${sectionPrefix}${key}`;
  if (Object.prototype.hasOwnProperty.call(map, sectionKey)) return map[sectionKey];
  const legacyKey = `${LEGACY_PREFIX}${key}`;
  if (Object.prototype.hasOwnProperty.call(map, legacyKey)) return map[legacyKey];
  return fallback;
}

async function obterConfiguracao(tipo = 'balcao') {
  const destino = normalizeDestino(tipo);
  const map = await ConfiguracaoModel.obterPorPrefixo(LEGACY_PREFIX);
  const sectionPrefix = `${LEGACY_PREFIX}${destino}_`;
  const nomePadrao = destino === 'balcao'
    ? 'Balcão / Fechamento'
    : destino === 'cozinha'
      ? 'Cozinha'
      : destino.replace(/_/g, ' ');
  return normalizeConfig({
    habilitada: getSectionValue(map, sectionPrefix, 'habilitada'),
    tipo: getSectionValue(map, sectionPrefix, 'tipo'),
    host: getSectionValue(map, sectionPrefix, 'host'),
    porta: getSectionValue(map, sectionPrefix, 'porta'),
    impressora_local: getSectionValue(map, sectionPrefix, 'local'),
    auto_fechamento: getSectionValue(map, sectionPrefix, 'auto_fechamento'),
    auto_cozinha_item: getSectionValue(map, sectionPrefix, 'auto_cozinha_item'),
    nome: getSectionValue(map, sectionPrefix, 'nome') || nomePadrao,
    largura: getSectionValue(map, sectionPrefix, 'largura'),
    corte: getSectionValue(map, sectionPrefix, 'corte')
  });
}

async function listarConfiguracoesImpressao() {
  const map = await ConfiguracaoModel.obterPorPrefixo(LEGACY_PREFIX);
  const destinos = new Set();
  for (const key of Object.keys(map)) {
    if (!key.startsWith(LEGACY_PREFIX)) continue;
    const remainder = key.slice(LEGACY_PREFIX.length);
    if (PRINTER_FIELDS.some((suffix) => remainder === suffix)) {
      destinos.add('balcao');
      continue;
    }
    const field = PRINTER_FIELDS.find((suffix) => remainder.endsWith(`_${suffix}`));
    if (!field) continue;
    const destinoRaw = remainder.slice(0, -(field.length + 1));
    if (!destinoRaw) continue;
    destinos.add(normalizeDestino(destinoRaw));
  }

  if (!destinos.size) destinos.add('balcao');

  const lista = [];
  for (const destino of Array.from(destinos).sort((a, b) => {
    if (a === 'balcao') return -1;
    if (b === 'balcao') return 1;
    if (a === 'cozinha') return -1;
    if (b === 'cozinha') return 1;
    return a.localeCompare(b, 'pt-BR');
  })) {
    const config = await obterConfiguracao(destino);
    lista.push({ destino, ...config });
  }
  return lista;
}

async function salvarConfiguracao(parcial = {}) {
  const destino = normalizeDestino(parcial.destino || parcial.tipo_destino || parcial.section || parcial.nome_destino || 'balcao');
  const atual = await obterConfiguracao(destino);
  const proxima = normalizeConfig({ ...atual, ...parcial });

  if (proxima.habilitada && proxima.tipo === 'rede' && !proxima.host) {
    throw new Error('Host da impressora é obrigatório no modo rede');
  }

  const prefix = `${LEGACY_PREFIX}${destino}_`;
  const writes = [
    ConfiguracaoModel.definir(`${prefix}habilitada`, proxima.habilitada ? '1' : '0'),
    ConfiguracaoModel.definir(`${prefix}tipo`, proxima.tipo),
    ConfiguracaoModel.definir(`${prefix}host`, proxima.host || ''),
    ConfiguracaoModel.definir(`${prefix}porta`, String(proxima.porta)),
    ConfiguracaoModel.definir(`${prefix}local`, proxima.impressora_local || ''),
    ConfiguracaoModel.definir(`${prefix}auto_fechamento`, proxima.auto_fechamento ? '1' : '0'),
    ConfiguracaoModel.definir(`${prefix}auto_cozinha_item`, proxima.auto_cozinha_item ? '1' : '0'),
    ConfiguracaoModel.definir(`${prefix}nome`, proxima.nome || DEFAULTS.nome),
    ConfiguracaoModel.definir(`${prefix}largura`, String(proxima.largura)),
    ConfiguracaoModel.definir(`${prefix}corte`, proxima.corte ? '1' : '0')
  ];

  if (destino === 'balcao') {
    writes.push(
      ConfiguracaoModel.definir('impressora_habilitada', proxima.habilitada ? '1' : '0'),
      ConfiguracaoModel.definir('impressora_tipo', proxima.tipo),
      ConfiguracaoModel.definir('impressora_host', proxima.host || ''),
      ConfiguracaoModel.definir('impressora_porta', String(proxima.porta)),
      ConfiguracaoModel.definir('impressora_local', proxima.impressora_local || ''),
      ConfiguracaoModel.definir('impressora_auto_fechamento', proxima.auto_fechamento ? '1' : '0'),
      ConfiguracaoModel.definir('impressora_auto_cozinha_item', proxima.auto_cozinha_item ? '1' : '0'),
      ConfiguracaoModel.definir('impressora_nome', proxima.nome || DEFAULTS.nome),
      ConfiguracaoModel.definir('impressora_largura', String(proxima.largura)),
      ConfiguracaoModel.definir('impressora_corte', proxima.corte ? '1' : '0')
    );
  }

  await Promise.all(writes);

  return { ...proxima, destino };
}

async function removerConfiguracao(destinoRaw) {
  const destino = normalizeDestino(destinoRaw);
  if (!destino) throw new Error('Destino inválido');
  const prefix = `${LEGACY_PREFIX}${destino}_`;
  const map = await ConfiguracaoModel.obterPorPrefixo(LEGACY_PREFIX);
  const keys = Object.keys(map).filter((key) => key.startsWith(prefix));
  if (destino === 'balcao') {
    keys.push(
      'impressora_habilitada',
      'impressora_tipo',
      'impressora_host',
      'impressora_porta',
      'impressora_local',
      'impressora_auto_fechamento',
      'impressora_auto_cozinha_item',
      'impressora_nome',
      'impressora_largura',
      'impressora_corte'
    );
  }
  const uniq = Array.from(new Set(keys));
  await Promise.all(uniq.map((chave) => ConfiguracaoModel.remover(chave)));
  return { destino };
}

function padRight(text, width) {
  const str = String(text || '');
  if (str.length >= width) return str.slice(0, width);
  return str + ' '.repeat(width - str.length);
}

function money(value) {
  return Number(value || 0).toFixed(2).replace('.', ',');
}

function plain(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E\n]/g, '');
}

function line(width, char = '-') {
  return char.repeat(Math.max(1, width));
}

function wrap(text, width) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const out = [];
  let current = '';
  for (const w of words) {
    const next = current ? `${current} ${w}` : w;
    if (next.length <= width) {
      current = next;
      continue;
    }
    if (current) out.push(current);
    current = w.length > width ? w.slice(0, width) : w;
  }
  if (current) out.push(current);
  return out;
}

function buildVendaTicket(venda, itens, cfg, tipo = 'balcao') {
  const width = cfg.largura;
  const now = new Date().toLocaleString('pt-BR');
  const ehCozinha = ['cozinha', 'prep', 'preparo'].includes(String(tipo || '').toLowerCase()) || /cozinha|kitchen|prep/i.test(cfg.nome || '');
  const mesa = venda.mesa ? `Mesa ${venda.mesa}` : null;
  const cliente = venda.cliente_nome ? String(venda.cliente_nome).trim() : '';
  const cabecalho = cliente
    ? `# Comanda ${cliente}`
    : mesa
      ? `# Comanda ${mesa.replace(/^Mesa\s+/i, '')}`
      : `# Comanda ${venda.id}`;

  const rows = [
    padRight(plain(cfg.nome).toUpperCase(), width),
    line(width, '='),
    padRight(titulo, width),
    plain(`${mesa}  ${now}`).slice(0, width),
    plain(`Status: ${venda.status}`).slice(0, width),
    line(width)
  ];

  let total = 0;
  const itensUsados = ehCozinha
    ? itens.filter((i) => Number(i.produto_vai_cozinha) === 1)
    : itens;

  if (!ehCozinha) {
    rows.push('Consumos'.slice(0, width));
    rows.push(line(width));
  }

  for (const item of itensUsados) {
    const qtd = Number(item.quantidade || 0);
    const unit = Number(item.preco_unitario || 0);
    const sub = Number(item.subtotal || qtd * unit);
    total += sub;
    const head = `${qtd}x ${item.produto_nome || 'Item'}`;
    rows.push(...wrap(plain(head), width));
    if (item.observacoes) rows.push(...wrap(plain(`  Obs: ${item.observacoes}`), width));
    if (tipo !== 'cozinha') {
      rows.push(`  R$ ${money(unit)} -> R$ ${money(sub)}`.slice(0, width));
    }
  }

  rows.push(line(width));
  if (!ehCozinha) {
    const bruto = Number(venda.subtotal_bruto || total);
    const desconto = Number(venda.desconto_valor || 0);
    const acrescimo = Number(venda.acrescimo_valor || 0);
    if (desconto > 0) rows.push(`Desconto: -R$ ${money(desconto)}`.slice(0, width));
    if (acrescimo > 0) rows.push(plain(`Acrescimo: +R$ ${money(acrescimo)}`).slice(0, width));
    rows.push(`Subtotal: R$ ${money(bruto)}`.slice(0, width));
    if (venda.forma_pagamento) rows.push(`${String(venda.forma_pagamento).toUpperCase()}`.slice(0, width));
    rows.push(`Total: R$ ${money(Number(venda.total || total))}`.slice(0, width));
    if (Number(venda.valor_pago || 0) > 0) rows.push(`Pago: R$ ${money(venda.valor_pago)}`.slice(0, width));
    if (Number(venda.troco_valor || 0) > 0) rows.push(`Troco: R$ ${money(venda.troco_valor)}`.slice(0, width));
    if (venda.split_mode) rows.push(plain(`Divisao: ${String(venda.split_mode)}`).slice(0, width));
    if (venda.pix_chave_utilizada) {
      rows.push(line(width));
      rows.push('PIX');
      rows.push(plain(`Chave: ${String(venda.pix_chave_utilizada)}`).slice(0, width));
      if (venda.pix_payload) {
        rows.push('Copia e cola:');
        rows.push(...wrap(plain(String(venda.pix_payload)), width));
      }
    }
  } else {
    rows.push(' ');
  }
  rows.push(line(width, '='));
  rows.push(' ');
  rows.push(' ');

  return rows.join('\n');
}

function buildTesteTicket(cfg, destino) {
  const width = cfg.largura;
  const modoCozinha = ['cozinha', 'prep', 'preparo'].includes(String(destino || '').toLowerCase()) || /cozinha|kitchen|prep/i.test(cfg.nome || '');
  const dataLine = `Data: ${new Date().toLocaleString('pt-BR')}`.slice(0, width);
  const rows = modoCozinha
    ? [
        line(width, '='),
        dataLine,
        line(width),
        ...wrap('Mesa 12 • Cliente Exemplo', width),
        ...wrap('2x Coxinha', width),
        line(width, '='),
        ' ',
        ' '
      ]
    : [
        line(width, '='),
        dataLine,
        line(width),
        ...wrap('Comanda 18', width),
        line(width),
        ...wrap('Coxinha R$ 12,00', width),
        ...wrap('Refrigerante R$ 8,00', width),
        line(width),
        'Subtotal: R$ 49,00'.slice(0, width),
        'Desconto: R$ 5,00'.slice(0, width),
        'PIX'.slice(0, width),
        'Total: R$ 44,00'.slice(0, width),
        line(width, '='),
        ' ',
        ' '
      ];
  return rows.join('\n');
}

function writeSocket(host, port, data, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let done = false;

    const finish = (err) => {
      if (done) return;
      done = true;
      socket.destroy();
      if (err) reject(err);
      else resolve();
    };

    socket.setTimeout(timeoutMs, () => finish(new Error('Timeout ao conectar na impressora')));
    socket.on('error', (err) => finish(err));
    socket.connect(port, host, () => {
      socket.write(data, (err) => {
        if (err) return finish(err);
        socket.end(() => finish());
      });
    });
  });
}

function montarPayload(texto, cfg) {
  const init = Buffer.from([0x1b, 0x40]); // ESC @
  const body = Buffer.from(`${plain(texto)}\n`, 'ascii');
  const cut = cfg.corte ? Buffer.from([0x1d, 0x56, 0x41, 0x10]) : Buffer.alloc(0); // GS V A n
  return Buffer.concat([init, body, cut]);
}

function execFileAsync(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(file, args, options, (error, stdout, stderr) => {
      if (error) {
        reject(new Error((stderr || stdout || error.message || 'Falha ao executar comando').trim()));
      } else {
        resolve({ stdout: String(stdout || ''), stderr: String(stderr || '') });
      }
    });
  });
}

function psEscape(value) {
  return String(value || '').replace(/'/g, "''");
}

async function imprimirLocalWindows(texto, cfg) {
  const tempPath = path.join(os.tmpdir(), `pdv-print-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
  await fs.writeFile(tempPath, `${texto}\n`, 'utf8');

  const printerName = String(cfg.impressora_local || '').trim();
  const cmd = printerName
    ? `$p='${psEscape(tempPath)}';$n='${psEscape(printerName)}';Get-Content -Raw -Encoding UTF8 $p | Out-Printer -Name $n`
    : `$p='${psEscape(tempPath)}';Get-Content -Raw -Encoding UTF8 $p | Out-Printer`;

  try {
    await execFileAsync('powershell.exe', ['-NoProfile', '-Command', cmd], { timeout: 12000 });
  } finally {
    await fs.unlink(tempPath).catch(() => {});
  }
}

async function imprimirTexto(texto, destino = 'balcao') {
  const cfg = await obterConfiguracao(destino);
  if (!cfg.habilitada) throw new Error('Impressão térmica está desabilitada');
  if (cfg.tipo === 'local') {
    await imprimirLocalWindows(texto, cfg);
    return cfg;
  }
  if (!cfg.host) throw new Error('Host da impressora não configurado');
  const payload = montarPayload(texto, cfg);
  await writeSocket(cfg.host, cfg.porta, payload);
  return cfg;
}

async function imprimirTeste(destino = 'balcao') {
  const cfg = await obterConfiguracao(destino);
  const texto = buildTesteTicket(cfg, destino);
  await imprimirTexto(texto, destino);
  return cfg;
}

async function imprimirVenda(venda, itens, tipo = 'balcao') {
  const destino = normalizeDestino(tipo);
  const cfg = await obterConfiguracao(destino);
  const texto = buildVendaTicket(venda, itens, cfg, tipo);
  await imprimirTexto(texto, destino);
  return cfg;
}

async function listarImpressorasLocais() {
  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-Command', 'Get-Printer | Select-Object -ExpandProperty Name'],
    { timeout: 8000 }
  );
  return stdout
    .split(/\r?\n/)
    .map((v) => v.trim())
    .filter(Boolean);
}

export {
  obterConfiguracao,
  listarConfiguracoesImpressao,
  salvarConfiguracao,
  removerConfiguracao,
  imprimirTeste,
  imprimirVenda,
  listarImpressorasLocais
};
