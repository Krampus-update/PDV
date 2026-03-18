import VendaModel from '../models/VendaModel.js';
import VendaItemModel from '../models/VendaItemModel.js';
import CategoriaModel from '../models/CategoriaModel.js';
import ProdutoModel from '../models/ProdutoModel.js';
import PromocaoModel from '../models/PromocaoModel.js';
import HistoricoModel from '../models/HistoricoModel.js';
import CaixaModel from '../models/CaixaModel.js';
import { broadcast } from '../services/realtimeService.js';
import { gerarPixCobranca } from '../services/pixService.js';
import { processarPagamento } from '../services/paymentGatewayService.js';
import {
  obterConfiguracao as obterConfigImpressao,
  imprimirVenda as imprimirVendaTermica
} from '../services/thermalPrinterService.js';

// considera produto avulso qualquer item com nome iniciando por "Avulso" ou
// com estoque muito alto (marca temporários gerados para venda avulsa).
function isAvulso(produto){
  return (produto.nome && produto.nome.startsWith('Avulso')) || produto.estoque >= 9999;
}

function normalizarTexto(v) {
  return String(v || '').trim().toLowerCase();
}

function parseOpcoesProduto(produto) {
  try {
    const arr = JSON.parse(produto?.opcoes_json || '[]');
    if (!Array.isArray(arr)) return [];
    return arr
      .map((o) => ({
        nome: String(o?.nome || '').trim(),
        extra: Number(o?.extra || 0) || 0,
        consumo: Math.max(1, Number(o?.consumo || 1)),
        estoque: o?.estoque === null || o?.estoque === undefined || o?.estoque === '' ? null : Math.max(0, Number(o?.estoque) || 0)
      }))
      .filter((o) => o.nome);
  } catch {
    return [];
  }
}

function acharOpcaoProduto(produto, observacoes) {
  const obs = normalizarTexto(observacoes);
  if (!obs) return null;
  return parseOpcoesProduto(produto).find((o) => normalizarTexto(o.nome) === obs) || null;
}

async function ajustarEstoqueOpcaoProduto(produtoId, nomeOpcao, delta) {
  if (!nomeOpcao) return;
  const produto = await ProdutoModel.obterPorId(produtoId);
  if (!produto) return;
  const opcoes = parseOpcoesProduto(produto);
  const idx = opcoes.findIndex((o) => normalizarTexto(o.nome) === normalizarTexto(nomeOpcao));
  if (idx < 0) return;
  const atual = opcoes[idx];
  if (atual.estoque === null || atual.estoque === undefined) return;
  const novo = Math.max(0, Number(atual.estoque || 0) + Number(delta || 0));
  opcoes[idx] = { ...atual, estoque: novo };
  await ProdutoModel.atualizar(produtoId, { opcoes_json: JSON.stringify(opcoes) });
}

async function registrarHistorico(acao, entidade_id, detalhes = null) {
  try {
    await HistoricoModel.registrar({
      tipo_entidade: 'venda',
      entidade_id,
      acao,
      detalhes
    });
  } catch (e) {
    console.warn('Falha ao registrar histórico de venda:', e.message);
  }
}

async function produtoVaiParaCozinha(produto) {
  if (!produto) return false;
  if (Number(produto.vai_cozinha) === 1) return true;
  const categoria = await CategoriaModel.obterPorNome(produto.categoria);
  return Number(categoria?.vai_cozinha || 0) === 1;
}

async function tentarImpressaoAutomatica({ vendaId, tipo, flag }) {
  try {
    const cfg = await obterConfigImpressao();
    if (!cfg?.habilitada || !cfg?.[flag]) return;
    const venda = await VendaModel.obterPorId(vendaId);
    if (!venda) return;
    const itens = await VendaItemModel.obterPorVenda(vendaId);
    await imprimirVendaTermica(venda, itens, tipo);
  } catch (e) {
    console.warn(`Falha na impressão automática (${flag}):`, e.message);
  }
}

class VendaController {
  static promocaoAtivaNoMomento(promo) {
    if (!promo || Number(promo.ativo || 0) !== 1) return false;
    const now = Date.now();
    if (promo.data_inicio && new Date(promo.data_inicio).getTime() > now) return false;
    if (promo.data_fim && new Date(promo.data_fim).getTime() < now) return false;
    return true;
  }

  static normalizarCategoria(valor) {
    const v = String(valor || '').trim().toLowerCase();
    return v || 'geral';
  }

  static calcularDesconto({ venda, itens, desconto_tipo, desconto_valor }) {
    const bruto = Number(venda?.subtotal_bruto || venda?.total || 0);
    const tipo = String(desconto_tipo || '').trim().toLowerCase();
    const valor = Number(desconto_valor || 0);
    if (!tipo || ['nenhum', 'none', 'null'].includes(tipo)) return 0;
    if (tipo === 'percentual') {
      return valor > 0 ? Math.min(bruto, (bruto * valor) / 100) : 0;
    }
    if (tipo === 'fixo') {
      return valor > 0 ? Math.min(bruto, valor) : 0;
    }
    if (tipo === 'leve3pague2') {
      const grupos = new Map();
      for (const item of itens || []) {
        const key = `${item.produto_id}|${Number(item.preco_unitario || 0)}`;
        if (!grupos.has(key)) grupos.set(key, []);
        grupos.get(key).push(item);
      }
      let desconto = 0;
      for (const group of grupos.values()) {
        const quantidade = group.reduce((sum, it) => sum + Number(it.quantidade || 0), 0);
        if (quantidade < 3) continue;
        const preco = Number(group[0]?.preco_unitario || 0);
        desconto += preco * Math.floor(quantidade / 3);
      }
      return Math.min(bruto, desconto);
    }
    return 0;
  }

