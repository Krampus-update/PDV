// Garçom (mobile): fluxo alinhado ao painel desktop.

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

  const btnModoProdutos = document.getElementById('btnModoProdutos');
  const btnModoAvulso = document.getElementById('btnModoAvulso');
  const blocoProdutosModal = document.getElementById('blocoProdutosModal');
  const blocoAvulsoModal = document.getElementById('blocoAvulsoModal');
  const btnClearAvulsoModal = document.getElementById('btnClearAvulsoModal');
  const btnAddAvulsoModal = document.getElementById('btnAddAvulsoModal');

  const modalAjustarQtd = document.getElementById('modalAjustarQtd');
  const btnQtdMais = document.getElementById('btnQtdMais');
  const btnQtdMenos = document.getElementById('btnQtdMenos');
  const qtdDisplay = document.getElementById('qtdDisplay');
  const btnCancelarQtd = document.getElementById('btnCancelarQtd');
  const btnSalvarQtd = document.getElementById('btnSalvarQtd');
  const btnRemoverItemQtd = document.getElementById('btnRemoverItemQtd');
  const produtoNomeQtd = document.getElementById('produtoNomeQtd');
  const produtoInfoQtd = document.getElementById('produtoInfoQtd');

  let vendas = [];
  let produtos = [];
  let vendaAtiva = null;
  let itemEmEdicao = null;
  let quantidadeTemp = 0;
  let statusAtivo = 'todas';
  let refreshEmAndamento = false;

  const tecladoAvulso = criarTeclado(
    document.getElementById('tecladoAvulsoModal'),
    document.getElementById('displayAvulsoModal')
  );

  function normalizarMesa(valor) {
    const v = String(valor || '').trim();
    if (!v || v.toLowerCase() === 'balcao' || v.toLowerCase() === 'balcão' || v === '0') return 'balcao';
    return v.toLowerCase();
  }

  function tituloVenda(venda) {
    if (venda.mesa) return `Mesa ${venda.mesa}`;
    return `Balcão #${venda.id}`;
  }

  function showNotificacao(msg, tipo = 'success') {
    console.log(`[${tipo.toUpperCase()}] ${msg}`);
  }

  function aplicarModoModal(modo) {
    const produtosAtivo = modo === 'produtos';
    if (blocoProdutosModal) blocoProdutosModal.style.display = produtosAtivo ? 'block' : 'none';
    if (blocoAvulsoModal) blocoAvulsoModal.style.display = produtosAtivo ? 'none' : 'block';
    if (btnModoProdutos) btnModoProdutos.className = produtosAtivo ? 'btn' : 'btn btn-secondary';
    if (btnModoAvulso) btnModoAvulso.className = produtosAtivo ? 'btn btn-secondary' : 'btn';
  }

  async function carregarProdutos() {
    try {
      produtos = await API.obterProdutos();
      renderizarGridProdutos();
    } catch (err) {
      console.error('Erro ao carregar produtos:', err);
    }
  }

  function renderizarGridProdutos() {
    const termo = (buscaProdutoModal.value || '').toLowerCase().trim();
    const filtrados = produtos.filter((p) => p.ativo && p.tipo !== 'avulso' && p.nome.toLowerCase().includes(termo));
    if (filtrados.length === 0) {
      gridProdutosModal.innerHTML = '<p class="placeholder">Nenhum produto disponível</p>';
      return;
    }

    gridProdutosModal.innerHTML = filtrados
      .map((p) => {
        const semEstoque = Number(p.estoque || 0) <= 0;
        return `<div class="produto-card ${semEstoque ? 'sem-estoque' : ''}" data-id="${p.id}" data-nome="${p.nome}" data-preco="${p.preco}" style="cursor:${semEstoque ? 'not-allowed' : 'pointer'}">
          <div class="produto-nome">${p.nome}</div>
          <div class="produto-preco">${formatarMoeda(p.preco)}</div>
          <div class="produto-estoque">${p.estoque} em estoque</div>
        </div>`;
      })
      .join('');

    gridProdutosModal.querySelectorAll('.produto-card').forEach((card) => {
      card.addEventListener('click', async () => {
        const produtoId = Number(card.dataset.id);
        const produto = produtos.find((p) => p.id === produtoId);
        if (!produto || Number(produto.estoque || 0) <= 0) return;
        if (!vendaAtiva) return;
        try {
          await API.adicionarItem(vendaAtiva.id, produtoId, 1);
          await refreshDados();
          if (vendaAtiva) await abrirVenda(vendaAtiva.id);
          showNotificacao(`${produto.nome} adicionado`);
        } catch (err) {
          console.error('Erro ao adicionar item:', err);
          alert(err.message || 'Erro ao adicionar item');
        }
      });
    });
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
    const filtradas = statusAtivo === 'todas' ? vendas : vendas.filter((v) => v.status === statusAtivo);
    if (!filtradas.length) {
      const texto = statusAtivo === 'todas' ? 'Nenhuma comanda ativa' : 'Nenhuma comanda neste status';
      listaVendasEl.innerHTML = `<p class="placeholder">${texto}</p>`;
      return;
    }

    listaVendasEl.innerHTML = filtradas
      .map(
        (v) => `<div class="venda-card ${v.status}" data-id="${v.id}">
          <div class="venda-info">
            <div class="venda-itens-preview"><strong>${tituloVenda(v)}</strong></div>
            <div style="font-size:11px;color:#666">${v.tipo}</div>
          </div>
          <div class="venda-total">${formatarMoeda(v.total || 0)}</div>
        </div>`
      )
      .join('');

    listaVendasEl.querySelectorAll('.venda-card').forEach((card) => {
      card.addEventListener('click', async () => {
        await abrirVenda(Number(card.dataset.id));
        modal.style.display = 'flex';
      });
    });
  }

  async function abrirVenda(vendaId) {
    try {
      const venda = await API.obterVenda(vendaId);
      vendaAtiva = venda;
      tituloComanda.textContent = `Comanda ${tituloVenda(venda)}`;
      statusComanda.textContent = venda.status;
      statusComanda.className = `status-badge ${venda.status}`;
      totalComanda.textContent = formatarMoeda(venda.total || 0);

      const itens = venda.itens || [];
      if (!itens.length) {
        itensComanda.innerHTML = '<p class="placeholder">Nenhum item</p>';
      } else {
        itensComanda.innerHTML = itens
          .map(
            (it) => `<div class="item" data-item-id="${it.id}" style="padding:12px;background:#f9f9f9;border-radius:4px;border:1px solid #eee;display:flex;flex-direction:column;align-items:center;text-align:center;cursor:pointer;transition:all 0.2s">
              <div style="font-weight:bold;font-size:13px;margin-bottom:6px;width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${it.produto_nome}</div>
              <div style="color:#666;font-size:12px;margin-bottom:6px">x${it.quantidade}</div>
              <div style="color:var(--success);font-weight:bold;font-size:12px">${formatarMoeda(it.subtotal)}</div>
            </div>`
          )
          .join('');

        itensComanda.querySelectorAll('.item').forEach((itemCard) => {
          itemCard.addEventListener('click', () => {
            const item = itens.find((x) => x.id === Number(itemCard.dataset.itemId));
            if (!item) return;
            itemEmEdicao = {
              vendaId: venda.id,
              itemId: item.id,
              nomeProduto: item.produto_nome,
              precoUnitario: Number(item.preco_unitario || (item.subtotal / item.quantidade))
            };
            quantidadeTemp = item.quantidade;
            produtoNomeQtd.textContent = item.produto_nome;
            produtoInfoQtd.textContent = `Preço unitário: ${formatarMoeda(itemEmEdicao.precoUnitario)}`;
            qtdDisplay.textContent = String(item.quantidade);
            modalAjustarQtd.style.display = 'flex';
            modalAjustarQtd.style.justifyContent = 'space-between';
          });
        });
      }
    } catch (err) {
      console.error('Erro ao abrir venda:', err);
    }
  }

  async function salvarQuantidadeItem() {
    if (!itemEmEdicao || quantidadeTemp <= 0) return;
    try {
      await API.atualizarItem(itemEmEdicao.vendaId, itemEmEdicao.itemId, quantidadeTemp);
      await refreshDados();
      if (vendaAtiva) await abrirVenda(vendaAtiva.id);
      modalAjustarQtd.style.display = 'none';
      itemEmEdicao = null;
    } catch (e) {
      console.error('Erro ao atualizar quantidade', e);
      alert('Erro ao atualizar quantidade');
    }
  }

  async function encontrarComandaPorMesa(mesa) {
    const abertas = await API.obterVendasAbertas('bar');
    const chave = normalizarMesa(mesa);
    return abertas.find((v) => normalizarMesa(v.mesa) === chave) || null;
  }

  async function adicionarAvulsoComandaAtiva() {
    if (!vendaAtiva) return;
    const valor = tecladoAvulso && tecladoAvulso.getValue();
    if (valor === null || valor <= 0) return alert('Valor inválido');
    try {
      const temp = await API.criarProduto({
        nome: `Avulso R$ ${valor.toFixed(2)} #${Date.now()}`,
        preco: valor,
        estoque: 9999,
        estoque_minimo: 0,
        tipo: 'simples',
        ativo: false
      });
      const pid = temp.id || temp.lastID;
      await API.adicionarItem(vendaAtiva.id, pid, 1);
      try {
        await API.deletarProduto(pid);
      } catch (e) {
        try {
          await API.atualizarProduto(pid, { ativo: false });
        } catch (e2) {
          console.error('Falha ao inativar produto temporário', e2);
        }
      }
      if (tecladoAvulso) tecladoAvulso.clear();
      await refreshDados();
      if (vendaAtiva) await abrirVenda(vendaAtiva.id);
      showNotificacao('Valor avulso adicionado');
    } catch (e) {
      console.error('Erro ao adicionar avulso', e);
      alert('Erro ao adicionar valor avulso');
    }
  }

  async function refreshDados() {
    if (refreshEmAndamento) return;
    refreshEmAndamento = true;
    try {
      await Promise.all([carregarProdutos(), carregarVendas()]);
      if (vendaAtiva) {
        try {
          const updated = await API.obterVenda(vendaAtiva.id);
          vendaAtiva = updated;
          await abrirVenda(vendaAtiva.id);
        } catch (e) {
          modal.style.display = 'none';
          vendaAtiva = null;
        }
      }
    } finally {
      refreshEmAndamento = false;
    }
  }

  btnQtdMais.addEventListener('click', () => {
    quantidadeTemp++;
    qtdDisplay.textContent = String(quantidadeTemp);
  });

  btnQtdMenos.addEventListener('click', () => {
    if (quantidadeTemp > 1) {
      quantidadeTemp--;
      qtdDisplay.textContent = String(quantidadeTemp);
    }
  });

  btnCancelarQtd.addEventListener('click', () => {
    modalAjustarQtd.style.display = 'none';
    itemEmEdicao = null;
  });

  btnSalvarQtd.addEventListener('click', salvarQuantidadeItem);

  btnRemoverItemQtd.addEventListener('click', async () => {
    if (!itemEmEdicao) return;
    if (!confirm('Remover item da comanda?')) return;
    try {
      await API.removerItem(itemEmEdicao.vendaId, itemEmEdicao.itemId);
      await refreshDados();
      if (vendaAtiva) await abrirVenda(vendaAtiva.id);
      modalAjustarQtd.style.display = 'none';
      itemEmEdicao = null;
    } catch (e) {
      console.error('Erro ao remover item', e);
      alert('Erro ao remover item');
    }
  });

  document.addEventListener('keydown', (evt) => {
    if (evt.key === 'Enter' && modalAjustarQtd.style.display !== 'none') salvarQuantidadeItem();
    if (evt.key === 'Escape' && modalAjustarQtd.style.display !== 'none') {
      modalAjustarQtd.style.display = 'none';
      itemEmEdicao = null;
    }
  });

  modalAjustarQtd.addEventListener('click', (evt) => {
    if (evt.target === modalAjustarQtd) salvarQuantidadeItem();
  });

  btnFecharModal.addEventListener('click', () => (modal.style.display = 'none'));
  btnCancelarComanda.addEventListener('click', () => (modal.style.display = 'none'));

  document.getElementById('btnNovaComanda').addEventListener('click', async () => {
    try {
      let mesa = prompt('Número da mesa (ou deixe em branco para balcão)');
      if (mesa === null) return;
      mesa = mesa.trim();
      const mesaParam = mesa || 'balcao';
      let venda = await encontrarComandaPorMesa(mesaParam);
      const jaExistia = !!venda;
      if (!venda) venda = await API.criarVenda('bar', mesaParam);
      await refreshDados();
      showNotificacao(jaExistia ? 'Comanda existente aberta' : 'Comanda criada');
      if (venda && venda.id) {
        await abrirVenda(venda.id);
        modal.style.display = 'flex';
      }
    } catch (e) {
      console.error('Erro ao criar/abrir comanda', e);
      showNotificacao('Erro', 'error');
    }
  });

  btnRemoverUltimo.addEventListener('click', async () => {
    if (!vendaAtiva || !vendaAtiva.itens || !vendaAtiva.itens.length) return;
    const ultimo = vendaAtiva.itens[vendaAtiva.itens.length - 1];
    try {
      await API.removerItem(vendaAtiva.id, ultimo.id);
      await refreshDados();
      if (vendaAtiva) await abrirVenda(vendaAtiva.id);
      showNotificacao('Último item removido');
    } catch (err) {
      console.error('Erro ao remover item:', err);
      alert('Erro ao remover item');
    }
  });

  btnFecharComanda.addEventListener('click', async () => {
    if (!vendaAtiva) return;
    if (!confirm('Finalizar comanda agora?')) return;
    try {
      await API.fecharVenda(vendaAtiva.id, 'dinheiro');
      modal.style.display = 'none';
      vendaAtiva = null;
      await refreshDados();
      showNotificacao('Comanda finalizada');
    } catch (err) {
      console.error('Erro ao finalizar comanda:', err);
      alert('Erro ao finalizar comanda');
    }
  });

  buscaProdutoModal.addEventListener('input', renderizarGridProdutos);

  if (btnModoProdutos) btnModoProdutos.addEventListener('click', () => aplicarModoModal('produtos'));
  if (btnModoAvulso) btnModoAvulso.addEventListener('click', () => aplicarModoModal('avulso'));
  if (btnClearAvulsoModal) btnClearAvulsoModal.addEventListener('click', () => tecladoAvulso && tecladoAvulso.clear());
  if (btnAddAvulsoModal) btnAddAvulsoModal.addEventListener('click', adicionarAvulsoComandaAtiva);

  document.querySelectorAll('.aba').forEach((aba) => {
    aba.addEventListener('click', () => {
      statusAtivo = aba.dataset.status;
      document.querySelectorAll('.aba').forEach((a) => a.classList.remove('aba-ativa'));
      aba.classList.add('aba-ativa');
      renderizarLista();
    });
  });

  function atualizarBadges() {
    badgeAbertas.textContent = String(vendas.length);
    badgePreparo.textContent = String(vendas.filter((v) => v.status === 'em_preparo').length);
    badgePronta.textContent = String(vendas.filter((v) => v.status === 'pronta').length);
  }

  aplicarModoModal('produtos');
  refreshDados();
  setInterval(refreshDados, 5000);
});
