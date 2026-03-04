import ClienteModel from '../models/ClienteModel.js';
import HistoricoModel from '../models/HistoricoModel.js';

async function registrarHistorico(acao, entidade_id, detalhes = null) {
  try {
    await HistoricoModel.registrar({
      tipo_entidade: 'cliente',
      entidade_id,
      acao,
      detalhes
    });
  } catch {
    // nao bloquear fluxo
  }
}

class ClienteController {
  static async listar(req, res) {
    try {
      const incluirInativos = req.query.incluir_inativos === 'true';
      const busca = req.query.busca || '';
      const clientes = await ClienteModel.listar({ incluirInativos, busca });
      res.json(clientes);
    } catch (error) {
      console.error('Erro ao listar clientes:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async obter(req, res) {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ error: 'ID inválido' });
      const cliente = await ClienteModel.obterPorId(id);
      if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado' });
      res.json(cliente);
    } catch (error) {
      console.error('Erro ao obter cliente:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async criar(req, res) {
    try {
      const { nome, telefone, observacoes, pontos } = req.body;
      if (!String(nome || '').trim()) {
        return res.status(400).json({ error: 'Nome é obrigatório' });
      }
      const id = await ClienteModel.criar({ nome, telefone, observacoes, pontos });
      await registrarHistorico('cliente_criado', id, { nome, telefone });
      res.status(201).json({ message: 'Cliente criado com sucesso', id });
    } catch (error) {
      console.error('Erro ao criar cliente:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async atualizar(req, res) {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ error: 'ID inválido' });
      const atual = await ClienteModel.obterPorId(id);
      if (!atual) return res.status(404).json({ error: 'Cliente não encontrado' });
      await ClienteModel.atualizar(id, req.body || {});
      await registrarHistorico('cliente_atualizado', id, req.body || {});
      res.json({ message: 'Cliente atualizado com sucesso' });
    } catch (error) {
      console.error('Erro ao atualizar cliente:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async remover(req, res) {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ error: 'ID inválido' });
      const atual = await ClienteModel.obterPorId(id);
      if (!atual) return res.status(404).json({ error: 'Cliente não encontrado' });
      await ClienteModel.remover(id);
      await registrarHistorico('cliente_removido', id, { nome: atual.nome });
      res.json({ message: 'Cliente removido com sucesso' });
    } catch (error) {
      console.error('Erro ao remover cliente:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

export default ClienteController;