  static async calcularDescontoPromocao({ venda, itens, promocao_id }) {
    const bruto = Number(venda?.subtotal_bruto || venda?.total || 0);
    const promo = await PromocaoModel.obterPorId(promocao_id);
    if (!VendaController.promocaoAtivaNoMomento(promo)) return { desconto: 0, promocao: null };

    if (String(promo.tipo || '') === 'combo_produto') {
      const itensProduto = (itens || []).filter((i) => Number(i.produto_id) === Number(promo.produto_id));
      if (!itensProduto.length) return { desconto: 0, promocao: promo };
      const qtd = itensProduto.reduce((sum, i) => sum + Number(i.quantidade || 0), 0);
      const subtotalProduto = itensProduto.reduce((sum, i) => sum + Number(i.subtotal || 0), 0);
      const unit = qtd > 0 ? subtotalProduto / qtd : 0;
      const packQtd = Math.max(1, Number(promo.quantidade_min || 0));
      const comboPrice = Number(promo.preco_combo || 0);
      if (qtd < packQtd || comboPrice <= 0) return { desconto: 0, promocao: promo };
      const aplicarRepetidamente = Number(promo.repetir_na_venda ?? 1) === 1;
      const groups = aplicarRepetidamente ? Math.floor(qtd / packQtd) : 1;
      const precoNormalGroups = groups * packQtd * unit;
      const precoComboGroups = groups * comboPrice;
      const desconto = Math.max(0, precoNormalGroups - precoComboGroups);
      return { desconto: Math.min(bruto, desconto), promocao: promo };
    }

    if (String(promo.tipo || '') === 'combo_categoria') {
      const categoriaPromo = VendaController.normalizarCategoria(promo.categoria);
      const itensCategoria = (itens || []).filter(
        (i) => VendaController.normalizarCategoria(i.produto_categoria) === categoriaPromo
      );
      if (!itensCategoria.length) return { desconto: 0, promocao: promo };
      const totalConsumo = itensCategoria.reduce(
        (sum, i) => sum + Number(i.quantidade || 0) * Math.max(1, Number(i.consumo_estoque || 1)),
        0
      );
      const subtotalCategoria = itensCategoria.reduce((sum, i) => sum + Number(i.subtotal || 0), 0);
      const packQtd = Math.max(1, Number(promo.quantidade_min || 0));
      const comboPrice = Number(promo.preco_combo || 0);
      if (totalConsumo < packQtd || comboPrice <= 0) return { desconto: 0, promocao: promo };
      const aplicarRepetidamente = Number(promo.repetir_na_venda ?? 1) === 1;
      const groups = aplicarRepetidamente ? Math.floor(totalConsumo / packQtd) : 1;
      const unit = totalConsumo > 0 ? subtotalCategoria / totalConsumo : 0;
      const precoNormalGroups = groups * packQtd * unit;
      const precoComboGroups = groups * comboPrice;
      const desconto = Math.max(0, precoNormalGroups - precoComboGroups);
      return { desconto: Math.min(bruto, desconto), promocao: promo };
    }

    return { desconto: 0, promocao: promo };
  }

  static async calcularMelhorPromocaoAutomatica({ venda, itens }) {
    const promocoes = await PromocaoModel.listar({ ativo: true });
    let melhor = { desconto: 0, promocao: null };
    for (const promo of promocoes || []) {
      if (!VendaController.promocaoAtivaNoMomento(promo)) continue;
      const calc = await VendaController.calcularDescontoPromocao({
        venda,
        itens,
        promocao_id: promo.id
      });
      if (Number(calc.desconto || 0) > Number(melhor.desconto || 0)) {
        melhor = calc;
      }
    }
    return melhor;
  }

  static async aplicarPromocaoAutomaticaSeElegivel(vendaId) {
    const vendaBase = await VendaModel.obterPorId(vendaId);
    if (!vendaBase || String(vendaBase.status) === 'fechada') return null;
    const tipoAtual = String(vendaBase.desconto_tipo || 'nenhum').toLowerCase();
    const ehManual = ['percentual', 'fixo', 'leve3pague2'].includes(tipoAtual);
    if (ehManual) return vendaBase;

    await VendaModel.obterTotal(vendaId);
    const venda = await VendaModel.obterPorId(vendaId);
    const itens = await VendaItemModel.obterPorVenda(vendaId);
    const melhor = await VendaController.calcularMelhorPromocaoAutomatica({ venda, itens });
    const desconto = Number(melhor.desconto || 0);

    if (desconto > 0) {
      await VendaModel.atualizar(vendaId, {
        desconto_tipo: 'promocao',
        desconto_valor: desconto,
        desconto_descricao: melhor.promocao?.nome || 'Promoção automática',
        promocao_aplicada_id: melhor.promocao?.id || null
      });
    } else {
      await VendaModel.atualizar(vendaId, {
        desconto_tipo: 'nenhum',
        desconto_valor: 0,
        desconto_descricao: null,
        promocao_aplicada_id: null
      });
    }
    await VendaModel.obterTotal(vendaId);
    const atualizada = await VendaModel.obterPorId(vendaId);
    broadcast('venda.atualizada', { id: Number(vendaId), total: Number(atualizada.total || 0) });
    return atualizada;
  }

