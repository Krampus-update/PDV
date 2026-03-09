import ConfiguracaoModel from '../models/ConfiguracaoModel.js';

const PROVIDERS = ['manual', 'mock', 'cielo', 'pagseguro'];

async function obterConfigPagamento() {
  const map = await ConfiguracaoModel.obterPorPrefixo('pagamento_');
  return {
    provider: String(map.pagamento_provider || 'manual').toLowerCase(),
    ambiente: String(map.pagamento_ambiente || 'sandbox').toLowerCase(),
    merchant_id: String(map.pagamento_merchant_id || '').trim(),
    merchant_key: String(map.pagamento_merchant_key || '').trim(),
    pagseguro_token: String(map.pagamento_pagseguro_token || '').trim(),
    ativo: String(map.pagamento_ativo || '0') === '1'
  };
}

async function salvarConfigPagamento(parcial = {}) {
  const atual = await obterConfigPagamento();
  const next = {
    provider: PROVIDERS.includes(String(parcial.provider || '').toLowerCase())
      ? String(parcial.provider).toLowerCase()
      : atual.provider,
    ambiente: ['sandbox', 'producao'].includes(String(parcial.ambiente || '').toLowerCase())
      ? String(parcial.ambiente).toLowerCase()
      : atual.ambiente,
    merchant_id: String(parcial.merchant_id ?? atual.merchant_id ?? '').trim(),
    merchant_key: String(parcial.merchant_key ?? atual.merchant_key ?? '').trim(),
    pagseguro_token: String(parcial.pagseguro_token ?? atual.pagseguro_token ?? '').trim(),
    ativo: parcial.ativo === undefined ? atual.ativo : !!parcial.ativo
  };
  await Promise.all([
    ConfiguracaoModel.definir('pagamento_provider', next.provider),
    ConfiguracaoModel.definir('pagamento_ambiente', next.ambiente),
    ConfiguracaoModel.definir('pagamento_merchant_id', next.merchant_id),
    ConfiguracaoModel.definir('pagamento_merchant_key', next.merchant_key),
    ConfiguracaoModel.definir('pagamento_pagseguro_token', next.pagseguro_token),
    ConfiguracaoModel.definir('pagamento_ativo', next.ativo ? '1' : '0')
  ]);
  return next;
}

async function processarPagamento({ vendaId, valor, forma_pagamento, descricao }) {
  const cfg = await obterConfigPagamento();
  const base = {
    provider: cfg.provider,
    ambiente: cfg.ambiente,
    venda_id: vendaId,
    valor: Number(valor || 0),
    forma_pagamento: forma_pagamento || 'dinheiro',
    descricao: descricao || ''
  };

  if (!cfg.ativo || cfg.provider === 'manual') {
    return { ...base, status: 'manual', transacao_id: null, mensagem: 'Pagamento manual (sem gateway)' };
  }

  if (cfg.provider === 'mock') {
    return {
      ...base,
      status: 'aprovado',
      transacao_id: `MOCK-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
      autorizacao: `AUTH${Math.floor(Math.random() * 100000)}`,
      mensagem: 'Pagamento aprovado em modo mock'
    };
  }

  if (cfg.provider === 'cielo') {
    if (!cfg.merchant_id || !cfg.merchant_key) {
      throw new Error('Cielo não configurado (merchant_id/merchant_key)');
    }
    return {
      ...base,
      status: 'pendente',
      transacao_id: `CIELO-SIM-${Date.now()}`,
      mensagem: 'Integração Cielo habilitada em modo simulado'
    };
  }

  if (cfg.provider === 'pagseguro') {
    if (!cfg.pagseguro_token) {
      throw new Error('PagSeguro não configurado (token)');
    }
    return {
      ...base,
      status: 'pendente',
      transacao_id: `PSEG-SIM-${Date.now()}`,
      mensagem: 'Integração PagSeguro habilitada em modo simulado'
    };
  }

  throw new Error('Provider de pagamento inválido');
}

export { obterConfigPagamento, salvarConfigPagamento, processarPagamento, PROVIDERS };
