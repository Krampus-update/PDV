import VendaModel from '../models/VendaModel.js';
import VendaItemModel from '../models/VendaItemModel.js';
import {
  obterConfiguracao,
  salvarConfiguracao,
  imprimirTeste,
  imprimirVenda,
  listarImpressorasLocais
} from '../services/thermalPrinterService.js';

class ImpressaoController {
  static async obterConfig(req, res) {
    try {
      const config = await obterConfiguracao();
      res.json(config);
    } catch (error) {
      console.error('Erro ao obter config de impressao:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async salvarConfig(req, res) {
    try {
      const config = await salvarConfiguracao(req.body || {});
      res.json({ message: 'Configuração de impressora atualizada', config });
    } catch (error) {
      console.error('Erro ao salvar config de impressao:', error);
      res.status(400).json({ error: error.message });
    }
  }

  static async teste(req, res) {
    try {
      const config = await imprimirTeste();
      res.json({ message: 'Teste enviado para impressora', config });
    } catch (error) {
      console.error('Erro ao imprimir teste:', error);
      res.status(400).json({ error: error.message });
    }
  }

  static async imprimirVenda(req, res) {
    try {
      const id = Number(req.params.id);
      const tipo = String(req.query.tipo || req.body?.tipo || 'balcao').toLowerCase();
      if (!id) return res.status(400).json({ error: 'ID de venda inválido' });
      if (!['balcao', 'cozinha'].includes(tipo)) {
        return res.status(400).json({ error: 'tipo deve ser balcao ou cozinha' });
      }

      const venda = await VendaModel.obterPorId(id);
      if (!venda) return res.status(404).json({ error: 'Venda não encontrada' });
      const itens = await VendaItemModel.obterPorVenda(id);

      await imprimirVenda(venda, itens, tipo);
      res.json({ message: `Impressão de ${tipo} enviada`, venda_id: id });
    } catch (error) {
      console.error('Erro ao imprimir venda:', error);
      res.status(400).json({ error: error.message });
    }
  }

  static async listarLocais(req, res) {
    try {
      const impressoras = await listarImpressorasLocais();
      res.json({ impressoras });
    } catch (error) {
      console.error('Erro ao listar impressoras locais:', error);
      res.status(400).json({ error: error.message });
    }
  }
}

export default ImpressaoController;
