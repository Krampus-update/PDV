import { dbRun, dbAll } from '../database/database.js';

class HistoricoModel {
  static async registrar({ tipo_entidade, entidade_id, acao, detalhes = null }) {
    const payload = detalhes ? JSON.stringify(detalhes) : null;
    const result = await dbRun(
      `INSERT INTO historico_transacoes (tipo_entidade, entidade_id, acao, detalhes)
       VALUES (?, ?, ?, ?)`,
      [tipo_entidade, entidade_id || null, acao, payload]
    );
    return result.lastID;
  }

  static async listar({ limite = 100, tipo_entidade = null, entidade_id = null }) {
    let query = 'SELECT * FROM historico_transacoes WHERE 1=1';
    const values = [];
    if (tipo_entidade) {
      query += ' AND tipo_entidade = ?';
      values.push(tipo_entidade);
    }
    if (entidade_id) {
      query += ' AND entidade_id = ?';
      values.push(entidade_id);
    }
    query += ' ORDER BY created_at DESC LIMIT ?';
    values.push(limite);
    const rows = await dbAll(query, values);
    return rows.map((r) => ({
      ...r,
      detalhes: r.detalhes ? JSON.parse(r.detalhes) : null
    }));
  }
}

export default HistoricoModel;
