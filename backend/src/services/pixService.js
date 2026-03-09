import QRCode from 'qrcode';
import ConfiguracaoModel from '../models/ConfiguracaoModel.js';

function normalizeText(v, max = 99) {
  const txt = String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s@._-]/g, '')
    .trim();
  return txt.slice(0, max);
}

function normalizePixNameOrCity(v, max) {
  return String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function isUuidV4Like(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function isEmailLike(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function isCpf(v) {
  return /^\d{11}$/.test(v);
}

function isCnpj(v) {
  return /^\d{14}$/.test(v);
}

function isTelefoneE164Brasil(v) {
  return /^\+55\d{10,11}$/.test(v);
}

function validarChavePix(chaveRaw) {
  const chave = String(chaveRaw || '').trim();
  const somenteDigitos = chave.replace(/\D/g, '');
  const telefoneNormalizado = chave.replace(/[^\d+]/g, '');
  if (!chave) return { ok: false, motivo: 'Chave PIX vazia' };
  if (isUuidV4Like(chave)) return { ok: true, tipo: 'evp' };
  if (isEmailLike(chave)) return { ok: true, tipo: 'email' };
  if (isCpf(somenteDigitos)) return { ok: true, tipo: 'cpf', valor: somenteDigitos };
  if (isCnpj(somenteDigitos)) return { ok: true, tipo: 'cnpj', valor: somenteDigitos };
  if (isTelefoneE164Brasil(telefoneNormalizado)) return { ok: true, tipo: 'telefone', valor: telefoneNormalizado };
  return {
    ok: false,
    motivo: 'Formato de chave PIX inválido. Use EVP, email, CPF, CNPJ ou telefone no formato +55...'
  };
}

function crc16(str) {
  let crc = 0xffff;
  for (let c = 0; c < str.length; c++) {
    crc ^= str.charCodeAt(c) << 8;
    for (let i = 0; i < 8; i++) {
      if (crc & 0x8000) crc = (crc << 1) ^ 0x1021;
      else crc <<= 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function field(id, value) {
  const v = String(value || '');
  return `${id}${String(v.length).padStart(2, '0')}${v}`;
}

function normalizeTxid(value) {
  const v = String(value || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 25);
  return v || '***';
}

function buildPixPayload({ chave, nome, cidade, valor, txid, descricao }) {
  const merchant = field('00', 'BR.GOV.BCB.PIX') + field('01', chave) + (descricao ? field('02', descricao) : '');
  const txidNorm = normalizeTxid(txid);
  const payloadSemCRC = [
    field('00', '01'),
    field('01', '11'),
    field('26', merchant),
    field('52', '0000'),
    field('53', '986'),
    valor && Number(valor) > 0 ? field('54', Number(valor).toFixed(2)) : '',
    field('58', 'BR'),
    field('59', nome),
    field('60', cidade),
    field('62', field('05', txidNorm)),
    '6304'
  ]
    .filter(Boolean)
    .join('');
  const crc = crc16(payloadSemCRC);
  return `${payloadSemCRC}${crc}`;
}

async function obterConfigPix() {
  const map = await ConfiguracaoModel.obterPorPrefixo('pix_');
  return {
    habilitado: String(map.pix_habilitado || '0') === '1',
    chave: String(map.pix_chave || '').trim(),
    nome_recebedor: normalizePixNameOrCity(map.pix_nome_recebedor || '', 25),
    cidade: normalizePixNameOrCity(map.pix_cidade || 'SAO PAULO', 15),
    descricao_padrao: normalizeText(map.pix_descricao_padrao || 'Pagamento PDV', 50)
  };
}

async function salvarConfigPix(parcial = {}) {
  const atual = await obterConfigPix();
  const next = {
    habilitado: parcial.habilitado === undefined ? atual.habilitado : !!parcial.habilitado,
    chave: String(parcial.chave ?? atual.chave ?? '').trim(),
    nome_recebedor: normalizePixNameOrCity(parcial.nome_recebedor ?? atual.nome_recebedor ?? '', 25),
    cidade: normalizePixNameOrCity(parcial.cidade ?? atual.cidade ?? 'SAO PAULO', 15),
    descricao_padrao: normalizeText(parcial.descricao_padrao ?? atual.descricao_padrao ?? 'Pagamento PDV', 50)
  };
  if (next.habilitado) {
    const validacao = validarChavePix(next.chave);
    if (!validacao.ok) {
      throw new Error(validacao.motivo);
    }
  }
  await Promise.all([
    ConfiguracaoModel.definir('pix_habilitado', next.habilitado ? '1' : '0'),
    ConfiguracaoModel.definir('pix_chave', next.chave),
    ConfiguracaoModel.definir('pix_nome_recebedor', next.nome_recebedor),
    ConfiguracaoModel.definir('pix_cidade', next.cidade),
    ConfiguracaoModel.definir('pix_descricao_padrao', next.descricao_padrao)
  ]);
  return next;
}

async function gerarPixCobranca({ vendaId, valor, descricao = '' }) {
  const cfg = await obterConfigPix();
  if (!cfg.habilitado || !cfg.chave) {
    throw new Error('Pix não configurado');
  }
  const validacao = validarChavePix(cfg.chave);
  if (!validacao.ok) {
    throw new Error(validacao.motivo);
  }
  if (!cfg.nome_recebedor || cfg.nome_recebedor.length < 3) {
    throw new Error('Nome do recebedor PIX inválido');
  }
  if (!cfg.cidade || cfg.cidade.length < 2) {
    throw new Error('Cidade PIX inválida');
  }
  const chavePix = validacao.valor || cfg.chave;
  const txid = `PDV${String(vendaId || '').replace(/\D/g, '').slice(-20) || Date.now().toString().slice(-20)}`;
  const payload = buildPixPayload({
    chave: chavePix,
    nome: cfg.nome_recebedor || 'RECEBEDOR',
    cidade: cfg.cidade || 'SAO PAULO',
    valor: Number(valor || 0),
    txid,
    descricao: ''
  });
  const qr_data_url = await QRCode.toDataURL(payload, { margin: 1, width: 320 });
  return {
    payload,
    txid,
    chave: chavePix,
    qr_data_url,
    copia_cola: payload
  };
}

export { obterConfigPix, salvarConfigPix, gerarPixCobranca, validarChavePix };
