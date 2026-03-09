import { dbRun, dbGet, dbAll } from '../database/database.js';

class ProdutoModel {
  static async criar(dados) {
    const result = await dbRun(
      `INSERT INTO produtos (nome, preco, estoque, estoque_minimo, tipo, categoria, destaque, popularidade, opcoes_json, promocao_tipo, promocao_param_json, imagem, vai_cozinha) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dados.nome,
        dados.preco,
        dados.estoque || 0,
        dados.estoque_minimo || 0,
        dados.tipo || 'simples',
        dados.categoria || 'geral',
        dados.destaque ? 1 : 0,
        dados.popularidade || 0,
        dados.opcoes_json || null,
        dados.promocao_tipo || 'nenhuma',
        dados.promocao_param_json || null,
        dados.imagem || null,
        dados.vai_cozinha ? 1 : 0
      ]
    );
    return result.lastID;
  }

  static async obterPorId(id) {
    return dbGet('SELECT * FROM produtos WHERE id = ?', [id]);
  }

  static async obterTodos(ativo = true) {
    const order = ' ORDER BY destaque DESC, popularidade DESC, nome ASC';
    if (ativo) {
      return dbAll(`SELECT * FROM produtos WHERE ativo = 1${order}`);
    }
    return dbAll(`SELECT * FROM produtos${order}`);
  }

  static async atualizar(id, dados) {
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(dados)) {
      if (['nome', 'preco', 'estoque', 'estoque_minimo', 'tipo', 'categoria', 'destaque', 'popularidade', 'opcoes_json', 'promocao_tipo', 'promocao_param_json', 'ativo', 'imagem', 'vai_cozinha'].includes(key)) {
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
