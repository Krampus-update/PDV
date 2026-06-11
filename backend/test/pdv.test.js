import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';

process.env.NODE_ENV = 'test';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const testDataDir = path.join(testDir, '..', 'test-data');

await fs.rm(testDataDir, { recursive: true, force: true });

const database = await import('../src/database/database.js');
const auth = await import('../src/middlewares/auth.js');
const pix = await import('../src/services/pixService.js');

after(async () => {
  try {
    await database.closeTenantDatabase('testa01');
  } catch {}
  try {
    await database.closeTenantDatabase('testb01');
  } catch {}
  try {
    await fs.rm(testDataDir, { recursive: true, force: true });
  } catch {}
});

test('normaliza roles e códigos de tenant', () => {
  assert.equal(auth.normalizeRole('ADMIN'), 'gerente');
  assert.equal(auth.normalizeRole('cozinha'), 'funcionario');
  assert.equal(database.sanitizeTenantCode('rest_01'), 'rest_01');
  assert.throws(() => database.sanitizeTenantCode('x'), /inválido/i);
});

test('valida chaves PIX comuns e gera payload EMV', () => {
  assert.equal(pix.validarChavePix('user@example.com').ok, true);
  assert.equal(pix.validarChavePix('+5511999999999').ok, true);
  assert.equal(pix.validarChavePix('chave-invalida').ok, false);

  const payload = pix.buildPixPayload({
    chave: 'user@example.com',
    nome: 'RESTAURANTE',
    cidade: 'SAO PAULO',
    valor: 12.34,
    txid: 'PDV123'
  });

  assert.match(payload, /^000201/);
  assert.match(payload, /BR\.GOV\.BCB\.PIX/);
  assert.match(payload.slice(-4), /^[0-9A-F]{4}$/);
});

test('isola dados entre tenants', async () => {
  const t1 = 'testa01';
  const t2 = 'testb01';

  await database.registerTenant({ code: t1, nome: 'Teste A' });
  await database.registerTenant({ code: t2, nome: 'Teste B' });
  await database.initializeTenantDatabase(t1);
  await database.initializeTenantDatabase(t2);

  await database.runWithTenant(t1, async () => {
    await database.dbRun(
      "INSERT INTO produtos (nome, preco, estoque, estoque_minimo, tipo, categoria, destaque, popularidade, opcoes_json, promocao_tipo, promocao_param_json, imagem, vai_cozinha, ativo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)",
      ['Produto Tenant A', 10, 5, 0, 'simples', 'geral', 0, 0, null, 'nenhuma', null, null, 0]
    );
  });

  const encontradoA = await database.runWithTenant(t1, async () => database.dbGet('SELECT nome FROM produtos WHERE nome = ?', ['Produto Tenant A']));
  const encontradoB = await database.runWithTenant(t2, async () => database.dbGet('SELECT nome FROM produtos WHERE nome = ?', ['Produto Tenant A']));

  assert.equal(encontradoA?.nome, 'Produto Tenant A');
  assert.ok(!encontradoB);
});
