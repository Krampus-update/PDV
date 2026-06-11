import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs/promises';
import { AsyncLocalStorage } from 'async_hooks';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tenantsDir = path.join(__dirname, '../../tenants');
const centralDbPath = path.join(__dirname, '../../central.db');

const tenantStorage = new AsyncLocalStorage();
const tenantConnections = new Map();
let centralDb = null;

function sanitizeTenantCode(code) {
  const v = String(code || '').trim().toLowerCase();
  if (!/^[a-z0-9_-]{3,40}$/.test(v)) {
    throw new Error('Código do restaurante inválido (use 3-40 chars: a-z, 0-9, _, -)');
  }
  return v;
}

function getCurrentTenantCode() {
  return tenantStorage.getStore()?.tenant || 'default';
}

function getTenantDbPath(code) {
  const tenant = sanitizeTenantCode(code);
  return path.join(tenantsDir, `${tenant}.db`);
}

function runQuery(db, query, params = []) {
  return new Promise((resolve, reject) => {
    if (query.trim().toUpperCase().startsWith('SELECT')) {
      if (query.includes('FROM') && query.includes('WHERE')) {
        db.all(query, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      } else {
        db.get(query, params, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      }
    } else {
      db.run(query, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    }
  });
}

async function getCentralDatabase() {
  if (centralDb) return centralDb;
  await fs.mkdir(tenantsDir, { recursive: true });
  centralDb = await new Promise((resolve, reject) => {
    const db = new sqlite3.Database(centralDbPath, (err) => {
      if (err) reject(err);
      else resolve(db);
    });
  });
  return centralDb;
}

async function getTenantDatabase(code = getCurrentTenantCode()) {
  const tenant = sanitizeTenantCode(code);
  if (tenantConnections.has(tenant)) return tenantConnections.get(tenant);

  await fs.mkdir(tenantsDir, { recursive: true });
  const dbPath = getTenantDbPath(tenant);
  const db = await new Promise((resolve, reject) => {
    const conn = new sqlite3.Database(dbPath, (err) => {
      if (err) reject(err);
      else resolve(conn);
    });
  });
  await runQuery(db, 'PRAGMA foreign_keys = ON');
  tenantConnections.set(tenant, db);
  return db;
}

async function initializeCentralDatabase() {
  const db = await getCentralDatabase();
  await runQuery(
    db,
    `CREATE TABLE IF NOT EXISTS tenants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      nome TEXT NOT NULL,
      ativo BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  );
  await runQuery(db, 'CREATE INDEX IF NOT EXISTS idx_tenants_code ON tenants(code)');
}

async function tenantExists(code) {
  const db = await getCentralDatabase();
  const tenant = sanitizeTenantCode(code);
  const row = await new Promise((resolve, reject) => {
    db.get('SELECT id, code, nome, ativo FROM tenants WHERE code = ? AND ativo = 1', [tenant], (err, r) => {
      if (err) reject(err);
      else resolve(r || null);
    });
  });
  return row;
}

async function registerTenant({ code, nome }) {
  const db = await getCentralDatabase();
  const tenant = sanitizeTenantCode(code);
  const exists = await tenantExists(tenant);
  if (exists) throw new Error('Restaurante já existe');
  await runQuery(db, 'INSERT INTO tenants (code, nome, ativo) VALUES (?, ?, 1)', [tenant, nome || tenant]);
  return tenant;
}

async function listTenants() {
  const db = await getCentralDatabase();
  return new Promise((resolve, reject) => {
    db.all('SELECT id, code, nome, ativo, created_at FROM tenants ORDER BY nome', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function tenantSchemaQueries() {
  return [
    `CREATE TABLE IF NOT EXISTS schema_version (
      id INTEGER PRIMARY KEY,
      version INTEGER NOT NULL DEFAULT 1,
      seed_data_inserted BOOLEAN DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS produtos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE,
      preco DECIMAL(10, 2) NOT NULL,
      estoque INTEGER NOT NULL DEFAULT 0,
      estoque_minimo INTEGER NOT NULL DEFAULT 0,
      tipo TEXT NOT NULL CHECK(tipo IN ('simples', 'composto')),
      categoria TEXT NOT NULL DEFAULT 'geral',
      destaque BOOLEAN DEFAULT 0,
      popularidade INTEGER NOT NULL DEFAULT 0,
      opcoes_json TEXT,
      promocao_tipo TEXT DEFAULT 'nenhuma',
      promocao_param_json TEXT,
      vai_cozinha BOOLEAN DEFAULT 0,
      imagem TEXT,
      ativo BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS vendas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL CHECK(tipo IN ('bar', 'fastfood')),
      status TEXT NOT NULL CHECK(status IN ('aberta', 'em_preparo', 'pronta', 'fechada')) DEFAULT 'aberta',
      numero_pedido INTEGER,
      mesa TEXT,
      cliente_id INTEGER,
      auto_cliente_nome TEXT,
      auto_cliente_contato TEXT,
      origem TEXT DEFAULT 'operador',
      aprovacao_status TEXT DEFAULT 'aprovado',
      caixa_sessao_id INTEGER,
      subtotal_bruto DECIMAL(10, 2) NOT NULL DEFAULT 0,
      desconto_tipo TEXT,
      desconto_valor DECIMAL(10,2) NOT NULL DEFAULT 0,
      desconto_descricao TEXT,
      acrescimo_valor DECIMAL(10,2) NOT NULL DEFAULT 0,
      valor_pago DECIMAL(10,2),
      troco_valor DECIMAL(10,2),
      split_mode TEXT,
      split_payload_json TEXT,
      pagamento_provider TEXT,
      pagamento_status TEXT,
      pagamento_transacao_id TEXT,
      pix_payload TEXT,
      pix_chave_utilizada TEXT,
      total DECIMAL(10, 2) NOT NULL DEFAULT 0,
      forma_pagamento TEXT,
      observacoes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      closed_at DATETIME,
      UNIQUE(numero_pedido)
    )`,
    `CREATE TABLE IF NOT EXISTS venda_itens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venda_id INTEGER NOT NULL,
      produto_id INTEGER NOT NULL,
      quantidade INTEGER NOT NULL,
      preco_unitario DECIMAL(10, 2) NOT NULL,
      consumo_estoque INTEGER NOT NULL DEFAULT 1,
      subtotal DECIMAL(10, 2) NOT NULL,
      observacoes TEXT,
      status_item TEXT NOT NULL DEFAULT 'anotado',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (venda_id) REFERENCES vendas(id) ON DELETE CASCADE,
      FOREIGN KEY (produto_id) REFERENCES produtos(id)
    )`,
    `CREATE TABLE IF NOT EXISTS ficha_tecnica (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      produto_id INTEGER NOT NULL,
      ingrediente_id INTEGER NOT NULL,
      quantidade_necessaria DECIMAL(10, 2) NOT NULL,
      unidade TEXT DEFAULT 'un',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE,
      FOREIGN KEY (ingrediente_id) REFERENCES produtos(id)
    )`,
    `CREATE TABLE IF NOT EXISTS historico_transacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo_entidade TEXT NOT NULL,
      entidade_id INTEGER,
      acao TEXT NOT NULL,
      detalhes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      telefone TEXT,
      observacoes TEXT,
      pontos INTEGER NOT NULL DEFAULT 0,
      ativo BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      login TEXT NOT NULL UNIQUE,
      senha_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('dev', 'gerente', 'funcionario')),
      ativo BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS sessoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS configuracoes (
      chave TEXT PRIMARY KEY,
      valor TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS promocoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      descricao TEXT,
      tipo TEXT NOT NULL DEFAULT 'combo_produto',
      produto_id INTEGER,
      variacao_nome TEXT,
      produto_bonus_id INTEGER,
      produto_bonus_quantidade INTEGER NOT NULL DEFAULT 1,
      quantidade_min INTEGER NOT NULL DEFAULT 0,
      repetir_na_venda BOOLEAN DEFAULT 1,
      preco_combo DECIMAL(10,2),
      desconto_percentual DECIMAL(10,2),
      desconto_fixo DECIMAL(10,2),
      data_inicio DATETIME,
      data_fim DATETIME,
      ativo BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (produto_id) REFERENCES produtos(id)
    )`,
    `CREATE TABLE IF NOT EXISTS caixa_sessoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      aberto_por INTEGER,
      fechado_por INTEGER,
      saldo_inicial DECIMAL(10,2) NOT NULL DEFAULT 0,
      saldo_final_informado DECIMAL(10,2),
      total_vendas DECIMAL(10,2) NOT NULL DEFAULT 0,
      total_comandas INTEGER NOT NULL DEFAULT 0,
      observacoes TEXT,
      aberto_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      fechado_em DATETIME
    )`
  ];
}

async function migrateUsuariosRoleSchema(db) {
  const table = await new Promise((resolve, reject) => {
    db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='usuarios'", [], (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
  const sql = String(table?.sql || '').toLowerCase();
  if (!sql || sql.includes("'gerente'")) return;

  await runQuery(db, 'PRAGMA foreign_keys = OFF');
  await runQuery(db, 'ALTER TABLE usuarios RENAME TO usuarios_legacy');
  await runQuery(
    db,
    `CREATE TABLE usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      login TEXT NOT NULL UNIQUE,
      senha_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('dev', 'gerente', 'funcionario')),
      ativo BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  );
  await runQuery(
    db,
    `INSERT INTO usuarios (id, nome, login, senha_hash, role, ativo, created_at)
     SELECT
       id,
       nome,
       login,
       senha_hash,
       CASE
         WHEN role = 'admin' THEN 'gerente'
         ELSE 'funcionario'
       END AS role,
       ativo,
       created_at
     FROM usuarios_legacy`
  );
  await runQuery(db, 'DROP TABLE IF EXISTS sessoes');
  await runQuery(
    db,
    `CREATE TABLE IF NOT EXISTS sessoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    )`
  );
  await runQuery(db, 'DROP TABLE usuarios_legacy');
  await runQuery(db, 'PRAGMA foreign_keys = ON');
}

