// Tela de Produção (cozinha): mostra apenas itens marcados para cozinha.

document.addEventListener('DOMContentLoaded', () => {
  const ui = window.PDVUI || {};
  const uiAlert = async (message, type = 'info') => {
    if (ui.alert) return ui.alert(message, type, 'Produção');
    alert(message);
  };
  const uiNotify = (message, type = 'success') => {
    if (ui.notify) {
      ui.notify({ title: 'Produção', message, type, keepHistory: true });
    } else {
      console.log(`[${type}] ${message}`);
    }
  };
  const gridPedidos = document.getElementById('gridPedidos');
  const btnRecarregar = document.getElementById('btnRecarregar');
  const totalEmPreparo = document.getElementById('totalEmPreparo');
  const totalProntos = document.getElementById('totalProntos');
  const buscaPedido = document.getElementById('buscaPedido');
  const filtroTipoPedido = document.getElementById('filtroTipoPedido');

  const modal = document.getElementById('modalDetalhes');
  const btnFecharModal = document.getElementById('btnFecharModal');
  const tituloPedido = document.getElementById('tituloPedido');
  const origemPedido = document.getElementById('origemPedido');
  const clientePedido = document.getElementById('clientePedido');
  const codigoPedido = document.getElementById('codigoPedido');
  const statusPedido = document.getElementById('statusPedido');
  const horarioPedido = document.getElementById('horarioPedido');
  const tempoEspera = document.getElementById('tempoEspera');
  const tempoEntregadorPedido = document.getElementById('tempoEntregadorPedido');
  const tempoEntregaPedido = document.getElementById('tempoEntregaPedido');
  const itensPedido = document.getElementById('itensPedido');
  const observacoesPedido = document.getElementById('observacoesPedido');
  const btnMarcarPronto = document.getElementById('btnMarcarPronto');
  const btnCancelarDetalhes = document.getElementById('btnCancelarDetalhes');

  let pedidos = [];
  let pedidoAtivo = null;
  let statusAtivo = 'em_preparo';
  let buscaTermo = '';
  let filtroTipo = 'todos';
  let refreshRodando = false;
  let idsEmPreparo = new Set();

  function tocarAlertaNovoPedido() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.36);
    } catch (e) {
      console.warn('Falha ao tocar alerta sonoro:', e);
    }
  }

  function tituloComanda(venda) {
    if (venda?.nome_comanda) return venda.nome_comanda;
    if (venda?.origem === 'ifood' && venda?.origem_codigo) {
      const cliente = venda?.cliente_nome || venda?.observacoes || 'Cliente';
      return `iFood - ${cliente} (${venda.origem_codigo})`;
    }
    if (venda?.mesa) return `Mesa ${venda.mesa}`;
    return `Balcão #${venda?.id || '--'}`;
  }

  async function carregarPedidos() {
    try {
      pedidos = await API.obterProducao(statusAtivo);
      renderizarPedidos();
      await atualizarStats();
    } catch (err) {
      console.error('Erro ao carregar pedidos:', err);
      gridPedidos.innerHTML = '<p class="placeholder">Erro ao carregar pedidos</p>';
    }
  }

  function renderizarPedidos() {
    const filtrados = (pedidos || []).filter((p) => {
      const termo = String(buscaTermo || '').toLowerCase().trim();
      const titulo = tituloComanda(p).toLowerCase();
      const itensTxt = (p.itens || []).map((i) => String(i.produto_nome || '').toLowerCase()).join(' ');
      const isMesa = !!String(p.mesa || '').trim();
      const tipoOk = filtroTipo === 'todos' ? true : filtroTipo === 'mesa' ? isMesa : !isMesa;
      const buscaOk = !termo || titulo.includes(termo) || itensTxt.includes(termo) || String(p.id || '').includes(termo);
      return tipoOk && buscaOk;
    });
    if (!filtrados.length) {
      gridPedidos.innerHTML = `<p class="placeholder">Nenhum pedido ${statusAtivo === 'em_preparo' ? 'em preparo' : 'pronto'} para cozinha</p>`;
      return;
    }

    gridPedidos.innerHTML = filtrados
      .map((p) => {
        const itens = (p.itens || []).filter((i) => Number(i.produto_vai_cozinha) === 1);
        const itensPreview = itens
          .slice(0, 3)
          .map((i) => `<div class="item-preview"><span class="item-nome">${i.produto_nome}</span> <span class="item-qty">x${i.quantidade}</span></div>`)
          .join('');
        return `<div class="pedido-card ${p.status}" data-id="${p.id}">
          <div class="pedido-numero">${tituloComanda(p)}</div>
          <div class="pedido-tempo">${calcularTempoEspera(p.created_at)}</div>
          <div class="pedido-itens-count">${itens.length} item(ns) de cozinha</div>
          <div class="pedido-itens-preview">${itensPreview || '<div class="item-preview">Sem itens</div>'}</div>
          <div class="pedido-acoes">
            ${p.status === 'em_preparo' ? '<button class="btn btn-success btn-small btn-pronto">Marcar pronto</button>' : '<span style="font-size:12px;color:#4CAF50;font-weight:bold">Pronto para entrega</span>'}
          </div>
        </div>`;
      })
      .join('');

    gridPedidos.querySelectorAll('.pedido-card').forEach((card) => {
      const id = Number(card.dataset.id);
      card.addEventListener('click', () => abrirPedido(id));
      const btnPronto = card.querySelector('.btn-pronto');
      if (btnPronto) {
        btnPronto.addEventListener('click', async (e) => {
          e.stopPropagation();
          await marcarPedidoPronto(id);
        });
      }
    });
  }

  async function abrirPedido(id) {
    try {
      const p = await API.obterVenda(id);
      pedidoAtivo = p;
      tituloPedido.textContent = `Comanda ${tituloComanda(p)}`;
      origemPedido.textContent = p.origem || 'pdv';
      clientePedido.textContent = p.cliente_nome || p.cliente_nome_externo || '--';
      codigoPedido.textContent = p.origem_codigo || p.numero_pedido || '--';
      statusPedido.textContent = p.status;
      statusPedido.className = `status-badge ${p.status}`;
      horarioPedido.textContent = formatarData(p.created_at);
      tempoEspera.textContent = calcularTempoEspera(p.created_at);
      tempoEntregadorPedido.textContent = p.tempo_ate_entregador_minutos ? `${p.tempo_ate_entregador_minutos} min` : '--';
      tempoEntregaPedido.textContent = p.entrega_estimativa_minutos ? `${p.entrega_estimativa_minutos} min` : '--';
      observacoesPedido.textContent = p.observacoes || '--';

      const itensCozinha = (p.itens || []).filter((i) => Number(i.produto_vai_cozinha) === 1);
      if (!itensCozinha.length) {
        itensPedido.innerHTML = '<p class="placeholder">Nenhum item de cozinha</p>';
      } else {
        itensPedido.innerHTML = itensCozinha
          .map(
            (i) => `<div class="item-detalhe">
              <div class="item-info">
                <div class="item-titulo">${i.produto_nome}</div>
                <div class="item-observacoes">${i.observacoes || ''}</div>
              </div>
              <div class="item-quantidade">x${i.quantidade}</div>
            </div>`
          )
          .join('');
      }

      btnMarcarPronto.style.display = p.status === 'em_preparo' ? 'block' : 'none';
      modal.style.display = 'flex';
    } catch (err) {
      console.error('Erro ao abrir pedido:', err);
    }
  }

  async function marcarPedidoPronto(id) {
    try {
      await API.marcarPronto(id);
      if (pedidoAtivo && pedidoAtivo.id === id) {
        modal.style.display = 'none';
        pedidoAtivo = null;
      }
      await carregarPedidos();
      showNotificacao('Pedido marcado como pronto');
    } catch (err) {
      console.error('Erro ao marcar pronto:', err);
      await uiAlert(err.message || 'Erro ao marcar como pronto', 'error');
    }
  }

  async function atualizarStats() {
    try {
      const [emPreparo, prontos] = await Promise.all([API.obterProducao('em_preparo'), API.obterProducao('pronta')]);
      totalEmPreparo.textContent = String(emPreparo.length);
      totalProntos.textContent = String(prontos.length);
    } catch (e) {
      console.error('Erro ao atualizar stats', e);
    }
  }

  function showNotificacao(msg) {
    uiNotify(msg, 'success');
  }

  async function refreshGeral() {
    if (refreshRodando) return;
    refreshRodando = true;
    try {
      const emPreparoAtual = await API.obterProducao('em_preparo');
      const novos = emPreparoAtual.filter((p) => !idsEmPreparo.has(p.id));
      idsEmPreparo = new Set(emPreparoAtual.map((p) => p.id));
      if (novos.length > 0) {
        tocarAlertaNovoPedido();
      }
      await carregarPedidos();
      if (pedidoAtivo) {
        try {
          const updated = await API.obterVenda(pedidoAtivo.id);
          pedidoAtivo = updated;
          if (modal.style.display !== 'none') await abrirPedido(pedidoAtivo.id);
        } catch {
          modal.style.display = 'none';
          pedidoAtivo = null;
        }
      }
    } finally {
      refreshRodando = false;
    }
  }

  btnMarcarPronto.addEventListener('click', async () => {
    if (!pedidoAtivo) return;
    await marcarPedidoPronto(pedidoAtivo.id);
  });

  btnFecharModal.addEventListener('click', () => (modal.style.display = 'none'));
  btnCancelarDetalhes.addEventListener('click', () => (modal.style.display = 'none'));
  btnRecarregar.addEventListener('click', () => refreshGeral());
  if (buscaPedido) {
    buscaPedido.addEventListener('input', () => {
      buscaTermo = buscaPedido.value || '';
      renderizarPedidos();
    });
  }
  if (filtroTipoPedido) {
    filtroTipoPedido.addEventListener('change', () => {
      filtroTipo = filtroTipoPedido.value || 'todos';
      renderizarPedidos();
    });
  }

  document.querySelectorAll('.aba').forEach((aba) => {
    aba.addEventListener('click', async () => {
      statusAtivo = aba.dataset.status;
      document.querySelectorAll('.aba').forEach((a) => a.classList.remove('aba-ativa'));
      aba.classList.add('aba-ativa');
      await carregarPedidos();
    });
  });

  refreshGeral();
  if (window.initRealtime) {
    window.initRealtime((evt) => {
      if (!evt || !evt.type) return;
      if (evt.type.startsWith('venda.') || evt.type.startsWith('produto.')) {
        refreshGeral();
      }
    });
  }
  setInterval(refreshGeral, 5000);
});
