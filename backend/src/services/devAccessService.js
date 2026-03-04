import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const devSecretFile = path.join(__dirname, '../../.dev-password');

const DEV_LOGIN = 'devroot';

async function getDevPassword() {
  if (process.env.PDV_DEV_PASSWORD && process.env.PDV_DEV_PASSWORD.trim()) {
    return process.env.PDV_DEV_PASSWORD.trim();
  }

  try {
    const value = (await fs.readFile(devSecretFile, 'utf-8')).trim();
    if (value) return value;
  } catch {
    // arquivo ainda nao existe
  }

  const generated = crypto.randomBytes(18).toString('base64url');
  await fs.writeFile(devSecretFile, generated, 'utf-8');
  return generated;
}

export { DEV_LOGIN, getDevPassword };
