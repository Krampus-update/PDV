import { dbAll, dbGet, dbRun } from '../database/database.js';
import crypto from 'crypto';

class UsuarioModel {
  static hashSenha(senha) {
    return crypto.createHash('sha256').update(String(senha)).digest('hex');
  }

  static normalizeRole(role) {
    const r = String(role || '').toLowerCase().trim();
    if (r === 'admin') return 'gerente';
    if (r === 'cliente' || r === 'cozinha') return 'funcionario';
    return r;
  }

  static async obterPorLogin(login) {
    return dbGet('SELECT * FROM usuarios WHERE login = ? AND ativo = 1', [login]);
  }

  static async obterPorLoginQualquerStatus(login) {
    return dbGet('SELECT * FROM usuarios WHERE login = ?', [login]);
  }

  static async obterPorId(id) {
    return dbGet('SELECT id, nome, login, role, ativo, created_at FROM usuarios WHERE id = ?', [id]);
  }

  static async listarUsuarios() {
    return dbAll('SELECT id, nome, login, role, ativo, created_at FROM usuarios ORDER BY nome');
  }

  static async criarUsuario({ nome, login, senha, role = 'funcionario' }) {
    const senha_hash = this.hashSenha(senha);
    const normalizedRole = this.normalizeRole(role);
    const result = await dbRun(
      'INSERT INTO usuarios (nome, login, senha_hash, role, ativo) VALUES (?, ?, ?, ?, 1)',
      [nome, login, senha_hash, normalizedRole]
    );
    return result.lastID;
  }

  static async atualizarUsuario(id, dados = {}) {
    const campos = [];
    const valores = [];

    if (Object.prototype.hasOwnProperty.call(dados, 'nome')) {
      campos.push('nome = ?');
      valores.push(String(dados.nome || '').trim());
    }
    if (Object.prototype.hasOwnProperty.call(dados, 'login')) {
      campos.push('login = ?');
      valores.push(String(dados.login || '').trim());
    }
    if (Object.prototype.hasOwnProperty.call(dados, 'role')) {
      campos.push('role = ?');
      valores.push(this.normalizeRole(dados.role));
    }
    if (Object.prototype.hasOwnProperty.call(dados, 'ativo')) {
      campos.push('ativo = ?');
      valores.push(dados.ativo ? 1 : 0);
    }
    if (Object.prototype.hasOwnProperty.call(dados, 'senha') && dados.senha) {
      campos.push('senha_hash = ?');
      valores.push(this.hashSenha(dados.senha));
    }

    if (campos.length === 0) return 0;

    valores.push(id);
    const result = await dbRun(`UPDATE usuarios SET ${campos.join(', ')} WHERE id = ?`, valores);
    return result.changes;
  }

  static async desativarUsuario(id) {
    const result = await dbRun('UPDATE usuarios SET ativo = 0 WHERE id = ?', [id]);
    return result.changes;
  }

  static async removerSessao(token) {
    const result = await dbRun('DELETE FROM sessoes WHERE token = ?', [token]);
    return result.changes;
  }

  static async removerSessoesUsuario(usuarioId) {
    const result = await dbRun('DELETE FROM sessoes WHERE usuario_id = ?', [usuarioId]);
    return result.changes;
  }

  static async criarSessao(usuario_id, duracaoHoras = 12) {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + duracaoHoras * 60 * 60 * 1000).toISOString();
    await dbRun(
      'INSERT INTO sessoes (usuario_id, token, expires_at) VALUES (?, ?, ?)',
      [usuario_id, token, expires]
    );
    return { token, expires_at: expires };
  }

  static async obterSessaoValida(token) {
    return dbGet(
      `SELECT s.id, s.usuario_id, s.token, s.expires_at, u.nome, u.login, u.role
       FROM sessoes s
       JOIN usuarios u ON u.id = s.usuario_id
       WHERE s.token = ? AND datetime(s.expires_at) > datetime('now') AND u.ativo = 1`,
      [token]
    );
  }

  static async limparSessoesExpiradas() {
    await dbRun("DELETE FROM sessoes WHERE datetime(expires_at) <= datetime('now')");
  }
}

export default UsuarioModel;
