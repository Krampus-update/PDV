// Garçom (mobile): fluxo alinhado ao painel desktop.

document.addEventListener('DOMContentLoaded', () => {
  const listaVendasEl = document.getElementById('listaVendas');
  const mainContentEl = document.querySelector('.main-content');
  const badgeAbertas = document.getElementById('badgeAbertas');
  const badgePreparo = document.getElementById('badgePreparo');
  const badgePronta = document.getElementById('badgePronta');
  const statusCurrentLabel = document.getElementById('statusCurrentLabel');
  const statusCurrentDot = document.getElementById('statusCurrentDot');

  const modal = document.getElementById('modalDetalhes');
  const btnFecharModal = document.getElementById('btnFecharModal');
  const tituloComanda = document.getElementById('tituloComanda');
  const statusComanda = document.getElementById('statusComanda');
  const totalComanda = document.getElementById('totalComanda');
  const itensComanda = document.getElementById('itensComanda');
  const gridProdutosModal = document.getElementById('gridProdutosModal');
  const chipsCategoriaModal = document.getElementById('chipsCategoriaModal');
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
  let categoriaAtiva = 'todas';
  let refreshEmAndamento = false;
  const statusOrder = ['todas', 'em_preparo', 'pronta'];
  const ui = window.PDVUI || {};
  const uiNotify = (message, type = 'info') =>
    ui.notify ? ui.notify({ title: 'Garçom', message, type, keepHistory: true }) : console.log(`[${type}] ${message}`);
  const uiAlert = async (message, type = 'info') => {
    if (ui.alert) return ui.alert(message, type, 'Garçom');
    alert(message);
  };
  const uiConfirm = async (message, opts = {}) => {
    if (ui.confirm) return ui.confirm(message, opts);
    return confirm(message);
  };

  function statusLabel(status) {
    if (status === 'em_preparo') return 'Preparando';
    if (status === 'pronta') return 'Pronta';
    return 'Todas';
  }

  function statusColor(status) {
    if (status === 'em_preparo') return '#f59e0b';
    if (status === 'pronta') return '#22c55e';
    return '#3b82f6';
  }

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
    if (venda?.nome_comanda) return venda.nome_comanda;
    if (venda?.origem === 'ifood' && venda?.origem_codigo) {
      const cliente = venda?.cliente_nome || venda?.observacoes || 'Cliente';
      return `iFood - ${cliente} (${venda.origem_codigo})`;
    }
    if (venda.mesa) return `Mesa ${venda.mesa}`;
    return `Balcão #${venda.id}`;
  }

  function showNotificacao(msg, tipo = 'success') {
    uiNotify(msg, tipo);
  }

  function normalizarCategoria(v) {
    const s = String(v || '').trim().toLowerCase();
    return s || 'geral';
  }

  function rotuloCategoria(v) {
    const c = normalizarCategoria(v);
    return c.charAt(0).toUpperCase() + c.slice(1);
  }

  function parseOpcoesProduto(prod) {
    try {
      const arr = JSON.parse(prod?.opcoes_json || '[]');
      if (!Array.isArray(arr)) return [];
      return arr
        .map((o) => ({
          nome: String(o?.nome || '').trim(),
          extra: Number(o?.extra || 0) || 0,
          estoque: o?.estoque === '' || o?.estoque === null || o?.estoque === undefined ? null : Math.max(0, Number.parseInt(o?.estoque, 10) || 0)
        }))
        .filter((o) => o.nome);
    } catch {
      return [];
    }
  }

  async function escolherOpcaoProduto(prod) {
    const opcoes = parseOpcoesProduto(prod);
    if (!opcoes.length) return { observacoes: null, preco: Number(prod.preco || 0) };
    const idx = ui.choose
      ? await ui.choose({
          title: `Variação - ${prod.nome}`,
          message: 'Selecione a variação desejada.',
          okLabel: 'Adicionar',
          items: [
            {
              value: -1,
              label: 'Normal',
              meta: `${formatarMoeda(Number(prod.preco || 0))} • estoque padrão`
            },
            ...opcoes.map((o, index) => ({
              value: index,
              label: o.nome,
              meta: [
                `${o.extra >= 0 ? '+' : ''}${formatarMoeda(o.extra)}`,
                o.estoque === null ? 'estoque livre' : `${o.estoque} disp.`
              ].join(' • '),
              disabled: o.estoque !== null && Number(o.estoque) <= 0
            }))
          ]
        })
      : 0;
    if (idx === null || idx === undefined) return null;
    if (Number(idx) === -1) {
      return { observacoes: null, preco: Number(prod.preco || 0) };
    }
    const sel = opcoes[idx];
    if (!sel) return null;
    if (sel.estoque !== null && Number(sel.estoque) <= 0) {
      await uiAlert(`A variação "${sel.nome}" está sem estoque.`, 'warning');
      return null;
    }
    return {
      observacoes: sel.nome,
      preco: Number(prod.preco || 0) + Number(sel.extra || 0)
    };
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
      renderizarChipsCategoria();
      renderizarGridProdutos();
    } catch (err) {
      console.error('Erro ao carregar produtos:', err);
    }
  }

  function renderizarChipsCategoria() {
    if (!chipsCategoriaModal) return;
    const cats = [
      ...new Set(
        produtos.filter((p) => p.ativo && p.tipo !== 'avulso').map((p) => normalizarCategoria(p.categoria))
      )
    ].sort();
    const all = ['todas', ...cats];
    if (!all.includes(categoriaAtiva)) categoriaAtiva = 'todas';

    chipsCategoriaModal.innerHTML = all
      .map((c) => `<button class="chip-categoria ${c === categoriaAtiva ? 'ativo' : ''}" data-categoria="${c}">${c === 'todas' ? 'Todas' : rotuloCategoria(c)}</button>`)
      .join('');

    chipsCategoriaModal.querySelectorAll('.chip-categoria').forEach((btn) => {
      btn.addEventListener('click', () => {
        categoriaAtiva = btn.dataset.categoria || 'todas';
        renderizarChipsCategoria();
        renderizarGridProdutos();
      });
    });
  }

  function renderizarGridProdutos() {
    const termo = (buscaProdutoModal.value || '').toLowerCase().trim();
    const base = produtos.filter((p) => p.ativo && p.tipo !== 'avulso' && p.nome.toLowerCase().includes(termo));
    const cardHtml = (p) => {
      const semEstoque = Number(p.estoque || 0) <= 0;
      const qtdOpcoes = parseOpcoesProduto(p).length;
      return `<div class="produto-card ${semEstoque ? 'sem-estoque' : ''}" data-id="${p.id}" data-nome="${p.nome}" data-preco="${p.preco}" style="cursor:${semEstoque ? 'not-allowed' : 'pointer'}">
          <div class="produto-nome">${p.nome}</div>
          <div class="produto-preco">${formatarMoeda(p.preco)}</div>
          <div class="produto-estoque">${p.estoque} em estoque${qtdOpcoes ? ` • ${qtdOpcoes} opções` : ''}</div>
        </div>`;
    };

    if (categoriaAtiva === 'todas') {
      gridProdutosModal.classList.add('grouped');
      const grouped = base.reduce((acc, p) => {
        const cat = normalizarCategoria(p.categoria);
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(p);
        return acc;
      }, {});
      const cats = Object.keys(grouped).sort();
      if (!cats.length) {
        gridProdutosModal.innerHTML = '<p class="placeholder">Nenhum produto disponível</p>';
        return;
      }
      gridProdutosModal.innerHTML = cats
        .map((cat) => {
          const cards = grouped[cat].map((p) => cardHtml(p)).join('');
          return `<section class="categoria-bloco-modal"><h4 class="categoria-titulo-modal">${rotuloCategoria(cat)}</h4><div class="categoria-grid-modal">${cards}</div></section>`;
        })
        .join('');
    } else {
      gridProdutosModal.classList.remove('grouped');
      const filtrados = base.filter((p) => normalizarCategoria(p.categoria) === categoriaAtiva);
      if (filtrados.length === 0) {
        gridProdutosModal.innerHTML = '<p class="placeholder">Nenhum produto disponível</p>';
        return;
      }
      gridProdutosModal.innerHTML = filtrados.map((p) => cardHtml(p)).join('');
    }

    gridProdutosModal.querySelectorAll('.produto-card').forEach((card) => {
      card.addEventListener('click', async () => {
        const produtoId = Number(card.dataset.id);
        const produto = produtos.find((p) => p.id === produtoId);
        if (!produto || Number(produto.estoque || 0) <= 0) return;
        if (!vendaAtiva) return;
        try {
          const opcao = await escolherOpcaoProduto(produto);
          if (opcao === null) return;
          await API.adicionarItem(vendaAtiva.id, produtoId, 1, {
            observacoes: opcao.observacoes || null,
            preco_unitario_override: opcao.preco
          });
          await refreshDados();
          if (vendaAtiva) await abrirVenda(vendaAtiva.id);
          showNotificacao(`${produto.nome} adicionado`);
        } catch (err) {
          console.error('Erro ao adicionar item:', err);
          await uiAlert(err.message || 'Erro ao adicionar item', 'error');
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

  function aplicarStatusFiltro(status) {
    statusAtivo = status;
    document.querySelectorAll('.aba').forEach((a) => a.classList.toggle('aba-ativa', a.dataset.status === statusAtivo));
    document.querySelectorAll('.status-step').forEach((s) => s.classList.toggle('active', s.dataset.step === statusAtivo));
    if (statusCurrentLabel) statusCurrentLabel.textContent = statusLabel(statusAtivo);
    if (statusCurrentDot) statusCurrentDot.style.background = statusColor(statusAtivo);
    renderizarLista();
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
              ${it.observacoes ? `<div style="font-size:11px;color:#555;margin-bottom:6px">${it.observacoes}</div>` : ''}
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
      await uiAlert('Erro ao atualizar quantidade', 'error');
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
    if (valor === null || valor <= 0) return uiAlert('Valor inválido', 'warning');
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
      await uiAlert('Erro ao adicionar valor avulso', 'error');
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
    if (!(await uiConfirm('Remover item da comanda?', { title: 'Confirmar remoção' }))) return;
    try {
      await API.removerItem(itemEmEdicao.vendaId, itemEmEdicao.itemId);
      await refreshDados();
      if (vendaAtiva) await abrirVenda(vendaAtiva.id);
      modalAjustarQtd.style.display = 'none';
      itemEmEdicao = null;
    } catch (e) {
      console.error('Erro ao remover item', e);
      await uiAlert('Erro ao remover item', 'error');
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
      let mesa = ui.prompt
        ? await ui.prompt({
            title: 'Nova comanda',
            message: 'Número da mesa (deixe em branco para balcão).',
            placeholder: 'Ex: 12',
            value: ''
          })
        : '';
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
      await uiAlert('Erro ao remover item', 'error');
    }
  });

  btnFecharComanda.addEventListener('click', async () => {
    if (!vendaAtiva) return;
    if (!(await uiConfirm('Finalizar comanda agora?', { title: 'Finalizar comanda' }))) return;
    try {
      await API.fecharVenda(vendaAtiva.id, 'dinheiro');
      modal.style.display = 'none';
      vendaAtiva = null;
      await refreshDados();
      showNotificacao('Comanda finalizada');
    } catch (err) {
      console.error('Erro ao finalizar comanda:', err);
      await uiAlert('Erro ao finalizar comanda', 'error');
    }
  });

  buscaProdutoModal.addEventListener('input', renderizarGridProdutos);

  if (btnModoProdutos) btnModoProdutos.addEventListener('click', () => aplicarModoModal('produtos'));
  if (btnModoAvulso) btnModoAvulso.addEventListener('click', () => aplicarModoModal('avulso'));
  if (btnClearAvulsoModal) btnClearAvulsoModal.addEventListener('click', () => tecladoAvulso && tecladoAvulso.clear());
  if (btnAddAvulsoModal) btnAddAvulsoModal.addEventListener('click', adicionarAvulsoComandaAtiva);

  document.querySelectorAll('.aba').forEach((aba) => {
    aba.addEventListener('click', () => {
      aplicarStatusFiltro(aba.dataset.status);
    });
  });

  let touchStartX = 0;
  let touchStartY = 0;
  if (mainContentEl) {
    mainContentEl.addEventListener(
      'touchstart',
      (e) => {
        const t = e.changedTouches && e.changedTouches[0];
        if (!t) return;
        touchStartX = t.clientX;
        touchStartY = t.clientY;
      },
      { passive: true }
    );

    mainContentEl.addEventListener(
      'touchend',
      (e) => {
        const t = e.changedTouches && e.changedTouches[0];
        if (!t) return;
        const dx = t.clientX - touchStartX;
        const dy = t.clientY - touchStartY;
        if (Math.abs(dx) < 50) return;
        if (Math.abs(dx) < Math.abs(dy) * 1.2) return;

        const idx = statusOrder.indexOf(statusAtivo);
        if (dx < 0 && idx < statusOrder.length - 1) {
          aplicarStatusFiltro(statusOrder[idx + 1]);
        } else if (dx > 0 && idx > 0) {
          aplicarStatusFiltro(statusOrder[idx - 1]);
        }
      },
      { passive: true }
    );
  }

  function atualizarBadges() {
    badgeAbertas.textContent = String(vendas.length);
    badgePreparo.textContent = String(vendas.filter((v) => v.status === 'em_preparo').length);
    badgePronta.textContent = String(vendas.filter((v) => v.status === 'pronta').length);
  }

  aplicarModoModal('produtos');
  refreshDados();
  if (window.initRealtime) {
    window.initRealtime((evt) => {
      if (!evt || !evt.type) return;
      if (evt.type.startsWith('venda.') || evt.type.startsWith('produto.')) {
        refreshDados();
      }
    });
  }
  setInterval(refreshDados, 5000);
});
