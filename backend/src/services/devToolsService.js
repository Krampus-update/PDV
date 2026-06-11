import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { closeTenantDatabase, getCurrentTenantCode, sanitizeTenantCode } from '../database/database.js';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '../../');
const projectRoot = path.resolve(backendDir, '..');
const tenantsDir = path.join(backendDir, 'tenants');
const backupsDir = path.join(backendDir, 'backups', 'dev-reset');
const startupShortcutPath = path.join(
  process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming'),
  'Microsoft',
  'Windows',
  'Start Menu',
  'Programs',
  'Startup',
  'PDV - Iniciar.lnk'
);
const startScriptPath = path.join(projectRoot, 'INICIAR_PDV.bat');

function getTenantDbPath(tenantCode) {
  const code = sanitizeTenantCode(tenantCode || getCurrentTenantCode());
  return path.join(tenantsDir, `${code}.db`);
}

function getTenantJournalPaths(dbPath) {
  return [dbPath, `${dbPath}-wal`, `${dbPath}-shm`, `${dbPath}-journal`];
}

async function resetTenantDatabase(tenantCode = null) {
  const code = sanitizeTenantCode(tenantCode || getCurrentTenantCode());
  const dbPath = getTenantDbPath(code);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupsDir, code, stamp);
  await fs.mkdir(backupPath, { recursive: true });
  await closeTenantDatabase(code).catch(() => null);

  const files = getTenantJournalPaths(dbPath);
  const copied = [];
  for (const file of files) {
    if (!existsSync(file)) continue;
    const name = path.basename(file);
    await fs.copyFile(file, path.join(backupPath, name));
    copied.push(name);
  }

  for (const file of files) {
    if (existsSync(file)) {
      await fs.unlink(file);
    }
  }

  return {
    tenant: code,
    backupPath,
    copied
  };
}

function buildShortcutScript(targetPath, workingDirectory, shortcutPath) {
  const esc = (v) => String(v).replace(/'/g, "''");
  return `
$ws = New-Object -ComObject WScript.Shell
$lnk = $ws.CreateShortcut('${esc(shortcutPath)}')
$lnk.TargetPath = '${esc(targetPath)}'
$lnk.WorkingDirectory = '${esc(workingDirectory)}'
$lnk.IconLocation = 'C:\\Windows\\System32\\shell32.dll,25'
$lnk.Save()
`.trim();
}

async function installAutostart() {
  await fs.mkdir(path.dirname(startupShortcutPath), { recursive: true });
  if (!existsSync(startScriptPath)) {
    throw new Error('Script de inicio não encontrado');
  }

  const script = buildShortcutScript(startScriptPath, projectRoot, startupShortcutPath);
  await execFileAsync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    windowsHide: true
  });

  return {
    installed: true,
    shortcutPath: startupShortcutPath
  };
}

async function removeAutostart() {
  if (existsSync(startupShortcutPath)) {
    await fs.unlink(startupShortcutPath);
  }
  return {
    installed: false,
    shortcutPath: startupShortcutPath
  };
}

async function getMaintenanceStatus(tenantCode = null) {
  const code = sanitizeTenantCode(tenantCode || getCurrentTenantCode());
  return {
    tenant: code,
    tenantDbExists: existsSync(getTenantDbPath(code)),
    autostartInstalled: existsSync(startupShortcutPath),
    autostartShortcutPath: startupShortcutPath,
    startScriptExists: existsSync(startScriptPath)
  };
}

export { getMaintenanceStatus, installAutostart, removeAutostart, resetTenantDatabase };
