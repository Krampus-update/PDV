import {
  obterConfigIfood,
  iniciarLoginIfood,
  finalizarLoginIfood,
  processarWebhookIfoodPublic,
  salvarConfigIfood,
  sincronizarBaixaPorPronto
} from '../services/ifoodIntegrationService.js';

class IfoodController {
  static async obterConfig(req, res) {
    try {
      const cfg = await obterConfigIfood();
      res.json(cfg);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async salvarConfig(req, res) {
    try {
      const cfg = await salvarConfigIfood(req.body || {});
      res.json({ message: 'Configuração iFood atualizada', config: cfg });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  static async iniciarLogin(req, res) {
    try {
      const resp = await iniciarLoginIfood();
      res.json(resp);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  static async finalizarLogin(req, res) {
    try {
      const resp = await finalizarLoginIfood(req.body || {});
      res.json(resp);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  static async webhook(req, res) {
    try {
      const resultado = await processarWebhookIfoodPublic(
        req.body || {},
        req.rawBody || Buffer.from(JSON.stringify(req.body || {})),
        req.headers['x-ifood-signature']
      );

      if (resultado?.keepalive) {
        return res.status(202).json({ ok: true, keepalive: true });
      }
      res.status(202).json({ ok: true, ...resultado });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  static async marcarPronto(req, res) {
    try {
      const { id } = req.params;
      const resultado = await sincronizarBaixaPorPronto(id);
      res.json({ message: 'Pedido iFood sincronizado como pronto', ...resultado });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}

export default IfoodController;
