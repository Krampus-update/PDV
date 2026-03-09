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
      `INSERT INTO vendas (tipo, status, numero_pedido, mesa, cliente_id, caixa_sessao_id, total) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        dados.tipo,
        dados.status || 'aberta',
        numero_pedido,
        dados.mesa || null,
        dados.cliente_id || null,
        dados.caixa_sessao_id || null,
        dados.total || 0
      ]
    );
    
    return {
      id: result.lastID,
      tipo: dados.tipo,
      numero_pedido: numero_pedido,
      mesa: dados.mesa || null,
      cliente_id: dados.cliente_id || null,
      caixa_sessao_id: dados.caixa_sessao_id || null
    };
  }

  static async obterPorId(id) {
    return dbGet(
      `SELECT v.*, c.nome as cliente_nome, c.telefone as cliente_telefone
       FROM vendas v
       LEFT JOIN clientes c ON c.id = v.cliente_id
       WHERE v.id = ?`,
      [id]
    );
  }

  static async obterTodas(filtros = {}) {
    let query = `SELECT v.*, c.nome as cliente_nome, c.telefone as cliente_telefone
                 FROM vendas v
                 LEFT JOIN clientes c ON c.id = v.cliente_id
                 WHERE 1=1`;
    const values = [];

    if (filtros.tipo) {
      query += ' AND v.tipo = ?';
      values.push(filtros.tipo);
    }

    if (filtros.status) {
      query += ' AND v.status = ?';
      values.push(filtros.status);
    }

    if (filtros.data_inicio && filtros.data_fim) {
      query += ' AND v.created_at BETWEEN ? AND ?';
      values.push(filtros.data_inicio, filtros.data_fim);
    }

    query += ' ORDER BY v.created_at DESC';
    return dbAll(query, values);
  }

  static async obertasAbertas(tipo = null) {
    let query = `SELECT v.*, c.nome as cliente_nome, c.telefone as cliente_telefone
                 FROM vendas v
                 LEFT JOIN clientes c ON c.id = v.cliente_id
                 WHERE v.status IN ('aberta', 'em_preparo', 'pronta')`;
    const values = [];

    if (tipo) {
      query += ' AND v.tipo = ?';
      values.push(tipo);
    }

    query += ' ORDER BY v.created_at DESC';
    return dbAll(query, values);
  }

  static async obterEmPreparo() {
    return dbAll(
      `SELECT DISTINCT v.*
       FROM vendas v
       JOIN venda_itens vi ON vi.venda_id = v.id
       JOIN produtos p ON p.id = vi.produto_id
       WHERE v.status = 'em_preparo' AND p.vai_cozinha = 1
       ORDER BY v.created_at ASC`
    );
  }

  static async obterParaProducao(status = 'em_preparo') {
    return dbAll(
      `SELECT DISTINCT v.*
       FROM vendas v
       JOIN venda_itens vi ON vi.venda_id = v.id
       JOIN produtos p ON p.id = vi.produto_id
       WHERE v.status = ? AND p.vai_cozinha = 1
       ORDER BY v.created_at ASC`,
      [status]
    );
  }

  static async atualizar(id, dados) {
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(dados)) {
      if (
        [
          'status',
          'total',
          'forma_pagamento',
          'observacoes',
          'mesa',
          'caixa_sessao_id',
          'subtotal_bruto',
          'desconto_tipo',
          'desconto_valor',
          'desconto_descricao',
          'acrescimo_valor',
          'valor_pago',
          'troco_valor',
          'split_mode',
          'split_payload_json',
          'pagamento_provider',
          'pagamento_status',
          'pagamento_transacao_id',
          'pix_payload',
          'pix_chave_utilizada',
          'promocao_aplicada_id'
        ].includes(key)
      ) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }
    if (Object.prototype.hasOwnProperty.call(dados, 'cliente_id')) {
      fields.push('cliente_id = ?');
      values.push(dados.cliente_id || null);
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
    if (!result) return 0;

    const venda = await dbGet(
      'SELECT desconto_valor, acrescimo_valor FROM vendas WHERE id = ?',
      [id]
    );
    const subtotal = Number(result.total || 0);
    const desconto = Number(venda?.desconto_valor || 0);
    const acrescimo = Number(venda?.acrescimo_valor || 0);
    const totalFinal = Math.max(0, subtotal - desconto + acrescimo);
    await dbRun(
      'UPDATE vendas SET subtotal_bruto = ?, total = ? WHERE id = ?',
      [subtotal, totalFinal, id]
    );
    return totalFinal;
  }
}

export default VendaModel;
