import ProdutoModel from '../models/ProdutoModel.js';
import CategoriaModel from '../models/CategoriaModel.js';
import HistoricoModel from '../models/HistoricoModel.js';
import { broadcast } from '../services/realtimeService.js';

function normalizarOpcoesJson(input) {
  if (!input) return null;
  try {
    const value = typeof input === 'string' ? JSON.parse(input) : input;
    if (!Array.isArray(value)) return null;
    const cleaned = value
      .map((o) => ({
        nome: String(o?.nome || '').trim(),
        extra: Number.parseFloat(o?.extra || 0) || 0,
        consumo: Math.max(1, Number(o?.consumo || 1)),
        estoque: o?.estoque === '' || o?.estoque === null || o?.estoque === undefined ? null : Math.max(0, Number.parseInt(o?.estoque, 10) || 0)
      }))
      .filter((o) => o.nome);
    if (!cleaned.length) return null;
    return JSON.stringify(cleaned);
  } catch {
    return null;
  }
}

async function registrarHistorico(acao, entidade_id, detalhes = null) {
  try {
    await HistoricoModel.registrar({
      tipo_entidade: 'produto',
      entidade_id,
      acao,
      detalhes
    });
  } catch (e) {
    console.warn('Falha ao registrar histórico de produto:', e.message);
  }
}

class ProdutoController {
  static async criar(req, res) {
    try {
      const { nome, preco, estoque, estoque_minimo, tipo, categoria, destaque, popularidade, opcoes_json, imagem, vai_cozinha } = req.body;

      if (!nome || !preco) {
        return res.status(400).json({ error: 'Nome e preço são obrigatórios' });
      }

      const categoriaNorm = String(categoria || 'geral').trim() || 'geral';
      await CategoriaModel.garantir(categoriaNorm);

      const id = await ProdutoModel.criar({
        nome,
        preco: parseFloat(preco),
        estoque: parseInt(estoque) || 0,
        estoque_minimo: parseInt(estoque_minimo) || 0,
        tipo: tipo || 'simples',
        categoria: categoriaNorm,
        destaque: destaque === true || destaque === 1 || destaque === '1',
        popularidade: parseInt(popularidade, 10) || 0,
        opcoes_json: normalizarOpcoesJson(opcoes_json),
        imagem: imagem || null,
        vai_cozinha: vai_cozinha === true || vai_cozinha === 1 || vai_cozinha === '1'
      });

      res.status(201).json({ 
        message: 'Produto criado com sucesso',
        id: id
      });
      await registrarHistorico('produto_criado', id, { nome, preco: parseFloat(preco) });
      broadcast('produto.criado', { id, nome });
    } catch (error) {
      console.error('Erro ao criar produto:', error);
      if (error.message.includes('UNIQUE')) {
        return res.status(400).json({ error: 'Produto com este nome já existe' });
      }
      res.status(500).json({ error: error.message });
    }
  }

