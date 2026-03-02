// Painel principal (desktop). Depende de `api.js` e `common.js`.

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', switchTab));

  function switchTab(e) {
    document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
    e.currentTarget.classList.add('active');
    document.querySelectorAll('.tab-content').forEach((c) => c.classList.add('hidden'));
    const target = e.currentTarget.dataset.target;
    document.getElementById(target).classList.remove('hidden');
    if (target === 'mesas') carregarMesas();
  }

  function normalizarMesa(valor) {
    const v = String(valor || '').trim();
    if (!v || v.toLowerCase() === 'balcao' || v.toLowerCase() === 'balcão' || v === '0') return 'balcao';
    return v.toLowerCase();
  }

  function tituloComanda(venda) {
    if (venda?.mesa) return `Mesa ${venda.mesa}`;
    return `Balcão #${venda?.id || '--'}`;
  }

  function loadConfig() {
    const cfg = JSON.parse(localStorage.getItem('pdv_config') || '{}');
    const modo = cfg.modo || 'bar';
    const mesaEl = document.getElementById('mesa');
    if (mesaEl && mesaEl.parentElement) mesaEl.parentElement.style.display = modo === 'bar' ? 'block' : 'none';
  }

  document.getElementById('salvarConfig').addEventListener('click', () => {
    const cfg = {
      nome: document.getElementById('nomeEstabelecimento').value,
      modo: document.getElementById('modoOperacao').value,
      cor: document.getElementById('corDestaque').value
    };
    localStorage.setItem('pdv_config', JSON.stringify(cfg));
    loadConfig();
    alert('Configurações salvas');
  });
  loadConfig();

  let carrinho = [];
  let nextAvulsoId = 1;
  let currentMesa = null;
  let vendaAtual = null;
  let produtosCache = [];
  let abrindoComanda = false;
  let mesaTeclado = null;
  let refreshEmAndamento = false;

  const mainTeclado = criarTeclado(document.getElementById('teclado'), document.getElementById('displayValor'));
  if (document.getElementById('btnClear')) {
    document.getElementById('btnClear').addEventListener('click', () => mainTeclado && mainTeclado.clear());
  }
  if (document.getElementById('btnAddValor')) {
    document.getElementById('btnAddValor').addEventListener('click', () => {
      const valor = mainTeclado && mainTeclado.getValue();
      if (valor === null || valor <= 0) return alert('Digite um valor válido');
      adicionarAoCarrinho({ produto_id: 'avulso', nome: `Avulso R$ ${valor.toFixed(2)}`, preco: valor });
      mainTeclado.clear();
      alert('Adicionado ao carrinho');
    });
  }
  if (document.getElementById('btnFinalizarVenda')) {
    document.getElementById('btnFinalizarVenda').addEventListener('click', abrirComanda);
  }

  async function obterComandaAbertaPorMesa(mesaInformada) {
    const chave = normalizarMesa(mesaInformada);
    const vendas = await API.obterVendasAbertas('bar');
    return vendas.find((v) => normalizarMesa(v.mesa) === chave) || null;
  }

  async function abrirComanda() {
    if (abrindoComanda) return;
    if (carrinho.length === 0) {
      alert('Carrinho vazio');
      return;
    }

    const btnFinalizar = document.getElementById('btnFinalizarVenda');
    const mesaInput = document.getElementById('mesa');
    const mesaInformada = (mesaInput?.value || '').trim();
    const mesaParaApi = mesaInformada || 'balcao';

    abrindoComanda = true;
    if (btnFinalizar) {
      btnFinalizar.disabled = true;
      btnFinalizar.textContent = 'Processando...';
    }

    try {
      let venda = await obterComandaAbertaPorMesa(mesaParaApi);
      const comandaExistente = !!venda;
      if (!venda) venda = await API.criarVenda('bar', mesaParaApi);

      vendaAtual = venda.id;
      localStorage.setItem('vendaAtual', vendaAtual);

      for (const it of carrinho) {
        if (String(it.produto_id).startsWith('avulso')) {
          const temp = await API.criarProduto({
            nome: `${it.nome} #${Date.now()}`,
            preco: it.preco,
            estoque: 9999,
            estoque_minimo: 0,
            tipo: 'simples',
            ativo: false
          });
          const pid = temp.id || temp.lastID;
          await API.adicionarItem(venda.id, pid, 1);
          try {
            await API.deletarProduto(pid);
          } catch (e) {
            console.warn('Falha ao remover produto temporário, marcando inativo', e);
            try {
              await API.atualizarProduto(pid, { ativo: false });
            } catch (e2) {
              console.error('Falha ao marcar produto inativo', e2);
            }
          }
        } else {
          await API.adicionarItem(venda.id, it.produto_id, it.quantidade);
        }
      }

      carrinho = [];
      atualizarCarrinhoUI();
      if (mesaInput) mesaInput.value = '';
      await refreshDados();

      const tabMesas = document.querySelector('[data-target="mesas"]');
      if (tabMesas) tabMesas.click();
      alert(comandaExistente ? 'Itens adicionados à comanda existente' : 'Comanda aberta');
    } catch (e) {
      console.error(e);
      alert('Erro: ' + (e.message || e));
    } finally {
      abrindoComanda = false;
      if (btnFinalizar) {
        btnFinalizar.disabled = false;
        btnFinalizar.textContent = 'Abrir Comanda';
      }
    }
  }

  function adicionarAoCarrinho(prod) {
    if (prod.produto_id === 'avulso') {
      carrinho.push({ ...prod, produto_id: `avulso-${nextAvulsoId++}`, quantidade: 1, subtotal: prod.preco });
    } else {
      const prodId = String(prod.produto_id);
      const ex = carrinho.find((i) => String(i.produto_id) === prodId);
      if (ex) {
        ex.quantidade++;
        ex.subtotal = ex.quantidade * ex.preco;
      } else {
        carrinho.push({ ...prod, quantidade: 1, subtotal: prod.preco });
      }
    }
    atualizarCarrinhoUI();
  }
  window.adicionarAoCarrinho = adicionarAoCarrinho;

  function atualizarCarrinhoUI() {
    const el = document.getElementById('carrinhoItens');
    if (!el) return;
    if (carrinho.length === 0) {
      el.innerHTML = '<p style="color:#666;margin:0;font-size:12px">Carrinho vazio</p>';
    } else {
      el.innerHTML = carrinho
        .map(
          (i, idx) => `<div class="cart-item" style="display:flex;justify-content:space-between;align-items:center;padding:8px;background:#f9f9f9;border-radius:4px;margin-bottom:4px"><div style="flex:1"><div class="cart-item-name" style="font-weight:600;font-size:12px">${i.nome}</div><div style="font-size:11px;color:#666">x${i.quantidade}</div></div><div style="display:flex;gap:4px;align-items:center"><button onclick="alterarQuantidadeCarrinho(${idx},-1)" style="padding:2px 6px;font-size:11px;border:1px solid #ccc;background:#fff;cursor:pointer;border-radius:2px">-</button><span style="min-width:20px;text-align:center;font-size:12px;font-weight:600">${i.quantidade}</span><button onclick="alterarQuantidadeCarrinho(${idx},1)" style="padding:2px 6px;font-size:11px;border:1px solid #ccc;background:#fff;cursor:pointer;border-radius:2px">+</button><button onclick="removerDoCarrinho(${idx})" style="padding:2px 6px;font-size:11px;background:var(--danger);color:white;border:none;cursor:pointer;border-radius:2px">✕</button></div><span class="cart-item-value" style="font-weight:bold;color:var(--success);min-width:60px;text-align:right">${formatarMoedaBR(i.subtotal)}</span></div>`
        )
        .join('');
    }
    const totalEl = document.getElementById('carrinhoTotal');
    if (totalEl) totalEl.textContent = formatarMoedaBR(carrinho.reduce((s, i) => s + i.subtotal, 0));
  }

  async function removerItemMesa(vendaId, itemId, skipConfirm = false) {
    if (!skipConfirm && !confirm('Remover item da comanda?')) return;
    try {
      await API.removerItem(vendaId, itemId);
      const updated = await API.obterVenda(vendaId);
      currentMesa = updated;
      renderSideMesa(updated);
      await carregarProdutosCompleto();
      await carregarMesas();
    } catch (e) {
      console.error('Erro ao remover item', e);
      alert('Erro ao remover item');
    }
  }

  async function cancelarPedidoItem(vendaId, itemId) {
    if (!confirm('Cancelar este pedido da comanda?')) return;
    await removerItemMesa(vendaId, itemId, true);
  }

  async function alterarQuantidadeMesa(vendaId, itemId, delta) {
    try {
      const venda = await API.obterVenda(vendaId);
      const item = (venda.itens || []).find((x) => x.id === itemId);
      if (!item) return;
      const novaQtd = item.quantidade + delta;
      if (novaQtd <= 0) {
        await removerItemMesa(vendaId, itemId);
        return;
      }
      await API.atualizarItem(vendaId, itemId, novaQtd);
      const updated = await API.obterVenda(vendaId);
      currentMesa = updated;
      renderSideMesa(updated);
      await carregarProdutosCompleto();
      await carregarMesas();
    } catch (e) {
      console.error('Erro ao alterar quantidade', e);
      alert('Erro ao alterar quantidade');
    }
  }

  window.removerItemMesa = removerItemMesa;
  window.cancelarPedidoItem = cancelarPedidoItem;
  window.alterarQuantidadeMesa = alterarQuantidadeMesa;

  function removerDoCarrinho(idx) {
    carrinho.splice(idx, 1);
    atualizarCarrinhoUI();
  }

  function alterarQuantidadeCarrinho(idx, delta) {
    if (idx < 0 || idx >= carrinho.length) return;
    const novaQtd = carrinho[idx].quantidade + delta;
    if (novaQtd <= 0) {
      removerDoCarrinho(idx);
    } else {
      carrinho[idx].quantidade = novaQtd;
      carrinho[idx].subtotal = novaQtd * carrinho[idx].preco;
      atualizarCarrinhoUI();
    }
  }

  window.removerDoCarrinho = removerDoCarrinho;
  window.alterarQuantidadeCarrinho = alterarQuantidadeCarrinho;

  async function carregarMesas() {
    try {
      const vendas = await API.obterVendasAbertas('bar');
      const el = document.getElementById('listaMesas');
      if (!el) return;
      if (!vendas || vendas.length === 0) {
        el.innerHTML = '<p style="padding:8px;font-size:12px">Nenhuma comanda aberta</p>';
        return;
      }
      el.innerHTML = vendas
        .map(
          (v) =>
            `<div class="mesas-list-item" data-id="${v.id}"><strong>${tituloComanda(v)}</strong><span class="mesa-value">${formatarMoedaBR(v.total || 0)}</span></div>`
        )
        .join('');
      el.querySelectorAll('.mesas-list-item').forEach((d) => d.addEventListener('click', () => abrirMesa(d.dataset.id)));
    } catch (err) {
      console.error('Erro ao carregar comandas', err);
    }
  }

  async function abrirMesa(id) {
    try {
      const venda = await API.obterVenda(id);
      currentMesa = venda;
      renderSideMesa(venda);
    } catch (err) {
      console.error(err);
      alert('Erro ao abrir comanda');
    }
  }

  function renderSideMesa(venda) {
    const sideEl = document.getElementById('sideMesas');
    if (!sideEl) return;
    const itens = venda.itens || [];
    const filtered = produtosCache.filter((p) => p.tipo !== 'avulso' && p.ativo && p.estoque > 0);

    let prodGrid = '<p style="font-size:11px;color:#666;margin:8px 0">Sem produtos disponíveis</p>';
    if (filtered.length > 0) {
      prodGrid = '<div class="produtos-mesa-grid">';
      prodGrid += filtered
        .map(
          (p) =>
            `<div class="produto-mesa-card" data-id="${p.id}" style="cursor:pointer"><div class="produto-mesa-card-img">IMG</div><div class="produto-mesa-card-name">${p.nome}</div><div class="produto-mesa-card-price">${formatarMoedaBR(p.preco)}</div><div style="font-size:10px;color:#0a7;margin-top:4px">${p.estoque} disponíveis${Number(p.vai_cozinha || 0) === 1 ? ' • cozinha' : ''}</div></div>`
        )
        .join('');
      prodGrid += '</div>';
    }

    const getStatusItem = (item) => {
      const vaiCozinha = Number(item.produto_vai_cozinha || 0) === 1;
      if (!vaiCozinha) {
        return { label: 'Liberado', color: '#607D8B', bg: 'rgba(96,125,139,0.12)' };
      }
      if (venda.status === 'pronta') {
        return { label: 'Pronto', color: '#2E7D32', bg: 'rgba(76,175,80,0.15)' };
      }
      if (venda.status === 'em_preparo') {
        return { label: 'Em preparo', color: '#EF6C00', bg: 'rgba(255,152,0,0.15)' };
      }
      return { label: 'Aguardando', color: '#1565C0', bg: 'rgba(33,150,243,0.15)' };
    };

    sideEl.innerHTML = `
      <div class="sidebar-section">
        <h3>Comanda ${tituloComanda(venda)}</h3>
        <div style="font-size:12px;margin-bottom:8px">Total: <strong style="color:var(--success)">${formatarMoedaBR(venda.total || 0)}</strong></div>
        <h4 style="margin:8px 0 4px;font-size:12px">Itens</h4>
        <div class="mesa-items-list">
          ${
            itens.length === 0
              ? '<p style="color:#666;margin:0">Sem itens</p>'
              : itens
                  .map((i) => {
                    const st = getStatusItem(i);
                    return `<div class="mesa-item" style="display:flex;justify-content:space-between;align-items:center;padding:6px;border-bottom:1px solid #eee;font-size:12px;border-left:4px solid ${st.color};background:${st.bg}">
                      <div style="flex:1">
                        <div>${i.produto_nome}</div>
                        <div style="font-size:10px;color:#999">x${i.quantidade}</div>
                        <div style="display:inline-block;margin-top:2px;padding:1px 6px;border-radius:10px;font-size:10px;color:${st.color};background:#fff">${st.label}</div>
                      </div>
                      <div style="display:flex;gap:4px;align-items:center">
                        <button onclick="alterarQuantidadeMesa(${venda.id},${i.id},-1)" style="padding:2px 4px;font-size:10px;border:1px solid #ccc;background:#fff;cursor:pointer;border-radius:2px">-</button>
                        <span style="min-width:18px;text-align:center;font-size:10px">${i.quantidade}</span>
                        <button onclick="alterarQuantidadeMesa(${venda.id},${i.id},1)" style="padding:2px 4px;font-size:10px;border:1px solid #ccc;background:#fff;cursor:pointer;border-radius:2px">+</button>
                        <button onclick="cancelarPedidoItem(${venda.id},${i.id})" style="padding:2px 6px;font-size:10px;background:var(--danger);color:white;border:none;cursor:pointer;border-radius:2px">Cancelar</button>
                      </div>
                      <span style="color:var(--success);font-weight:bold;min-width:50px;text-align:right">${formatarMoedaBR(i.subtotal)}</span>
                    </div>`;
                  })
                  .join('')
          }
        </div>
        <hr style="margin:12px 0;border:none;border-top:1px solid #eee" />
        <div style="display:flex;gap:6px;margin-bottom:8px">
          <button id="btnModoProdutos" class="btn btn-small" style="flex:1;padding:8px;font-size:11px">Produtos</button>
          <button id="btnModoAvulso" class="btn btn-small btn-secondary" style="flex:1;padding:8px;font-size:11px">Valor Avulso</button>
        </div>
        <div id="blocoProdutos" style="display:block">
          <h4 style="margin:8px 0 4px;font-size:12px">Adicionar Produto</h4>
          ${prodGrid}
        </div>
        <div id="blocoAvulso" style="display:none">
          <h4 style="margin:8px 0 4px;font-size:12px">Valor Avulso</h4>
          <div id="sideMesaDisplay" class="display-value" style="font-size:18px;margin-bottom:8px">R$ 0,00</div>
          <div id="sideMesaTeclado" class="numeric-pad" style="grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:8px"></div>
          <div style="display:flex;gap:4px;flex-direction:column;margin-bottom:12px">
            <button id="btnSideMesaClear" class="pad-key secondary" style="padding:8px;font-size:11px">Limpar</button>
            <button id="btnSideMesaAddValor" class="pad-key" style="padding:8px;font-size:11px">Adicionar Valor</button>
          </div>
        </div>
        <button id="btnSideMesaFechar" class="btn btn-success btn-block" style="font-size:12px;padding:10px">Fechar Comanda</button>
      </div>
    `;

    const blocoProdutos = document.getElementById('blocoProdutos');
    const blocoAvulso = document.getElementById('blocoAvulso');
    const btnModoProdutos = document.getElementById('btnModoProdutos');
    const btnModoAvulso = document.getElementById('btnModoAvulso');

    function aplicarModo(modo) {
      const produtosAtivo = modo === 'produtos';
      if (blocoProdutos) blocoProdutos.style.display = produtosAtivo ? 'block' : 'none';
      if (blocoAvulso) blocoAvulso.style.display = produtosAtivo ? 'none' : 'block';
      if (btnModoProdutos) btnModoProdutos.className = produtosAtivo ? 'btn btn-small' : 'btn btn-small btn-secondary';
      if (btnModoAvulso) btnModoAvulso.className = produtosAtivo ? 'btn btn-small btn-secondary' : 'btn btn-small';
    }

    if (btnModoProdutos) btnModoProdutos.addEventListener('click', () => aplicarModo('produtos'));
    if (btnModoAvulso) btnModoAvulso.addEventListener('click', () => aplicarModo('avulso'));
    aplicarModo('produtos');

    if (mesaTeclado && mesaTeclado.container) mesaTeclado.container.innerHTML = '';
    mesaTeclado = criarTeclado(document.getElementById('sideMesaTeclado'), document.getElementById('sideMesaDisplay'));
    if (mesaTeclado) mesaTeclado.container = document.getElementById('sideMesaTeclado');

    const btnSideClear = document.getElementById('btnSideMesaClear');
    if (btnSideClear) btnSideClear.addEventListener('click', () => mesaTeclado && mesaTeclado.clear());

    const btnSideAdd = document.getElementById('btnSideMesaAddValor');
    if (btnSideAdd) {
      btnSideAdd.addEventListener('click', async () => {
        const valor = mesaTeclado && mesaTeclado.getValue();
        if (valor === null || valor <= 0) return alert('Valor inválido');
        if (!currentMesa) return alert('Nenhuma comanda selecionada');
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
          await API.adicionarItem(currentMesa.id, pid, 1);
          const upd = await API.obterVenda(currentMesa.id);
          currentMesa = upd;
          renderSideMesa(upd);
          if (mesaTeclado) mesaTeclado.clear();
          try {
            await API.deletarProduto(pid);
          } catch (e) {
            console.warn('Falha ao remover produto temporário, marcando inativo', e);
            try {
              await API.atualizarProduto(pid, { ativo: false });
            } catch (e2) {
              console.error('Falha ao marcar produto inativo', e2);
            }
          }
          await carregarProdutosCompleto();
          await carregarMesas();
        } catch (e) {
          console.error(e);
          alert('Erro ao adicionar valor');
        }
      });
    }

    sideEl.querySelectorAll('.produto-mesa-card').forEach((card) => {
      card.addEventListener('click', async () => {
        const pid = card.dataset.id;
        if (!currentMesa) return;
        try {
          await API.adicionarItem(currentMesa.id, pid, 1);
          const updated = await API.obterVenda(currentMesa.id);
          currentMesa = updated;
          renderSideMesa(updated);
          await carregarProdutosCompleto();
          await carregarMesas();
        } catch (er) {
          console.error(er);
          alert(er.message || 'Erro ao adicionar item');
        }
      });
    });

    const btnFechar = document.getElementById('btnSideMesaFechar');
    if (btnFechar) {
      btnFechar.addEventListener('click', async () => {
        if (!currentMesa) return;
        if (!confirm('Fechar comanda?')) return;
        try {
          await API.fecharVenda(currentMesa.id, 'dinheiro');
          document.getElementById('sideMesas').innerHTML = '<p style="color:#999;font-size:12px">Selecione uma comanda à esquerda</p>';
          currentMesa = null;
          vendaAtual = null;
          localStorage.removeItem('vendaAtual');
          await carregarMesas();
          await carregarProdutosCompleto();
          alert('Comanda fechada');
        } catch (e) {
          console.error(e);
          alert('Erro ao fechar comanda');
        }
      });
    }
  }

  function renderProdutosGrid(produtos) {
    const el = document.getElementById('produtosGrid');
    if (!el) return;
    const filtered = produtos.filter((p) => p.tipo !== 'avulso');
    el.innerHTML = filtered
      .map((p) => {
        const semEstoque = Number(p.estoque || 0) <= 0;
        return `<div class="product-card ${semEstoque ? 'sem-estoque' : ''}" data-id="${p.id}" data-nome="${p.nome}" data-preco="${p.preco}" style="${semEstoque ? 'opacity:.55;cursor:not-allowed;' : ''}">\n      <div class="product-image">${p.imagem ? `<img src="${p.imagem}" style="width:100%;height:100%;object-fit:cover"/>` : 'IMG'}</div>\n      <div class="product-name">${p.nome}</div>\n      <div class="product-price">${formatarMoedaBR(p.preco)}</div>\n      <div class="product-meta">${p.estoque} em estoque${Number(p.vai_cozinha || 0) === 1 ? ' • cozinha' : ''}</div>\n    </div>`;
      })
      .join('');
    el.querySelectorAll('.product-card').forEach((card) => {
      card.addEventListener('click', () => {
        const estoque = Number(
          (filtered.find((p) => String(p.id) === String(card.dataset.id)) || { estoque: 0 }).estoque || 0
        );
        if (estoque <= 0) return alert('Produto sem estoque');
        adicionarAoCarrinho({
          produto_id: card.dataset.id,
          nome: card.dataset.nome,
          preco: parseFloat(card.dataset.preco)
        });
      });
    });
  }

  function renderProdutosList(produtos) {
    const el = document.getElementById('prodList');
    if (!el) return;
    const filtered = produtos.filter((p) => p.tipo !== 'avulso');
    el.innerHTML = filtered
      .map(
        (p) =>
          `<div class="product-list-item" data-id="${p.id}"><div><div class="product-list-item-name">#${p.id} ${p.nome}</div><div style="font-size:11px;color:#999">${p.tipo}${Number(p.vai_cozinha || 0) === 1 ? ' • cozinha' : ''}</div></div><div class="product-list-item-info"><span class="qty">${p.estoque} un</span><span class="price">${formatarMoedaBR(p.preco)}</span><button onclick="deletarProduto(${p.id})" class="delete-btn">X</button></div></div>`
      )
      .join('');
    el.querySelectorAll('.product-list-item').forEach((item) => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        selecionarProduto(id);
      });
    });
    if (window.produtoSelecionado) {
      const sel = el.querySelector(`.product-list-item[data-id="${window.produtoSelecionado}"]`);
      if (sel) sel.classList.add('selected');
    }
  }

  let produtoImagemBase64 = null;
  window.produtoSelecionado = null;
  let precoTeclado = null;

  const novoProdutoImagemEl = document.getElementById('novoProdutoImagem');
  if (novoProdutoImagemEl) {
    novoProdutoImagemEl.addEventListener('change', (ev) => {
      const file = ev.target.files[0];
      const preview = document.getElementById('previewImagem');
      if (file) {
        if (file.size > 5 * 1024 * 1024) {
          ev.target.value = '';
          if (preview) preview.style.display = 'none';
          produtoImagemBase64 = null;
          alert('Arquivo muito grande (máx 5MB)');
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          produtoImagemBase64 = reader.result;
          if (preview) {
            preview.src = reader.result;
            preview.style.display = 'block';
          }
        };
        reader.readAsDataURL(file);
      } else {
        produtoImagemBase64 = null;
        if (preview) {
          preview.src = '';
          preview.style.display = 'none';
        }
      }
    });
  }

  async function carregarProdutosCompleto() {
    try {
      produtosCache = await API.obterProdutos();
      renderProdutosGrid(produtosCache);
      renderProdutosList(produtosCache);
    } catch (e) {
      console.error('Erro ao carregar produtos:', e);
    }
  }

  let criacaoProdutoEmProgresso = false;
  const btnCriarProduto = document.getElementById('btnCriarProduto');
  if (btnCriarProduto) {
    btnCriarProduto.addEventListener('click', async () => {
      if (criacaoProdutoEmProgresso) {
        alert('Aguarde...');
        return;
      }
      const nome = document.getElementById('novoProdutoNome').value || '';
      const preco = precoTeclado && precoTeclado.getValue();
      const estoque = parseInt(document.getElementById('novoProdutoEstoque').value, 10) || 0;
      const vaiCozinha = !!document.getElementById('novoProdutoVaiCozinha')?.checked;
      if (!nome.trim() || isNaN(preco)) {
        alert('Preencha nome e preço');
        return;
      }
      if (preco <= 0) {
        alert('Preço deve ser maior que zero');
        return;
      }

      criacaoProdutoEmProgresso = true;
      btnCriarProduto.disabled = true;
      try {
        if (window.produtoSelecionado) {
          btnCriarProduto.textContent = 'Atualizando...';
          await API.atualizarProduto(window.produtoSelecionado, {
            nome,
            preco,
            estoque,
            imagem: produtoImagemBase64,
            vai_cozinha: vaiCozinha
          });
          alert('Produto atualizado!');
        } else {
          btnCriarProduto.textContent = 'Criando...';
          await API.criarProduto({
            nome,
            preco,
            estoque,
            estoque_minimo: 0,
            tipo: 'simples',
            imagem: produtoImagemBase64,
            vai_cozinha: vaiCozinha
          });
          alert('Produto criado com sucesso!');
        }
        limparFormularioProduto();
        await carregarProdutosCompleto();
      } catch (e) {
        console.error('Erro ao salvar produto:', e);
        alert('Erro: ' + (e.message || e));
      } finally {
        criacaoProdutoEmProgresso = false;
        btnCriarProduto.disabled = false;
        btnCriarProduto.textContent = 'Criar Produto';
      }
    });
  }

  function limparFormularioProduto() {
    window.produtoSelecionado = null;
    const nomeEl = document.getElementById('novoProdutoNome');
    if (nomeEl) nomeEl.value = '';
    if (precoTeclado) precoTeclado.clear();
    const estoqueEl = document.getElementById('novoProdutoEstoque');
    if (estoqueEl) estoqueEl.value = '0';
    const cozinhaEl = document.getElementById('novoProdutoVaiCozinha');
    if (cozinhaEl) cozinhaEl.checked = false;
    const inputImg = document.getElementById('novoProdutoImagem');
    if (inputImg) inputImg.value = '';
    const preview = document.getElementById('previewImagem');
    if (preview) preview.style.display = 'none';
    produtoImagemBase64 = null;
    if (document.getElementById('btnCriarProduto')) document.getElementById('btnCriarProduto').textContent = 'Criar Produto';
    const btnCancelar = document.getElementById('btnCancelarEdicao');
    if (btnCancelar) btnCancelar.style.display = 'none';
    const header = document.querySelector('#sideProdutos .sidebar-section h3');
    if (header) header.textContent = 'Novo Produto';
    document.querySelectorAll('.product-list-item').forEach((x) => x.classList.remove('selected'));
  }

  async function selecionarProduto(id) {
    try {
      const prod = await API.obterProduto(id);
      window.produtoSelecionado = prod.id;
      const nomeEl = document.getElementById('novoProdutoNome');
      if (nomeEl) nomeEl.value = prod.nome;
      if (precoTeclado) precoTeclado.setValue(prod.preco);
      const estoqueEl = document.getElementById('novoProdutoEstoque');
      if (estoqueEl) estoqueEl.value = prod.estoque || 0;
      const cozinhaEl = document.getElementById('novoProdutoVaiCozinha');
      if (cozinhaEl) cozinhaEl.checked = Number(prod.vai_cozinha || 0) === 1;
      if (prod.imagem) {
        produtoImagemBase64 = prod.imagem;
        const preview = document.getElementById('previewImagem');
        if (preview) {
          preview.src = prod.imagem;
          preview.style.display = 'block';
        }
      }
      const btnCriar = document.getElementById('btnCriarProduto');
      if (btnCriar) btnCriar.textContent = 'Salvar Alterações';
      const btnCancelar = document.getElementById('btnCancelarEdicao');
      if (btnCancelar) btnCancelar.style.display = 'block';
      const header = document.querySelector('#sideProdutos .sidebar-section h3');
      if (header) header.textContent = `Produto #${prod.id}`;
      document.querySelectorAll('.product-list-item').forEach((x) => x.classList.remove('selected'));
      const item = document.querySelector(`.product-list-item[data-id="${id}"]`);
      if (item) item.classList.add('selected');
    } catch (e) {
      console.error('Erro ao obter produto para edição', e);
    }
  }

  const btnCancelarEdicao = document.getElementById('btnCancelarEdicao');
  if (btnCancelarEdicao) btnCancelarEdicao.addEventListener('click', () => limparFormularioProduto());

  window.deletarProduto = async (id) => {
    if (!confirm('Deletar produto?')) return;
    try {
      await API.deletarProduto(id);
      await carregarProdutosCompleto();
      limparFormularioProduto();
      if (currentMesa) {
        const updated = await API.obterVenda(currentMesa.id);
        currentMesa = updated;
        renderSideMesa(updated);
      }
    } catch (e) {
      alert('Erro ao deletar');
    }
  };

  async function refreshDados() {
    if (refreshEmAndamento) return;
    refreshEmAndamento = true;
    try {
      await carregarProdutosCompleto();
      await carregarMesas();
      if (currentMesa) {
        try {
          const updated = await API.obterVenda(currentMesa.id);
          currentMesa = updated;
          renderSideMesa(updated);
        } catch (e) {
          currentMesa = null;
          const side = document.getElementById('sideMesas');
          if (side) side.innerHTML = '<p style="color:#999;font-size:12px">Selecione uma comanda à esquerda</p>';
        }
      }
    } finally {
      refreshEmAndamento = false;
    }
  }

  precoTeclado = criarTeclado(document.getElementById('precoTeclado'), document.getElementById('displayPreco'));

  carregarProdutosCompleto().then(async () => {
    limparFormularioProduto();
    await carregarMesas();
  });
  setInterval(refreshDados, 5000);
});
