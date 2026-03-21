import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const legacyPasswordFile = path.join(__dirname, '../../.dev-password');
const passwordFile = path.join(__dirname, '../../.dev-password.json');

const DEV_LOGIN = 'devroot';
const DEFAULT_ITERATIONS = 210000;

function normalizePassword(v) {
  return String(v || '').trim();
}

function createPasswordRecord(password, iterations = DEFAULT_ITERATIONS) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(normalizePassword(password), salt, iterations, 64, 'sha512').toString('hex');
  return {
    version: 1,
    algorithm: 'pbkdf2',
    digest: 'sha512',
    iterations,
    salt,
    hash,
    updated_at: new Date().toISOString()
  };
}

function verifyPassword(password, record) {
  if (!record?.salt || !record?.hash) return false;
  const iterations = Number(record.iterations || DEFAULT_ITERATIONS);
  const digest = record.digest || 'sha512';
  const hash = crypto.pbkdf2Sync(normalizePassword(password), record.salt, iterations, 64, digest).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(record.hash, 'hex'));
}

async function readJson(file) {
  const raw = await fs.readFile(file, 'utf-8');
  return JSON.parse(raw);
}

async function writeJson(file, data) {
  await fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
}

async function loadLegacyPlainPassword() {
  try {
    const value = normalizePassword(await fs.readFile(legacyPasswordFile, 'utf-8'));
    return value || null;
  } catch {
    return null;
  }
}

async function getDevPasswordRecord() {
  try {
    const record = await readJson(passwordFile);
    if (record?.hash && record?.salt) return record;
  } catch {
    // segue para migração/criação
  }

  const legacy = await loadLegacyPlainPassword();
  if (legacy) {
    const record = createPasswordRecord(legacy);
    await writeJson(passwordFile, record);
    await fs.unlink(legacyPasswordFile).catch(() => {});
    return record;
  }

  const generated = crypto.randomBytes(18).toString('base64url');
  const record = createPasswordRecord(generated);
  await writeJson(passwordFile, record);
  return record;
}

async function getDevPassword() {
  const record = await getDevPasswordRecord();
  return {
    password: null,
    record
  };
}

async function resetDevPassword() {
  const password = crypto.randomBytes(18).toString('base64url');
  const record = createPasswordRecord(password);
  await writeJson(passwordFile, record);
  await fs.unlink(legacyPasswordFile).catch(() => {});
  return { password, record };
}

async function verifyDevPassword(password) {
  const record = await getDevPasswordRecord();
  return verifyPassword(password, record);
}

export {
  DEV_LOGIN,
  getDevPasswordRecord,
  getDevPassword,
  resetDevPassword,
  verifyDevPassword
};
