import { dbAll, dbGet, dbRun } from '../database/database.js';

class PromocaoModel {
  static async listar({ ativo = null } = {}) {
    let query = `SELECT p.*, pr.nome as produto_nome, pb.nome as produto_bonus_nome
      FROM promocoes p
      LEFT JOIN produtos pr ON pr.id = p.produto_id
      LEFT JOIN produtos pb ON pb.id = p.produto_bonus_id
      WHERE 1=1`;
    const values = [];
    if (ativo !== null) {
      query += ' AND p.ativo = ?';
      values.push(ativo ? 1 : 0);
    }
    query += ' ORDER BY p.created_at DESC';
    return dbAll(query, values);
  }

  static async obterPorId(id) {
    return dbGet('SELECT * FROM promocoes WHERE id = ?', [id]);
  }

  static async criar(dados) {
    const result = await dbRun(
      `INSERT INTO promocoes
       (nome, descricao, tipo, produto_id, variacao_nome, produto_bonus_id, produto_bonus_quantidade, quantidade_min, repetir_na_venda, preco_combo, desconto_percentual, desconto_fixo, data_inicio, data_fim, ativo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dados.nome,
        dados.descricao || null,
        dados.tipo || 'combo_produto',
        dados.produto_id || null,
        dados.variacao_nome || null,
        dados.produto_bonus_id || null,
        Math.max(1, Number(dados.produto_bonus_quantidade || 1)),
        Number(dados.quantidade_min || 0),
        dados.repetir_na_venda === false ? 0 : 1,
        dados.preco_combo === null || dados.preco_combo === undefined ? null : Number(dados.preco_combo),
        dados.desconto_percentual === null || dados.desconto_percentual === undefined ? null : Number(dados.desconto_percentual),
        dados.desconto_fixo === null || dados.desconto_fixo === undefined ? null : Number(dados.desconto_fixo),
        dados.data_inicio || null,
        dados.data_fim || null,
        dados.ativo === false ? 0 : 1
      ]
    );
    return result.lastID;
  }

  static async atualizar(id, dados) {
    const fields = [];
    const values = [];
    for (const [key, value] of Object.entries(dados || {})) {
      if (
        [
          'nome',
          'descricao',
          'tipo',
          'produto_id',
          'variacao_nome',
          'produto_bonus_id',
          'produto_bonus_quantidade',
          'quantidade_min',
          'repetir_na_venda',
          'preco_combo',
          'desconto_percentual',
          'desconto_fixo',
          'data_inicio',
          'data_fim',
          'ativo'
        ].includes(key)
      ) {
        fields.push(`${key} = ?`);
        if (key === 'repetir_na_venda') {
          values.push(value === false ? 0 : 1);
        } else {
          values.push(value);
        }
      }
    }
    if (!fields.length) return 0;
    values.push(id);
    const result = await dbRun(
      `UPDATE promocoes
       SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      values
    );
    return result.changes;
  }

  static async remover(id) {
    const result = await dbRun('DELETE FROM promocoes WHERE id = ?', [id]);
    return result.changes;
  }
}

export default PromocaoModel;
