// Garçom - funcionalidades básicas para listar e gerenciar comandas (modo BAR)

document.addEventListener('DOMContentLoaded', () => {
  const listaVendasEl = document.getElementById('listaVendas');
  const badgeAbertas = document.getElementById('badgeAbertas');
  const badgePreparo = document.getElementById('badgePreparo');
  const badgePronta = document.getElementById('badgePronta');

  const modal = document.getElementById('modalDetalhes');
  const btnFecharModal = document.getElementById('btnFecharModal');
  const tituloComanda = document.getElementById('tituloComanda');
  const statusComanda = document.getElementById('statusComanda');
  const totalComanda = document.getElementById('totalComanda');
  const itensComanda = document.getElementById('itensComanda');
  const gridProdutosModal = document.getElementById('gridProdutosModal');
  const buscaProdutoModal = document.getElementById('buscaProdutoModal');
  const btnRemoverUltimo = document.getElementById('btnRemoverUltimo');
  const btnFecharComanda = document.getElementById('btnFecharComanda');
  const btnCancelarComanda = document.getElementById('btnCancelarComanda');

  const modalAjustarQtd = document.getElementById('modalAjustarQtd');
  const btnQtdMais = document.getElementById('btnQtdMais');
  const btnQtdMenos = document.getElementById('btnQtdMenos');
  const qtdDisplay = document.getElementById('qtdDisplay');
  const btnCancelarQtd = document.getElementById('btnCancelarQtd');
  const btnRemoverItemQtd = document.getElementById('btnRemoverItemQtd');
  const produtoNomeQtd = document.getElementById('produtoNomeQtd');
  const produtoInfoQtd = document.getElementById('produtoInfoQtd');

  let vendas = [];
  let produtos = [];
  let vendaAtiva = null;
  let itemEmEdicao = null;
  let quantidadeTemp = 0;

  async function carregarProdutos() {
    try {
      produtos = await API.obterProdutos();
      renderizarGridProdutos();
    } catch (err) {
      console.error('Erro ao carregar produtos:', err);
    }
  }

  function renderizarGridProdutos() {
    const termo = buscaProdutoModal.value.toLowerCase();
    const filtrados = produtos.filter(p => p.ativo && p.nome.toLowerCase().includes(termo));

    gridProdutosModal.innerHTML = filtrados.map(p => `
      <div class="produto-card ${p.estoque===0?'sem-estoque':''}" data-id="${p.id}"
           ${p.estoque>0?`onclick="addProdutoModal(${p.id}, '${p.nome.replace(/'/g, "\\'")}', ${p.preco})"`:''}
           style="cursor:${p.estoque>0?'pointer':'not-allowed'}">
        <div class="produto-nome">${p.nome}</div>
        <div class="produto-preco">${formatarMoeda(p.preco)}</div>
        <div class="produto-estoque">${p.estoque} em estoque</div>
      </div>
    `).join('');
  }

  // função exposta para o onclick nos cards
  window.addProdutoModal = async function(produtoId, produtoNome, produtoPreco) {
    if (!vendaAtiva) return;
    try {
      await API.adicionarItem(vendaAtiva.id, produtoId, 1);
      await abrirVenda(vendaAtiva.id);
      await carregarProdutos(); // atualizar estoque na grade
      showNotificacao(`${produtoNome} adicionado!`);
    } catch (err) {
      console.error('Erro ao adicionar item:', err);
      showNotificacao(err.message || 'Erro', 'error');
    }
  };

  function showNotificacao(msg, tipo = 'success') {
    console.log(`[${tipo.toUpperCase()}] ${msg}`);
  }

  async function carregarVendas() {
    try {
      vendas = await API.obterVendasAbertas('bar');
      renderizarLista();
      atualizarBadges();
    } catch (err) {
      console.error('Erro ao carregar vendas:', err);
    }
  }

  function renderizarLista() {
    if (!vendas || vendas.length === 0) {
      listaVendasEl.innerHTML = '<p class="placeholder">Nenhuma comanda aberta</p>';
      return;
    }

    listaVendasEl.innerHTML = vendas.map(v => `
      <div class="comanda-item" data-id="${v.id}" onclick="abrirVendaModal(${v.id})">
        <div class="comanda-info">
          <div class="comanda-tipo">${v.tipo}</div>
          <div class="comanda-numero">${v.numero_pedido ? `#${v.numero_pedido}` : 'Comanda'}</div>
          <div class="comanda-mesa" style="font-size:10px;color:#666">${v.mesa?`Mesa ${v.mesa}`:'Balcão'}</div>
        </div>
        <div class="comanda-total">${formatarMoeda(v.total)}</div>
      </div>
    `).join('');
  }

  window.abrirVendaModal = async function(vendaId) {
    await abrirVenda(vendaId);
    modal.style.display = 'flex';
  };

  async function abrirVenda(vendaId) {
    try {
      const venda = await API.obterVenda(vendaId);
      vendaAtiva = venda;
      tituloComanda.textContent = venda.numero_pedido ? `Comanda #${venda.numero_pedido}` : `Comanda`;
      if(venda.mesa) tituloComanda.textContent += ` (Mesa ${venda.mesa})`;
      else tituloComanda.textContent += ` (Balcão)`;
      statusComanda.textContent = venda.status;
      totalComanda.textContent = formatarMoeda(venda.total || 0);

      const itens = venda.itens || [];
      if (itens.length === 0) {
        itensComanda.innerHTML = '<p class="placeholder">Nenhum item</p>';
      } else {
        itensComanda.innerHTML = itens.map(it => `
          <div class="item" onclick="abrirAjusteQuantidade(${venda.id},${it.id},'${it.produto_nome}',${it.quantidade},${it.subtotal})" 
               style="padding:12px;background:#f9f9f9;border-radius:4px;border:1px solid #eee;display:flex;flex-direction:column;align-items:center;text-align:center;cursor:pointer;transition:all 0.2s">
            <div style="font-weight:bold;font-size:13px;margin-bottom:6px;width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${it.produto_nome}</div>
            <div style="color:#666;font-size:12px;margin-bottom:6px">x${it.quantidade}</div>
            <div style="color:var(--success);font-weight:bold;font-size:12px">${formatarMoeda(it.subtotal)}</div>
          </div>
        `).join('');
      }
    } catch (err) {
      console.error('Erro ao abrir venda:', err);
    }
  }

  // Funções de controle de itens da comanda
  window.abrirAjusteQuantidade = function(vendaId, itemId, nomeProduto, qtdAtual, subtotal) {
    itemEmEdicao = { vendaId, itemId, nomeProduto };
    quantidadeTemp = qtdAtual;
    produtoNomeQtd.textContent = nomeProduto;
    produtoInfoQtd.textContent = `Preço unitário: ${formatarMoeda(subtotal / qtdAtual)}`;
    qtdDisplay.textContent = qtdAtual;
    modalAjustarQtd.style.display = 'flex';
    modalAjustarQtd.style.justifyContent = 'space-between';
  };

  btnQtdMais.addEventListener('click', () => {
    quantidadeTemp++;
    qtdDisplay.textContent = quantidadeTemp;
  });

  btnQtdMenos.addEventListener('click', () => {
    if (quantidadeTemp > 1) {
      quantidadeTemp--;
      qtdDisplay.textContent = quantidadeTemp;
    }
  });

  btnCancelarQtd.addEventListener('click', () => {
    modalAjustarQtd.style.display = 'none';
    itemEmEdicao = null;
  });

  btnRemoverItemQtd.addEventListener('click', async () => {
    if (!itemEmEdicao) return;
    if (!confirm('Remover item da comanda?')) return;
    try {
      await API.removerItem(itemEmEdicao.vendaId, itemEmEdicao.itemId);
      await carregarVendas();
      const updated = await API.obterVenda(itemEmEdicao.vendaId);
      vendaAtiva = updated;
      abrirVenda(itemEmEdicao.vendaId);
      modalAjustarQtd.style.display = 'none';
      itemEmEdicao = null;
    } catch (e) {
      console.error('Erro ao remover item', e);
      alert('Erro ao remover item');
    }
  });

  // Evento para salvar quantidade quando clica fora ou em area neutra
  document.addEventListener('keydown', (evt) => {
    if (evt.key === 'Enter' && modalAjustarQtd.style.display !== 'none') {
      salvarQuantidadeItem();
    }
    if (evt.key === 'Escape' && modalAjustarQtd.style.display !== 'none') {
      modalAjustarQtd.style.display = 'none';
      itemEmEdicao = null;
    }
  });

  async function salvarQuantidadeItem() {
    if (!itemEmEdicao || quantidadeTemp === 0) return;
    try {
      await API.atualizarItem(itemEmEdicao.vendaId, itemEmEdicao.itemId, quantidadeTemp);
      await carregarVendas();
      const updated = await API.obterVenda(itemEmEdicao.vendaId);
      vendaAtiva = updated;
      abrirVenda(itemEmEdicao.vendaId);
      modalAjustarQtd.style.display = 'none';
      itemEmEdicao = null;
    } catch (e) {
      console.error('Erro ao atualizar quantidade', e);
      alert('Erro ao atualizar quantidade');
    }
  }

  // Clica fora da modal para confirmar mudança
  modalAjustarQtd.addEventListener('click', (evt) => {
    if (evt.target === modalAjustarQtd) {
      salvarQuantidadeItem();
    }
  });

  btnFecharModal.addEventListener('click', () => modal.style.display = 'none');
  btnCancelarComanda.addEventListener('click', () => modal.style.display = 'none');

  document.getElementById('btnNovaComanda').addEventListener('click', async () => {
    try{
      let mesa = prompt('Número da mesa (ou deixe em branco para balcão)');
      if(mesa !== null){
        mesa = mesa.trim();
        if(!mesa || mesa.toLowerCase()==='balcao' || mesa==='0') mesa = null;
      }
      const venda = await API.criarVenda('bar', mesa);
      await carregarVendas();
      showNotificacao('Comanda criada');
      if(venda && venda.id){
        abrirVendaModal(venda.id);
      }
    }catch(e){console.error('Erro ao criar comanda', e);showNotificacao('Erro','error');}
  });


  btnRemoverUltimo.addEventListener('click', async () => {
    if (!vendaAtiva || !vendaAtiva.itens || vendaAtiva.itens.length === 0) return;
    const ultimo = vendaAtiva.itens[vendaAtiva.itens.length - 1];
    try {
      await API.removerItem(vendaAtiva.id, ultimo.id);
      await abrirVenda(vendaAtiva.id);
      showNotificacao('Último item removido');
    } catch (err) {
      console.error('Erro ao remover item:', err);
    }
  });

  btnFecharComanda.addEventListener('click', async () => {
    if (!vendaAtiva) return;
    if (!confirm('Finalizar comanda agora?')) return;
    try {
      await API.fecharVenda(vendaAtiva.id, 'dinheiro');
      modal.style.display = 'none';
      vendaAtiva = null;
      await carregarVendas();
      showNotificacao('Comanda finalizada');
    } catch (err) {
      console.error('Erro ao finalizar comanda:', err);
    }
  });

  buscaProdutoModal.addEventListener('input', () => renderizarGridProdutos());

  function atualizarBadges() {
    const contAbertas = vendas.filter(v => v.status === 'aberta').length;
    const contPreparo = vendas.filter(v => v.status === 'em_preparo').length;
    const contPronta = vendas.filter(v => v.status === 'pronta').length;

    badgeAbertas.textContent = contAbertas;
    badgePreparo.textContent = contPreparo;
    badgePronta.textContent = contPronta;
  }

  // Inicialização
  carregarProdutos();
  carregarVendas();
  setInterval(() => carregarVendas(), 5000);
});
