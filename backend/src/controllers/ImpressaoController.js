import VendaModel from '../models/VendaModel.js';
import VendaItemModel from '../models/VendaItemModel.js';
import {
  obterConfiguracao,
  listarConfiguracoesImpressao,
  salvarConfiguracao,
  removerConfiguracao,
  imprimirTeste,
  imprimirVenda,
  listarImpressorasLocais
} from '../services/thermalPrinterService.js';

class ImpressaoController {
  static async obterConfig(req, res) {
    try {
      const destino = String(req.query?.tipo || req.query?.destino || 'balcao');
      const config = await obterConfiguracao(destino);
      res.json(config);
    } catch (error) {
      console.error('Erro ao obter config de impressao:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async salvarConfig(req, res) {
    try {
      const config = await salvarConfiguracao({ ...(req.body || {}), destino: req.body?.destino || req.query?.tipo || req.query?.destino });
      res.json({ message: 'Configuração de impressora atualizada', config });
    } catch (error) {
      console.error('Erro ao salvar config de impressao:', error);
      res.status(400).json({ error: error.message });
    }
  }

  static async listarConfigs(req, res) {
    try {
      const configs = await listarConfiguracoesImpressao();
      res.json({ configs });
    } catch (error) {
      console.error('Erro ao listar configs de impressao:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async removerConfig(req, res) {
    try {
      const destino = String(req.query?.destino || req.body?.destino || '');
      const resultado = await removerConfiguracao(destino);
      res.json({ message: 'Configuração de impressora removida', ...resultado });
    } catch (error) {
      console.error('Erro ao remover config de impressao:', error);
      res.status(400).json({ error: error.message });
    }
  }

  static async teste(req, res) {
    try {
      const destino = String(req.query?.tipo || req.query?.destino || 'balcao');
      const config = await imprimirTeste(destino);
      res.json({ message: 'Teste enviado para impressora', config });
    } catch (error) {
      console.error('Erro ao imprimir teste:', error);
      res.status(400).json({ error: error.message });
    }
  }

  static async imprimirVenda(req, res) {
    try {
      const id = Number(req.params.id);
      const tipo = String(req.query.tipo || req.query.destino || req.body?.tipo || req.body?.destino || 'balcao').toLowerCase();
      if (!id) return res.status(400).json({ error: 'ID de venda inválido' });

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
