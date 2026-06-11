import net from 'net';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import ConfiguracaoModel from '../models/ConfiguracaoModel.js';

const DEFAULTS = {
  habilitada: false,
  tipo: 'rede',
  host: '',
  porta: 9100,
  impressora_local: '',
  auto_fechamento: false,
  auto_cozinha_item: false,
  nome: 'Impressora Termica',
  largura: 42,
  corte: true
};

function toBool(value, fallback = false) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const v = String(value).toLowerCase().trim();
  return v === '1' || v === 'true' || v === 'sim' || v === 'yes';
}

function toInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeConfig(raw = {}) {
  const cfg = {
    habilitada: toBool(raw.habilitada, DEFAULTS.habilitada),
    tipo: String(raw.tipo || DEFAULTS.tipo).toLowerCase().trim() === 'local' ? 'local' : 'rede',
    host: String(raw.host || '').trim(),
    porta: toInt(raw.porta, DEFAULTS.porta),
    impressora_local: String(raw.impressora_local || '').trim(),
    auto_fechamento: toBool(raw.auto_fechamento, DEFAULTS.auto_fechamento),
    auto_cozinha_item: toBool(raw.auto_cozinha_item, DEFAULTS.auto_cozinha_item),
    nome: String(raw.nome || DEFAULTS.nome).trim(),
    largura: toInt(raw.largura, DEFAULTS.largura),
    corte: toBool(raw.corte, DEFAULTS.corte)
  };
  if (cfg.largura < 32 || cfg.largura > 64) cfg.largura = DEFAULTS.largura;
  if (cfg.porta < 1 || cfg.porta > 65535) cfg.porta = DEFAULTS.porta;
  return cfg;
}

async function obterConfiguracao() {
  const map = await ConfiguracaoModel.obterPorPrefixo('impressora_');
  return normalizeConfig({
    habilitada: map.impressora_habilitada,
    tipo: map.impressora_tipo,
    host: map.impressora_host,
    porta: map.impressora_porta,
    impressora_local: map.impressora_local,
    auto_fechamento: map.impressora_auto_fechamento,
    auto_cozinha_item: map.impressora_auto_cozinha_item,
    nome: map.impressora_nome,
    largura: map.impressora_largura,
    corte: map.impressora_corte
  });
}

async function salvarConfiguracao(parcial = {}) {
  const atual = await obterConfiguracao();
  const proxima = normalizeConfig({ ...atual, ...parcial });

  if (proxima.habilitada && proxima.tipo === 'rede' && !proxima.host) {
    throw new Error('Host da impressora é obrigatório no modo rede');
  }

  await Promise.all([
    ConfiguracaoModel.definir('impressora_habilitada', proxima.habilitada ? '1' : '0'),
    ConfiguracaoModel.definir('impressora_tipo', proxima.tipo),
    ConfiguracaoModel.definir('impressora_host', proxima.host || ''),
    ConfiguracaoModel.definir('impressora_porta', String(proxima.porta)),
    ConfiguracaoModel.definir('impressora_local', proxima.impressora_local || ''),
    ConfiguracaoModel.definir('impressora_auto_fechamento', proxima.auto_fechamento ? '1' : '0'),
    ConfiguracaoModel.definir('impressora_auto_cozinha_item', proxima.auto_cozinha_item ? '1' : '0'),
    ConfiguracaoModel.definir('impressora_nome', proxima.nome || DEFAULTS.nome),
    ConfiguracaoModel.definir('impressora_largura', String(proxima.largura)),
    ConfiguracaoModel.definir('impressora_corte', proxima.corte ? '1' : '0')
  ]);

  return proxima;
}

function padRight(text, width) {
  const str = String(text || '');
  if (str.length >= width) return str.slice(0, width);
  return str + ' '.repeat(width - str.length);
}

function money(value) {
  return Number(value || 0).toFixed(2).replace('.', ',');
}

function plain(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E\n]/g, '');
}

function line(width, char = '-') {
  return char.repeat(Math.max(1, width));
}

function wrap(text, width) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const out = [];
  let current = '';
  for (const w of words) {
    const next = current ? `${current} ${w}` : w;
    if (next.length <= width) {
      current = next;
      continue;
    }
    if (current) out.push(current);
    current = w.length > width ? w.slice(0, width) : w;
  }
  if (current) out.push(current);
  return out;
}

