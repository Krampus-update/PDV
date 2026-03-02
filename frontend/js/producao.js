// Tela de Produção - listar pedidos fastfood em preparo e marcar como pronto

document.addEventListener('DOMContentLoaded', () => {
  const gridPedidos = document.getElementById('gridPedidos');
  const btnRecarregar = document.getElementById('btnRecarregar');
  const totalEmPreparo = document.getElementById('totalEmPreparo');
  const totalProntos = document.getElementById('totalProntos');

  const modal = document.getElementById('modalDetalhes');
  const btnFecharModal = document.getElementById('btnFecharModal');
  const tituloPedido = document.getElementById('tituloPedido');
  const statusPedido = document.getElementById('statusPedido');
  const horarioPedido = document.getElementById('horarioPedido');
  const tempoEspera = document.getElementById('tempoEspera');
  const itensPedido = document.getElementById('itensPedido');
  const observacoesPedido = document.getElementById('observacoesPedido');
  const btnMarcarPronto = document.getElementById('btnMarcarPronto');
  const btnCancelarDetalhes = document.getElementById('btnCancelarDetalhes');

  let pedidos = [];
  let pedidoAtivo = null;

  async function carregarPedidos() {
    try {
      pedidos = await API.obterEmPreparo();
      renderizarPedidos();
      atualizarStats();
    } catch (err) {
      console.error('Erro ao carregar pedidos:', err);
    }
  }

  function renderizarPedidos() {
    if (!pedidos || pedidos.length === 0) {
      gridPedidos.innerHTML = '<p class="placeholder">Nenhum pedido em preparo</p>';
      return;
    }

    gridPedidos.innerHTML = pedidos.map(p => `
      <div class="pedido-card" onclick="abrirPedido(${p.id})">
        <div class="pedido-numero">#${p.numero_pedido}</div>
        <div class="pedido-info">
          <div class="pedido-status">${p.status}</div>
          <div class="pedido-criado">${formatarData(p.created_at)}</div>
        </div>
        <div class="pedido-total">${formatarMoeda(p.total)}</div>
      </div>
    `).join('');
  }

  window.abrirPedido = async function(id) {
    try {
      const p = await API.obterVenda(id);
      pedidoAtivo = p;
      tituloPedido.textContent = p.numero_pedido ? `Pedido #${p.numero_pedido}` : `Pedido`;
      statusPedido.textContent = p.status;
      horarioPedido.textContent = formatarData(p.created_at);
      tempoEspera.textContent = calcularTempoEspera(p.created_at);
      observacoesPedido.textContent = p.observacoes || '--';

      const itens = p.itens || [];
      if (itens.length === 0) itensPedido.innerHTML = '<p class="placeholder">Nenhum item</p>';
      else itensPedido.innerHTML = itens.map(i => `
        <div class="item-pedido">
          <div class="nome">${i.produto_nome}</div>
          <div class="qtd">x${i.quantidade}</div>
        </div>
      `).join('');

      modal.style.display = 'flex';
    } catch (err) {
      console.error('Erro ao abrir pedido:', err);
    }
  };

  btnMarcarPronto.addEventListener('click', async () => {
    if (!pedidoAtivo) return;
    try {
      await API.marcarPronto(pedidoAtivo.id);
      modal.style.display = 'none';
      pedidoAtivo = null;
      await carregarPedidos();
      showNotificacao('Pedido marcado como pronto');
    } catch (err) {
      console.error('Erro ao marcar pronto:', err);
    }
  });

  btnFecharModal.addEventListener('click', () => modal.style.display = 'none');
  btnCancelarDetalhes.addEventListener('click', () => modal.style.display = 'none');

  btnRecarregar.addEventListener('click', () => carregarPedidos());

  function atualizarStats() {
    totalEmPreparo.textContent = pedidos.filter(p => p.status === 'em_preparo').length;
    totalProntos.textContent = pedidos.filter(p => p.status === 'pronta').length;
  }

  function showNotificacao(msg) {
    console.log(`[INFO] ${msg}`);
  }

  // Inicializar
  carregarPedidos();
  setInterval(() => carregarPedidos(), 5000);
});
