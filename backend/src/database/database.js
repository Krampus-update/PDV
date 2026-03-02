import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../../pdv.db');

let db = null;

function getDatabase() {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
      } else {
        // Habilitar foreign keys
        db.run('PRAGMA foreign_keys = ON', (error) => {
          if (error) reject(error);
          else resolve(db);
        });
      }
    });
  });
}

// Wrapper para executar queries com Promises
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
      db.run(query, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    }
  });
}

async function initializeDatabase() {
  const database = await getDatabase();

  const queries = [
    // Tabela de versão do schema
    `CREATE TABLE IF NOT EXISTS schema_version (
      id INTEGER PRIMARY KEY,
      version INTEGER NOT NULL DEFAULT 1,
      seed_data_inserted BOOLEAN DEFAULT 0
    )`,

    // Tabela de Produtos
    `CREATE TABLE IF NOT EXISTS produtos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE,
      preco DECIMAL(10, 2) NOT NULL,
      estoque INTEGER NOT NULL DEFAULT 0,
      estoque_minimo INTEGER NOT NULL DEFAULT 0,
      tipo TEXT NOT NULL CHECK(tipo IN ('simples', 'composto')),
      ativo BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Tabela de Vendas
    `CREATE TABLE IF NOT EXISTS vendas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL CHECK(tipo IN ('bar', 'fastfood')),
      status TEXT NOT NULL CHECK(status IN ('aberta', 'em_preparo', 'pronta', 'fechada')) DEFAULT 'aberta',
      numero_pedido INTEGER,
      mesa TEXT,
      total DECIMAL(10, 2) NOT NULL DEFAULT 0,
      forma_pagamento TEXT,
      observacoes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      closed_at DATETIME,
      UNIQUE(numero_pedido)
    )`,

    // Tabela de Itens de Venda
    `CREATE TABLE IF NOT EXISTS venda_itens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venda_id INTEGER NOT NULL,
      produto_id INTEGER NOT NULL,
      quantidade INTEGER NOT NULL,
      preco_unitario DECIMAL(10, 2) NOT NULL,
      subtotal DECIMAL(10, 2) NOT NULL,
      observacoes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (venda_id) REFERENCES vendas(id) ON DELETE CASCADE,
      FOREIGN KEY (produto_id) REFERENCES produtos(id)
    )`,

    // Tabela de Ficha Técnica (para produtos compostos)
    `CREATE TABLE IF NOT EXISTS ficha_tecnica (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      produto_id INTEGER NOT NULL,
      ingrediente_id INTEGER NOT NULL,
      quantidade_necessaria DECIMAL(10, 2) NOT NULL,
      unidade TEXT DEFAULT 'un',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE,
      FOREIGN KEY (ingrediente_id) REFERENCES produtos(id)
    )`
  ];

  // Executar cada query
  for (const query of queries) {
    await runQuery(database, query);
  }

  // adicionar coluna mesa se não existir (atualização de esquema)
  let cols = await dbAll("PRAGMA table_info(vendas)");
  if (!cols.some(c => c.name === 'mesa')) {
    await runQuery(database, 'ALTER TABLE vendas ADD COLUMN mesa TEXT');
  }

  // garantir campo imagem em produtos (para fotos ou base64)
  cols = await dbAll("PRAGMA table_info(produtos)");
  if (!cols.some(c => c.name === 'imagem')) {
    await runQuery(database, 'ALTER TABLE produtos ADD COLUMN imagem TEXT');
  }

  // Inserir produtos de exemplo se a tabela estiver vazia
  try {
    let schemaVersion = await dbGet('SELECT version, seed_data_inserted FROM schema_version LIMIT 1');
    
    if (!schemaVersion) {
      await runQuery(database, 'INSERT INTO schema_version (version, seed_data_inserted) VALUES (1, 0)');
      schemaVersion = { version: 1, seed_data_inserted: 0 };
    }

    if (!schemaVersion.seed_data_inserted) {
      const produtosInicial = [
        { nome: 'Água', preco: 3.00, estoque: 50, estoque_minimo: 10, tipo: 'simples' },
        { nome: 'Refrigerante', preco: 5.00, estoque: 40, estoque_minimo: 10, tipo: 'simples' },
        { nome: 'Suco', preco: 6.00, estoque: 30, estoque_minimo: 5, tipo: 'simples' },
        { nome: 'Cerveja', preco: 8.00, estoque: 50, estoque_minimo: 10, tipo: 'simples' },
        { nome: 'Chopp', preco: 12.00, estoque: 100, estoque_minimo: 20, tipo: 'simples' },
        { nome: 'Hambúrguer', preco: 25.00, estoque: 20, estoque_minimo: 5, tipo: 'simples' },
        { nome: 'Pastel', preco: 8.00, estoque: 30, estoque_minimo: 5, tipo: 'simples' },
        { nome: 'Batata Frita', preco: 12.00, estoque: 25, estoque_minimo: 5, tipo: 'simples' },
        { nome: 'Comida Composição', preco: 35.00, estoque: 15, estoque_minimo: 3, tipo: 'composto' },
        { nome: 'Moqueca', preco: 45.00, estoque: 10, estoque_minimo: 2, tipo: 'composto' }
      ];

      for (const produto of produtosInicial) {
        try {
          await runQuery(
            database,
            `INSERT INTO produtos (nome, preco, estoque, estoque_minimo, tipo, ativo) VALUES (?, ?, ?, ?, ?, 1)`,
            [produto.nome, produto.preco, produto.estoque, produto.estoque_minimo, produto.tipo]
          );
        } catch {
          // Produto já existe, ignorar
        }
      }
      
      // Marcar seed data como inserida
      await runQuery(database, 'UPDATE schema_version SET seed_data_inserted = 1');
      console.log('✓ Produtos de exemplo inseridos com sucesso');
    }
  } catch (error) {
    console.warn('Aviso ao inserir produtos de exemplo:', error.message);
  }

  // Criar índices
  const indexQueries = [
    'CREATE INDEX IF NOT EXISTS idx_vendas_tipo ON vendas(tipo)',
    'CREATE INDEX IF NOT EXISTS idx_vendas_status ON vendas(status)',
    'CREATE INDEX IF NOT EXISTS idx_vendas_created_at ON vendas(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_venda_itens_venda_id ON venda_itens(venda_id)',
    'CREATE INDEX IF NOT EXISTS idx_ficha_tecnica_produto_id ON ficha_tecnica(produto_id)'
  ];

  for (const query of indexQueries) {
    await runQuery(database, query);
  }

  console.log('✓ Banco de dados inicializado com sucesso');
  return database;
}

// Funções auxiliares para simplificar o uso da API
async function dbRun(query, params = []) {
  const db = await getDatabase();
  return runQuery(db, query, params);
}

async function dbGet(query, params = []) {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function dbAll(query, params = []) {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export { getDatabase, initializeDatabase, dbRun, dbGet, dbAll };
