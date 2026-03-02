import { dbRun, dbGet, dbAll } from '../database/database.js';

class ProdutoModel {
  static async criar(dados) {
    const result = await dbRun(
      `INSERT INTO produtos (nome, preco, estoque, estoque_minimo, tipo, imagem) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [dados.nome, dados.preco, dados.estoque || 0, dados.estoque_minimo || 0, dados.tipo || 'simples', dados.imagem || null]
    );
    return result.lastID;
  }

  static async obterPorId(id) {
    return dbGet('SELECT * FROM produtos WHERE id = ?', [id]);
  }

  static async obterTodos(ativo = true) {
    if (ativo) {
      return dbAll('SELECT * FROM produtos WHERE ativo = 1 ORDER BY nome');
    }
    return dbAll('SELECT * FROM produtos ORDER BY nome');
  }

  static async atualizar(id, dados) {
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(dados)) {
      if (['nome', 'preco', 'estoque', 'estoque_minimo', 'tipo', 'ativo', 'imagem'].includes(key)) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) return 0;

    values.push(id);
    const result = await dbRun(
      `UPDATE produtos SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );
    return result.changes;
  }

  static async deletar(id) {
    const result = await dbRun('DELETE FROM produtos WHERE id = ?', [id]);
    return result.changes;
  }

  static async obterEstoque(id) {
    return dbGet('SELECT estoque, estoque_minimo FROM produtos WHERE id = ?', [id]);
  }

  static async atualizarEstoque(id, quantidade) {
    const result = await dbRun(
      'UPDATE produtos SET estoque = estoque + ? WHERE id = ?',
      [quantidade, id]
    );
    return result.changes;
  }
}

export default ProdutoModel;
