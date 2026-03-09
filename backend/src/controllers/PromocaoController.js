import PromocaoModel from '../models/PromocaoModel.js';

class PromocaoController {
  static async listar(req, res) {
    try {
      const ativo = req.query?.ativo;
      const rows = await PromocaoModel.listar({
        ativo: ativo === undefined ? null : String(ativo) === '1' || String(ativo).toLowerCase() === 'true'
      });
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async obter(req, res) {
    try {
      const id = Number(req.params.id);
      const row = await PromocaoModel.obterPorId(id);
      if (!row) return res.status(404).json({ error: 'Promoção não encontrada' });
      res.json(row);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async criar(req, res) {
    try {
      const {
        nome,
        tipo = 'combo_produto',
        produto_id,
        quantidade_min = 0,
        repetir_na_venda = true,
        preco_combo,
        desconto_percentual,
        desconto_fixo,
        descricao,
        data_inicio,
        data_fim,
        ativo = true
      } = req.body || {};
      if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });
      const id = await PromocaoModel.criar({
        nome,
        tipo,
        produto_id: produto_id || null,
        quantidade_min,
        repetir_na_venda: !!repetir_na_venda,
        preco_combo,
        desconto_percentual,
        desconto_fixo,
        descricao,
        data_inicio,
        data_fim,
        ativo: !!ativo
      });
      const row = await PromocaoModel.obterPorId(id);
      res.status(201).json(row);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async atualizar(req, res) {
    try {
      const id = Number(req.params.id);
      const existente = await PromocaoModel.obterPorId(id);
      if (!existente) return res.status(404).json({ error: 'Promoção não encontrada' });
      await PromocaoModel.atualizar(id, req.body || {});
      const row = await PromocaoModel.obterPorId(id);
      res.json(row);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async remover(req, res) {
    try {
      const id = Number(req.params.id);
      const existente = await PromocaoModel.obterPorId(id);
      if (!existente) return res.status(404).json({ error: 'Promoção não encontrada' });
      await PromocaoModel.remover(id);
      res.json({ message: 'Promoção removida' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

export default PromocaoController;
