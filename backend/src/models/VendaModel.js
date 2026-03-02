import { dbRun, dbGet, dbAll } from '../database/database.js';

class VendaModel {
  static async criar(dados) {
    let numero_pedido = null;
    if (dados.tipo === 'fastfood') {
      // Gerar número sequencial para fastfood
      const lastVenda = await dbGet(
        'SELECT numero_pedido FROM vendas WHERE tipo = \'fastfood\' ORDER BY numero_pedido DESC LIMIT 1'
      );
      numero_pedido = (lastVenda?.numero_pedido || 0) + 1;
    }

    const result = await dbRun(
      `INSERT INTO vendas (tipo, status, numero_pedido, mesa, total) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        dados.tipo,
        dados.status || 'aberta',
        numero_pedido,
        dados.mesa || null,
        dados.total || 0
      ]
    );
    
    return {
      id: result.lastID,
      tipo: dados.tipo,
      numero_pedido: numero_pedido,
      mesa: dados.mesa || null
    };
  }

  static async obterPorId(id) {
    return dbGet('SELECT * FROM vendas WHERE id = ?', [id]);
  }

  static async obterTodas(filtros = {}) {
    let query = 'SELECT * FROM vendas WHERE 1=1';
    const values = [];

    if (filtros.tipo) {
      query += ' AND tipo = ?';
      values.push(filtros.tipo);
    }

    if (filtros.status) {
      query += ' AND status = ?';
      values.push(filtros.status);
    }

    if (filtros.data_inicio && filtros.data_fim) {
      query += ' AND created_at BETWEEN ? AND ?';
      values.push(filtros.data_inicio, filtros.data_fim);
    }

    query += ' ORDER BY created_at DESC';
    return dbAll(query, values);
  }

  static async obertasAbertas(tipo = null) {
    let query = 'SELECT * FROM vendas WHERE status IN (\'aberta\', \'em_preparo\', \'pronta\')';
    const values = [];

    if (tipo) {
      query += ' AND tipo = ?';
      values.push(tipo);
    }

    query += ' ORDER BY created_at DESC';
    return dbAll(query, values);
  }

  static async obterEmPreparo() {
    return dbAll(
      'SELECT * FROM vendas WHERE tipo = \'fastfood\' AND status = \'em_preparo\' ORDER BY numero_pedido'
    );
  }

  static async atualizar(id, dados) {
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(dados)) {
      if (['status', 'total', 'forma_pagamento', 'observacoes', 'mesa'].includes(key)) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) return 0;

    if (dados.status === 'fechada') {
      fields.push('closed_at = CURRENT_TIMESTAMP');
    }

    values.push(id);
    const result = await dbRun(
      `UPDATE vendas SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    return result.changes;
  }

  static async deletar(id) {
    const result = await dbRun('DELETE FROM vendas WHERE id = ?', [id]);
    return result.changes;
  }

  static async obterTotal(id) {
    const result = await dbGet(
      'SELECT COALESCE(SUM(subtotal), 0) as total FROM venda_itens WHERE venda_id = ?',
      [id]
    );
    
    if (result) {
      await dbRun('UPDATE vendas SET total = ? WHERE id = ?', [result.total, id]);
      return result.total;
    }
    return 0;
  }
}

export default VendaModel;
