// Painel principal (desktop). Depende de `api.js` e `common.js`.

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', switchTab));
  const tabViaQuery = (new URLSearchParams(window.location.search).get('tab') || '').toLowerCase();

  function switchTab(e) {
    document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
    e.currentTarget.classList.add('active');
    document.querySelectorAll('.tab-content').forEach((c) => c.classList.add('hidden'));
    const target = e.currentTarget.dataset.target;
    document.getElementById(target).classList.remove('hidden');
    if (target === 'mesas') carregarMesas();
    if (target === 'clientes') carregarClientes();
  }

  if (tabViaQuery && ['home', 'produtos', 'mesas', 'clientes'].includes(tabViaQuery)) {
    const alvo = document.querySelector(`.tab[data-target="${tabViaQuery}"]`);
    if (alvo) alvo.click();
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

  loadConfig();
  let filtroComandaTermo = '';
  let filtroComandaStatus = 'todas';
  const buscaComandaEl = document.getElementById('buscaComanda');
  const filtroStatusComandaEl = document.getElementById('filtroStatusComanda');
  if (buscaComandaEl) {
    buscaComandaEl.addEventListener('input', () => {
      filtroComandaTermo = String(buscaComandaEl.value || '').toLowerCase().trim();
      carregarMesas();
    });
  }
  if (filtroStatusComandaEl) {
    filtroStatusComandaEl.addEventListener('change', () => {
      filtroComandaStatus = filtroStatusComandaEl.value || 'todas';
      carregarMesas();
    });
  }
  const btnAddVariacao = document.getElementById('btnAddVariacao');
  if (btnAddVariacao) {
    btnAddVariacao.addEventListener('click', () => adicionarLinhaVariacao('', 0));
  }

  let carrinho = [];
  let nextAvulsoId = 1;
  let currentMesa = null;
  let vendaAtual = null;
  let produtosCache = [];
  let categoriaAtiva = 'todas';
  let categoriaAtivaMesa = 'todas';
  let abrindoComanda = false;
  let mesaTeclado = null;
  let refreshEmAndamento = false;

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
        .map((o) => ({ nome: String(o?.nome || '').trim(), extra: Number(o?.extra || 0) || 0 }))
        .filter((o) => o.nome);
    } catch {
      return [];
    }
  }

  function opcoesParaTexto(opcoes) {
    return opcoes.map((o, idx) => `${idx + 1}) ${o.nome} (${o.extra >= 0 ? '+' : ''}${formatarMoedaBR(o.extra)})`).join('\n');
  }

  function escolherOpcaoProduto(prod) {
    const opcoes = parseOpcoesProduto(prod);
    if (!opcoes.length) return { observacoes: null, preco: Number(prod.preco || 0) };
    const msg = `Escolha a variação de ${prod.nome}:\n${opcoesParaTexto(opcoes)}\n\nDigite o número da opção:`;
    const resp = prompt(msg, '1');
    if (resp === null) return null;
    const idx = parseInt(String(resp).trim(), 10) - 1;
    if (idx < 0 || idx >= opcoes.length) {
      alert('Opção inválida');
      return null;
    }
    const sel = opcoes[idx];
    return {
      observacoes: sel.nome,
      preco: Number(prod.preco || 0) + Number(sel.extra || 0)
    };
  }

  function adicionarLinhaVariacao(nome = '', extra = 0) {
    const list = document.getElementById('variacoesList');
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'variacao-row';
    row.innerHTML = `
      <input type="text" class="variacao-nome" placeholder="Ex: 300ml, 500ml, 1L" value="${String(nome || '').replace(/"/g, '&quot;')}">
      <input type="number" step="0.01" class="variacao-extra" placeholder="Extra" value="${Number(extra || 0)}">
      <button type="button" class="btn-rem">x</button>
    `;
    row.querySelector('.btn-rem')?.addEventListener('click', () => row.remove());
    list.appendChild(row);
  }

  function renderVariacoesEditor(opcoesJson = null) {
    const list = document.getElementById('variacoesList');
    if (!list) return;
    list.innerHTML = '';
    if (!opcoesJson) return;
    try {
      const arr = JSON.parse(opcoesJson);
      if (!Array.isArray(arr)) return;
      arr.forEach((o) => adicionarLinhaVariacao(String(o?.nome || '').trim(), Number(o?.extra || 0)));
    } catch {
      // noop
    }
  }

  function lerVariacoesEditorJson() {
    const list = document.getElementById('variacoesList');
    if (!list) return null;
    const rows = [...list.querySelectorAll('.variacao-row')];
    const arr = rows
      .map((row) => ({
        nome: String(row.querySelector('.variacao-nome')?.value || '').trim(),
        extra: Number.parseFloat(String(row.querySelector('.variacao-extra')?.value || '0').replace(',', '.')) || 0
      }))
      .filter((x) => x.nome);
    return arr.length ? JSON.stringify(arr) : null;
  }

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
          await API.adicionarItem(venda.id, it.produto_id, it.quantidade, {
            observacoes: it.observacoes || null,
            preco_unitario_override: it.preco
          });
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
      const keyObs = String(prod.observacoes || '').trim();
      const keyPreco = Number(prod.preco || 0);
      const ex = carrinho.find(
        (i) => String(i.produto_id) === prodId && String(i.observacoes || '').trim() === keyObs && Number(i.preco || 0) === keyPreco
      );
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
          (i, idx) => `<div class="cart-item" style="display:flex;justify-content:space-between;align-items:center;padding:8px;background:#f9f9f9;border-radius:4px;margin-bottom:4px"><div style="flex:1"><div class="cart-item-name" style="font-weight:600;font-size:12px">${i.nome}</div>${i.observacoes ? `<div style="font-size:10px;color:#555">${i.observacoes}</div>` : ''}<div style="font-size:11px;color:#666">x${i.quantidade}</div></div><div style="display:flex;gap:4px;align-items:center"><button onclick="alterarQuantidadeCarrinho(${idx},-1)" style="padding:2px 6px;font-size:11px;border:1px solid #ccc;background:#fff;cursor:pointer;border-radius:2px">-</button><span style="min-width:20px;text-align:center;font-size:12px;font-weight:600">${i.quantidade}</span><button onclick="alterarQuantidadeCarrinho(${idx},1)" style="padding:2px 6px;font-size:11px;border:1px solid #ccc;background:#fff;cursor:pointer;border-radius:2px">+</button><button onclick="removerDoCarrinho(${idx})" style="padding:2px 6px;font-size:11px;background:var(--danger);color:white;border:none;cursor:pointer;border-radius:2px">✕</button></div><span class="cart-item-value" style="font-weight:bold;color:var(--success);min-width:60px;text-align:right">${formatarMoedaBR(i.subtotal)}</span></div>`
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
      const lista = (vendas || []).filter((v) => {
        const statusOk = filtroComandaStatus === 'todas' ? true : String(v.status || '') === filtroComandaStatus;
        if (!statusOk) return false;
        if (!filtroComandaTermo) return true;
        const mesaTxt = String(v.mesa || 'balcao').toLowerCase();
        const idTxt = String(v.id || '');
        const titleTxt = tituloComanda(v).toLowerCase();
        return mesaTxt.includes(filtroComandaTermo) || idTxt.includes(filtroComandaTermo) || titleTxt.includes(filtroComandaTermo);
      });
      if (!lista.length) {
        el.innerHTML = '<p style="padding:8px;font-size:12px">Nenhuma comanda aberta</p>';
        return;
      }
      el.innerHTML = lista
        .map(
          (v) => {
            const status = String(v.status || 'aberta');
            const cor = status === 'pronta' ? '#16a34a' : status === 'em_preparo' ? '#f59e0b' : '#3b82f6';
            const label = status === 'em_preparo' ? 'Em preparo' : status === 'pronta' ? 'Pronta' : 'Aberta';
            return `<div class="mesas-list-item" data-id="${v.id}">
              <div style="display:flex;flex-direction:column;gap:4px">
                <strong>${tituloComanda(v)}</strong>
                <span style="font-size:11px;color:${cor};font-weight:700">${label}</span>
              </div>
              <span class="mesa-value">${formatarMoedaBR(v.total || 0)}</span>
            </div>`;
          }
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
    const cats = [...new Set(filtered.map((p) => normalizarCategoria(p.categoria)))].sort();
    const allCats = ['todas', ...cats];
    if (!allCats.includes(categoriaAtivaMesa)) categoriaAtivaMesa = 'todas';

    const cardMesa = (p) => {
      const qtdOpcoes = parseOpcoesProduto(p).length;
      return `<div class="produto-mesa-card" data-id="${p.id}" style="cursor:pointer"><div class="produto-mesa-card-img">IMG</div><div class="produto-mesa-card-name">${p.nome}</div><div class="produto-mesa-card-price">${formatarMoedaBR(p.preco)}</div><div style="font-size:10px;color:#0a7;margin-top:4px">${p.estoque} disponíveis${Number(p.vai_cozinha || 0) === 1 ? ' • cozinha' : ''}${qtdOpcoes ? ` • ${qtdOpcoes} opções` : ''}</div></div>`;
    };

    let prodGrid = '<p style="font-size:11px;color:#666;margin:8px 0">Sem produtos disponíveis</p>';
    if (filtered.length > 0) {
      const chips = `<div id="chipsCategoriaMesa" style="display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px;position:sticky;top:0;background:#fff;z-index:4;padding:6px 0;border-bottom:1px solid #eef2f7">${allCats
        .map(
          (c) =>
            `<button class="chip-categoria-mesa ${c === categoriaAtivaMesa ? 'ativo' : ''}" data-categoria="${c}" style="border:1px solid ${c === categoriaAtivaMesa ? 'var(--primary)' : '#d1d5db'};background:${c === categoriaAtivaMesa ? '#e8f2ff' : '#fff'};color:${c === categoriaAtivaMesa ? '#1e3a8a' : '#334155'};border-radius:999px;padding:5px 10px;font-size:11px;cursor:pointer">${c === 'todas' ? 'Todas' : rotuloCategoria(c)}</button>`
        )
        .join('')}</div>`;

      if (categoriaAtivaMesa === 'todas') {
        const grouped = filtered.reduce((acc, p) => {
          const cat = normalizarCategoria(p.categoria);
          if (!acc[cat]) acc[cat] = [];
          acc[cat].push(p);
          return acc;
        }, {});
        const groups = Object.keys(grouped)
          .sort()
          .map((cat) => `<section style="border:1px solid #e2e8f0;border-radius:8px;padding:8px;background:#fff;margin-bottom:8px"><h4 style="margin:0 0 8px;font-size:12px;font-weight:700;color:#0f172a">${rotuloCategoria(cat)}</h4><div class="produtos-mesa-grid">${grouped[cat].map((p) => cardMesa(p)).join('')}</div></section>`)
          .join('');
        prodGrid = chips + groups;
      } else {
        const byCat = filtered.filter((p) => normalizarCategoria(p.categoria) === categoriaAtivaMesa);
        prodGrid = chips + `<div class="produtos-mesa-grid">${byCat.map((p) => cardMesa(p)).join('')}</div>`;
      }
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
                        ${i.observacoes ? `<div style="font-size:10px;color:#555">${i.observacoes}</div>` : ''}
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
        const pid = Number(card.dataset.id);
        if (!currentMesa) return;
        try {
          const produto = produtosCache.find((p) => Number(p.id) === pid);
          if (!produto) return;
          const opcao = escolherOpcaoProduto(produto);
          if (opcao === null) return;
          await API.adicionarItem(currentMesa.id, pid, 1, {
            observacoes: opcao.observacoes || null,
            preco_unitario_override: opcao.preco
          });
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

    sideEl.querySelectorAll('.chip-categoria-mesa').forEach((btn) => {
      btn.addEventListener('click', () => {
        categoriaAtivaMesa = btn.dataset.categoria || 'todas';
        renderSideMesa(venda);
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
    const base = produtos.filter((p) => p.tipo !== 'avulso');
    const cardHtml = (p) => {
      const semEstoque = Number(p.estoque || 0) <= 0;
      const promo = Number(p.destaque || 0) === 1 ? '<span style="display:inline-block;background:#f59e0b;color:#fff;padding:1px 6px;border-radius:999px;font-size:10px;font-weight:700;margin-bottom:4px">PROMO</span>' : '';
      return `<div class="product-card ${semEstoque ? 'sem-estoque' : ''}" data-id="${p.id}" data-nome="${p.nome}" data-preco="${p.preco}" style="${semEstoque ? 'opacity:.55;cursor:not-allowed;' : ''}">\n      <div class="product-image">${p.imagem ? `<img src="${p.imagem}" style="width:100%;height:100%;object-fit:cover"/>` : 'IMG'}</div>\n      ${promo}\n      <div class="product-name">${p.nome}</div>\n      <div class="product-price">${formatarMoedaBR(p.preco)}</div>\n      <div class="product-meta">${rotuloCategoria(p.categoria)} • pop ${Number(p.popularidade || 0)} • ${p.estoque} em estoque${Number(p.vai_cozinha || 0) === 1 ? ' • cozinha' : ''}</div>\n    </div>`;
    };

    if (categoriaAtiva === 'todas') {
      const grouped = base.reduce((acc, p) => {
        const cat = normalizarCategoria(p.categoria);
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(p);
        return acc;
      }, {});
      const cats = Object.keys(grouped).sort();
      if (!cats.length) {
        el.classList.remove('grouped');
        el.innerHTML = '<p style="font-size:12px;color:#64748b">Nenhum produto disponível.</p>';
        return;
      }
      el.classList.add('grouped');
      el.innerHTML = cats
        .map((cat) => {
          const cards = grouped[cat].map((p) => cardHtml(p)).join('');
          return `<section class="category-section"><h3 class="category-title">${rotuloCategoria(cat)}</h3><div class="products-main">${cards}</div></section>`;
        })
        .join('');
    } else {
      const filtered = base.filter((p) => normalizarCategoria(p.categoria) === categoriaAtiva);
      el.classList.remove('grouped');
      if (!filtered.length) {
        el.innerHTML = '<p style="font-size:12px;color:#64748b">Nenhum produto nesta categoria.</p>';
        return;
      }
      el.innerHTML = filtered.map((p) => cardHtml(p)).join('');
    }

    el.querySelectorAll('.product-card').forEach((card) => {
      card.addEventListener('click', () => {
        const produto = base.find((p) => String(p.id) === String(card.dataset.id));
        const estoque = Number((produto || { estoque: 0 }).estoque || 0);
        if (estoque <= 0) return alert('Produto sem estoque');
        if (!produto) return;
        const opcao = escolherOpcaoProduto(produto);
        if (opcao === null) return;
        adicionarAoCarrinho({
          produto_id: card.dataset.id,
          nome: card.dataset.nome,
          preco: opcao.preco,
          observacoes: opcao.observacoes || null
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
          `<div class="product-list-item" data-id="${p.id}"><div><div class="product-list-item-name">#${p.id} ${p.nome} ${Number(p.destaque || 0) === 1 ? '<span style="color:#f59e0b">★</span>' : ''}</div><div style="font-size:11px;color:#999">${rotuloCategoria(p.categoria)} • pop ${Number(p.popularidade || 0)} • ${p.tipo}${Number(p.vai_cozinha || 0) === 1 ? ' • cozinha' : ''}</div></div><div class="product-list-item-info"><span class="qty">${p.estoque} un</span><span class="price">${formatarMoedaBR(p.preco)}</span><button onclick="deletarProduto(${p.id})" class="delete-btn">X</button></div></div>`
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
      renderCategoriasHome(produtosCache);
      atualizarListaCategoriasFormulario(produtosCache);
      renderProdutosGrid(produtosCache);
      renderProdutosList(produtosCache);
    } catch (e) {
      console.error('Erro ao carregar produtos:', e);
    }
  }

  function renderCategoriasHome(produtos) {
    const el = document.getElementById('homeCategorias');
    if (!el) return;
    const cats = [...new Set((produtos || []).filter((p) => p.tipo !== 'avulso').map((p) => normalizarCategoria(p.categoria)))].sort();
    const all = ['todas', ...cats];
    if (!all.includes(categoriaAtiva)) categoriaAtiva = 'todas';
    el.innerHTML = all
      .map((c) => `<button class="category-chip ${c === categoriaAtiva ? 'active' : ''}" data-categoria="${c}">${c === 'todas' ? 'Todas' : rotuloCategoria(c)}</button>`)
      .join('');
    el.querySelectorAll('.category-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        categoriaAtiva = btn.dataset.categoria || 'todas';
        renderCategoriasHome(produtosCache);
        renderProdutosGrid(produtosCache);
      });
    });
  }

  function atualizarListaCategoriasFormulario(produtos) {
    const dl = document.getElementById('categoriasList');
    if (!dl) return;
    const cats = [...new Set((produtos || []).filter((p) => p.tipo !== 'avulso').map((p) => normalizarCategoria(p.categoria)))].sort();
    dl.innerHTML = cats.map((c) => `<option value="${c}"></option>`).join('');
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
      const categoria = normalizarCategoria(document.getElementById('novoProdutoCategoria')?.value || 'geral');
      const destaque = !!document.getElementById('novoProdutoDestaque')?.checked;
      const popularidade = parseInt(document.getElementById('novoProdutoPopularidade')?.value || '0', 10) || 0;
      const opcoes_json = lerVariacoesEditorJson();
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
            categoria,
            destaque,
            popularidade,
            opcoes_json,
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
            categoria,
            destaque,
            popularidade,
            opcoes_json,
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
    const categoriaEl = document.getElementById('novoProdutoCategoria');
    if (categoriaEl) categoriaEl.value = 'geral';
    const destaqueEl = document.getElementById('novoProdutoDestaque');
    if (destaqueEl) destaqueEl.checked = false;
    const popularidadeEl = document.getElementById('novoProdutoPopularidade');
    if (popularidadeEl) popularidadeEl.value = '0';
    renderVariacoesEditor(null);
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
      const categoriaEl = document.getElementById('novoProdutoCategoria');
      if (categoriaEl) categoriaEl.value = normalizarCategoria(prod.categoria);
      const destaqueEl = document.getElementById('novoProdutoDestaque');
      if (destaqueEl) destaqueEl.checked = Number(prod.destaque || 0) === 1;
      const popularidadeEl = document.getElementById('novoProdutoPopularidade');
      if (popularidadeEl) popularidadeEl.value = Number(prod.popularidade || 0);
      renderVariacoesEditor(prod.opcoes_json || null);
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

  // ===== CLIENTES =====
  let clientesCache = [];
  let clienteSelecionado = null;

  function renderClientesLista(clientes) {
    const el = document.getElementById('listaClientes');
    if (!el) return;
    if (!clientes.length) {
      el.innerHTML = '<p style="font-size:12px;color:#64748b">Nenhum cliente cadastrado.</p>';
      return;
    }
    el.innerHTML = clientes
      .map(
        (c) =>
          `<div class="product-list-item cliente-item ${clienteSelecionado === c.id ? 'selected' : ''}" data-id="${c.id}">
            <div>
              <div class="product-list-item-name">${c.nome}</div>
              <div style="font-size:11px;color:#999">${c.telefone || 'Sem telefone'} • ${Number(c.pontos || 0)} pts</div>
            </div>
            <div class="product-list-item-info">
              <button class="delete-btn" onclick="removerCliente(${c.id})">X</button>
            </div>
          </div>`
      )
      .join('');
    el.querySelectorAll('.cliente-item').forEach((item) => {
      item.addEventListener('click', () => selecionarCliente(Number(item.dataset.id)));
    });
  }

  async function carregarClientes() {
    try {
      const termo = document.getElementById('buscaCliente')?.value || '';
      clientesCache = await API.obterClientes(termo);
      renderClientesLista(clientesCache);
    } catch (e) {
      console.error('Erro ao carregar clientes:', e);
    }
  }

  function limparFormularioCliente() {
    clienteSelecionado = null;
    const nome = document.getElementById('clienteNome');
    const telefone = document.getElementById('clienteTelefone');
    const pontos = document.getElementById('clientePontos');
    const obs = document.getElementById('clienteObs');
    const titulo = document.getElementById('tituloClienteForm');
    const btnCancelar = document.getElementById('btnCancelarCliente');
    const btnSalvar = document.getElementById('btnSalvarCliente');
    if (nome) nome.value = '';
    if (telefone) telefone.value = '';
    if (pontos) pontos.value = '0';
    if (obs) obs.value = '';
    if (titulo) titulo.textContent = 'Novo Cliente';
    if (btnCancelar) btnCancelar.style.display = 'none';
    if (btnSalvar) btnSalvar.textContent = 'Salvar Cliente';
    renderClientesLista(clientesCache);
  }

  function selecionarCliente(id) {
    const c = clientesCache.find((x) => x.id === id);
    if (!c) return;
    clienteSelecionado = c.id;
    const nome = document.getElementById('clienteNome');
    const telefone = document.getElementById('clienteTelefone');
    const pontos = document.getElementById('clientePontos');
    const obs = document.getElementById('clienteObs');
    const titulo = document.getElementById('tituloClienteForm');
    const btnCancelar = document.getElementById('btnCancelarCliente');
    const btnSalvar = document.getElementById('btnSalvarCliente');
    if (nome) nome.value = c.nome || '';
    if (telefone) telefone.value = c.telefone || '';
    if (pontos) pontos.value = Number(c.pontos || 0);
    if (obs) obs.value = c.observacoes || '';
    if (titulo) titulo.textContent = `Cliente #${c.id}`;
    if (btnCancelar) btnCancelar.style.display = 'block';
    if (btnSalvar) btnSalvar.textContent = 'Salvar Alterações';
    renderClientesLista(clientesCache);
  }

  async function salvarCliente() {
    const nome = document.getElementById('clienteNome')?.value?.trim() || '';
    const telefone = document.getElementById('clienteTelefone')?.value?.trim() || '';
    const pontos = Number.parseInt(document.getElementById('clientePontos')?.value || '0', 10) || 0;
    const observacoes = document.getElementById('clienteObs')?.value?.trim() || '';
    if (!nome) return alert('Nome do cliente é obrigatório');
    try {
      if (clienteSelecionado) {
        await API.atualizarCliente(clienteSelecionado, { nome, telefone, pontos, observacoes });
      } else {
        await API.criarCliente({ nome, telefone, pontos, observacoes });
      }
      await carregarClientes();
      limparFormularioCliente();
    } catch (e) {
      alert(e.message || 'Erro ao salvar cliente');
    }
  }

  window.removerCliente = async (id) => {
    if (!confirm('Remover cliente?')) return;
    try {
      await API.removerCliente(id);
      await carregarClientes();
      if (clienteSelecionado === id) limparFormularioCliente();
    } catch (e) {
      alert(e.message || 'Erro ao remover cliente');
    }
  };

  async function refreshDados() {
    if (refreshEmAndamento) return;
    refreshEmAndamento = true;
    try {
      await carregarProdutosCompleto();
      await carregarMesas();
      const clientesTab = document.getElementById('clientes');
      if (clientesTab && !clientesTab.classList.contains('hidden')) {
        await carregarClientes();
      }
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
    await carregarClientes();
  });
  document.getElementById('btnSalvarCliente')?.addEventListener('click', salvarCliente);
  document.getElementById('btnCancelarCliente')?.addEventListener('click', limparFormularioCliente);
  document.getElementById('buscaCliente')?.addEventListener('input', () => carregarClientes());
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
