import { dbAll, dbGet } from '../database/database.js';

class RelatorioController {
  static async resumo(req, res) {
    try {
      const { periodo = 'hoje' } = req.query;
      let where = "date(created_at) = date('now')";
      if (periodo === '7d') where = "datetime(created_at) >= datetime('now', '-7 days')";
      if (periodo === '30d') where = "datetime(created_at) >= datetime('now', '-30 days')";
      if (periodo === 'mes') where = "strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')";

      const totais = await dbGet(
        `SELECT 
          COUNT(*) as total_vendas,
          COALESCE(SUM(total),0) as faturamento,
          COALESCE(AVG(total),0) as ticket_medio
         FROM vendas
         WHERE status = 'fechada' AND ${where}`
      );

      const porStatus = await dbAll(
        `SELECT status, COUNT(*) as quantidade
         FROM vendas
         WHERE ${where}
         GROUP BY status`
      );

      res.json({ periodo, ...totais, por_status: porStatus });
    } catch (error) {
      console.error('Erro no relatório resumo:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async produtos(req, res) {
    try {
      const { limite = 20 } = req.query;
      const rows = await dbAll(
        `SELECT 
          p.id as produto_id,
          p.nome as produto_nome,
          COALESCE(SUM(vi.quantidade),0) as quantidade_total,
          COALESCE(SUM(vi.subtotal),0) as total_vendido
         FROM venda_itens vi
         JOIN produtos p ON p.id = vi.produto_id
         JOIN vendas v ON v.id = vi.venda_id
         WHERE v.status = 'fechada'
         GROUP BY p.id, p.nome
         ORDER BY total_vendido DESC
         LIMIT ?`,
        [Math.max(1, Math.min(parseInt(limite, 10) || 20, 200))]
      );
      res.json(rows);
    } catch (error) {
      console.error('Erro no relatório por produto:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

export default RelatorioController;