function buildVendaTicket(venda, itens, cfg, tipo = 'balcao') {
  const width = cfg.largura;
  const now = new Date().toLocaleString('pt-BR');
  const titulo = tipo === 'cozinha' ? 'PEDIDO COZINHA' : 'COMPROVANTE';
  const mesa = venda.mesa ? `Mesa ${venda.mesa}` : `Comanda #${venda.id}`;

  const rows = [
    padRight(plain(cfg.nome).toUpperCase(), width),
    line(width, '='),
    padRight(titulo, width),
    plain(`${mesa}  ${now}`).slice(0, width),
    plain(`Status: ${venda.status}`).slice(0, width),
    line(width)
  ];

  let total = 0;
  const itensUsados = tipo === 'cozinha'
    ? itens.filter((i) => Number(i.produto_vai_cozinha) === 1)
    : itens;

  for (const item of itensUsados) {
    const qtd = Number(item.quantidade || 0);
    const unit = Number(item.preco_unitario || 0);
    const sub = Number(item.subtotal || qtd * unit);
    total += sub;
    const head = `${qtd}x ${item.produto_nome || 'Item'}`;
    rows.push(...wrap(plain(head), width));
    if (item.observacoes) rows.push(...wrap(plain(`  Obs: ${item.observacoes}`), width));
    if (tipo !== 'cozinha') {
      rows.push(`  R$ ${money(unit)} -> R$ ${money(sub)}`.slice(0, width));
    }
  }

  rows.push(line(width));
  if (tipo !== 'cozinha') {
    const bruto = Number(venda.subtotal_bruto || total);
    const desconto = Number(venda.desconto_valor || 0);
    const acrescimo = Number(venda.acrescimo_valor || 0);
    if (desconto > 0) rows.push(`Desconto: -R$ ${money(desconto)}`.slice(0, width));
    if (acrescimo > 0) rows.push(plain(`Acrescimo: +R$ ${money(acrescimo)}`).slice(0, width));
    rows.push(`Subtotal: R$ ${money(bruto)}`.slice(0, width));
    rows.push(`TOTAL: R$ ${money(Number(venda.total || total))}`.slice(0, width));
    if (venda.forma_pagamento) rows.push(`PAGTO: ${venda.forma_pagamento}`.slice(0, width));
    if (Number(venda.valor_pago || 0) > 0) rows.push(`Pago: R$ ${money(venda.valor_pago)}`.slice(0, width));
    if (Number(venda.troco_valor || 0) > 0) rows.push(`Troco: R$ ${money(venda.troco_valor)}`.slice(0, width));
    if (venda.split_mode) rows.push(plain(`Divisao: ${String(venda.split_mode)}`).slice(0, width));
    if (venda.pix_chave_utilizada) {
      rows.push(line(width));
      rows.push('PIX');
      rows.push(plain(`Chave: ${String(venda.pix_chave_utilizada)}`).slice(0, width));
      if (venda.pix_payload) {
        rows.push('Copia e cola:');
        rows.push(...wrap(plain(String(venda.pix_payload)), width));
      }
    }
  } else {
    rows.push(`Itens cozinha: ${itensUsados.length}`.slice(0, width));
  }
  rows.push(line(width, '='));
  rows.push(' ');
  rows.push(' ');

  return rows.join('\n');
}

function writeSocket(host, port, data, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let done = false;

    const finish = (err) => {
      if (done) return;
      done = true;
      socket.destroy();
      if (err) reject(err);
      else resolve();
    };

    socket.setTimeout(timeoutMs, () => finish(new Error('Timeout ao conectar na impressora')));
    socket.on('error', (err) => finish(err));
    socket.connect(port, host, () => {
      socket.write(data, (err) => {
        if (err) return finish(err);
        socket.end(() => finish());
      });
    });
  });
}

function montarPayload(texto, cfg) {
  const init = Buffer.from([0x1b, 0x40]); // ESC @
  const body = Buffer.from(`${plain(texto)}\n`, 'ascii');
  const cut = cfg.corte ? Buffer.from([0x1d, 0x56, 0x41, 0x10]) : Buffer.alloc(0); // GS V A n
  return Buffer.concat([init, body, cut]);
}

function execFileAsync(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(file, args, options, (error, stdout, stderr) => {
      if (error) {
        reject(new Error((stderr || stdout || error.message || 'Falha ao executar comando').trim()));
      } else {
        resolve({ stdout: String(stdout || ''), stderr: String(stderr || '') });
      }
    });
  });
}

function psEscape(value) {
  return String(value || '').replace(/'/g, "''");
}

async function imprimirLocalWindows(texto, cfg) {
  const tempPath = path.join(os.tmpdir(), `pdv-print-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
  await fs.writeFile(tempPath, `${texto}\n`, 'utf8');

  const printerName = String(cfg.impressora_local || '').trim();
  const cmd = printerName
    ? `$p='${psEscape(tempPath)}';$n='${psEscape(printerName)}';Get-Content -Raw -Encoding UTF8 $p | Out-Printer -Name $n`
    : `$p='${psEscape(tempPath)}';Get-Content -Raw -Encoding UTF8 $p | Out-Printer`;

  try {
    await execFileAsync('powershell.exe', ['-NoProfile', '-Command', cmd], { timeout: 12000 });
  } finally {
    await fs.unlink(tempPath).catch(() => {});
  }
}

async function imprimirTexto(texto) {
  const cfg = await obterConfiguracao();
  if (!cfg.habilitada) throw new Error('Impressão térmica está desabilitada');
  if (cfg.tipo === 'local') {
    await imprimirLocalWindows(texto, cfg);
    return cfg;
  }
  if (!cfg.host) throw new Error('Host da impressora não configurado');
  const payload = montarPayload(texto, cfg);
  await writeSocket(cfg.host, cfg.porta, payload);
  return cfg;
}

async function imprimirTeste() {
  const cfg = await obterConfiguracao();
  const texto = [
    cfg.nome.toUpperCase(),
    line(cfg.largura, '='),
    'TESTE DE IMPRESSAO TERMICA',
    `Data: ${new Date().toLocaleString('pt-BR')}`,
    line(cfg.largura),
    'Se voce consegue ler isto,',
    'a integracao esta funcionando.',
    line(cfg.largura, '='),
    ' ',
    ' '
  ].join('\n');
  await imprimirTexto(texto);
  return cfg;
}

async function imprimirVenda(venda, itens, tipo = 'balcao') {
  const cfg = await obterConfiguracao();
  const texto = buildVendaTicket(venda, itens, cfg, tipo);
  await imprimirTexto(texto);
  return cfg;
}

async function listarImpressorasLocais() {
  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-Command', 'Get-Printer | Select-Object -ExpandProperty Name'],
    { timeout: 8000 }
  );
  return stdout
    .split(/\r?\n/)
    .map((v) => v.trim())
    .filter(Boolean);
}

export { obterConfiguracao, salvarConfiguracao, imprimirTeste, imprimirVenda, listarImpressorasLocais };
