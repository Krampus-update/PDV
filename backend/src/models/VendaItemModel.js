import { dbRun, dbGet, dbAll } from '../database/database.js';

class VendaItemModel {
  static async criar(dados) {
    const result = await dbRun(
      `INSERT INTO venda_itens (venda_id, produto_id, quantidade, preco_unitario, subtotal, observacoes) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        dados.venda_id,
        dados.produto_id,
        dados.quantidade,
        dados.preco_unitario,
        dados.subtotal,
        dados.observacoes || null
      ]
    );
    return result.lastID;
  }

  static async obterPorId(id) {
    return dbGet('SELECT * FROM venda_itens WHERE id = ?', [id]);
  }

  static async obterPorVenda(venda_id) {
    return dbAll(
      `SELECT vi.*, p.nome as produto_nome, p.tipo as produto_tipo, p.vai_cozinha as produto_vai_cozinha
       FROM venda_itens vi 
       JOIN produtos p ON vi.produto_id = p.id 
       WHERE vi.venda_id = ? 
       ORDER BY vi.created_at`,
      [venda_id]
    );
  }

  static async atualizar(id, dados) {
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(dados)) {
      if (['quantidade', 'preco_unitario', 'subtotal', 'observacoes'].includes(key)) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) return 0;

    values.push(id);
    const result = await dbRun(
      `UPDATE venda_itens SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    return result.changes;
  }

  static async deletar(id) {
    const result = await dbRun('DELETE FROM venda_itens WHERE id = ?', [id]);
    return result.changes;
  }

  static async obterItensPorVenda(venda_id) {
    return dbAll(
      `SELECT 
        vi.id,
        vi.quantidade,
        vi.preco_unitario,
        vi.subtotal,
        vi.observacoes,
        p.id as produto_id,
        p.nome as produto_nome,
        p.tipo as produto_tipo,
        p.vai_cozinha as produto_vai_cozinha
       FROM venda_itens vi 
       JOIN produtos p ON vi.produto_id = p.id 
       WHERE vi.venda_id = ?`,
      [venda_id]
    );
  }
}

export default VendaItemModel;