  static async aplicarFinanceiro(req, res) {
    try {
      const { id } = req.params;
      const venda = await VendaModel.obterPorId(id);
      if (!venda) return res.status(404).json({ error: 'Venda não encontrada' });
      if (String(venda.status) === 'fechada') return res.status(400).json({ error: 'Venda já fechada' });

      const itens = await VendaItemModel.obterPorVenda(id);
      await VendaModel.obterTotal(id);
      const atual = await VendaModel.obterPorId(id);

      const descontoTipo = String(req.body?.desconto_tipo || atual.desconto_tipo || 'nenhum').toLowerCase();
      const promocaoIdReq = req.body?.promocao_id || atual.promocao_aplicada_id || null;
      let descontoCalculado = 0;
      let promocaoAplicadaId = null;
      if (descontoTipo === 'promocao') {
        if (!promocaoIdReq) {
          const auto = await VendaController.calcularMelhorPromocaoAutomatica({ venda: atual, itens });
          descontoCalculado = Number(auto.desconto || 0);
          promocaoAplicadaId = auto.promocao?.id || null;
        } else {
          const promoCalc = await VendaController.calcularDescontoPromocao({
            venda: atual,
            itens,
            promocao_id: promocaoIdReq
          });
          descontoCalculado = Number(promoCalc.desconto || 0);
          promocaoAplicadaId = promoCalc.promocao?.id || null;
        }
      } else if (descontoTipo === 'nenhum') {
        const auto = await VendaController.calcularMelhorPromocaoAutomatica({ venda: atual, itens });
        descontoCalculado = Number(auto.desconto || 0);
        if (descontoCalculado > 0) {
          promocaoAplicadaId = auto.promocao?.id || null;
        }
      } else {
        descontoCalculado = VendaController.calcularDesconto({
          venda: atual,
          itens,
          desconto_tipo: descontoTipo,
          desconto_valor: req.body?.desconto_valor ?? atual.desconto_valor ?? 0
        });
      }
      const acrescimoValor = Math.max(0, Number(req.body?.acrescimo_valor ?? atual.acrescimo_valor ?? 0));

      const splitMode = req.body?.split_mode ? String(req.body.split_mode) : atual.split_mode || null;
      let splitPayload = atual.split_payload_json || null;
      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'split_payload_json')) {
        const payloadRaw = req.body?.split_payload_json;
        splitPayload = payloadRaw ? JSON.stringify(payloadRaw) : null;
      }

