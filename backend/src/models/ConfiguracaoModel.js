import { dbAll, dbGet, dbRun } from '../database/database.js';

class ConfiguracaoModel {
  static async obter(chave, valorPadrao = null) {
    const row = await dbGet('SELECT valor FROM configuracoes WHERE chave = ?', [String(chave)]);
    return row ? row.valor : valorPadrao;
  }

  static async definir(chave, valor) {
    await dbRun(
      `INSERT INTO configuracoes (chave, valor, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, updated_at = CURRENT_TIMESTAMP`,
      [String(chave), String(valor ?? '')]
    );
  }

  static async obterPorPrefixo(prefixo) {
    const rows = await dbAll('SELECT chave, valor FROM configuracoes WHERE chave LIKE ?', [`${String(prefixo)}%`]);
    return rows.reduce((acc, row) => {
      acc[row.chave] = row.valor;
      return acc;
    }, {});
  }
}

export default ConfiguracaoModel;
