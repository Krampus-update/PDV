import CategoriaModel from '../models/CategoriaModel.js';
import HistoricoModel from '../models/HistoricoModel.js';

async function registrarHistorico(acao, entidade_id, detalhes = null) {
  try {
    await HistoricoModel.registrar({
      tipo_entidade: 'categoria',
      entidade_id,
      acao,
      detalhes
    });
  } catch (e) {
    console.warn('Falha ao registrar histórico de categoria:', e.message);
  }
}

class CategoriaController {
  static async listar(req, res) {
    try {
      const { ativas } = req.query;
      const categorias = await CategoriaModel.listar(ativas === 'true');
      res.json(categorias);
    } catch (error) {
      console.error('Erro ao listar categorias:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async criar(req, res) {
    try {
      const { nome, ativo, vai_cozinha } = req.body;
      if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });
      const id = await CategoriaModel.criar({ nome, ativo, vai_cozinha });
      res.status(201).json({ id });
      await registrarHistorico('categoria_criada', id, { nome, vai_cozinha });
    } catch (error) {
      console.error('Erro ao criar categoria:', error);
      if (error.message.includes('UNIQUE')) {
        return res.status(400).json({ error: 'Categoria já existe' });
      }
      res.status(500).json({ error: error.message });
    }
  }

  static async atualizar(req, res) {
    try {
      const { id } = req.params;
      const { nome, ativo, vai_cozinha } = req.body || {};
      await CategoriaModel.atualizar(id, { nome, ativo, vai_cozinha });
      res.json({ message: 'Categoria atualizada' });
      await registrarHistorico('categoria_atualizada', Number(id), { nome, ativo, vai_cozinha });
    } catch (error) {
      console.error('Erro ao atualizar categoria:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async remover(req, res) {
    try {
      const { id } = req.params;
      await CategoriaModel.remover(id);
      res.json({ message: 'Categoria removida' });
      await registrarHistorico('categoria_removida', Number(id), null);
    } catch (error) {
      console.error('Erro ao remover categoria:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

export default CategoriaController;
