import { dbAll, dbGet, dbRun } from '../database/database.js';

class ClienteModel {
  static async listar({ incluirInativos = false, busca = '' } = {}) {
    const filtroBusca = String(busca || '').trim().toLowerCase();
    let query = 'SELECT * FROM clientes WHERE 1=1';
    const values = [];
    if (!incluirInativos) query += ' AND ativo = 1';
    if (filtroBusca) {
      query += ' AND (LOWER(nome) LIKE ? OR LOWER(COALESCE(telefone, \'\')) LIKE ?)';
      values.push(`%${filtroBusca}%`, `%${filtroBusca}%`);
    }
    query += ' ORDER BY nome';
    return dbAll(query, values);
  }

  static async obterPorId(id) {
    return dbGet('SELECT * FROM clientes WHERE id = ?', [id]);
  }

  static async criar({ nome, telefone = null, observacoes = null, pontos = 0 }) {
    const result = await dbRun(
      `INSERT INTO clientes (nome, telefone, observacoes, pontos, ativo)
       VALUES (?, ?, ?, ?, 1)`,
      [String(nome || '').trim(), telefone || null, observacoes || null, Number.parseInt(pontos, 10) || 0]
    );
    return result.lastID;
  }

  static async atualizar(id, dados = {}) {
    const fields = [];
    const values = [];
    if (Object.prototype.hasOwnProperty.call(dados, 'nome')) {
      fields.push('nome = ?');
      values.push(String(dados.nome || '').trim());
    }
    if (Object.prototype.hasOwnProperty.call(dados, 'telefone')) {
      fields.push('telefone = ?');
      values.push(String(dados.telefone || '').trim() || null);
    }
    if (Object.prototype.hasOwnProperty.call(dados, 'observacoes')) {
      fields.push('observacoes = ?');
      values.push(String(dados.observacoes || '').trim() || null);
    }
    if (Object.prototype.hasOwnProperty.call(dados, 'pontos')) {
      fields.push('pontos = ?');
      values.push(Number.parseInt(dados.pontos, 10) || 0);
    }
    if (Object.prototype.hasOwnProperty.call(dados, 'ativo')) {
      fields.push('ativo = ?');
      values.push(dados.ativo ? 1 : 0);
    }
    if (!fields.length) return 0;

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    const result = await dbRun(`UPDATE clientes SET ${fields.join(', ')} WHERE id = ?`, values);
    return result.changes;
  }

  static async remover(id) {
    const result = await dbRun('UPDATE clientes SET ativo = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
    return result.changes;
  }

  static async historicoPedidos(id, limite = 30) {
    const lim = Math.max(1, Math.min(Number.parseInt(limite, 10) || 30, 200));
    return dbAll(
      `SELECT
         v.id,
         v.tipo,
         v.status,
         v.total,
         v.forma_pagamento,
         v.mesa,
         v.created_at,
         v.closed_at,
         (
           SELECT COALESCE(SUM(vi.quantidade), 0)
           FROM venda_itens vi
           WHERE vi.venda_id = v.id
         ) as itens_total
       FROM vendas v
       WHERE v.cliente_id = ?
       ORDER BY v.created_at DESC
       LIMIT ?`,
      [id, lim]
    );
  }
}

export default ClienteModel;
