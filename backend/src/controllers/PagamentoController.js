import {
  obterConfigPagamento,
  processarPagamento,
  PROVIDERS,
  salvarConfigPagamento
} from '../services/paymentGatewayService.js';

class PagamentoController {
  static async providers(req, res) {
    res.json({ providers: PROVIDERS });
  }

  static async obterConfig(req, res) {
    try {
      const cfg = await obterConfigPagamento();
      res.json(cfg);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async salvarConfig(req, res) {
    try {
      const cfg = await salvarConfigPagamento(req.body || {});
      res.json({ message: 'Configuração de pagamento atualizada', config: cfg });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  static async processar(req, res) {
    try {
      const payload = req.body || {};
      const result = await processarPagamento(payload);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}

export default PagamentoController;