      await VendaModel.atualizar(id, {
        desconto_tipo: descontoTipo === 'nenhum' && descontoCalculado > 0 ? 'promocao' : descontoTipo,
        desconto_valor: descontoCalculado,
        desconto_descricao:
          descontoTipo === 'nenhum' && descontoCalculado > 0
            ? (promocaoAplicadaId ? `Promoção #${promocaoAplicadaId}` : 'Promoção automática')
            : (req.body?.desconto_descricao || atual.desconto_descricao || null),
        promocao_aplicada_id: promocaoAplicadaId,
        acrescimo_valor: acrescimoValor,
        split_mode: splitMode,
        split_payload_json: splitPayload
      });
      const totalFinal = await VendaModel.obterTotal(id);
      const vendaAtualizada = await VendaModel.obterPorId(id);
      await registrarHistorico('venda_financeiro_atualizado', Number(id), {
        desconto_tipo: descontoTipo,
        desconto_valor: descontoCalculado,
        acrescimo_valor: acrescimoValor,
        total: totalFinal
      });
      broadcast('venda.atualizada', { id: Number(id), total: totalFinal });
      res.json({ venda: vendaAtualizada, total: totalFinal });
    } catch (error) {
      console.error('Erro ao aplicar financeiro na venda:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async simularDivisao(req, res) {
    try {
      const { id } = req.params;
      const venda = await VendaModel.obterPorId(id);
      if (!venda) return res.status(404).json({ error: 'Venda não encontrada' });
      const itens = await VendaItemModel.obterPorVenda(id);
      const modo = String(req.body?.modo || 'valor_igual').toLowerCase();
      const pessoas = Math.max(1, Number(req.body?.pessoas || 1));
      const total = Number(venda.total || 0);

      if (modo === 'valor_igual') {
        const base = total / pessoas;
        const parcelas = Array.from({ length: pessoas }).map((_, idx) => ({
          pessoa: idx + 1,
          valor: Number(base.toFixed(2))
        }));
        const soma = parcelas.reduce((s, p) => s + p.valor, 0);
        const diff = Number((total - soma).toFixed(2));
        if (parcelas.length && diff !== 0) {
          parcelas[parcelas.length - 1].valor = Number((parcelas[parcelas.length - 1].valor + diff).toFixed(2));
        }
        return res.json({ modo, parcelas });
      }

      if (modo === 'por_item') {
        const payload = req.body?.split_payload_json || null;
        if (payload && Array.isArray(payload.itens)) {
          let totalSelecionado = 0;
          const itensSelecionados = [];
          for (const sel of payload.itens) {
            const item = itens.find((x) => Number(x.id) === Number(sel.item_id));
            if (!item) continue;
            const qtdMax = Number(item.quantidade || 0);
            const qtdSel = Math.max(0, Math.min(qtdMax, Number(sel.quantidade || 0)));
            if (qtdSel <= 0) continue;
            const valor = Number((qtdSel * Number(item.preco_unitario || 0)).toFixed(2));
            totalSelecionado += valor;
            itensSelecionados.push({
              item_id: Number(item.id),
              produto_nome: item.produto_nome,
              quantidade: qtdSel,
              valor
            });
          }
          totalSelecionado = Number(totalSelecionado.toFixed(2));
          return res.json({
            modo,
            parcelas: [
              { pessoa: 1, itens: itensSelecionados, total: totalSelecionado },
              { pessoa: 2, itens: [], total: Number((total - totalSelecionado).toFixed(2)) }
            ]
          });
        }

        const grupos = Array.from({ length: pessoas }).map((_, idx) => ({ pessoa: idx + 1, itens: [], total: 0 }));
        let cursor = 0;
        for (const item of itens) {
          const qtd = Number(item.quantidade || 0);
          const unit = Number(item.preco_unitario || 0);
          for (let i = 0; i < qtd; i++) {
            const g = grupos[cursor % pessoas];
            g.itens.push({ produto_nome: item.produto_nome, valor: unit });
            g.total += unit;
            cursor++;
          }
        }
        grupos.forEach((g) => {
          g.total = Number(g.total.toFixed(2));
        });
        return res.json({ modo, parcelas: grupos });
      }

      return res.status(400).json({ error: 'Modo de divisão inválido' });
    } catch (error) {
      console.error('Erro ao simular divisão:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async criar(req, res) {
    try {
      const { tipo, mesa, cliente_id } = req.body;

      if (!tipo || !['bar', 'fastfood'].includes(tipo)) {
        return res.status(400).json({ error: 'Tipo é obrigatório (bar ou fastfood)' });
      }

      const caixaAberto = await CaixaModel.obterAberto();
      const venda = await VendaModel.criar({
        tipo,
        status: tipo === 'fastfood' ? 'em_preparo' : 'aberta',
        mesa: mesa || null,
        cliente_id: cliente_id || null,
        caixa_sessao_id: caixaAberto?.id || null
      });

      res.status(201).json(venda);
      await registrarHistorico('venda_criada', venda.id, { tipo, mesa: mesa || null, cliente_id: cliente_id || null });
      broadcast('venda.criada', venda);
    } catch (error) {
      console.error('Erro ao criar venda:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async obterPorId(req, res) {
    try {
      const { id } = req.params;
      const venda = await VendaModel.obterPorId(id);

      if (!venda) {
        return res.status(404).json({ error: 'Venda não encontrada' });
      }

      const itens = await VendaItemModel.obterPorVenda(id);
      res.json({ ...venda, itens });
    } catch (error) {
      console.error('Erro ao obter venda:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async obterTodas(req, res) {
    try {
      const { tipo, status, data_inicio, data_fim } = req.query;
      const vendas = await VendaModel.obterTodas({ tipo, status, data_inicio, data_fim });
      res.json(vendas);
    } catch (error) {
      console.error('Erro ao obter vendas:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async obterAbertas(req, res) {
    try {
      const { tipo } = req.query;
      const vendas = await VendaModel.obertasAbertas(tipo);
      res.json(vendas);
    } catch (error) {
      console.error('Erro ao obter vendas abertas:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async obterEmPreparo(req, res) {
    try {
      const { status } = req.query;
      const vendas = status ? await VendaModel.obterParaProducao(status) : await VendaModel.obterEmPreparo();
      
      // Enriquecer com itens
      const vendasComItens = await Promise.all(
        vendas.map(async (venda) => {
          const itens = (await VendaItemModel.obterPorVenda(venda.id)).filter((i) => Number(i.produto_vai_cozinha) === 1);
          return { ...venda, itens };
        })
      );

      res.json(vendasComItens);
    } catch (error) {
      console.error('Erro ao obter pedidos em preparo:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async adicionarItem(req, res) {
    try {
      const { id } = req.params;
      const { produto_id, quantidade, observacoes, preco_unitario_override } = req.body;
      const consumoRaw = req.body?.consumo_estoque ?? req.body?.estoque_consumo ?? 1;
      const consumo = Math.max(1, Number(consumoRaw || 1));

      if (!produto_id || !quantidade) {
        return res.status(400).json({ error: 'produto_id e quantidade são obrigatórios' });
      }

      const venda = await VendaModel.obterPorId(id);
      if (!venda) {
        return res.status(404).json({ error: 'Venda não encontrada' });
      }

      const produto = await ProdutoModel.obterPorId(produto_id);
      if (!produto) {
        return res.status(404).json({ error: 'Produto não encontrado' });
      }
      const opcaoSelecionada = acharOpcaoProduto(produto, observacoes);

      // verifica se produto é temporário/avulso (não controla estoque)
      const avulso = isAvulso(produto);
      if(!avulso){
        // Protege contra produtos sem estoque ou inativos
        if(!produto.ativo){
          return res.status(400).json({ error: 'Produto indisponível' });
        }
        if (produto.estoque <= 0) {
          return res.status(400).json({ error: 'Produto sem estoque' });
        }
        if (produto.estoque < quantidade) {
          return res.status(400).json({ error: 'Estoque insuficiente' });
        }
        if (opcaoSelecionada && opcaoSelecionada.estoque !== null && Number(opcaoSelecionada.estoque) < qtd) {
          return res.status(400).json({ error: `Variação "${opcaoSelecionada.nome}" sem estoque suficiente` });
        }
      }

      const qtd = parseInt(quantidade, 10);
      if (!qtd || qtd < 1) {
        return res.status(400).json({ error: 'Quantidade inválida' });
      }

      const obsNorm = String(observacoes || '').trim() || null;
      const override = Number.parseFloat(preco_unitario_override);
      let precoUnitario = Number.isFinite(override) && override > 0 ? override : Number(produto.preco);
      if (!Number.isFinite(override) || override <= 0) {
        const promoTipo = String(produto.promocao_tipo || 'nenhuma').toLowerCase();
        let promoValor = 0;
        try {
          promoValor = Number(JSON.parse(produto.promocao_param_json || '{}')?.valor || 0);
        } catch {
          promoValor = 0;
        }
        if (promoTipo === 'percentual' && promoValor > 0) {
          precoUnitario = Math.max(0, Number((precoUnitario * (1 - promoValor / 100)).toFixed(2)));
        } else if (promoTipo === 'fixo' && promoValor > 0) {
          precoUnitario = Math.max(0, Number((precoUnitario - promoValor).toFixed(2)));
        }
      }

      // se já existir item equivalente (mesmo produto, mesmo preço e mesma observação), apenas atualiza a quantidade
      const itensVenda = await VendaItemModel.obterPorVenda(id);
      const existente = itensVenda.find(
        (i) =>
          String(i.produto_id) === String(produto_id) &&
          Number(i.preco_unitario) === Number(precoUnitario) &&
          String(i.observacoes || '').trim() === String(obsNorm || '').trim() &&
          Number(i.consumo_estoque || 1) === Number(consumo || 1)
      );
      if(existente){
        const novaQtd = existente.quantidade + qtd;
        const novoSubtotal = existente.preco_unitario * novaQtd;
        await VendaItemModel.atualizar(existente.id, { quantidade: novaQtd, subtotal: novoSubtotal });
        if(!avulso){
          await ProdutoModel.atualizarEstoque(produto_id, -(qtd * consumo));
        }
        await VendaModel.obterTotal(id);
        await VendaController.aplicarPromocaoAutomaticaSeElegivel(id);
        if ((await produtoVaiParaCozinha(produto)) && ['aberta', 'pronta'].includes(venda.status)) {
          await VendaModel.atualizar(id, { status: 'em_preparo' });
          broadcast('venda.status', { id: parseInt(id, 10), status: 'em_preparo' });
        }
        await registrarHistorico('item_quantidade_incrementada', parseInt(id, 10), {
          item_id: existente.id,
          produto_id,
          quantidade_adicionada: qtd,
          observacoes: obsNorm
        });
        broadcast('venda.item', { venda_id: parseInt(id, 10), produto_id, acao: 'incrementado' });
        if (await produtoVaiParaCozinha(produto)) {
          await tentarImpressaoAutomatica({
            vendaId: parseInt(id, 10),
            tipo: 'cozinha',
            flag: 'auto_cozinha_item'
          });
        }
        return res.status(200).json({
          message: 'Quantidade de item atualizada',
          item_id: existente.id,
          subtotal: novoSubtotal
        });
      }

      // Calcular subtotal para novo item
      const subtotal = precoUnitario * qtd;

      // Adicionar item novo
      const itemId = await VendaItemModel.criar({
        venda_id: id,
        produto_id,
        quantidade: qtd,
        preco_unitario: precoUnitario,
        consumo_estoque: consumo,
        subtotal,
        observacoes: obsNorm
      });

      // Baixar estoque apenas se não tratar-se de avulso
      if(!avulso){
        await ProdutoModel.atualizarEstoque(produto_id, -(qtd * consumo));
        if (opcaoSelecionada) {
          await ajustarEstoqueOpcaoProduto(produto_id, opcaoSelecionada.nome, -qtd);
        }
      }

      // Atualizar total da venda
      await VendaModel.obterTotal(id);
      await VendaController.aplicarPromocaoAutomaticaSeElegivel(id);
      if ((await produtoVaiParaCozinha(produto)) && ['aberta', 'pronta'].includes(venda.status)) {
        await VendaModel.atualizar(id, { status: 'em_preparo' });
        broadcast('venda.status', { id: parseInt(id, 10), status: 'em_preparo' });
      }
      await registrarHistorico('item_adicionado', parseInt(id, 10), { item_id: itemId, produto_id, quantidade: qtd, observacoes: obsNorm, preco_unitario: precoUnitario });
      broadcast('venda.item', { venda_id: parseInt(id, 10), produto_id, item_id: itemId, acao: 'adicionado' });
      if (await produtoVaiParaCozinha(produto)) {
        await tentarImpressaoAutomatica({
          vendaId: parseInt(id, 10),
          tipo: 'cozinha',
          flag: 'auto_cozinha_item'
        });
      }

      res.status(201).json({
        message: 'Item adicionado com sucesso',
        item_id: itemId,
        subtotal
      });
    } catch (error) {
      console.error('Erro ao adicionar item:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async removerItem(req, res) {
    try {
      const { id, item_id } = req.params;

      const item = await VendaItemModel.obterPorId(item_id);
      if (!item) {
        return res.status(404).json({ error: 'Item não encontrado' });
      }

      // Devolver estoque
      const consumo = Math.max(1, Number(item.consumo_estoque || 1));
      await ProdutoModel.atualizarEstoque(item.produto_id, item.quantidade * consumo);
      const produtoItem = await ProdutoModel.obterPorId(item.produto_id);
      const opcaoItem = acharOpcaoProduto(produtoItem, item.observacoes);
      if (opcaoItem) {
        await ajustarEstoqueOpcaoProduto(item.produto_id, opcaoItem.nome, item.quantidade);
      }

      // Remover item
      await VendaItemModel.deletar(item_id);

      // Atualizar total
      await VendaModel.obterTotal(id);
      await VendaController.aplicarPromocaoAutomaticaSeElegivel(id);
      await registrarHistorico('item_removido', parseInt(id, 10), {
        item_id: parseInt(item_id, 10),
        produto_id: item.produto_id,
        quantidade: item.quantidade
      });
      broadcast('venda.item', { venda_id: parseInt(id, 10), item_id: parseInt(item_id, 10), acao: 'removido' });

      res.json({ message: 'Item removido com sucesso' });
    } catch (error) {
      console.error('Erro ao remover item:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async atualizarItem(req, res) {
    try {
      const { id, item_id } = req.params;
      const { quantidade } = req.body;

      if (!quantidade || quantidade < 1) {
        return res.status(400).json({ error: 'Quantidade deve ser maior que 0' });
      }

      const item = await VendaItemModel.obterPorId(item_id);
      if (!item) {
        return res.status(404).json({ error: 'Item não encontrado' });
      }
      const venda = await VendaModel.obterPorId(id);
      if (!venda) {
        return res.status(404).json({ error: 'Venda não encontrada' });
      }

      const produto = await ProdutoModel.obterPorId(item.produto_id);
      if (!produto) {
        return res.status(404).json({ error: 'Produto não encontrado' });
      }
      const opcaoItem = acharOpcaoProduto(produto, item.observacoes);

      // Verificar estoque (não para avulsos)
      const isAvulso = produto.nome.includes('Avulso') && produto.estoque >= 9999;
      if (!isAvulso) {
        const diferenca = quantidade - item.quantidade;
        const consumo = Math.max(1, Number(item.consumo_estoque || 1));
        if (diferenca > 0 && produto.estoque < diferenca * consumo) {
          return res.status(400).json({ error: 'Estoque insuficiente' });
        }
        if (opcaoItem && opcaoItem.estoque !== null && diferenca > 0 && Number(opcaoItem.estoque) < diferenca) {
          return res.status(400).json({ error: `Variação "${opcaoItem.nome}" sem estoque suficiente` });
        }
        // Ajustar estoque: se aumenta quantidade, baixa estoque; se diminui, devolve
        if (diferenca !== 0) {
          await ProdutoModel.atualizarEstoque(item.produto_id, -(diferenca * consumo));
          if (opcaoItem) {
            await ajustarEstoqueOpcaoProduto(item.produto_id, opcaoItem.nome, -diferenca);
          }
        }
      }

      // Atualizar item
      const novoSubtotal = item.preco_unitario * quantidade;
      await VendaItemModel.atualizar(item_id, {
        quantidade,
        subtotal: novoSubtotal
      });

      // Atualizar total
      await VendaModel.obterTotal(id);
      await VendaController.aplicarPromocaoAutomaticaSeElegivel(id);
      if ((await produtoVaiParaCozinha(produto)) && ['aberta', 'pronta'].includes(venda.status)) {
        await VendaModel.atualizar(id, { status: 'em_preparo' });
        broadcast('venda.status', { id: parseInt(id, 10), status: 'em_preparo' });
      }
      await registrarHistorico('item_atualizado', parseInt(id, 10), {
        item_id: parseInt(item_id, 10),
        quantidade
      });
      broadcast('venda.item', { venda_id: parseInt(id, 10), item_id: parseInt(item_id, 10), acao: 'atualizado' });
      if (await produtoVaiParaCozinha(produto)) {
        await tentarImpressaoAutomatica({
          vendaId: parseInt(id, 10),
          tipo: 'cozinha',
          flag: 'auto_cozinha_item'
        });
      }

      res.json({ message: 'Item atualizado com sucesso', quantidade, subtotal: novoSubtotal });
    } catch (error) {
      console.error('Erro ao atualizar item:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async fechar(req, res) {
    try {
      const { id } = req.params;
      const {
        forma_pagamento,
        valor_pago,
        pagamento_provider,
        split_mode,
        split_payload_json,
        desconto_tipo,
        desconto_valor,
        desconto_descricao,
        pix_gerar
      } = req.body || {};
      const promocaoIdReq = req.body?.promocao_id || null;

      if (!forma_pagamento) {
        return res.status(400).json({ error: 'Forma de pagamento é obrigatória' });
      }

      const venda = await VendaModel.obterPorId(id);
      if (!venda) {
        return res.status(404).json({ error: 'Venda não encontrada' });
      }

      if (desconto_tipo || desconto_valor || split_mode || split_payload_json) {
        const itens = await VendaItemModel.obterPorVenda(id);
        await VendaModel.obterTotal(id);
        const base = await VendaModel.obterPorId(id);
        const tipoDescontoAtual = desconto_tipo || base.desconto_tipo;
        let descontoCalculado = 0;
        let promocaoAplicadaId = base.promocao_aplicada_id || null;
        if (String(tipoDescontoAtual || '').toLowerCase() === 'promocao') {
          const promoAlvo = promocaoIdReq || base.promocao_aplicada_id || null;
          if (!promoAlvo) {
            return res.status(400).json({ error: 'Selecione uma promoção válida' });
          }
          const promoCalc = await VendaController.calcularDescontoPromocao({
            venda: base,
            itens,
            promocao_id: promoAlvo
          });
          descontoCalculado = Number(promoCalc.desconto || 0);
          promocaoAplicadaId = promoCalc.promocao?.id || null;
        } else {
          descontoCalculado = VendaController.calcularDesconto({
            venda: base,
            itens,
            desconto_tipo: tipoDescontoAtual,
            desconto_valor: desconto_valor ?? base.desconto_valor
          });
          promocaoAplicadaId = null;
        }
        await VendaModel.atualizar(id, {
          desconto_tipo: desconto_tipo || base.desconto_tipo || null,
          desconto_valor: descontoCalculado,
          desconto_descricao: desconto_descricao || base.desconto_descricao || null,
          promocao_aplicada_id: promocaoAplicadaId,
          split_mode: split_mode || base.split_mode || null,
          split_payload_json: Object.prototype.hasOwnProperty.call(req.body || {}, 'split_payload_json')
            ? (split_payload_json ? JSON.stringify(split_payload_json) : null)
            : (base.split_payload_json || null)
        });
      }
      await VendaController.aplicarPromocaoAutomaticaSeElegivel(id);

      const totalFinal = await VendaModel.obterTotal(id);
      const vendaFechamento = await VendaModel.obterPorId(id);
      const pago = valor_pago === null || valor_pago === undefined ? null : Number(valor_pago);
      const troco = pago !== null && pago > totalFinal ? Number((pago - totalFinal).toFixed(2)) : 0;

      const splitModeAtual = String(split_mode || vendaFechamento.split_mode || '').toLowerCase();
      const splitPayloadAtual = split_payload_json || vendaFechamento.split_payload_json || null;
      if (splitModeAtual === 'por_item' && splitPayloadAtual) {
        let payloadObj = splitPayloadAtual;
        if (typeof payloadObj === 'string') {
          try {
            payloadObj = JSON.parse(payloadObj);
          } catch {
            payloadObj = null;
          }
        }
        const itensSelecionados = Array.isArray(payloadObj?.itens) ? payloadObj.itens : [];
        if (itensSelecionados.length) {
          const itensVenda = await VendaItemModel.obterPorVenda(id);
          const ajustes = [];
          let totalSelecionado = 0;
          for (const sel of itensSelecionados) {
            const item = itensVenda.find((x) => Number(x.id) === Number(sel.item_id));
            if (!item) continue;
            const qtdAtual = Number(item.quantidade || 0);
            const qtdSel = Math.max(0, Math.min(qtdAtual, Number(sel.quantidade || 0)));
            if (qtdSel <= 0) continue;
            totalSelecionado += Number(item.preco_unitario || 0) * qtdSel;
            ajustes.push({ item, qtdSel, qtdAtual });
          }
          totalSelecionado = Number(totalSelecionado.toFixed(2));
          if (totalSelecionado > 0 && totalSelecionado < totalFinal) {
            for (const ajuste of ajustes) {
              if (ajuste.qtdSel >= ajuste.qtdAtual) {
                await VendaItemModel.deletar(ajuste.item.id);
              } else {
                const qtdRestante = ajuste.qtdAtual - ajuste.qtdSel;
                await VendaItemModel.atualizar(ajuste.item.id, {
                  quantidade: qtdRestante,
                  subtotal: Number((qtdRestante * Number(ajuste.item.preco_unitario || 0)).toFixed(2))
                });
              }
            }
            await VendaController.aplicarPromocaoAutomaticaSeElegivel(id);
            const totalRestante = await VendaModel.obterTotal(id);
            const vendaParcial = await VendaModel.obterPorId(id);
            await registrarHistorico('venda_pagamento_parcial', parseInt(id, 10), {
              forma_pagamento,
              valor_pago: totalSelecionado,
              total_restante: totalRestante
            });
            broadcast('venda.atualizada', { id: parseInt(id, 10), total: totalRestante, parcial: true });
            return res.json({
              message: 'Pagamento parcial aplicado',
              parcial: true,
              valor_pago_parcial: totalSelecionado,
              venda: vendaParcial
            });
          }
        }
      }

      let pagamentoStatus = null;
      let pagamentoTransacao = null;
      let providerUsado = pagamento_provider || null;
      if (['credito', 'debito'].includes(String(forma_pagamento || '').toLowerCase())) {
        const pg = await processarPagamento({
          vendaId: Number(id),
          valor: totalFinal,
          forma_pagamento,
          descricao: `Venda ${id}`
        });
        pagamentoStatus = pg.status;
        pagamentoTransacao = pg.transacao_id;
        providerUsado = pg.provider || providerUsado;
      }

      let pixPayload = null;
      let pixChave = null;
      if (String(forma_pagamento || '').toLowerCase() === 'pix' && pix_gerar) {
        try {
          const pix = await gerarPixCobranca({ vendaId: Number(id), valor: totalFinal, descricao: `Venda ${id}` });
          pixPayload = pix.payload;
          pixChave = pix.chave;
        } catch {
          // não bloqueia fechamento por falha de geração de QR
        }
      }

      await VendaModel.atualizar(id, {
        status: 'fechada',
        forma_pagamento,
        valor_pago: pago,
        troco_valor: troco,
        pagamento_provider: providerUsado,
        pagamento_status: pagamentoStatus,
        pagamento_transacao_id: pagamentoTransacao,
        pix_payload: pixPayload,
        pix_chave_utilizada: pixChave
      });
      if (!vendaFechamento.caixa_sessao_id) {
        const caixaAberto = await CaixaModel.obterAberto();
        if (caixaAberto?.id) {
          await VendaModel.atualizar(id, { caixa_sessao_id: caixaAberto.id });
        }
      }
      await registrarHistorico('venda_fechada', parseInt(id, 10), {
        forma_pagamento,
        total: totalFinal,
        valor_pago: pago,
        troco
      });
      broadcast('venda.status', { id: parseInt(id, 10), status: 'fechada' });
      await tentarImpressaoAutomatica({
        vendaId: parseInt(id, 10),
        tipo: 'balcao',
        flag: 'auto_fechamento'
      });

      const vendaFinal = await VendaModel.obterPorId(id);
      res.json({ message: 'Venda fechada com sucesso', venda: vendaFinal });
    } catch (error) {
      console.error('Erro ao fechar venda:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async marcarPronto(req, res) {
    try {
      const { id } = req.params;

      const venda = await VendaModel.obterPorId(id);
      if (!venda) {
        return res.status(404).json({ error: 'Venda não encontrada' });
      }

      await VendaModel.atualizar(id, { status: 'pronta' });
      await registrarHistorico('venda_marcada_pronta', parseInt(id, 10), null);
      broadcast('venda.status', { id: parseInt(id, 10), status: 'pronta' });

      res.json({ message: 'Pedido marcado como pronto' });
    } catch (error) {
      console.error('Erro ao marcar como pronto:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async atualizarStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['aberta', 'em_preparo', 'pronta', 'fechada'].includes(status)) {
        return res.status(400).json({ error: 'Status inválido' });
      }

      const venda = await VendaModel.obterPorId(id);
      if (!venda) {
        return res.status(404).json({ error: 'Venda não encontrada' });
      }

      await VendaModel.atualizar(id, { status });
      await registrarHistorico('status_atualizado', parseInt(id, 10), { status });
      broadcast('venda.status', { id: parseInt(id, 10), status });

      res.json({ message: 'Status atualizado com sucesso' });
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async vincularCliente(req, res) {
    try {
      const { id } = req.params;
      const { cliente_id } = req.body || {};
      const venda = await VendaModel.obterPorId(id);
      if (!venda) return res.status(404).json({ error: 'Venda não encontrada' });
      await VendaModel.atualizar(id, { cliente_id: cliente_id || null });
      const atualizada = await VendaModel.obterPorId(id);
      await registrarHistorico('venda_cliente_vinculado', parseInt(id, 10), { cliente_id: cliente_id || null });
      broadcast('venda.atualizada', { id: parseInt(id, 10), cliente_id: cliente_id || null });
      res.json({ message: 'Cliente vinculado com sucesso', venda: atualizada });
    } catch (error) {
      console.error('Erro ao vincular cliente na venda:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async reabrir(req, res) {
    try {
      const { id } = req.params;
      const venda = await VendaModel.obterPorId(id);
      if (!venda) return res.status(404).json({ error: 'Venda não encontrada' });
      if (venda.status !== 'fechada') {
        return res.status(400).json({ error: 'Somente vendas fechadas podem ser reabertas' });
      }
      await VendaModel.atualizar(id, {
        status: 'aberta',
        forma_pagamento: null,
        observacoes: venda.observacoes || null,
        valor_pago: null,
        troco_valor: null,
        pagamento_provider: null,
        pagamento_status: null,
        pagamento_transacao_id: null,
        pix_payload: null
      });
      await registrarHistorico('venda_reaberta', parseInt(id, 10), null);
      broadcast('venda.status', { id: parseInt(id, 10), status: 'aberta' });
      res.json({ message: 'Venda reaberta com sucesso' });
    } catch (error) {
      console.error('Erro ao reabrir venda:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

export default VendaController;