async function initializeTenantDatabase(code) {
  const db = await getTenantDatabase(code);

  for (const query of tenantSchemaQueries()) {
    await runQuery(db, query);
  }
  await migrateUsuariosRoleSchema(db);

  const cols = await dbAll("PRAGMA table_info(vendas)", [], code);
  if (!cols.some((c) => c.name === 'mesa')) {
    await runQuery(db, 'ALTER TABLE vendas ADD COLUMN mesa TEXT');
  }
  if (!cols.some((c) => c.name === 'cliente_id')) {
    await runQuery(db, 'ALTER TABLE vendas ADD COLUMN cliente_id INTEGER');
  }
  if (!cols.some((c) => c.name === 'caixa_sessao_id')) {
    await runQuery(db, 'ALTER TABLE vendas ADD COLUMN caixa_sessao_id INTEGER');
  }
  if (!cols.some((c) => c.name === 'subtotal_bruto')) {
    await runQuery(db, 'ALTER TABLE vendas ADD COLUMN subtotal_bruto DECIMAL(10,2) NOT NULL DEFAULT 0');
  }
  if (!cols.some((c) => c.name === 'desconto_tipo')) {
    await runQuery(db, 'ALTER TABLE vendas ADD COLUMN desconto_tipo TEXT');
  }
  if (!cols.some((c) => c.name === 'desconto_valor')) {
    await runQuery(db, 'ALTER TABLE vendas ADD COLUMN desconto_valor DECIMAL(10,2) NOT NULL DEFAULT 0');
  }
  if (!cols.some((c) => c.name === 'desconto_descricao')) {
    await runQuery(db, 'ALTER TABLE vendas ADD COLUMN desconto_descricao TEXT');
  }
  if (!cols.some((c) => c.name === 'acrescimo_valor')) {
    await runQuery(db, 'ALTER TABLE vendas ADD COLUMN acrescimo_valor DECIMAL(10,2) NOT NULL DEFAULT 0');
  }
  if (!cols.some((c) => c.name === 'valor_pago')) {
    await runQuery(db, 'ALTER TABLE vendas ADD COLUMN valor_pago DECIMAL(10,2)');
  }
  if (!cols.some((c) => c.name === 'troco_valor')) {
    await runQuery(db, 'ALTER TABLE vendas ADD COLUMN troco_valor DECIMAL(10,2)');
  }
  if (!cols.some((c) => c.name === 'split_mode')) {
    await runQuery(db, 'ALTER TABLE vendas ADD COLUMN split_mode TEXT');
  }
  if (!cols.some((c) => c.name === 'split_payload_json')) {
    await runQuery(db, 'ALTER TABLE vendas ADD COLUMN split_payload_json TEXT');
  }
  if (!cols.some((c) => c.name === 'pagamento_provider')) {
    await runQuery(db, 'ALTER TABLE vendas ADD COLUMN pagamento_provider TEXT');
  }
  if (!cols.some((c) => c.name === 'pagamento_status')) {
    await runQuery(db, 'ALTER TABLE vendas ADD COLUMN pagamento_status TEXT');
  }
  if (!cols.some((c) => c.name === 'auto_cliente_nome')) {
    await runQuery(db, 'ALTER TABLE vendas ADD COLUMN auto_cliente_nome TEXT');
  }
  if (!cols.some((c) => c.name === 'auto_cliente_contato')) {
    await runQuery(db, 'ALTER TABLE vendas ADD COLUMN auto_cliente_contato TEXT');
  }
  if (!cols.some((c) => c.name === 'origem')) {
    await runQuery(db, "ALTER TABLE vendas ADD COLUMN origem TEXT DEFAULT 'operador'");
  }
  if (!cols.some((c) => c.name === 'aprovacao_status')) {
    await runQuery(db, "ALTER TABLE vendas ADD COLUMN aprovacao_status TEXT DEFAULT 'aprovado'");
  }
  if (!cols.some((c) => c.name === 'pagamento_transacao_id')) {
    await runQuery(db, 'ALTER TABLE vendas ADD COLUMN pagamento_transacao_id TEXT');
  }
  if (!cols.some((c) => c.name === 'pix_payload')) {
    await runQuery(db, 'ALTER TABLE vendas ADD COLUMN pix_payload TEXT');
  }
  if (!cols.some((c) => c.name === 'pix_chave_utilizada')) {
    await runQuery(db, 'ALTER TABLE vendas ADD COLUMN pix_chave_utilizada TEXT');
  }
  const itensCols = await dbAll("PRAGMA table_info(venda_itens)", [], code);
  if (!itensCols.some((c) => c.name === 'consumo_estoque')) {
    await runQuery(db, 'ALTER TABLE venda_itens ADD COLUMN consumo_estoque INTEGER NOT NULL DEFAULT 1');
  }
  if (!cols.some((c) => c.name === 'promocao_aplicada_id')) {
    await runQuery(db, 'ALTER TABLE vendas ADD COLUMN promocao_aplicada_id INTEGER');
  }
  const promoCols = await dbAll("PRAGMA table_info(promocoes)", [], code);
  if (!promoCols.some((c) => c.name === 'repetir_na_venda')) {
    await runQuery(db, 'ALTER TABLE promocoes ADD COLUMN repetir_na_venda BOOLEAN DEFAULT 1');
  }
  if (!promoCols.some((c) => c.name === 'variacao_nome')) {
    await runQuery(db, 'ALTER TABLE promocoes ADD COLUMN variacao_nome TEXT');
  }
  if (!promoCols.some((c) => c.name === 'produto_bonus_id')) {
    await runQuery(db, 'ALTER TABLE promocoes ADD COLUMN produto_bonus_id INTEGER');
  }
  if (!promoCols.some((c) => c.name === 'produto_bonus_quantidade')) {
    await runQuery(db, 'ALTER TABLE promocoes ADD COLUMN produto_bonus_quantidade INTEGER NOT NULL DEFAULT 1');
  }
  const prodCols = await dbAll("PRAGMA table_info(produtos)", [], code);
  const vendaItemCols = await dbAll("PRAGMA table_info(venda_itens)", [], code);
  if (!vendaItemCols.some((c) => c.name === 'status_item')) {
    await runQuery(db, "ALTER TABLE venda_itens ADD COLUMN status_item TEXT NOT NULL DEFAULT 'anotado'");
  }
  if (!prodCols.some((c) => c.name === 'imagem')) {
    await runQuery(db, 'ALTER TABLE produtos ADD COLUMN imagem TEXT');
  }
  if (!prodCols.some((c) => c.name === 'vai_cozinha')) {
    await runQuery(db, 'ALTER TABLE produtos ADD COLUMN vai_cozinha BOOLEAN DEFAULT 0');
  }
  if (!prodCols.some((c) => c.name === 'categoria')) {
    await runQuery(db, "ALTER TABLE produtos ADD COLUMN categoria TEXT NOT NULL DEFAULT 'geral'");
  }
  if (!prodCols.some((c) => c.name === 'destaque')) {
    await runQuery(db, 'ALTER TABLE produtos ADD COLUMN destaque BOOLEAN DEFAULT 0');
  }
  if (!prodCols.some((c) => c.name === 'popularidade')) {
    await runQuery(db, 'ALTER TABLE produtos ADD COLUMN popularidade INTEGER NOT NULL DEFAULT 0');
  }
  if (!prodCols.some((c) => c.name === 'opcoes_json')) {
    await runQuery(db, 'ALTER TABLE produtos ADD COLUMN opcoes_json TEXT');
  }
  if (!prodCols.some((c) => c.name === 'promocao_tipo')) {
    await runQuery(db, "ALTER TABLE produtos ADD COLUMN promocao_tipo TEXT DEFAULT 'nenhuma'");
  }
  if (!prodCols.some((c) => c.name === 'promocao_param_json')) {
    await runQuery(db, 'ALTER TABLE produtos ADD COLUMN promocao_param_json TEXT');
  }

  const indexQueries = [
    'CREATE INDEX IF NOT EXISTS idx_vendas_tipo ON vendas(tipo)',
    'CREATE INDEX IF NOT EXISTS idx_vendas_status ON vendas(status)',
    'CREATE INDEX IF NOT EXISTS idx_vendas_created_at ON vendas(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_vendas_cliente_id ON vendas(cliente_id)',
    'CREATE INDEX IF NOT EXISTS idx_vendas_caixa_sessao_id ON vendas(caixa_sessao_id)',
    'CREATE INDEX IF NOT EXISTS idx_vendas_promocao_aplicada_id ON vendas(promocao_aplicada_id)',
    'CREATE INDEX IF NOT EXISTS idx_venda_itens_venda_id ON venda_itens(venda_id)',
    'CREATE INDEX IF NOT EXISTS idx_ficha_tecnica_produto_id ON ficha_tecnica(produto_id)',
    'CREATE INDEX IF NOT EXISTS idx_historico_entidade ON historico_transacoes(tipo_entidade, entidade_id)',
    'CREATE INDEX IF NOT EXISTS idx_historico_created_at ON historico_transacoes(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_clientes_nome ON clientes(nome)',
    'CREATE INDEX IF NOT EXISTS idx_clientes_telefone ON clientes(telefone)',
    'CREATE INDEX IF NOT EXISTS idx_usuarios_login ON usuarios(login)',
    'CREATE INDEX IF NOT EXISTS idx_sessoes_token ON sessoes(token)',
    'CREATE INDEX IF NOT EXISTS idx_sessoes_expires ON sessoes(expires_at)',
    'CREATE INDEX IF NOT EXISTS idx_caixa_aberto_em ON caixa_sessoes(aberto_em)',
    'CREATE INDEX IF NOT EXISTS idx_caixa_fechado_em ON caixa_sessoes(fechado_em)',
    'CREATE INDEX IF NOT EXISTS idx_promocoes_ativo ON promocoes(ativo)',
    'CREATE INDEX IF NOT EXISTS idx_promocoes_produto_id ON promocoes(produto_id)'
  ];
  for (const query of indexQueries) await runQuery(db, query);

  // seed produtos padrão
  let schemaVersion = await dbGet('SELECT version, seed_data_inserted FROM schema_version LIMIT 1', [], code);
  if (!schemaVersion) {
    await runQuery(db, 'INSERT INTO schema_version (version, seed_data_inserted) VALUES (1, 0)');
    schemaVersion = { version: 1, seed_data_inserted: 0 };
  }

  if (!schemaVersion.seed_data_inserted) {
    const produtosInicial = [
      { nome: 'Água', preco: 3.0, estoque: 50, estoque_minimo: 10, tipo: 'simples', categoria: 'bebidas', destaque: 0, popularidade: 2, opcoes_json: null, vai_cozinha: 0 },
      { nome: 'Refrigerante', preco: 5.0, estoque: 40, estoque_minimo: 10, tipo: 'simples', categoria: 'bebidas', destaque: 1, popularidade: 8, opcoes_json: null, vai_cozinha: 0 },
      { nome: 'Suco', preco: 6.0, estoque: 30, estoque_minimo: 5, tipo: 'simples', categoria: 'bebidas', destaque: 0, popularidade: 5, opcoes_json: null, vai_cozinha: 0 },
      { nome: 'Cerveja', preco: 8.0, estoque: 50, estoque_minimo: 10, tipo: 'simples', categoria: 'bebidas', destaque: 1, popularidade: 9, opcoes_json: null, vai_cozinha: 0 },
      { nome: 'Chopp', preco: 12.0, estoque: 100, estoque_minimo: 20, tipo: 'simples', categoria: 'bebidas', destaque: 1, popularidade: 10, opcoes_json: JSON.stringify([{nome:'300ml',extra:0},{nome:'500ml',extra:4},{nome:'1L',extra:12}]), vai_cozinha: 0 },
      { nome: 'Hambúrguer', preco: 25.0, estoque: 20, estoque_minimo: 5, tipo: 'simples', categoria: 'comidas', destaque: 1, popularidade: 9, opcoes_json: JSON.stringify([{nome:'Sem adicional',extra:0},{nome:'Bacon',extra:5},{nome:'Queijo extra',extra:3}]), vai_cozinha: 1 },
      { nome: 'Pastel', preco: 8.0, estoque: 30, estoque_minimo: 5, tipo: 'simples', categoria: 'comidas', destaque: 0, popularidade: 6, opcoes_json: null, vai_cozinha: 1 },
      { nome: 'Batata Frita', preco: 12.0, estoque: 25, estoque_minimo: 5, tipo: 'simples', categoria: 'comidas', destaque: 1, popularidade: 8, opcoes_json: JSON.stringify([{nome:'Pequena',extra:0},{nome:'Média',extra:5},{nome:'Grande',extra:10}]), vai_cozinha: 1 },
      { nome: 'Comida Composição', preco: 35.0, estoque: 15, estoque_minimo: 3, tipo: 'composto', categoria: 'comidas', destaque: 0, popularidade: 4, opcoes_json: null, vai_cozinha: 1 },
      { nome: 'Moqueca', preco: 45.0, estoque: 10, estoque_minimo: 2, tipo: 'composto', categoria: 'comidas', destaque: 0, popularidade: 3, opcoes_json: null, vai_cozinha: 1 }
    ];
    for (const p of produtosInicial) {
      try {
        await runQuery(
          db,
          `INSERT INTO produtos (nome, preco, estoque, estoque_minimo, tipo, categoria, destaque, popularidade, opcoes_json, vai_cozinha, ativo)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [p.nome, p.preco, p.estoque, p.estoque_minimo, p.tipo, p.categoria || 'geral', p.destaque ? 1 : 0, p.popularidade || 0, p.opcoes_json || null, p.vai_cozinha]
        );
      } catch {
        // ignore duplicates
      }
    }
    await runQuery(db, 'UPDATE schema_version SET seed_data_inserted = 1');
  }
}

async function initializeDatabase() {
  await initializeCentralDatabase();
  const defaultExists = await tenantExists('default');
  if (!defaultExists) {
    await registerTenant({ code: 'default', nome: 'Restaurante Padrão' });
  }
  await initializeTenantDatabase('default');
  console.log('✓ Banco de dados inicializado com sucesso');
}

function runWithTenant(tenantCode, fn) {
  const tenant = sanitizeTenantCode(tenantCode);
  return tenantStorage.run({ tenant }, fn);
}

async function dbRun(query, params = [], tenantCode = null) {
  const db = await getTenantDatabase(tenantCode || getCurrentTenantCode());
  return runQuery(db, query, params);
}

async function dbGet(query, params = [], tenantCode = null) {
  const db = await getTenantDatabase(tenantCode || getCurrentTenantCode());
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function dbAll(query, params = [], tenantCode = null) {
  const db = await getTenantDatabase(tenantCode || getCurrentTenantCode());
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export {
  initializeDatabase,
  initializeTenantDatabase,
  registerTenant,
  tenantExists,
  listTenants,
  runWithTenant,
  getCurrentTenantCode,
  sanitizeTenantCode,
  dbRun,
  dbGet,
  dbAll
};
