import { dbAll, dbGet, dbRun } from '../database/database.js';

class CaixaModel {
  static async obterAberto() {
    return dbGet(
      `SELECT cs.*,
              u1.nome as aberto_por_nome,
              u2.nome as fechado_por_nome
       FROM caixa_sessoes cs
       LEFT JOIN usuarios u1 ON u1.id = cs.aberto_por
       LEFT JOIN usuarios u2 ON u2.id = cs.fechado_por
       WHERE cs.fechado_em IS NULL
       ORDER BY cs.aberto_em DESC
       LIMIT 1`
    );
  }

  static async abrir({ aberto_por = null, saldo_inicial = 0 }) {
    const result = await dbRun(
      `INSERT INTO caixa_sessoes (aberto_por, saldo_inicial)
       VALUES (?, ?)`,
      [aberto_por, Number(saldo_inicial || 0)]
    );
    return this.obterPorId(result.lastID);
  }

  static async fechar({ id, fechado_por = null, saldo_final_informado = null, observacoes = null }) {
    const resumo = await dbGet(
      `SELECT
         COUNT(*) as total_comandas,
         COALESCE(SUM(total), 0) as total_vendas
       FROM vendas
       WHERE caixa_sessao_id = ? AND status = 'fechada'`,
      [id]
    );
    await dbRun(
      `UPDATE caixa_sessoes
       SET fechado_por = ?,
           saldo_final_informado = ?,
           observacoes = ?,
           total_comandas = ?,
           total_vendas = ?,
           fechado_em = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        fechado_por,
        saldo_final_informado === null ? null : Number(saldo_final_informado || 0),
        observacoes || null,
        Number(resumo?.total_comandas || 0),
        Number(resumo?.total_vendas || 0),
        id
      ]
    );
    return this.obterPorId(id);
  }

  static async obterPorId(id) {
    return dbGet(
      `SELECT cs.*,
              u1.nome as aberto_por_nome,
              u2.nome as fechado_por_nome
       FROM caixa_sessoes cs
       LEFT JOIN usuarios u1 ON u1.id = cs.aberto_por
       LEFT JOIN usuarios u2 ON u2.id = cs.fechado_por
       WHERE cs.id = ?`,
      [id]
    );
  }

  static async historico({ limite = 30 } = {}) {
    return dbAll(
      `SELECT cs.*,
              u1.nome as aberto_por_nome,
              u2.nome as fechado_por_nome
       FROM caixa_sessoes cs
       LEFT JOIN usuarios u1 ON u1.id = cs.aberto_por
       LEFT JOIN usuarios u2 ON u2.id = cs.fechado_por
       ORDER BY cs.aberto_em DESC
       LIMIT ?`,
      [Number(limite || 30)]
    );
  }

  static async resumoDia(dataISO = null) {
    const dia = dataISO ? String(dataISO).slice(0, 10) : new Date().toISOString().slice(0, 10);
    const inicio = `${dia} 00:00:00`;
    const fim = `${dia} 23:59:59`;
    const vendas = await dbAll(
      `SELECT id, tipo, status, mesa, total, forma_pagamento, created_at, closed_at
       FROM vendas
       WHERE created_at BETWEEN ? AND ?
       ORDER BY
         CASE status WHEN 'fechada' THEN 1 ELSE 0 END ASC,
         datetime(created_at) DESC`,
      [inicio, fim]
    );
    const fechado = vendas.filter((v) => String(v.status) === 'fechada');
    const porForma = fechado.reduce((acc, v) => {
      const key = String(v.forma_pagamento || 'nao_informado').toLowerCase();
      if (!acc[key]) acc[key] = { forma_pagamento: key, total: 0, quantidade: 0 };
      acc[key].total += Number(v.total || 0);
      acc[key].quantidade += 1;
      return acc;
    }, {});
    return {
      data: dia,
      total_comandas: vendas.length,
      total_fechadas: fechado.length,
      faturamento_fechadas: fechado.reduce((sum, v) => sum + Number(v.total || 0), 0),
      por_forma_pagamento: Object.values(porForma).map((x) => ({
        ...x,
        total: Number(x.total.toFixed(2))
      })),
      vendas
    };
  }
}

export default CaixaModel;
