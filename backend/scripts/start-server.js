import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const MAX_SUPPORTED_MAJOR = 24;
const localAppData = process.env.LOCALAPPDATA || path.join(homedir(), 'AppData', 'Local');
const wingetLtsNode = path.join(
  localAppData,
  'Microsoft',
  'WinGet',
  'Packages',
  'OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe',
  'node-v24.14.0-win-x64',
  'node.exe'
);

function parseMajor(version) {
  const major = Number(String(version || '').replace(/^v/, '').split('.')[0]);
  return Number.isFinite(major) ? major : 0;
}

function runWith(nodePath) {
  const child = spawn(nodePath, ['server.js'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
    windowsHide: false
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });

  child.on('error', (err) => {
    console.error('[ERRO] Falha ao iniciar servidor:', err.message);
    process.exit(1);
  });
}

const currentMajor = parseMajor(process.version);
if (currentMajor && currentMajor <= MAX_SUPPORTED_MAJOR) {
  runWith(process.execPath);
} else {
  const forcedNode = process.env.PDV_NODE_PATH;
  const fallbackCandidates = [forcedNode, wingetLtsNode].filter(Boolean);
  const compatibleNode = fallbackCandidates.find((candidate) => existsSync(candidate));

  if (!compatibleNode) {
    console.error('[ERRO] Node incompativel com sqlite3.');
    console.error(`Versao atual: ${process.version}. Use Node ${MAX_SUPPORTED_MAJOR}.x ou menor.`);
    console.error('Instale Node LTS e rode: npm rebuild sqlite3');
    process.exit(1);
  }

  console.warn(
    `[AVISO] Node atual ${process.version} nao e compativel com sqlite3. ` +
    `Iniciando com Node LTS em: ${compatibleNode}`
  );
  runWith(compatibleNode);
}