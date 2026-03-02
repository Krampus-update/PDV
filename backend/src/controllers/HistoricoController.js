import HistoricoModel from '../models/HistoricoModel.js';

class HistoricoController {
  static async listar(req, res) {
    try {
      const { limite, tipo_entidade, entidade_id } = req.query;
      const dados = await HistoricoModel.listar({
        limite: Math.max(1, Math.min(parseInt(limite, 10) || 100, 500)),
        tipo_entidade: tipo_entidade || null,
        entidade_id: entidade_id ? parseInt(entidade_id, 10) : null
      });
      res.json(dados);
    } catch (error) {
      console.error('Erro ao listar histórico:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

export default HistoricoController;
