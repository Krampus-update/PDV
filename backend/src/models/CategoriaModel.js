import { dbAll, dbGet, dbRun } from '../database/database.js';

function normalizarNome(nome) {
  return String(nome || '').trim().toLowerCase();
}

class CategoriaModel {
  static async listar(ativas = false) {
    const where = ativas ? 'WHERE ativo = 1' : '';
    return dbAll(`SELECT id, nome, ativo, vai_cozinha, created_at FROM categorias ${where} ORDER BY nome`);
  }

  static async obterPorNome(nome) {
    const n = normalizarNome(nome);
    if (!n) return null;
    return dbGet('SELECT id, nome, ativo, vai_cozinha FROM categorias WHERE nome = ?', [n]);
  }

  static async criar({ nome, ativo = 1, vai_cozinha = 0 }) {
    const n = normalizarNome(nome);
    if (!n) throw new Error('Nome inválido');
    const result = await dbRun('INSERT INTO categorias (nome, ativo, vai_cozinha) VALUES (?, ?, ?)', [n, ativo ? 1 : 0, vai_cozinha ? 1 : 0]);
    return result.lastID;
  }

  static async atualizar(id, { nome, ativo, vai_cozinha }) {
    const campos = [];
    const valores = [];
    if (nome !== undefined) {
      const n = normalizarNome(nome);
      if (!n) throw new Error('Nome inválido');
      campos.push('nome = ?');
      valores.push(n);
    }
    if (ativo !== undefined) {
      campos.push('ativo = ?');
      valores.push(ativo ? 1 : 0);
    }
    if (vai_cozinha !== undefined) {
      campos.push('vai_cozinha = ?');
      valores.push(vai_cozinha ? 1 : 0);
    }
    if (!campos.length) return { changes: 0 };
    valores.push(id);
    return dbRun(`UPDATE categorias SET ${campos.join(', ')} WHERE id = ?`, valores);
  }

  static async remover(id) {
    return dbRun('DELETE FROM categorias WHERE id = ?', [id]);
  }

  static async garantir(nome) {
    const n = normalizarNome(nome);
    if (!n) return null;
    const existente = await dbGet('SELECT id, nome, ativo FROM categorias WHERE nome = ?', [n]);
    if (existente) return existente.id;
    const result = await dbRun('INSERT INTO categorias (nome, ativo, vai_cozinha) VALUES (?, 1, 0)', [n]);
    return result.lastID;
  }
}

export default CategoriaModel;
