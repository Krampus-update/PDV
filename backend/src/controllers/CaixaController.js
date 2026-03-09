import CaixaModel from '../models/CaixaModel.js';
import HistoricoModel from '../models/HistoricoModel.js';
import { broadcast } from '../services/realtimeService.js';

async function registrarHistorico(acao, detalhes = null) {
  try {
    await HistoricoModel.registrar({
      tipo_entidade: 'caixa',
      entidade_id: null,
      acao,
      detalhes
    });
  } catch {
    // noop
  }
}

class CaixaController {
  static async atual(req, res) {
    try {
      const aberto = await CaixaModel.obterAberto();
      const historico = await CaixaModel.historico({ limite: 5 });
      res.json({ aberto, historico });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async abrir(req, res) {
    try {
      const existente = await CaixaModel.obterAberto();
      if (existente) {
        return res.status(400).json({ error: 'Já existe um caixa aberto' });
      }
      const saldoInicial = Number(req.body?.saldo_inicial || 0);
      const caixa = await CaixaModel.abrir({
        aberto_por: req.user?.id || null,
        saldo_inicial: Number.isFinite(saldoInicial) ? saldoInicial : 0
      });
      await registrarHistorico('caixa_aberto', { caixa_id: caixa.id, saldo_inicial: caixa.saldo_inicial });
      broadcast('caixa.aberto', caixa);
      res.status(201).json(caixa);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async fechar(req, res) {
    try {
      const aberto = await CaixaModel.obterAberto();
      if (!aberto) {
        return res.status(400).json({ error: 'Não há caixa aberto' });
      }
      const saldoFinal = req.body?.saldo_final;
      const observacoes = req.body?.observacoes || null;
      const fechado = await CaixaModel.fechar({
        id: aberto.id,
        fechado_por: req.user?.id || null,
        saldo_final_informado: saldoFinal === undefined || saldoFinal === null ? null : Number(saldoFinal),
        observacoes
      });
      await registrarHistorico('caixa_fechado', {
        caixa_id: fechado.id,
        total_vendas: fechado.total_vendas,
        total_comandas: fechado.total_comandas
      });
      broadcast('caixa.fechado', fechado);
      res.json(fechado);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async resumoDia(req, res) {
    try {
      const data = req.query?.data || null;
      const resumo = await CaixaModel.resumoDia(data);
      res.json(resumo);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async historico(req, res) {
    try {
      const limite = Number(req.query?.limite || 30);
      const rows = await CaixaModel.historico({ limite });
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

export default CaixaController;
