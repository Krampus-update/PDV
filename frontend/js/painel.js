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
    if (target === 'promocoes') carregarPromocoes();
  }

  if (tabViaQuery && ['home', 'produtos', 'mesas', 'clientes', 'promocoes'].includes(tabViaQuery)) {
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
  const caixaStatusTagEl = document.getElementById('caixaStatusTag');
  const caixaInfoResumoEl = document.getElementById('caixaInfoResumo');
  const btnAbrirCaixaEl = document.getElementById('btnAbrirCaixa');
  const btnFecharCaixaEl = document.getElementById('btnFecharCaixa');
  let filtroProdutoEstoque = '';
  const buscaProdutoEstoqueEl = document.getElementById('buscaProdutoEstoque');
  if (buscaProdutoEstoqueEl) {
    buscaProdutoEstoqueEl.addEventListener('input', () => {
      filtroProdutoEstoque = String(buscaProdutoEstoqueEl.value || '').toLowerCase().trim();
      renderProdutosList(produtosCache);
    });
  }
  const btnAddVariacao = document.getElementById('btnAddVariacao');
  if (btnAddVariacao) {
    btnAddVariacao.addEventListener('click', () => adicionarLinhaVariacao('', 0));
  }

  async function carregarCaixaResumo() {
    if (!caixaStatusTagEl || !caixaInfoResumoEl) return;
    try {
      const [{ aberto }, resumoDia] = await Promise.all([API.obterCaixaAtual(), API.obterResumoDiaCaixa()]);
      caixaAtual = aberto || null;
      if (caixaAtual) {
        caixaStatusTagEl.className = 'status-badge aberta';
        caixaStatusTagEl.textContent = 'Caixa aberto';
        caixaInfoResumoEl.textContent = `Abertura: ${new Date(caixaAtual.aberto_em).toLocaleString('pt-BR')} • Dia: ${resumoDia.total_comandas || 0} comandas • ${formatarMoedaBR(resumoDia.faturamento_fechadas || 0)}`;
      } else {
        caixaStatusTagEl.className = 'status-badge fechada';
        caixaStatusTagEl.textContent = 'Caixa fechado';
        caixaInfoResumoEl.textContent = `Dia: ${resumoDia.total_comandas || 0} comandas • ${formatarMoedaBR(resumoDia.faturamento_fechadas || 0)}`;
      }
      if (btnAbrirCaixaEl) btnAbrirCaixaEl.disabled = !!caixaAtual;
      if (btnFecharCaixaEl) btnFecharCaixaEl.disabled = !caixaAtual;
    } catch (e) {
      console.error('Erro ao carregar caixa', e);
      caixaInfoResumoEl.textContent = 'Falha ao carregar caixa.';
    }
  }

  if (btnAbrirCaixaEl) {
    btnAbrirCaixaEl.addEventListener('click', async () => {
      const entrada = ui.prompt
        ? await ui.prompt({
            title: 'Abrir caixa',
            message: 'Informe o saldo inicial (opcional).',
            placeholder: '0,00',
            value: '0,00',
            okLabel: 'Abrir'
          })
        : '0';
      if (entrada === null) return;
      const saldo = Number.parseFloat(String(entrada || '0').replace(',', '.')) || 0;
      try {
        await API.abrirCaixa(saldo);
        uiNotify(`Caixa aberto com saldo inicial ${formatarMoedaBR(saldo)}`, 'success');
        await carregarCaixaResumo();
      } catch (e) {
        await uiAlert(e.message || 'Erro ao abrir caixa', 'error');
      }
    });
  }

  if (btnFecharCaixaEl) {
    btnFecharCaixaEl.addEventListener('click', async () => {
      if (!caixaAtual) return;
      const entrada = ui.prompt
        ? await ui.prompt({
            title: 'Fechar caixa',
            message: 'Informe o saldo final contado (opcional).',
            placeholder: '0,00',
            value: '',
            okLabel: 'Fechar'
          })
        : '';
      if (entrada === null) return;
      if (!(await uiConfirm('Confirmar fechamento de caixa?', { title: 'Fechar caixa' }))) return;
      const saldoFinal = String(entrada || '').trim()
        ? Number.parseFloat(String(entrada).replace(',', '.')) || 0
        : null;
      try {
        const fechado = await API.fecharCaixa(saldoFinal, '');
        uiNotify(
          `Caixa fechado: ${fechado.total_comandas || 0} comandas • ${formatarMoedaBR(fechado.total_vendas || 0)}`,
          'success'
        );
        await carregarCaixaResumo();
      } catch (e) {
        await uiAlert(e.message || 'Erro ao fechar caixa', 'error');
      }
    });
  }

  function abrirModalFechamento() {
    if (!modalFechamentoVenda || !currentMesa) return;
    const bruto = Number(currentMesa.subtotal_bruto || currentMesa.total || 0);
    const total = Number(currentMesa.total || 0);
    splitPayloadAtual = null;
    if (fechTotalBruto) fechTotalBruto.textContent = formatarMoedaBR(bruto);
    if (fechTotalFinal) fechTotalFinal.textContent = formatarMoedaBR(total);
    if (fechTroco) fechTroco.textContent = formatarMoedaBR(0);
    if (fechDescontoTipo) fechDescontoTipo.value = String(currentMesa.desconto_tipo || 'nenhum');
    if (fechDescontoValor) fechDescontoValor.value = Number(currentMesa.desconto_valor || 0);
    if (fechSplitMode) fechSplitMode.value = String(currentMesa.split_mode || 'nenhum');
    if (fechValorPago) fechValorPago.value = Number(currentMesa.valor_pago || 0);
    if (fechPessoas) fechPessoas.value = '2';
    if (fechFormaPagamento) fechFormaPagamento.value = 'dinheiro';
    atualizarVisibilidadeDesconto();
    atualizarVisibilidadeDivisao();
    if (fechDivisaoPreview) fechDivisaoPreview.innerHTML = '<p style="font-size:12px;color:#64748b">Clique em Calcular para simular divisão.</p>';
    if (fechPixBox) fechPixBox.classList.add('hidden');
    if (fechPixQr) fechPixQr.src = '';
    if (fechPixPayload) fechPixPayload.value = '';
    if ((fechSplitMode?.value || '') === 'por_item') {
      if (fechValorPago) fechValorPago.value = String(totalSelecionadoSplitPorItem() || 0);
    }
    modalFechamentoVenda.style.display = 'flex';
  }

  function fecharModalFechamento() {
    if (!modalFechamentoVenda) return;
    modalFechamentoVenda.style.display = 'none';
  }

  async function calcularFechamento() {
    if (!currentMesa) return;
    const descontoTipo = fechDescontoTipo?.value || 'nenhum';
    const descontoValor = Number.parseFloat(String(fechDescontoValor?.value || '0').replace(',', '.')) || 0;
    const splitMode = fechSplitMode?.value || 'nenhum';
    const pessoas = Math.max(1, Number(fechPessoas?.value || 1));
    if (splitMode === 'por_item' && !splitPayloadAtual) {
      splitPayloadAtual = { itens: [] };
      renderSplitPorItemEditor();
    }
    const splitPayload = splitMode === 'por_item' ? splitPayloadAtual : null;
    const valorPago = Number.parseFloat(String(fechValorPago?.value || '0').replace(',', '.')) || 0;

    await API.aplicarFinanceiroVenda(currentMesa.id, {
      desconto_tipo: descontoTipo,
      desconto_valor: descontoValor,
      split_mode: splitMode === 'nenhum' ? null : splitMode,
      split_payload_json: splitPayload
    });
    const venda = await API.obterVenda(currentMesa.id);
    currentMesa = venda;
    if (fechTotalBruto) fechTotalBruto.textContent = formatarMoedaBR(Number(venda.subtotal_bruto || venda.total || 0));
    if (fechTotalFinal) fechTotalFinal.textContent = formatarMoedaBR(Number(venda.total || 0));
    const troco = Math.max(0, valorPago - Number(venda.total || 0));
    if (fechTroco) fechTroco.textContent = formatarMoedaBR(troco);

    if (splitMode !== 'nenhum') {
      if (splitMode === 'valor_igual') {
        const div = await API.simularDivisaoVenda(currentMesa.id, splitMode, pessoas);
        if (fechDivisaoPreview) {
          fechDivisaoPreview.innerHTML = (div.parcelas || [])
            .map((p) => `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #e2e8f0;font-size:12px"><span>Pessoa ${p.pessoa}</span><strong>${formatarMoedaBR(p.valor || p.total || 0)}</strong></div>`)
            .join('');
        }
      } else {
        renderSplitPorItemEditor();
        if (fechDivisaoPreview) {
          const selecionado = totalSelecionadoSplitPorItem();
          const restante = Math.max(0, Number((Number(venda.total || 0) - selecionado).toFixed(2)));
          fechDivisaoPreview.innerHTML = `
            <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #e2e8f0;font-size:12px">
              <span>Pagamento desta divisão</span><strong>${formatarMoedaBR(selecionado)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px">
              <span>Saldo restante</span><strong>${formatarMoedaBR(restante)}</strong>
            </div>`;
        }
      }
    } else if (fechDivisaoPreview) {
      fechDivisaoPreview.innerHTML = '<p style="font-size:12px;color:#64748b">Sem divisão.</p>';
    }

    if ((fechFormaPagamento?.value || '') === 'pix') {
      try {
        const pix = await API.gerarPixVenda(currentMesa.id, Number(venda.total || 0), `Comanda ${currentMesa.id}`);
        if (fechPixBox) fechPixBox.classList.remove('hidden');
        if (fechPixQr) fechPixQr.src = pix.qr_data_url || '';
        if (fechPixPayload) fechPixPayload.value = pix.copia_cola || pix.payload || '';
      } catch (e) {
        if (fechPixBox) fechPixBox.classList.add('hidden');
        uiNotify(e.message || 'PIX não configurado', 'warning');
      }
    } else if (fechPixBox) {
      fechPixBox.classList.add('hidden');
    }
  }

  async function confirmarFechamentoVenda() {
    if (!currentMesa) return;
    const forma = fechFormaPagamento?.value || 'dinheiro';
    const valorPago = Number.parseFloat(String(fechValorPago?.value || '0').replace(',', '.')) || 0;

    if (!(await uiConfirm('Confirmar fechamento da comanda?', { title: 'Fechar comanda' }))) return;

    const fechamento = await API.fecharVenda(currentMesa.id, forma, '', {
      valor_pago: valorPago,
      pagamento_provider: null,
      pix_gerar: forma === 'pix'
    });
    if (fechamento?.parcial) {
      uiNotify(`Pagamento parcial registrado: ${formatarMoedaBR(fechamento.valor_pago_parcial || 0)}`, 'success');
      fecharModalFechamento();
      await carregarMesas();
      if (currentMesa) {
        const updated = await API.obterVenda(currentMesa.id);
        currentMesa = updated;
        renderSideMesa(updated);
      }
      await carregarProdutosCompleto();
      await carregarCaixaResumo();
      return;
    }
    uiNotify('Comanda fechada', 'success');
    fecharModalFechamento();
    document.getElementById('sideMesas').innerHTML = '<p style="color:#999;font-size:12px">Selecione uma comanda à esquerda</p>';
    currentMesa = null;
    vendaAtual = null;
    localStorage.removeItem('vendaAtual');
    await carregarMesas();
    await carregarProdutosCompleto();
    await carregarCaixaResumo();
  }

  async function concluirAjustesFechamento() {
    if (!currentMesa) return;
    const forma = fechFormaPagamento?.value || 'dinheiro';
    const valorPago = Number.parseFloat(String(fechValorPago?.value || '0').replace(',', '.')) || 0;
    const splitMode = fechSplitMode?.value || 'nenhum';
    const descontoTipo = fechDescontoTipo?.value || 'nenhum';
    const descontoValor = Number.parseFloat(String(fechDescontoValor?.value || '0').replace(',', '.')) || 0;
    const splitPayload = splitMode === 'por_item' ? splitPayloadAtual : null;

    await calcularFechamento();

    // No modo por item, concluir deve registrar o pagamento parcial imediatamente.
    if (splitMode === 'por_item' && Array.isArray(splitPayload?.itens) && splitPayload.itens.length > 0) {
      const resp = await API.fecharVenda(currentMesa.id, forma, '', {
        valor_pago: valorPago,
        pagamento_provider: null,
        split_mode: 'por_item',
        split_payload_json: splitPayload,
        desconto_tipo: descontoTipo,
        desconto_valor: descontoValor,
        pix_gerar: forma === 'pix'
      });
      if (resp?.parcial) {
        uiNotify(`Pagamento parcial aplicado: ${formatarMoedaBR(resp.valor_pago_parcial || 0)}`, 'success');
      } else {
        uiNotify('Comanda totalmente quitada', 'success');
      }
      fecharModalFechamento();
      await carregarMesas();
      await carregarProdutosCompleto();
      await carregarCaixaResumo();
      if (currentMesa) {
        try {
          const updated = await API.obterVenda(currentMesa.id);
          currentMesa = updated;
          renderSideMesa(updated);
        } catch {
          currentMesa = null;
          const side = document.getElementById('sideMesas');
          if (side) side.innerHTML = '<p style="color:#999;font-size:12px">Selecione uma comanda à esquerda</p>';
        }
      }
      return;
    }

    uiNotify('Cálculo aplicado na comanda', 'success');
    fecharModalFechamento();
    await carregarMesas();
    if (currentMesa) {
      const updated = await API.obterVenda(currentMesa.id);
      currentMesa = updated;
      renderSideMesa(updated);
    }
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
  let caixaAtual = null;
  let promocoesCache = [];
  let promocaoEmEdicaoId = null;
  let splitPayloadAtual = null;

  const ui = window.PDVUI || {};
  const uiNotify = (message, type = 'info', title = 'Aviso') =>
    ui.notify ? ui.notify({ title, message, type, keepHistory: true }) : console.log(`[${type}] ${message}`);
  const uiAlert = async (message, type = 'info', title = 'Aviso') => {
    if (ui.alert) return ui.alert(message, type, title);
    alert(message);
  };
  const uiConfirm = async (message, opts = {}) => {
    if (ui.confirm) return ui.confirm(message, opts);
    return confirm(message);
  };
  const modalFechamentoVenda = document.getElementById('modalFechamentoVenda');
  const btnFecharModalVenda = document.getElementById('btnFecharModalVenda');
  const btnCalcularFechamento = document.getElementById('btnCalcularFechamento');
  const btnConfirmarFechamento = document.getElementById('btnConfirmarFechamento');
  const fechTotalBruto = document.getElementById('fechTotalBruto');
  const fechTotalFinal = document.getElementById('fechTotalFinal');
  const fechTroco = document.getElementById('fechTroco');
  const fechDescontoTipo = document.getElementById('fechDescontoTipo');
  const fechDescontoValor = document.getElementById('fechDescontoValor');
  const fechSplitMode = document.getElementById('fechSplitMode');
  const fechPessoasGroup = document.getElementById('fechPessoasGroup');
  const fechPessoas = document.getElementById('fechPessoas');
  const fechItensSplitBox = document.getElementById('fechItensSplitBox');
  const fechItensSplitList = document.getElementById('fechItensSplitList');
  const fechItensSplitTotal = document.getElementById('fechItensSplitTotal');
  const fechFormaPagamento = document.getElementById('fechFormaPagamento');
  const fechValorPago = document.getElementById('fechValorPago');
  const fechDivisaoPreview = document.getElementById('fechDivisaoPreview');
  const fechPixBox = document.getElementById('fechPixBox');
  const fechPixQr = document.getElementById('fechPixQr');
  const fechPixPayload = document.getElementById('fechPixPayload');

  btnFecharModalVenda?.addEventListener('click', fecharModalFechamento);
  btnCalcularFechamento?.addEventListener('click', async () => {
    try {
      await concluirAjustesFechamento();
    } catch (e) {
      await uiAlert(e.message || 'Erro ao concluir cálculo', 'error');
    }
  });
  btnConfirmarFechamento?.addEventListener('click', async () => {
    try {
      await confirmarFechamentoVenda();
    } catch (e) {
      await uiAlert(e.message || 'Erro ao fechar comanda', 'error');
    }
  });
  fechFormaPagamento?.addEventListener('change', () => {
    if (fechFormaPagamento.value === 'dinheiro') {
      if (fechValorPago) fechValorPago.value = Number(currentMesa?.total || 0);
    }
    if (fechFormaPagamento.value !== 'pix' && fechPixBox) fechPixBox.classList.add('hidden');
  });
  fechValorPago?.addEventListener('input', () => {
    const valorPago = Number.parseFloat(String(fechValorPago.value || '0').replace(',', '.')) || 0;
    const total = Number(currentMesa?.total || 0);
    const troco = Math.max(0, valorPago - total);
    if (fechTroco) fechTroco.textContent = formatarMoedaBR(troco);
  });
  fechSplitMode?.addEventListener('change', () => {
    atualizarVisibilidadeDivisao();
    if (fechSplitMode.value === 'por_item') {
      const totalSel = totalSelecionadoSplitPorItem();
      if (fechValorPago) fechValorPago.value = String(totalSel || 0);
    }
  });
  fechDescontoTipo?.addEventListener('change', () => {
    atualizarVisibilidadeDesconto();
  });
  modalFechamentoVenda?.addEventListener('click', (ev) => {
    if (ev.target === modalFechamentoVenda) {
      fecharModalFechamento();
    }
  });

  function atualizarVisibilidadeDesconto() {
    const tipo = String(fechDescontoTipo?.value || 'nenhum');
    if (fechDescontoValor) {
      fechDescontoValor.disabled = tipo === 'nenhum';
      if (tipo === 'nenhum') fechDescontoValor.value = '0';
    }
  }

  function totalSelecionadoSplitPorItem() {
    if (!currentMesa || !Array.isArray(splitPayloadAtual?.itens)) return 0;
    const itensVenda = currentMesa.itens || [];
    let total = 0;
    for (const sel of splitPayloadAtual.itens) {
      const item = itensVenda.find((i) => Number(i.id) === Number(sel.item_id));
      if (!item) continue;
      const qtd = Math.max(0, Math.min(Number(item.quantidade || 0), Number(sel.quantidade || 0)));
      total += Number(item.preco_unitario || 0) * qtd;
    }
    return Number(total.toFixed(2));
  }

  function atualizarResumoSplitPorItem() {
    if (!fechItensSplitTotal || !currentMesa) return;
    const totalSelecionado = totalSelecionadoSplitPorItem();
    const totalComanda = Number(currentMesa.total || 0);
    const restante = Math.max(0, Number((totalComanda - totalSelecionado).toFixed(2)));
    fechItensSplitTotal.textContent = `Selecionado: ${formatarMoedaBR(totalSelecionado)} • Restante: ${formatarMoedaBR(restante)}`;
  }

  function renderSplitPorItemEditor() {
    if (!fechItensSplitList || !currentMesa) return;
    const itens = currentMesa.itens || [];
    const payloadMap = new Map((splitPayloadAtual?.itens || []).map((x) => [Number(x.item_id), Number(x.quantidade || 0)]));
    fechItensSplitList.innerHTML = itens.length
      ? itens
          .map((item) => {
            const quantidadeTotal = Number(item.quantidade || 0);
            const quantidadeSel = Math.min(quantidadeTotal, Math.max(0, payloadMap.get(Number(item.id)) || 0));
            return `<div style="display:grid;grid-template-columns:1fr 90px;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid #e2e8f0">
              <div>
                <div style="font-size:12px;font-weight:700">${item.produto_nome}</div>
                <div style="font-size:11px;color:#64748b">${quantidadeTotal}x ${formatarMoedaBR(item.preco_unitario || 0)}</div>
              </div>
              <input class="split-item-qtd" data-item-id="${item.id}" type="number" min="0" max="${quantidadeTotal}" value="${quantidadeSel}" style="font-size:12px;padding:6px">
            </div>`;
          })
          .join('')
      : '<p style="font-size:12px;color:#64748b">Sem itens na comanda.</p>';
    fechItensSplitList.querySelectorAll('.split-item-qtd').forEach((input) => {
      input.addEventListener('input', () => {
        const itemId = Number(input.dataset.itemId);
        const max = Number(input.max || 0);
        const valor = Math.max(0, Math.min(max, Number(input.value || 0)));
        input.value = String(valor);
        const itensSel = (splitPayloadAtual?.itens || []).filter((x) => Number(x.item_id) !== itemId);
        if (valor > 0) itensSel.push({ item_id: itemId, quantidade: valor });
        splitPayloadAtual = { itens: itensSel };
        atualizarResumoSplitPorItem();
        if ((fechSplitMode?.value || '') === 'por_item' && fechValorPago) {
          fechValorPago.value = String(totalSelecionadoSplitPorItem());
        }
      });
    });
    atualizarResumoSplitPorItem();
  }

  function atualizarVisibilidadeDivisao() {
    const splitMode = String(fechSplitMode?.value || 'nenhum');
    const exibirPessoas = splitMode === 'valor_igual';
    const exibirItens = splitMode === 'por_item';
    if (fechPessoasGroup) fechPessoasGroup.classList.toggle('hidden', !exibirPessoas);
    if (fechItensSplitBox) fechItensSplitBox.classList.toggle('hidden', !exibirItens);
    if (exibirItens) {
      renderSplitPorItemEditor();
    } else {
      splitPayloadAtual = null;
      if (fechItensSplitList) fechItensSplitList.innerHTML = '';
      if (fechItensSplitTotal) fechItensSplitTotal.textContent = '';
    }
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
          consumo: Math.max(1, Number(o?.consumo || 1))
        }))
        .filter((o) => o.nome);
    } catch {
      return [];
    }
  }

  async function escolherOpcaoProduto(prod) {
    const opcoes = parseOpcoesProduto(prod);
    if (!opcoes.length) return { observacoes: null, preco: Number(prod.preco || 0), consumo: 1 };
    const idx = ui.choose
      ? await ui.choose({
          title: `Variação - ${prod.nome}`,
          message: 'Selecione uma opção para adicionar na comanda.',
          okLabel: 'Adicionar',
          items: [
            {
              value: -1,
              label: 'Normal',
              meta: `${formatarMoedaBR(Number(prod.preco || 0))} • consumo 1x`
            },
            ...opcoes.map((o, index) => ({
              value: index,
              label: o.nome,
              meta: `${o.extra >= 0 ? '+' : ''}${formatarMoedaBR(o.extra)} • consumo ${o.consumo}x`
            }))
          ]
        })
      : 0;
    if (idx === null || idx === undefined || !opcoes[idx]) return null;
    if (idx === -1) {
      return { observacoes: null, preco: Number(prod.preco || 0), consumo: 1 };
    }
    const sel = opcoes[idx];
    return {
      observacoes: sel.nome,
      preco: Number(prod.preco || 0) + Number(sel.extra || 0),
      consumo: Math.max(1, Number(sel.consumo || 1))
    };
  }

  function adicionarLinhaVariacao(nome = '', extra = 0, consumo = 1) {
    const list = document.getElementById('variacoesList');
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'variacao-row';
    row.innerHTML = `
      <input type="text" class="variacao-nome" placeholder="Ex: 300ml, 500ml, 1L" value="${String(nome || '').replace(/"/g, '&quot;')}">
      <input type="number" step="0.01" class="variacao-extra" placeholder="Extra" value="${Number(extra || 0)}">
      <input type="number" step="1" min="1" class="variacao-consumo" placeholder="Consumo" value="${Number(consumo || 1)}">
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
      arr.forEach((o) =>
        adicionarLinhaVariacao(
          String(o?.nome || '').trim(),
          Number(o?.extra || 0),
          Math.max(1, Number(o?.consumo || 1))
        )
      );
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
        extra: Number.parseFloat(String(row.querySelector('.variacao-extra')?.value || '0').replace(',', '.')) || 0,
        consumo: Math.max(1, Number(row.querySelector('.variacao-consumo')?.value || 1))
      }))
      .filter((x) => x.nome);
    return arr.length ? JSON.stringify(arr) : null;
  }

  const mainTeclado = criarTeclado(document.getElementById('teclado'), document.getElementById('displayValor'));
  if (document.getElementById('btnClear')) {
    document.getElementById('btnClear').addEventListener('click', () => mainTeclado && mainTeclado.clear());
  }
  if (document.getElementById('btnAddValor')) {
    document.getElementById('btnAddValor').addEventListener('click', async () => {
      const valor = mainTeclado && mainTeclado.getValue();
      if (valor === null || valor <= 0) return uiAlert('Digite um valor válido', 'warning');
      adicionarAoCarrinho({ produto_id: 'avulso', nome: `Avulso R$ ${valor.toFixed(2)}`, preco: valor });
      mainTeclado.clear();
      uiNotify('Adicionado ao carrinho', 'success');
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
      await uiAlert('Carrinho vazio', 'warning');
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
            preco_unitario_override: it.preco,
            consumo_estoque: it.consumo_estoque || it.consumo || 1
          });
        }
      }

      carrinho = [];
      atualizarCarrinhoUI();
      if (mesaInput) mesaInput.value = '';
      await refreshDados();

      const tabMesas = document.querySelector('[data-target="mesas"]');
      if (tabMesas) tabMesas.click();
      uiNotify(comandaExistente ? 'Itens adicionados à comanda existente' : 'Comanda aberta', 'success');
    } catch (e) {
      console.error(e);
      await uiAlert('Erro: ' + (e.message || e), 'error');
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
      const keyConsumo = Number(prod.consumo_estoque || prod.consumo || 1);
      const ex = carrinho.find(
        (i) =>
          String(i.produto_id) === prodId &&
          String(i.observacoes || '').trim() === keyObs &&
          Number(i.preco || 0) === keyPreco &&
          Number(i.consumo_estoque || i.consumo || 1) === keyConsumo
      );
      if (ex) {
        ex.quantidade++;
        ex.subtotal = ex.quantidade * ex.preco;
      } else {
        carrinho.push({
          ...prod,
          consumo_estoque: keyConsumo,
          quantidade: 1,
          subtotal: prod.preco
        });
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
    if (!skipConfirm && !(await uiConfirm('Remover item da comanda?', { title: 'Confirmar remoção' }))) return;
    try {
      await API.removerItem(vendaId, itemId);
      const updated = await API.obterVenda(vendaId);
      currentMesa = updated;
      renderSideMesa(updated);
      await carregarProdutosCompleto();
      await carregarMesas();
    } catch (e) {
      console.error('Erro ao remover item', e);
      await uiAlert('Erro ao remover item', 'error');
    }
  }

  async function cancelarPedidoItem(vendaId, itemId) {
    if (!(await uiConfirm('Cancelar este pedido da comanda?', { title: 'Cancelar pedido' }))) return;
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
      await uiAlert('Erro ao alterar quantidade', 'error');
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
      const vendas = await API.obterVendas({ tipo: 'bar' });
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
      const priorizada = [...lista].sort((a, b) => {
        const aFechada = String(a.status || '') === 'fechada' ? 1 : 0;
        const bFechada = String(b.status || '') === 'fechada' ? 1 : 0;
        if (aFechada !== bFechada) return aFechada - bFechada;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      if (!priorizada.length) {
        el.innerHTML = '<p style="padding:8px;font-size:12px">Nenhuma comanda encontrada</p>';
        return;
      }
      el.innerHTML = priorizada
        .map(
          (v) => {
            const status = String(v.status || 'aberta');
            const cor = status === 'pronta' ? '#16a34a' : status === 'em_preparo' ? '#f59e0b' : status === 'fechada' ? '#64748b' : '#3b82f6';
            const label = status === 'em_preparo' ? 'Em preparo' : status === 'pronta' ? 'Pronta' : status === 'fechada' ? 'Fechada' : 'Aberta';
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
      await uiAlert('Erro ao abrir comanda', 'error');
    }
  }

  function renderSideMesa(venda) {
    const sideEl = document.getElementById('sideMesas');
    if (!sideEl) return;
    const itens = venda.itens || [];
    const comandaFechada = String(venda.status || '') === 'fechada';
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
      if (venda.status === 'fechada') {
        return { label: 'Fechado', color: '#475569', bg: 'rgba(148,163,184,0.14)' };
      }
      return { label: 'Aguardando', color: '#1565C0', bg: 'rgba(33,150,243,0.15)' };
    };

    sideEl.innerHTML = `
      <div class="sidebar-section">
        <h3>Comanda ${tituloComanda(venda)}</h3>
        <div style="font-size:12px;margin-bottom:8px">Total: <strong style="color:var(--success)">${formatarMoedaBR(venda.total || 0)}</strong></div>
        <div style="font-size:12px;margin-bottom:8px">Cliente: <strong>${venda.cliente_nome || 'Não vinculado'}</strong></div>
        <div style="display:flex;gap:6px;margin-bottom:8px">
          <button id="btnVincularClienteMesa" class="btn btn-small btn-secondary" style="flex:1;padding:6px;font-size:11px" ${comandaFechada ? 'disabled' : ''}>Vincular cliente</button>
          <button id="btnReabrirVendaMesa" class="btn btn-small" style="flex:1;padding:6px;font-size:11px">Reabrir venda</button>
        </div>
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
                        <button onclick="alterarQuantidadeMesa(${venda.id},${i.id},-1)" ${comandaFechada ? 'disabled' : ''} style="padding:2px 4px;font-size:10px;border:1px solid #ccc;background:#fff;cursor:pointer;border-radius:2px">-</button>
                        <span style="min-width:18px;text-align:center;font-size:10px">${i.quantidade}</span>
                        <button onclick="alterarQuantidadeMesa(${venda.id},${i.id},1)" ${comandaFechada ? 'disabled' : ''} style="padding:2px 4px;font-size:10px;border:1px solid #ccc;background:#fff;cursor:pointer;border-radius:2px">+</button>
                        <button onclick="cancelarPedidoItem(${venda.id},${i.id})" ${comandaFechada ? 'disabled' : ''} style="padding:2px 6px;font-size:10px;background:var(--danger);color:white;border:none;cursor:pointer;border-radius:2px">Cancelar</button>
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
          ${comandaFechada ? '<p style="font-size:12px;color:#64748b">Comanda fechada. Reabra para adicionar itens.</p>' : prodGrid}
        </div>
        <div id="blocoAvulso" style="display:none">
          <h4 style="margin:8px 0 4px;font-size:12px">Valor Avulso</h4>
          <div id="sideMesaDisplay" class="display-value" style="font-size:18px;margin-bottom:8px">R$ 0,00</div>
          <div id="sideMesaTeclado" class="numeric-pad" style="grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:8px"></div>
          <div style="display:flex;gap:4px;flex-direction:column;margin-bottom:12px">
            <button id="btnSideMesaClear" class="pad-key secondary" style="padding:8px;font-size:11px" ${comandaFechada ? 'disabled' : ''}>Limpar</button>
            <button id="btnSideMesaAddValor" class="pad-key" style="padding:8px;font-size:11px" ${comandaFechada ? 'disabled' : ''}>Adicionar Valor</button>
          </div>
        </div>
        <button id="btnSideMesaFechar" class="btn btn-success btn-block" style="font-size:12px;padding:10px" ${comandaFechada ? 'disabled' : ''}>Tela de Fechamento</button>
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
        if (valor === null || valor <= 0) return uiAlert('Valor inválido', 'warning');
        if (!currentMesa) return uiAlert('Nenhuma comanda selecionada', 'warning');
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
          await uiAlert('Erro ao adicionar valor', 'error');
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
          const opcao = await escolherOpcaoProduto(produto);
          if (opcao === null) return;
          await API.adicionarItem(currentMesa.id, pid, 1, {
            observacoes: opcao.observacoes || null,
            preco_unitario_override: opcao.preco,
            consumo_estoque: opcao.consumo || 1
          });
          const updated = await API.obterVenda(currentMesa.id);
          currentMesa = updated;
          renderSideMesa(updated);
          await carregarProdutosCompleto();
          await carregarMesas();
        } catch (er) {
          console.error(er);
          await uiAlert(er.message || 'Erro ao adicionar item', 'error');
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
        abrirModalFechamento();
      });
    }

    const btnVincularClienteMesa = document.getElementById('btnVincularClienteMesa');
    if (btnVincularClienteMesa) {
      btnVincularClienteMesa.addEventListener('click', async () => {
        if (!currentMesa) return;
        const clientes = await API.obterClientes('');
        if (!clientes.length) return uiAlert('Nenhum cliente cadastrado.', 'warning');
        const removerLabel = currentMesa?.cliente_id ? 'Remover vínculo de cliente' : 'Nenhum cliente';
        const choice = ui.choose
          ? await ui.choose({
              title: 'Vincular cliente',
              message: 'Selecione um cliente para esta comanda.',
              okLabel: 'Vincular',
              items: [
                { value: null, label: removerLabel, meta: 'Comanda ficará sem cliente vinculado' },
                ...clientes.map((c) => ({
                  value: Number(c.id),
                  label: `#${c.id} ${c.nome}`,
                  meta: c.telefone || 'Sem telefone'
                }))
              ]
            })
          : null;
        if (choice === undefined) return;
        const clienteId = choice === null ? null : Number(choice);
        await API.vincularClienteVenda(currentMesa.id, clienteId);
        const atualizada = await API.obterVenda(currentMesa.id);
        currentMesa = atualizada;
        renderSideMesa(atualizada);
        await carregarMesas();
        uiNotify(clienteId ? 'Cliente vinculado à comanda' : 'Vínculo removido', 'success');
      });
    }

    const btnReabrirVendaMesa = document.getElementById('btnReabrirVendaMesa');
    if (btnReabrirVendaMesa) {
      btnReabrirVendaMesa.addEventListener('click', async () => {
        if (!currentMesa) return;
        if (String(currentMesa.status) !== 'fechada') {
          return uiAlert('Esta comanda já está aberta.', 'warning');
        }
        if (!(await uiConfirm('Reabrir esta comanda fechada?', { title: 'Reabrir comanda' }))) return;
        await API.reabrirVenda(currentMesa.id);
        const atualizada = await API.obterVenda(currentMesa.id);
        currentMesa = atualizada;
        renderSideMesa(atualizada);
        await carregarMesas();
        uiNotify('Comanda reaberta', 'success');
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
      card.addEventListener('click', async () => {
        const produto = base.find((p) => String(p.id) === String(card.dataset.id));
        const estoque = Number((produto || { estoque: 0 }).estoque || 0);
        if (estoque <= 0) return uiAlert('Produto sem estoque', 'warning');
        if (!produto) return;
        const opcao = await escolherOpcaoProduto(produto);
        if (opcao === null) return;
        adicionarAoCarrinho({
          produto_id: card.dataset.id,
          nome: card.dataset.nome,
          preco: opcao.preco,
          observacoes: opcao.observacoes || null,
          consumo_estoque: opcao.consumo || 1
        });
      });
    });
  }

  function renderProdutosList(produtos) {
    const el = document.getElementById('prodList');
    if (!el) return;
    const termo = String(filtroProdutoEstoque || '').toLowerCase().trim();
    const filtered = produtos.filter((p) => {
      if (p.tipo === 'avulso') return false;
      if (!termo) return true;
      const nome = String(p.nome || '').toLowerCase();
      const categoria = String(p.categoria || '').toLowerCase();
      return nome.includes(termo) || categoria.includes(termo);
    });
    if (!filtered.length) {
      el.innerHTML = '<p style="font-size:12px;color:#64748b">Nenhum produto encontrado.</p>';
      return;
    }
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
          uiAlert('Arquivo muito grande (máx 5MB)', 'warning');
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
      preencherSelectProdutoPromocao();
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
        await uiAlert('Aguarde...', 'info');
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
        await uiAlert('Preencha nome e preço', 'warning');
        return;
      }
      if (preco <= 0) {
        await uiAlert('Preço deve ser maior que zero', 'warning');
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
          uiNotify('Produto atualizado!', 'success');
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
          uiNotify('Produto criado com sucesso!', 'success');
        }
        limparFormularioProduto();
        await carregarProdutosCompleto();
      } catch (e) {
        console.error('Erro ao salvar produto:', e);
        await uiAlert('Erro: ' + (e.message || e), 'error');
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
    if (!(await uiConfirm('Deletar produto?', { title: 'Excluir produto' }))) return;
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
      await uiAlert('Erro ao deletar', 'error');
    }
  };

  // ===== PROMOCOES =====
  function preencherSelectProdutoPromocao() {
    const el = document.getElementById('promoProdutoId');
    if (!el) return;
    const lista = (produtosCache || [])
      .filter((p) => p.tipo !== 'avulso')
      .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));
    const atual = el.value;
    el.innerHTML = lista.length
      ? lista
          .map(
            (p) =>
              `<option value="${p.id}">${p.nome} (${formatarMoedaBR(p.preco)})${Number(p.ativo || 0) === 1 ? '' : ' • inativo'}</option>`
          )
          .join('')
      : '<option value="">Sem produtos cadastrados</option>';
    if (atual && el.querySelector(`option[value="${atual}"]`)) {
      el.value = atual;
    }
  }

  function limparFormularioPromocao() {
    promocaoEmEdicaoId = null;
    document.getElementById('promoNome').value = '';
    document.getElementById('promoDescricao').value = '';
    document.getElementById('promoTipo').value = 'combo_produto';
    document.getElementById('promoQuantidadeMin').value = '3';
    document.getElementById('promoPrecoCombo').value = '15';
    document.getElementById('promoRepetirNaVenda').checked = true;
    document.getElementById('promoAtiva').checked = true;
    const btn = document.getElementById('btnSalvarPromocao');
    if (btn) btn.textContent = 'Salvar Promoção';
    document.querySelectorAll('#listaPromocoes .product-list-item').forEach((x) => x.classList.remove('selected'));
  }

  function renderPromocoesLista() {
    const el = document.getElementById('listaPromocoes');
    if (!el) return;
    if (!promocoesCache.length) {
      el.innerHTML = '<p style="font-size:12px;color:#64748b">Nenhuma promoção cadastrada.</p>';
      return;
    }
    el.innerHTML = promocoesCache
      .map((p) => {
        const tag = Number(p.ativo || 0) === 1 ? '<span style="color:#16a34a">Ativa</span>' : '<span style="color:#64748b">Inativa</span>';
        const regra =
          String(p.tipo || '') === 'combo_produto'
            ? `${Number(p.quantidade_min || 0)}x ${p.produto_nome || `#${p.produto_id}`} por ${formatarMoedaBR(p.preco_combo || 0)}`
            : 'Regra personalizada';
        const repeticaoTxt = Number(p.repetir_na_venda ?? 1) === 1 ? 'Acumula na venda' : '1x por venda';
        return `<div class="product-list-item ${Number(promocaoEmEdicaoId) === Number(p.id) ? 'selected' : ''}" data-id="${p.id}">
          <div>
            <div class="product-list-item-name">${p.nome}</div>
            <div style="font-size:11px;color:#64748b">${regra}</div>
            <div style="font-size:11px;color:#64748b">${tag} • ${repeticaoTxt}</div>
          </div>
          <div class="product-list-item-info">
            <button class="btn btn-secondary btn-soft" type="button" onclick="editarPromocao(${p.id})">Editar</button>
            <button class="delete-btn" onclick="removerPromocao(${p.id})">X</button>
          </div>
        </div>`;
      })
      .join('');
    el.querySelectorAll('.product-list-item').forEach((item) => {
      item.addEventListener('click', () => {
        const id = Number(item.dataset.id);
        window.editarPromocao(id);
      });
    });
  }

  async function carregarPromocoes() {
    try {
      promocoesCache = await API.obterPromocoes(null);
      if (promocaoEmEdicaoId && !promocoesCache.some((p) => Number(p.id) === Number(promocaoEmEdicaoId))) {
        limparFormularioPromocao();
      }
      renderPromocoesLista();
    } catch (e) {
      console.error('Erro ao carregar promoções:', e);
    }
  }

  const btnSalvarPromocao = document.getElementById('btnSalvarPromocao');
  if (btnSalvarPromocao) {
    btnSalvarPromocao.addEventListener('click', async () => {
      const nome = String(document.getElementById('promoNome')?.value || '').trim();
      const descricao = String(document.getElementById('promoDescricao')?.value || '').trim();
      const tipo = String(document.getElementById('promoTipo')?.value || 'combo_produto');
      const produtoId = Number(document.getElementById('promoProdutoId')?.value || 0) || null;
      const quantidadeMin = Math.max(1, Number(document.getElementById('promoQuantidadeMin')?.value || 1));
      const precoCombo = Number.parseFloat(String(document.getElementById('promoPrecoCombo')?.value || '0').replace(',', '.')) || 0;
      const repetirNaVenda = !!document.getElementById('promoRepetirNaVenda')?.checked;
      const ativa = !!document.getElementById('promoAtiva')?.checked;
      if (!nome) return uiAlert('Informe o nome da promoção', 'warning');
      if (!produtoId) return uiAlert('Selecione um produto', 'warning');
      if (precoCombo <= 0) return uiAlert('Preço do combo deve ser maior que zero', 'warning');
      try {
        const payload = {
          nome,
          descricao: descricao || null,
          tipo,
          produto_id: produtoId,
          quantidade_min: quantidadeMin,
          repetir_na_venda: repetirNaVenda,
          preco_combo: precoCombo,
          ativo: ativa
        };
        if (promocaoEmEdicaoId) {
          await API.atualizarPromocao(promocaoEmEdicaoId, payload);
          uiNotify('Promoção atualizada', 'success');
        } else {
          await API.criarPromocao(payload);
          uiNotify('Promoção salva', 'success');
        }
        limparFormularioPromocao();
        await carregarPromocoes();
      } catch (e) {
        await uiAlert(e.message || 'Erro ao salvar promoção', 'error');
      }
    });
  }

  window.editarPromocao = async (id) => {
    const promo = promocoesCache.find((x) => Number(x.id) === Number(id));
    if (!promo) return;
    promocaoEmEdicaoId = Number(promo.id);
    document.getElementById('promoNome').value = promo.nome || '';
    document.getElementById('promoDescricao').value = promo.descricao || '';
    document.getElementById('promoTipo').value = promo.tipo || 'combo_produto';
    document.getElementById('promoProdutoId').value = String(promo.produto_id || '');
    document.getElementById('promoQuantidadeMin').value = String(Number(promo.quantidade_min || 1));
    document.getElementById('promoPrecoCombo').value = String(Number(promo.preco_combo || 0));
    document.getElementById('promoRepetirNaVenda').checked = Number(promo.repetir_na_venda ?? 1) === 1;
    document.getElementById('promoAtiva').checked = Number(promo.ativo || 0) === 1;
    const btn = document.getElementById('btnSalvarPromocao');
    if (btn) btn.textContent = 'Salvar Alterações';
    renderPromocoesLista();
  };

  window.removerPromocao = async (id) => {
    if (!(await uiConfirm('Remover promoção?', { title: 'Excluir promoção' }))) return;
    try {
      await API.removerPromocao(id);
      if (Number(promocaoEmEdicaoId) === Number(id)) {
        limparFormularioPromocao();
      }
      await carregarPromocoes();
      uiNotify('Promoção removida', 'success');
    } catch (e) {
      await uiAlert(e.message || 'Erro ao remover promoção', 'error');
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
    const resumo = document.getElementById('clienteResumoHistorico');
    const lista = document.getElementById('clienteHistoricoLista');
    if (resumo) resumo.textContent = 'Selecione um cliente para ver o histórico.';
    if (lista) lista.innerHTML = '';
  }

  async function carregarHistoricoCliente(id) {
    const resumo = document.getElementById('clienteResumoHistorico');
    const lista = document.getElementById('clienteHistoricoLista');
    if (!resumo || !lista) return;
    try {
      const hist = await API.obterHistoricoCliente(id, 30);
      resumo.textContent = `${hist.total_pedidos || 0} pedido(s) • Total ${formatarMoedaBR(hist.faturamento_total || 0)}`;
      const pedidos = hist.pedidos || [];
      if (!pedidos.length) {
        lista.innerHTML = '<p style="font-size:11px;color:#64748b">Sem pedidos vinculados para este cliente.</p>';
        return;
      }
      lista.innerHTML = pedidos
        .map(
          (p) =>
            `<div style="padding:6px 0;border-bottom:1px solid #eee">
              <div style="font-size:11px;font-weight:700">#${p.id} • ${p.mesa ? `Mesa ${p.mesa}` : 'Balcão'} • ${p.status}</div>
              <div style="font-size:10px;color:#64748b">${new Date(p.created_at).toLocaleString('pt-BR')} • ${p.itens_total} item(ns)</div>
              <div style="font-size:11px;color:#16a34a;font-weight:700">${formatarMoedaBR(p.total || 0)}</div>
            </div>`
        )
        .join('');
    } catch (e) {
      resumo.textContent = 'Erro ao carregar histórico.';
      lista.innerHTML = `<p style="font-size:11px;color:#b91c1c">${e.message || 'Falha no histórico'}</p>`;
    }
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
    carregarHistoricoCliente(c.id);
  }

  async function salvarCliente() {
    const nome = document.getElementById('clienteNome')?.value?.trim() || '';
    const telefone = document.getElementById('clienteTelefone')?.value?.trim() || '';
    const pontos = Number.parseInt(document.getElementById('clientePontos')?.value || '0', 10) || 0;
    const observacoes = document.getElementById('clienteObs')?.value?.trim() || '';
    if (!nome) return uiAlert('Nome do cliente é obrigatório', 'warning');
    try {
      if (clienteSelecionado) {
        await API.atualizarCliente(clienteSelecionado, { nome, telefone, pontos, observacoes });
      } else {
        await API.criarCliente({ nome, telefone, pontos, observacoes });
      }
      await carregarClientes();
      limparFormularioCliente();
    } catch (e) {
      await uiAlert(e.message || 'Erro ao salvar cliente', 'error');
    }
  }

  window.removerCliente = async (id) => {
    if (!(await uiConfirm('Remover cliente?', { title: 'Excluir cliente' }))) return;
    try {
      await API.removerCliente(id);
      await carregarClientes();
      if (clienteSelecionado === id) limparFormularioCliente();
    } catch (e) {
      await uiAlert(e.message || 'Erro ao remover cliente', 'error');
    }
  };

  async function refreshDados() {
    if (refreshEmAndamento) return;
    refreshEmAndamento = true;
    try {
      await carregarProdutosCompleto();
      await carregarMesas();
      await carregarCaixaResumo();
      const clientesTab = document.getElementById('clientes');
      if (clientesTab && !clientesTab.classList.contains('hidden')) {
        await carregarClientes();
      }
      const promocoesTab = document.getElementById('promocoes');
      if (promocoesTab && !promocoesTab.classList.contains('hidden')) {
        await carregarPromocoes();
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
    await carregarCaixaResumo();
    await carregarClientes();
    await carregarPromocoes();
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
