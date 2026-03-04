import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../../pdv.db');
const backupDir = path.join(__dirname, '../../backups');

function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function criarBackupManual() {
  await fs.mkdir(backupDir, { recursive: true });
  const file = path.join(backupDir, `pdv-${stamp()}.db`);
  await fs.copyFile(dbPath, file);
  return file;
}

async function listarBackups() {
  await fs.mkdir(backupDir, { recursive: true });
  const files = await fs.readdir(backupDir);
  const stats = await Promise.all(
    files
      .filter((f) => f.endsWith('.db'))
      .map(async (f) => {
        const full = path.join(backupDir, f);
        const st = await fs.stat(full);
        return {
          arquivo: f,
          caminho: full,
          tamanho: st.size,
          updated_at: st.mtime.toISOString()
        };
      })
  );
  return stats.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

function iniciarAutoBackup({ intervalMs = 6 * 60 * 60 * 1000, manter = 40 } = {}) {
  const timer = setInterval(async () => {
    try {
      await criarBackupManual();
      const backups = await listarBackups();
      const excess = backups.slice(manter);
      await Promise.all(excess.map((b) => fs.unlink(b.caminho).catch(() => null)));
      console.log(`✓ Auto-backup executado (${new Date().toISOString()})`);
    } catch (e) {
      console.warn('Falha no auto-backup:', e.message);
    }
  }, intervalMs);
  return timer;
}

export { criarBackupManual, listarBackups, iniciarAutoBackup };
