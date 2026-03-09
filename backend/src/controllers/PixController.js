import { gerarPixCobranca, obterConfigPix, salvarConfigPix } from '../services/pixService.js';

class PixController {
  static async obterConfig(req, res) {
    try {
      const cfg = await obterConfigPix();
      res.json(cfg);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async salvarConfig(req, res) {
    try {
      const cfg = await salvarConfigPix(req.body || {});
      res.json({ message: 'Configuração Pix atualizada', config: cfg });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  static async gerarCobranca(req, res) {
    try {
      const vendaId = Number(req.params.id);
      const valor = Number(req.body?.valor || req.query?.valor || 0);
      const descricao = req.body?.descricao || '';
      if (!vendaId) return res.status(400).json({ error: 'Venda inválida' });
      const pix = await gerarPixCobranca({ vendaId, valor, descricao });
      res.json(pix);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}

export default PixController;