  static async criarLote(req, res) {
    try {
      const itens = Array.isArray(req.body?.itens) ? req.body.itens : [];
      const categoria = String(req.body?.categoria || 'geral').trim() || 'geral';
      const criados = [];
      const ignorados = [];
      if (!itens.length) {
        return res.status(400).json({ error: 'Informe ao menos um produto' });
      }

      const existentes = await ProdutoModel.obterTodos(false);
      const nomesUsados = new Set((existentes || []).map((p) => String(p.nome || '').trim().toLowerCase()).filter(Boolean));

      for (const item of itens) {
        const nome = String(item?.nome || '').trim();
        const preco = Number.parseFloat(item?.preco || 0);
        if (!nome || !Number.isFinite(preco) || preco <= 0) continue;
        const chaveNome = nome.toLowerCase();
        if (nomesUsados.has(chaveNome)) {
          ignorados.push({ nome, motivo: 'Produto já cadastrado' });
          continue;
        }
        const id = await ProdutoModel.criar({
          nome,
          preco,
          estoque: parseInt(item?.estoque, 10) || 0,
          estoque_minimo: parseInt(item?.estoque_minimo, 10) || 0,
          tipo: 'simples',
          categoria,
          destaque: item?.destaque === true || item?.destaque === 1 || item?.destaque === '1',
          popularidade: parseInt(item?.popularidade, 10) || 0,
          opcoes_json: normalizarOpcoesJson(item?.opcoes_json),
          imagem: item?.imagem || null,
          vai_cozinha: item?.vai_cozinha === true || item?.vai_cozinha === 1 || item?.vai_cozinha === '1'
        });
        nomesUsados.add(chaveNome);
        criados.push({ id, nome });
        await registrarHistorico('produto_criado_lote', id, { nome, categoria, preco });
      }

      if (!criados.length && !ignorados.length) {
        return res.status(400).json({ error: 'Nenhum produto válido no lote' });
      }

      res.status(criados.length ? 201 : 200).json({ message: 'Lote processado', criados, ignorados });
      if (criados.length) broadcast('produto.lote_criado', { total: criados.length, categoria });
    } catch (error) {
      console.error('Erro ao criar produtos em lote:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async obterTodos(req, res) {
    try {
      const { incluir_inativos } = req.query;
      const produtos = await ProdutoModel.obterTodos(incluir_inativos !== 'true');
      res.json(produtos);
    } catch (error) {
      console.error('Erro ao obter produtos:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async obterPorId(req, res) {
    try {
      const { id } = req.params;
      const produto = await ProdutoModel.obterPorId(id);

      if (!produto) {
        return res.status(404).json({ error: 'Produto não encontrado' });
      }

      res.json(produto);
    } catch (error) {
      console.error('Erro ao obter produto:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async atualizar(req, res) {
    try {
      const { id } = req.params;
      const dados = { ...req.body };
      if (Object.prototype.hasOwnProperty.call(dados, 'categoria')) {
        dados.categoria = String(dados.categoria || 'geral').trim() || 'geral';
        await CategoriaModel.garantir(dados.categoria);
      }
      if (Object.prototype.hasOwnProperty.call(dados, 'vai_cozinha')) {
        dados.vai_cozinha = dados.vai_cozinha === true || dados.vai_cozinha === 1 || dados.vai_cozinha === '1';
      }
      if (Object.prototype.hasOwnProperty.call(dados, 'destaque')) {
        dados.destaque = dados.destaque === true || dados.destaque === 1 || dados.destaque === '1';
      }
      if (Object.prototype.hasOwnProperty.call(dados, 'popularidade')) {
        dados.popularidade = parseInt(dados.popularidade, 10) || 0;
      }
      if (Object.prototype.hasOwnProperty.call(dados, 'opcoes_json')) {
        dados.opcoes_json = normalizarOpcoesJson(dados.opcoes_json);
      }

      const produto = await ProdutoModel.obterPorId(id);
      if (!produto) {
        return res.status(404).json({ error: 'Produto não encontrado' });
      }

      await ProdutoModel.atualizar(id, dados);
      await registrarHistorico('produto_atualizado', parseInt(id, 10), dados);
      res.json({ message: 'Produto atualizado com sucesso' });
      broadcast('produto.atualizado', { id: parseInt(id, 10), dados });
    } catch (error) {
      console.error('Erro ao atualizar produto:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async renomearCategoria(req, res) {
    try {
      const categoriaAtual = String(req.body?.categoria_atual || '').trim();
      const categoriaNova = String(req.body?.categoria_nova || '').trim();
      if (!categoriaAtual || !categoriaNova) {
        return res.status(400).json({ error: 'Informe categoria atual e nova categoria' });
      }
      const alterados = await ProdutoModel.atualizarCategoria(categoriaAtual, categoriaNova);
      await registrarHistorico('categoria_renomeada', 0, { categoria_atual: categoriaAtual, categoria_nova: categoriaNova, alterados });
      res.json({ message: 'Categoria atualizada com sucesso', alterados });
      broadcast('produto.categoria_renomeada', { categoria_atual: categoriaAtual, categoria_nova: categoriaNova, alterados });
    } catch (error) {
      console.error('Erro ao renomear categoria:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async deletar(req, res) {
    try {
      const { id } = req.params;
      const produto = await ProdutoModel.obterPorId(id);

      if (!produto) {
        return res.status(404).json({ error: 'Produto não encontrado' });
      }

      // Soft delete - marcar como inativo
      await ProdutoModel.atualizar(id, { ativo: 0 });
      await registrarHistorico('produto_deletado', parseInt(id, 10), { nome: produto.nome });
      res.json({ message: 'Produto deletado com sucesso' });
      broadcast('produto.deletado', { id: parseInt(id, 10) });
    } catch (error) {
      console.error('Erro ao deletar produto:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async obterEstoque(req, res) {
    try {
      const { id } = req.params;
      const produto = await ProdutoModel.obterPorId(id);

      if (!produto) {
        return res.status(404).json({ error: 'Produto não encontrado' });
      }

      // produtos temporários (avulsos) não possuem estoque válido
      const isAvulso = produto.nome && produto.nome.startsWith('Avulso') || produto.estoque >= 9999;
      if (isAvulso) {
        return res.json({ estoque: null, estoque_minimo: null });
      }

      const estoque = await ProdutoModel.obterEstoque(id);
      res.json(estoque);
    } catch (error) {
      console.error('Erro ao obter estoque:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

export default ProdutoController;
