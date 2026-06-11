// Painel principal (desktop). Depende de `api.js` e `common.js`.

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', switchTab));
  const tabViaQuery = (new URLSearchParams(window.location.search).get('tab') || '').toLowerCase();

  const sideTabs = document.querySelector('#sideProdutos .sidebar-tabs');
  if (sideTabs) {
    sideTabs.addEventListener('click', (e) => {
      const btn = e.target?.closest?.('.sidebar-tab');
      if (!btn) return;
      document.querySelectorAll('#sideProdutos .sidebar-tab').forEach((x) => x.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.tab || 'produto';
      document.querySelectorAll('#sideProdutos .sidebar-tab-content').forEach((c) => c.classList.add('hidden'));
      const pane = document.getElementById(`tab${target.charAt(0).toUpperCase()}${target.slice(1)}`);
      if (pane) pane.classList.remove('hidden');
      if (target === 'categoria') {
        carregarCategorias(false).then(() => renderCategoriasLista());
      }
    });
  }

  function switchTab(e) {
    document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
    e.currentTarget.classList.add('active');
    document.querySelectorAll('.tab-content').forEach((c) => c.classList.add('hidden'));
    const target = e.currentTarget.dataset.target;
    document.getElementById(target).classList.remove('hidden');
    if (target === 'mesas') carregarMesas();
    if (target === 'clientes') carregarClientes();
    if (target === 'promocoes') carregarPromocoes();
    if (target === 'produtos') carregarProdutosCompleto();
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
  let filtroCategoriaEstoque = 'todas';
  const buscaProdutoEstoqueEl = document.getElementById('buscaProdutoEstoque');
  if (buscaProdutoEstoqueEl) {
    buscaProdutoEstoqueEl.addEventListener('input', () => {
      filtroProdutoEstoque = String(buscaProdutoEstoqueEl.value || '').toLowerCase().trim();
      renderProdutosList(produtosCache);
    });
  }
  const filtroCategoriaEstoqueEl = document.getElementById('filtroCategoriaEstoque');
  if (filtroCategoriaEstoqueEl) {
    filtroCategoriaEstoqueEl.addEventListener('change', () => {
      filtroCategoriaEstoque = filtroCategoriaEstoqueEl.value || 'todas';
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

  async function calcularFechamento({ mostrarPix = true } = {}) {
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
        const pixCfg = await API.obterConfigPix();
        const usaQrUpload = !!pixCfg?.qr_imagem;
        const pix = usaQrUpload
          ? {
              qr_data_url: pixCfg.qr_imagem,
              copia_cola: pixCfg.chave || '',
              payload: pixCfg.chave || '',
              chave: pixCfg.chave || ''
            }
          : await API.gerarPixVenda(currentMesa.id, Number(venda.total || 0), `Comanda ${currentMesa.id}`);
        if (fechPixBox) fechPixBox.classList.remove('hidden');
        if (fechPixQr) fechPixQr.src = pix.qr_data_url || '';
        if (fechPixPayload) fechPixPayload.value = pix.copia_cola || pix.payload || pix.chave || '';
        if (mostrarPix && fechPixBox?.scrollIntoView) fechPixBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    document.getElementById('mesas')?.classList.remove('comanda-fullscreen');
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

    await calcularFechamento({ mostrarPix: false });

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
  let categoriasCache = [];
  let categoriaSelecionadaId = null;
  let clienteComandaId = null;

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
  const btnCopiarPix = document.getElementById('btnCopiarPix');

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
    if (fechFormaPagamento.value === 'pix') {
      calcularFechamento({ mostrarPix: true }).catch((e) => uiAlert(e.message || 'Erro ao gerar PIX', 'error'));
    } else if (fechPixBox) {
      fechPixBox.classList.add('hidden');
    }
  });
  btnCopiarPix?.addEventListener('click', async () => {
    const texto = String(fechPixPayload?.value || '').trim();
    if (!texto) return uiAlert('Nenhum código PIX disponível', 'warning');
    try {
      await navigator.clipboard.writeText(texto);
      uiNotify('Código PIX copiado', 'success');
    } catch {
      try {
        fechPixPayload?.select?.();
        document.execCommand('copy');
        uiNotify('Código PIX copiado', 'success');
      } catch {
        uiAlert('Não foi possível copiar o código PIX', 'error');
      }
    }
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

  function produtoVaiCozinhaUI(p) {
    if (Number(p?.vai_cozinha || 0) === 1) return true;
    const cat = categoriasCache.find((c) => normalizarCategoria(c.nome) === normalizarCategoria(p?.categoria));
    return Number(cat?.vai_cozinha || 0) === 1;
  }

  function adicionarLinhaProdutoLote(dados = {}) {
    const list = document.getElementById('loteProdutosRows');
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'bulk-product-row';
    row.innerHTML = `
      <input type="text" class="lote-nome" placeholder="Ex: Coca lata" value="${String(dados.nome || '').replace(/"/g, '&quot;')}">
      <input type="number" step="0.01" min="0" class="lote-preco" placeholder="0,00" value="${dados.preco || ''}">
      <input type="number" step="1" min="0" class="lote-estoque" placeholder="0" value="${dados.estoque || ''}">
      <button type="button" class="bulk-product-remove">x</button>
    `;
    row.querySelector('.bulk-product-remove')?.addEventListener('click', () => {
      row.remove();
      if (!list.querySelector('.bulk-product-row')) adicionarLinhaProdutoLote();
    });
    list.appendChild(row);
  }

  function lerProdutosLoteRows() {
    const rows = [...document.querySelectorAll('#loteProdutosRows .bulk-product-row')];
    return rows
      .map((row) => ({
        nome: String(row.querySelector('.lote-nome')?.value || '').trim(),
        preco: Number.parseFloat(String(row.querySelector('.lote-preco')?.value || '0').replace(',', '.')) || 0,
        estoque: parseInt(row.querySelector('.lote-estoque')?.value || '0', 10) || 0
      }))
      .filter((p) => p.nome && p.preco > 0);
  }

  function parseOpcoesProduto(prod) {
    try {
      const arr = JSON.parse(prod?.opcoes_json || '[]');
      if (!Array.isArray(arr)) return [];
      return arr
        .map((o) => ({
          nome: String(o?.nome || '').trim(),
          extra: Number(o?.extra || 0) || 0,
          consumo: Math.max(1, Number(o?.consumo || 1)),
          estoque: o?.estoque === '' || o?.estoque === null || o?.estoque === undefined ? null : Math.max(0, Number.parseInt(o?.estoque, 10) || 0)
        }))
        .filter((o) => o.nome);
    } catch {
      return [];
    }
  }

  const btnSelecionarClienteComanda = document.getElementById('btnSelecionarClienteComanda');
  if (btnSelecionarClienteComanda) {
    btnSelecionarClienteComanda.addEventListener('click', async () => {
      try {
        const escolha = await abrirSeletorCliente({
          titulo: 'Selecionar cliente',
          descricao: 'Busque pelo nome ou telefone. Use “Sem cliente” para desvincular.'
        });
        if (escolha === undefined) return;
        clienteComandaId = escolha === null ? null : Number(escolha);
        if (clienteComandaId) {
          const c = clientesCache.find((x) => Number(x.id) === Number(clienteComandaId));
          atualizarResumoClienteComanda(c || { nome: '#' + clienteComandaId, telefone: '' });
        } else {
          atualizarResumoClienteComanda(null);
        }
      } catch (e) {
        await uiAlert(e.message || 'Erro ao selecionar cliente', 'error');
      }
    });
  }

  function atualizarResumoClienteComanda(cliente) {
    const el = document.getElementById('clienteComandaResumo');
    if (!el) return;
    if (!cliente) {
      el.textContent = 'Nenhum cliente vinculado.';
      return;
    }
    el.textContent = String(cliente.nome || 'Cliente') + (cliente.telefone ? (' • '+ cliente.telefone) : '');
  }

  async function abrirSeletorCliente(opts = {}) {
    const titulo = opts.titulo || 'Selecionar cliente';
    const descricao = opts.descricao || 'Escolha um cliente para a comanda.';
    const clientes = await API.obterClientes('');
    const chooser = ui.searchChoose || ui.choose;
    if (!chooser) return undefined;
    const choice = await chooser({
      title: titulo,
      message: descricao,
      okLabel: 'Selecionar',
      cancelLabel: 'Cancelar',
      searchPlaceholder: 'Buscar cliente pelo nome ou telefone',
      items: [
        { value: null, label: 'Sem cliente', meta: 'Remover vínculo da comanda' },
        { value: '__novo__', label: '+ Novo cliente', meta: 'Criar cadastro rápido' },
        ...clientes.map((c) => ({
          value: Number(c.id),
          label: c.nome || ('Cliente #' + c.id),
          meta: [c.telefone, c.observacoes].filter(Boolean).join(" • ") || 'Sem telefone'
        }))
      ]
    });
    if (choice === undefined) return undefined;
    if (choice === '__novo__') {
      const nome = ui.prompt ? await ui.prompt({ title: 'Novo cliente', message: 'Nome do cliente', placeholder: 'Nome', value: '' }) : null;
      if (!nome) return undefined;
      const telefone = ui.prompt ? await ui.prompt({ title: 'Novo cliente', message: 'Telefone (opcional)', placeholder: 'Telefone', value: '' }) : '';
      const novo = await API.criarCliente({
        nome: String(nome).trim(),
        telefone: String(telefone || '').trim(),
        pontos: 0,
        observacoes: ''
      });
      await carregarClientes();
      return Number(novo && (novo.id || novo.lastID) || null) || null;
    }
    if (choice === null) return null;
    return Number(choice);
  }

  async function escolherOpcaoProduto(prod) {
    const opcoes = parseOpcoesProduto(prod);
    if (!opcoes.length) return { observacoes: null, preco: Number(prod.preco || 0), consumo: 1 };
    const choice = ui.choose
      ? await ui.choose({
          title: `Variação - ${prod.nome}`,
          message: 'Selecione uma opção para adicionar na comanda.',
          okLabel: 'Adicionar',
          items: [
            {
              value: 0,
              label: 'Normal',
              meta: `${formatarMoedaBR(Number(prod.preco || 0))} • consumo 1x`
            },
            ...opcoes.map((o, index) => ({
              value: index + 1,
              label: o.nome,
              meta: [
                `${o.extra >= 0 ? '+' : ''}${formatarMoedaBR(o.extra)}`,
                `consumo ${o.consumo}x`,
                o.estoque === null ? 'estoque livre' : `${o.estoque} disp.`
              ].join(' • '),
              disabled: o.estoque !== null && Number(o.estoque) <= 0
            }))
          ]
        })
      : 0;
    if (choice === null || choice === undefined) return null;
    // DEBUG: mostra o valor retornado pelo modal de escolha
    if (window.PDV_DEBUG_VARIACOES) {
      console.log('[PDV][variacoes] retorno ui.choose:', choice);
      try { uiNotify(`DEBUG variacao retorno: ${JSON.stringify(choice)}`, 'info'); } catch {}
    }
    // UI pode devolver índice (radio) OU o value do item. Tratamos ambos.
    let idxNum = Number(choice);
    if (!Number.isFinite(idxNum)) return null;
    // Se veio índice do radio (0 = Normal, 1..N = variações)
    if (idxNum === 0) {
      return { observacoes: null, preco: Number(prod.preco || 0), consumo: 1 };
    }
    let sel = opcoes[idxNum - 1] || null;
    // Se veio value diretamente (0 = Normal, 1..N = variações), ainda ok
    if (!sel && idxNum > 0 && idxNum <= opcoes.length) {
      sel = opcoes[idxNum - 1] || null;
    }
    // Compat extra: se value veio como índice 0-based de opcoes
    if (!sel && idxNum >= 0 && idxNum < opcoes.length) {
      sel = opcoes[idxNum] || null;
    }
    if (!sel) return null;
    if (sel.estoque !== null && Number(sel.estoque) <= 0) {
      await uiAlert(`A variação "${sel.nome}" está sem estoque.`, 'warning');
      return null;
    }
    return {
      observacoes: sel.nome,
      preco: Number(prod.preco || 0) + Number(sel.extra || 0),
      consumo: Math.max(1, Number(sel.consumo || 1))
    };
  }

  function adicionarLinhaVariacao(nome = '', extra = 0, consumo = 1, estoque = '') {
    const list = document.getElementById('variacoesList');
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'variacao-row';
    row.innerHTML = `
      <input type="text" class="variacao-nome" placeholder="Ex: 300ml, 500ml, 1L" value="${String(nome || '').replace(/"/g, '&quot;')}">
      <input type="number" step="0.01" class="variacao-extra" placeholder="Extra" value="${Number(extra || 0)}">
      <input type="number" step="1" min="1" class="variacao-consumo" placeholder="Consumo" value="${Number(consumo || 1)}">
      <input type="number" step="1" min="0" class="variacao-estoque" placeholder="Estoque" value="${estoque === '' || estoque === null || estoque === undefined ? '' : Number(estoque)}">
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
          Math.max(1, Number(o?.consumo || 1)),
          o?.estoque ?? ''
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
        consumo: Math.max(1, Number(row.querySelector('.variacao-consumo')?.value || 1)),
        estoque: row.querySelector('.variacao-estoque')?.value === '' ? null : Math.max(0, Number.parseInt(String(row.querySelector('.variacao-estoque')?.value || '0'), 10) || 0)
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
  document.getElementById('btnLinkAutoAtendimento')?.addEventListener('click', async () => {
    const tenant = API.getTenant ? API.getTenant() : localStorage.getItem('pdv_tenant');
    if (!tenant) return uiAlert('Restaurante não identificado. Faça login novamente.', 'warning');
    const url = `${location.origin}/autoatendimento.html?tenant=${encodeURIComponent(tenant)}`;
    window.open(url, '_blank');
  });

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
      if (!venda) {
        venda = clienteComandaId
          ? await API.criarVendaComCliente('bar', mesaParaApi, clienteComandaId)
          : await API.criarVenda('bar', mesaParaApi);
      } else if (clienteComandaId !== null) {
        await API.vincularClienteVenda(venda.id, clienteComandaId);
      }

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
      clienteComandaId = null;
      atualizarResumoClienteComanda(null);
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

  async function atualizarStatusPedidoItem(vendaId, itemId, statusItem) {
    try {
      await API.atualizarStatusItem(vendaId, itemId, statusItem);
      const updated = await API.obterVenda(vendaId);
      currentMesa = updated;
      renderSideMesa(updated);
      await carregarMesas();
    } catch (e) {
      console.error('Erro ao atualizar status do item', e);
      await uiAlert(e.message || 'Erro ao atualizar status do item', 'error');
    }
  }

  window.removerItemMesa = removerItemMesa;
  window.cancelarPedidoItem = cancelarPedidoItem;
  window.alterarQuantidadeMesa = alterarQuantidadeMesa;
  window.atualizarStatusPedidoItem = atualizarStatusPedidoItem;

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
      renderPedidosPendentesAuto(vendas || []);
      const el = document.getElementById('listaMesas');
      if (!el) return;
      const lista = (vendas || []).filter((v) => {
        if (String(v.aprovacao_status || 'aprovado') === 'pendente') return false;
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
      return `<div class="produto-mesa-card" data-id="${p.id}" style="cursor:pointer"><div class="produto-mesa-card-img">IMG</div><div class="produto-mesa-card-name">${p.nome}</div><div class="produto-mesa-card-price">${formatarMoedaBR(p.preco)}</div><div style="font-size:10px;color:#0a7;margin-top:4px">${p.estoque} disponíveis${produtoVaiCozinhaUI(p) ? ' • cozinha' : ''}${qtdOpcoes ? ` • ${qtdOpcoes} opções` : ''}</div></div>`;
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
      const statusItem = String(item.status_item || 'anotado').toLowerCase() === 'saiu' ? 'saiu' : 'anotado';
      if (statusItem === 'saiu') return { key: 'saiu', label: 'Saiu', color: '#16a34a', bg: '#f0fdf4' };
      return { key: 'anotado', label: 'Anotado', color: '#f59e0b', bg: '#fff7ed' };
    };

    // Agrupa itens com mesmo produto+variação+preço para exibição unificada
    const agruparItensComanda = (lista) => {
      const map = new Map();
      for (const item of lista) {
        const key = `${item.produto_nome}||${String(item.observacoes || '').trim()}||${Number(item.preco_unitario || 0)}`;
        if (map.has(key)) {
          const g = map.get(key);
          g.quantidade += Number(item.quantidade || 0);
          g.subtotal = Number((g.quantidade * Number(g.preco_unitario || 0)).toFixed(2));
          g._idsGrupo.push(item.id);
        } else {
          map.set(key, { ...item, quantidade: Number(item.quantidade || 0), subtotal: Number(item.subtotal || 0), _idsGrupo: [item.id] });
        }
      }
      return [...map.values()];
    };

    const renderItemMesa = (i) => {
      const st = getStatusItem(i);
      const proximoStatus = st.key === 'anotado' ? 'saiu' : 'anotado';
      const rotuloBotao = st.key === 'anotado' ? 'Marcar saiu' : 'Voltar anotado';
      const idRef = i._idsGrupo ? i._idsGrupo[0] : i.id;
      const idsGrupo = i._idsGrupo || [i.id];
      // Para cancelar grupo, usamos onclick em série
      const cancelarCmds = idsGrupo.map((iid) => `cancelarPedidoItem(${venda.id},${iid})`).join(';');
      const statusCmds = idsGrupo.map((iid) => `atualizarStatusPedidoItem(${venda.id},${iid},'${proximoStatus}')`).join(';');
      const agrupado = idsGrupo.length > 1 ? ` <span style="font-size:10px;color:#94a3b8">(${idsGrupo.length} pedidos)</span>` : '';
      return `<div class="mesa-item-card ${st.key}">
        <div class="mesa-item-main">
          <strong>${i.produto_nome}</strong>${agrupado}
          ${i.observacoes ? `<small>${i.observacoes}</small>` : ''}
          <small>x${i.quantidade} • ${formatarMoedaBR(i.preco_unitario || 0)} un • ${formatarMoedaBR(i.subtotal || 0)}</small>
          <span style="display:inline-block;margin-top:6px;padding:2px 7px;border-radius:999px;font-size:10px;font-weight:700;color:${st.color};background:#fff">${st.label}</span>
        </div>
        <div class="mesa-item-actions">
          <button class="btn btn-small btn-secondary" onclick="alterarQuantidadeMesa(${venda.id},${idRef},-1)" ${comandaFechada ? 'disabled' : ''}>-</button>
          <span style="min-width:22px;text-align:center;font-size:12px;font-weight:700">${i.quantidade}</span>
          <button class="btn btn-small btn-secondary" onclick="alterarQuantidadeMesa(${venda.id},${idRef},1)" ${comandaFechada ? 'disabled' : ''}>+</button>
          <button class="btn btn-small btn-primary" onclick="${statusCmds}" ${comandaFechada ? 'disabled' : ''}>${rotuloBotao}</button>
          <button class="btn btn-small btn-danger" onclick="${cancelarCmds}" ${comandaFechada ? 'disabled' : ''}>Cancelar</button>
        </div>
      </div>`;
    };
    const itensJaSaiu = agruparItensComanda(itens.filter((i) => String(i.status_item || 'anotado').toLowerCase() === 'saiu'));
    const itensAnotados = agruparItensComanda(itens.filter((i) => String(i.status_item || 'anotado').toLowerCase() !== 'saiu'));
    const itensHtml = itens.length === 0
      ? '<p style="color:#666;margin:0">Sem itens</p>'
      : `${itensAnotados.length ? `<div class="mesa-grupo-titulo">Pedido anotado</div>${itensAnotados.map(renderItemMesa).join('')}` : ''}
         ${itensJaSaiu.length ? `<div class="mesa-grupo-titulo">Pedido que já saiu</div>${itensJaSaiu.map(renderItemMesa).join('')}` : ''}`;

    const addControlsHtml = `
      <div style="display:flex;gap:6px;margin-bottom:8px">
        <button class="btn btn-small btn-modo-produtos" style="flex:1;padding:8px;font-size:11px">Produtos</button>
        <button class="btn btn-small btn-secondary btn-modo-avulso" style="flex:1;padding:8px;font-size:11px">Valor Avulso</button>
      </div>
      <div class="bloco-produtos" style="display:block">
        <h4 style="margin:8px 0 4px;font-size:12px">Adicionar Produto</h4>
        ${comandaFechada ? '<p style="font-size:12px;color:#64748b">Comanda fechada. Reabra para adicionar itens.</p>' : prodGrid}
      </div>
      <div class="bloco-avulso" style="display:none">
        <h4 style="margin:8px 0 4px;font-size:12px">Valor Avulso</h4>
        <div class="side-mesa-display display-value" style="font-size:18px;margin-bottom:8px">R$ 0,00</div>
        <div class="side-mesa-teclado numeric-pad" style="grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:8px"></div>
        <div style="display:flex;gap:4px;flex-direction:column;margin-bottom:12px">
          <button class="pad-key secondary btn-side-mesa-clear" style="padding:8px;font-size:11px" ${comandaFechada ? 'disabled' : ''}>Limpar</button>
          <button class="pad-key btn-side-mesa-add-valor" style="padding:8px;font-size:11px" ${comandaFechada ? 'disabled' : ''}>Adicionar Valor</button>
        </div>
      </div>`;

    sideEl.innerHTML = `
      <div class="sidebar-section comanda-compacta">
        <h3>Comanda ${tituloComanda(venda)}</h3>
        <div style="font-size:12px;margin-bottom:8px">Total: <strong style="color:var(--success)">${formatarMoedaBR(venda.total || 0)}</strong></div>
        <div style="font-size:12px;margin-bottom:8px">Cliente: <strong>${venda.cliente_nome || 'Não vinculado'}</strong></div>
        <div style="display:flex;gap:6px;margin-bottom:8px">
          <button id="btnVincularClienteMesa" class="btn btn-small btn-secondary" style="flex:1;padding:6px;font-size:11px" ${comandaFechada ? 'disabled' : ''}>Vincular cliente</button>
          <button id="btnReabrirVendaMesa" class="btn btn-small" style="flex:1;padding:6px;font-size:11px">Reabrir venda</button>
        </div>
        <div style="display:flex;gap:6px;margin-bottom:8px">
          <button id="btnTelaCheiaComanda" class="btn btn-small btn-secondary" style="flex:1;padding:6px;font-size:11px">Tela inteira</button>
          <button id="btnImprimirComanda" class="btn btn-small btn-secondary" style="flex:1;padding:6px;font-size:11px">Imprimir</button>
          <button id="btnWhatsappComanda" class="btn btn-small btn-secondary" style="flex:1;padding:6px;font-size:11px">WhatsApp</button>
        </div>
        <h4 style="margin:8px 0 4px;font-size:12px">Itens</h4>
        <div class="mesa-items-list">
          ${itensHtml}
        </div>
        <hr style="margin:12px 0;border:none;border-top:1px solid #eee" />
        ${addControlsHtml}
        <button id="btnSideMesaFechar" class="btn btn-success btn-block" style="font-size:12px;padding:10px" ${comandaFechada ? 'disabled' : ''}>Tela de Fechamento</button>
      </div>
      <div class="comanda-full">
        <div class="comanda-full-top">
          <div class="comanda-full-title">
            <h3>${tituloComanda(venda)}</h3>
            <div class="comanda-full-meta">
              <span>Total: <strong>${formatarMoedaBR(venda.total || 0)}</strong></span>
              <span>Cliente: <strong>${venda.cliente_nome || 'Não vinculado'}</strong></span>
              <span>Status: <strong>${String(venda.status || 'aberta')}</strong></span>
              <span>${itens.length} item(ns)</span>
            </div>
          </div>
          <div class="comanda-full-actions">
            <button class="btn btn-small btn-secondary btn-vincular-cliente-mesa" ${comandaFechada ? 'disabled' : ''}>Vincular cliente</button>
            <button class="btn btn-small btn-secondary btn-imprimir-comanda">Imprimir</button>
            <button class="btn btn-small btn-secondary btn-whatsapp-comanda">WhatsApp</button>
            <button class="btn btn-small btn-success btn-side-mesa-fechar" ${comandaFechada ? 'disabled' : ''}>Fechamento</button>
            <button class="btn btn-small btn-secondary btn-tela-cheia-comanda">Sair da tela cheia</button>
          </div>
        </div>
        <div class="comanda-full-body">
          <div class="comanda-full-items">
            <h4>Itens da comanda</h4>
            <div class="mesa-items-list">${itensHtml}</div>
          </div>
          <div class="comanda-full-add">
            <h4>Adicionar na comanda</h4>
            ${addControlsHtml}
          </div>
        </div>
      </div>
    `;

    sideEl.querySelectorAll('.comanda-compacta, .comanda-full-add').forEach((panel) => {
      const blocoProdutos = panel.querySelector('.bloco-produtos');
      const blocoAvulso = panel.querySelector('.bloco-avulso');
      const btnModoProdutos = panel.querySelector('.btn-modo-produtos');
      const btnModoAvulso = panel.querySelector('.btn-modo-avulso');
      const tecladoLocal = criarTeclado(panel.querySelector('.side-mesa-teclado'), panel.querySelector('.side-mesa-display'));

      function aplicarModo(modo) {
        const produtosAtivo = modo === 'produtos';
        if (blocoProdutos) blocoProdutos.style.display = produtosAtivo ? 'block' : 'none';
        if (blocoAvulso) blocoAvulso.style.display = produtosAtivo ? 'none' : 'block';
        if (btnModoProdutos) btnModoProdutos.className = produtosAtivo ? 'btn btn-small btn-modo-produtos' : 'btn btn-small btn-secondary btn-modo-produtos';
        if (btnModoAvulso) btnModoAvulso.className = produtosAtivo ? 'btn btn-small btn-secondary btn-modo-avulso' : 'btn btn-small btn-modo-avulso';
      }

      btnModoProdutos?.addEventListener('click', () => aplicarModo('produtos'));
      btnModoAvulso?.addEventListener('click', () => aplicarModo('avulso'));
      aplicarModo('produtos');

      panel.querySelector('.btn-side-mesa-clear')?.addEventListener('click', () => tecladoLocal && tecladoLocal.clear());
      panel.querySelector('.btn-side-mesa-add-valor')?.addEventListener('click', async () => {
        const valor = tecladoLocal && tecladoLocal.getValue();
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
          if (tecladoLocal) tecladoLocal.clear();
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
    });

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

    sideEl.querySelectorAll('#btnTelaCheiaComanda, .btn-tela-cheia-comanda').forEach((btn) => btn.addEventListener('click', () => {
      document.getElementById('mesas')?.classList.toggle('comanda-fullscreen');
      renderSideMesa(venda);
    }));

    sideEl.querySelectorAll('#btnImprimirComanda, .btn-imprimir-comanda').forEach((btn) => btn.addEventListener('click', async () => {
      try {
        await API.imprimirVenda(venda.id, 'balcao');
        uiNotify('Comanda enviada para impressão', 'success');
      } catch (e) {
        await uiAlert(e.message || 'Erro ao imprimir comanda', 'error');
      }
    }));

    sideEl.querySelectorAll('#btnWhatsappComanda, .btn-whatsapp-comanda').forEach((btn) => btn.addEventListener('click', async () => {
      const telefone = String(venda.cliente_telefone || '').replace(/\D/g, '');
      if (!telefone) return uiAlert('Vincule um cliente com telefone para abrir o WhatsApp.', 'warning');
      const linhas = [
        `Comanda ${tituloComanda(venda)}`,
        ...itens.map((i) => `${i.quantidade}x ${i.produto_nome}${i.observacoes ? ` (${i.observacoes})` : ''} - ${formatarMoedaBR(i.subtotal)}`),
        `Total: ${formatarMoedaBR(venda.total || 0)}`
      ];
      window.open(`https://wa.me/55${telefone}?text=${encodeURIComponent(linhas.join('\n'))}`, '_blank');
    }));

    sideEl.querySelectorAll('#btnSideMesaFechar, .btn-side-mesa-fechar').forEach((btnFechar) => {
      btnFechar.addEventListener('click', async () => {
        if (!currentMesa) return;
        abrirModalFechamento();
      });
    });

    sideEl.querySelectorAll('#btnVincularClienteMesa, .btn-vincular-cliente-mesa').forEach((btnVincularClienteMesa) => {
      btnVincularClienteMesa.addEventListener('click', async () => {
        if (!currentMesa) return;
        const clientes = await API.obterClientes('');
        if (!clientes.length) return uiAlert('Nenhum cliente cadastrado.', 'warning');
        const clienteId = await abrirSeletorCliente({
          titulo: 'Vincular cliente',
          descricao: 'Pesquise pelo nome ou telefone. A primeira opção remove o vínculo atual.'
        });
        if (clienteId === undefined) return;
        await API.vincularClienteVenda(currentMesa.id, clienteId);
        const atualizada = await API.obterVenda(currentMesa.id);
        currentMesa = atualizada;
        renderSideMesa(atualizada);
        await carregarMesas();
        uiNotify(clienteId ? 'Cliente vinculado à comanda' : 'Vínculo removido', 'success');
      });
    });

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
      return `<div class="product-card ${semEstoque ? 'sem-estoque' : ''}" data-id="${p.id}" data-nome="${p.nome}" data-preco="${p.preco}" style="${semEstoque ? 'opacity:.55;cursor:not-allowed;' : ''}">\n      <div class="product-image">${p.imagem ? `<img src="${p.imagem}" style="width:100%;height:100%;object-fit:cover"/>` : 'IMG'}</div>\n      ${promo}\n      <div class="product-name">${p.nome}</div>\n      <div class="product-price">${formatarMoedaBR(p.preco)}</div>\n      <div class="product-meta">${rotuloCategoria(p.categoria)} • pop ${Number(p.popularidade || 0)} • ${p.estoque} em estoque${produtoVaiCozinhaUI(p) ? ' • cozinha' : ''}</div>\n    </div>`;
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
      const nome = String(p.nome || '').toLowerCase();
      const categoria = String(p.categoria || '').toLowerCase();
      if (termo && !nome.includes(termo) && !categoria.includes(termo)) return false;
      return true;
    });
    const filtradoCategoria =
      filtroCategoriaEstoque === 'todas'
        ? filtered
        : filtered.filter((p) => normalizarCategoria(p.categoria) === filtroCategoriaEstoque);

    if (!filtradoCategoria.length) {
      el.innerHTML = '<p style="font-size:12px;color:#64748b">Nenhum produto encontrado.</p>';
      return;
    }

    // Agrupar por categoria
    const agrupado = filtradoCategoria.reduce((acc, p) => {
      const cat = normalizarCategoria(p.categoria);
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(p);
      return acc;
    }, {});
    const cats = Object.keys(agrupado).sort((a, b) => a.localeCompare(b, 'pt-BR'));

    // Opções de categorias disponíveis para o bulk-move
    const catsDisponiveis = categoriasCache.length
      ? categoriasCache.filter((c) => Number(c.ativo || 0) === 1).map((c) => normalizarCategoria(c.nome)).filter(Boolean).sort((a,b) => a.localeCompare(b,'pt-BR'))
      : [...new Set(filtradoCategoria.map((p) => normalizarCategoria(p.categoria)))].sort();
    const catOptions = catsDisponiveis.map((c) => `<option value="${c}">${rotuloCategoria(c)}</option>`).join('');

    const renderRow = (p) =>
      `<div class="product-list-item" data-id="${p.id}" style="gap:8px;align-items:center">
        <input type="checkbox" class="produto-checkbox" data-id="${p.id}" onclick="event.stopPropagation()">
        <div style="flex:1;min-width:0">
          <div class="product-list-item-name">#${p.id} ${p.nome}${Number(p.destaque || 0) === 1 ? ' <span style="color:#f59e0b">\u2605</span>' : ''}</div>
          <div style="font-size:11px;color:#999">${rotuloCategoria(p.categoria)} \u2022 pop ${Number(p.popularidade || 0)} \u2022 ${p.tipo}${produtoVaiCozinhaUI(p) ? ' \u2022 cozinha' : ''}</div>
        </div>
        <div class="product-list-item-info">
          <span class="qty">${p.estoque} un</span>
          <span class="price">${formatarMoedaBR(p.preco)}</span>
          <button onclick="deletarProduto(${p.id})" class="delete-btn">X</button>
        </div>
      </div>`;

    el.innerHTML = cats.map((cat) => {
      const itens = agrupado[cat].sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));
      return `<section class="stock-category-section">
        <div class="stock-category-header">
          <div class="stock-category-title" style="gap:8px">
            <input type="checkbox" class="produto-checkbox cat-check-all" data-categoria="${cat}" title="Selecionar todos" onclick="event.stopPropagation()">
            <strong>${rotuloCategoria(cat)}</strong>
            <span>${itens.length} produto(s)</span>
          </div>
          <button class="btn btn-secondary btn-soft btn-renomear-categoria" type="button" data-categoria="${cat}">Renomear</button>
        </div>
        <div class="stock-category-items">${itens.map(renderRow).join('')}</div>
      </section>`;
    }).join('') +
    `<div class="bulk-action-bar" id="bulkActionBar" style="display:none">
      <span class="bulk-count" id="bulkCount">0 selecionados</span>
      <select id="bulkCatSelect">${catOptions}</select>
      <button class="btn btn-primary" id="btnBulkMover" type="button">Mover para categoria</button>
      <button class="btn btn-secondary" id="btnBulkDesmarcar" type="button">Desmarcar tudo</button>
    </div>`;

    // Atualizar barra de ação ao marcar/desmarcar
    const updateBulkBar = () => {
      const selecionados = [...el.querySelectorAll('.produto-checkbox[data-id]:checked')];
      const bar = el.querySelector('#bulkActionBar');
      const cnt = el.querySelector('#bulkCount');
      if (bar) bar.style.display = selecionados.length ? 'flex' : 'none';
      if (cnt) cnt.textContent = `${selecionados.length} selecionado${selecionados.length !== 1 ? 's' : ''}`;
    };

    el.querySelectorAll('.produto-checkbox[data-id]').forEach((cb) => cb.addEventListener('change', updateBulkBar));

    // Checkbox "selecionar todos" por categoria
    el.querySelectorAll('.cat-check-all').forEach((cbAll) => {
      cbAll.addEventListener('change', () => {
        const cat = cbAll.dataset.categoria;
        el.querySelectorAll('.produto-checkbox[data-id]').forEach((cb) => {
          const prod = filtradoCategoria.find((p) => String(p.id) === String(cb.dataset.id));
          if (prod && normalizarCategoria(prod.categoria) === cat) cb.checked = cbAll.checked;
        });
        updateBulkBar();
      });
    });

    // Mover em lote
    el.querySelector('#btnBulkMover')?.addEventListener('click', async () => {
      const ids = [...el.querySelectorAll('.produto-checkbox[data-id]:checked')].map((cb) => cb.dataset.id);
      const novaCategoria = el.querySelector('#bulkCatSelect')?.value;
      if (!ids.length || !novaCategoria) return;
      if (!(await uiConfirm(`Mover ${ids.length} produto(s) para "${rotuloCategoria(novaCategoria)}"?`, { title: 'Mudar categoria' }))) return;
      try {
        await Promise.all(ids.map((id) => API.atualizarProduto(id, { categoria: novaCategoria })));
        uiNotify(`${ids.length} produto(s) movidos para ${rotuloCategoria(novaCategoria)}`, 'success');
        await carregarProdutosCompleto();
      } catch (e) {
        await uiAlert(e.message || 'Erro ao mover produtos', 'error');
      }
    });

    // Desmarcar tudo
    el.querySelector('#btnBulkDesmarcar')?.addEventListener('click', () => {
      el.querySelectorAll('.produto-checkbox').forEach((cb) => { cb.checked = false; });
      updateBulkBar();
    });

    // Clique na linha → selecionar produto para edição
    el.querySelectorAll('.product-list-item').forEach((item) => {
      item.addEventListener('click', (ev) => {
        if (ev.target.closest('.produto-checkbox') || ev.target.closest('.delete-btn')) return;
        selecionarProduto(item.dataset.id);
      });
    });

    el.querySelectorAll('.btn-renomear-categoria').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        renomearCategoriaEstoque(btn.dataset.categoria || '');
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
      await carregarCategorias(false);
      renderCategoriasHome(produtosCache);
      atualizarListaCategoriasFormulario(produtosCache);
      renderProdutosGrid(produtosCache);
      renderProdutosList(produtosCache);
      preencherSelectProdutoPromocao();
      preencherSelectCategoriaPromocao();
    } catch (e) {
      console.error('Erro ao carregar produtos:', e);
    }
  }

  function renderCategoriasHome(produtos) {
    const el = document.getElementById('homeCategorias');
    if (!el) return;
    const catsRaw = categoriasCache.length
      ? categoriasCache.filter((c) => Number(c.ativo || 0) === 1).map((c) => normalizarCategoria(c.nome))
      : (produtos || []).filter((p) => p.tipo !== 'avulso').map((p) => normalizarCategoria(p.categoria));
    const cats = [...new Set(catsRaw)].filter(Boolean).sort();
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
    const catsRaw = categoriasCache.length
      ? categoriasCache.filter((c) => Number(c.ativo || 0) === 1).map((c) => normalizarCategoria(c.nome))
      : (produtos || []).filter((p) => p.tipo !== 'avulso').map((p) => normalizarCategoria(p.categoria));
    const cats = [...new Set(catsRaw)].filter(Boolean).sort();
    const filtroEl = document.getElementById('filtroCategoriaEstoque');
    if (filtroEl) {
      const cur = filtroEl.value || 'todas';
      filtroEl.innerHTML = ['todas', ...cats]
        .map((c) => `<option value="${c}">${c === 'todas' ? 'Todas categorias' : rotuloCategoria(c)}</option>`)
        .join('');
      if ([...filtroEl.options].some((o) => o.value === cur)) filtroEl.value = cur;
    }
    renderCategoriaSuggest(cats);
  }

  function renderCategoriaSuggest(cats) {
    const list = document.getElementById('categoriaSuggestList');
    if (!list) return;
    if (!cats.length) {
      list.innerHTML = '<div class="category-suggest-item" style="cursor:default;color:#64748b">Nenhuma categoria encontrada</div>';
      return;
    }
    list.innerHTML = cats
      .map(
        (c) =>
          `<div class="category-suggest-item" data-value="${c}">
            <span>${rotuloCategoria(c)}</span>
            <small style="color:#94a3b8">existente</small>
          </div>`
      )
      .join('');
  }

  const categoriaInput = document.getElementById('novoProdutoCategoria');
  if (categoriaInput) {
    const list = document.getElementById('categoriaSuggestList');
    const showList = () => {
      if (!list) return;
      list.style.display = 'block';
    };
    const hideList = () => {
      if (!list) return;
      list.style.display = 'none';
    };
    categoriaInput.addEventListener('focus', () => {
      const catsRaw = categoriasCache.length
        ? categoriasCache.filter((c) => Number(c.ativo || 0) === 1).map((c) => normalizarCategoria(c.nome))
        : (produtosCache || []).filter((p) => p.tipo !== 'avulso').map((p) => normalizarCategoria(p.categoria));
      const cats = [...new Set(catsRaw)].filter(Boolean).sort();
      renderCategoriaSuggest(cats);
      showList();
    });
    categoriaInput.addEventListener('input', () => {
      const termo = normalizarCategoria(categoriaInput.value || '');
      const catsRaw = categoriasCache.length
        ? categoriasCache.filter((c) => Number(c.ativo || 0) === 1).map((c) => normalizarCategoria(c.nome))
        : (produtosCache || []).filter((p) => p.tipo !== 'avulso').map((p) => normalizarCategoria(p.categoria));
      const cats = [...new Set(catsRaw)].filter(Boolean).sort();
      const filtrado = termo ? cats.filter((c) => c.includes(termo)) : cats;
      renderCategoriaSuggest(filtrado);
      showList();
    });
    categoriaInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') hideList();
    });
    document.addEventListener('click', (e) => {
      if (!list) return;
      if (e.target?.closest?.('#categoriaSuggestList')) return;
      if (e.target === categoriaInput) return;
      hideList();
    });
    list?.addEventListener('click', (e) => {
      const item = e.target?.closest?.('.category-suggest-item');
      if (!item) return;
      categoriaInput.value = String(item.dataset.value || '');
      hideList();
    });
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
        await garantirCategoriaLocal(categoria);
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

  async function garantirCategoriaLocal(nome) {
    const n = normalizarCategoria(nome || 'geral');
    if (!n) return;
    if (categoriasCache.some((c) => normalizarCategoria(c.nome) === n)) return;
    try {
      await API.criarCategoria({ nome: n, ativo: true });
      await carregarCategorias(false);
    } catch {
      // ignore
    }
  }

  document.getElementById('btnCriarProdutosLote')?.addEventListener('click', async () => {
    const categoria = normalizarCategoria(document.getElementById('loteCategoria')?.value || document.getElementById('novoProdutoCategoria')?.value || 'geral');
    const itens = lerProdutosLoteRows();
    if (!itens.length) return uiAlert('Informe ao menos um produto com nome e preço.', 'warning');
    try {
      const resp = await API.criarProdutosLote(categoria, itens);
      const rows = document.getElementById('loteProdutosRows');
      if (rows) rows.innerHTML = '';
      adicionarLinhaProdutoLote();
      document.getElementById('loteCategoria').value = categoria;
      await carregarProdutosCompleto();
      const criados = resp.criados?.length || 0;
      const ignorados = resp.ignorados?.length || 0;
      uiNotify(`${criados} produto(s) criado(s)${ignorados ? `, ${ignorados} ignorado(s) por nome repetido` : ''}`, criados ? 'success' : 'warning');
    } catch (e) {
      await uiAlert(e.message || 'Erro ao criar produtos em lote', 'error');
    }
  });
  document.getElementById('btnAddProdutoLote')?.addEventListener('click', () => adicionarLinhaProdutoLote());
  adicionarLinhaProdutoLote();

  async function renomearCategoriaEstoque(categoriaAtual) {
    const atual = normalizarCategoria(categoriaAtual);
    const entrada = ui.prompt
      ? await ui.prompt({
          title: 'Renomear categoria',
          message: `Novo nome para "${rotuloCategoria(atual)}".`,
          placeholder: 'Novo nome',
          value: atual,
          okLabel: 'Renomear'
        })
      : prompt(`Novo nome para "${rotuloCategoria(atual)}":`, atual);
    if (entrada === null) return;
    const nova = normalizarCategoria(entrada);
    if (!nova || nova === atual) return uiAlert('Informe um novo nome de categoria', 'warning');
    if (!(await uiConfirm(`Renomear todos os itens de "${atual}" para "${nova}"?`, { title: 'Renomear categoria' }))) return;
    try {
      const resp = await API.renomearCategoria(atual, nova);
      await carregarProdutosCompleto();
      uiNotify(`${resp.alterados || 0} item(ns) atualizados`, 'success');
    } catch (e) {
      await uiAlert(e.message || 'Erro ao renomear categoria', 'error');
    }
  }

  function renderPedidosPendentesAuto(vendas) {
    const el = document.getElementById('autoPedidosPendentes');
    if (!el) return;
    const pendentes = (vendas || []).filter((v) => String(v.aprovacao_status || '') === 'pendente');
    if (!pendentes.length) {
      el.innerHTML = '';
      return;
    }
    el.innerHTML = `<section style="border:1px solid #f59e0b;border-radius:8px;background:#fffbeb;padding:10px">
      <h3 style="margin:0 0 8px;font-size:15px;color:#92400e">Pedidos aguardando aprovação</h3>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${pendentes.map((v) => `<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;background:#fff;border:1px solid #fde68a;border-radius:8px;padding:8px">
          <div>
            <strong>${v.auto_cliente_nome || 'Cliente'} • ${tituloComanda(v)}</strong>
            <div style="font-size:12px;color:#64748b">${formatarMoedaBR(v.total || 0)} • ${new Date(v.created_at).toLocaleString('pt-BR')}</div>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-small btn-primary btn-auto-ver" data-id="${v.id}">Ver</button>
            <button class="btn btn-small btn-success btn-auto-aprovar" data-id="${v.id}">Aprovar</button>
            <button class="btn btn-small btn-danger btn-auto-recusar" data-id="${v.id}">Recusar</button>
          </div>
        </div>`).join('')}
      </div>
    </section>`;
    el.querySelectorAll('.btn-auto-ver').forEach((btn) => btn.addEventListener('click', () => abrirMesa(btn.dataset.id)));
    el.querySelectorAll('.btn-auto-aprovar').forEach((btn) => btn.addEventListener('click', async () => {
      try {
        await API.aprovarAutoatendimento(btn.dataset.id);
        uiNotify('Pedido aprovado', 'success');
        await carregarMesas();
        await carregarProdutosCompleto();
      } catch (e) {
        await uiAlert(e.message || 'Erro ao aprovar pedido', 'error');
      }
    }));
    el.querySelectorAll('.btn-auto-recusar').forEach((btn) => btn.addEventListener('click', async () => {
      if (!(await uiConfirm('Recusar este pedido?', { title: 'Autoatendimento' }))) return;
      try {
        await API.recusarAutoatendimento(btn.dataset.id, '');
        uiNotify('Pedido recusado', 'success');
        await carregarMesas();
      } catch (e) {
        await uiAlert(e.message || 'Erro ao recusar pedido', 'error');
      }
    }));
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
    const bonusEl = document.getElementById('promoProdutoBonusId');
    if (bonusEl) {
      const atualBonus = bonusEl.value;
      bonusEl.innerHTML = lista.length
        ? lista.map((p) => `<option value="${p.id}">${p.nome} (${formatarMoedaBR(p.preco)})</option>`).join('')
        : '<option value="">Sem produtos cadastrados</option>';
      if (atualBonus && bonusEl.querySelector(`option[value="${atualBonus}"]`)) bonusEl.value = atualBonus;
    }
    atualizarSelectVariacoesPromocao();
  }

  function atualizarCamposTipoPromocao() {
    const tipo = document.getElementById('promoTipo')?.value || 'combo_produto';
    const bonusBox = document.getElementById('promoBonusBox');
    const precoCombo = document.getElementById('promoPrecoCombo');
    if (bonusBox) bonusBox.style.display = tipo === 'ganhe_produto' ? 'block' : 'none';
    if (precoCombo) precoCombo.disabled = tipo === 'ganhe_produto';
  }

  function atualizarSelectVariacoesPromocao(valorAtual = null) {
    const produtoEl = document.getElementById('promoProdutoId');
    const variacaoEl = document.getElementById('promoVariacaoNome');
    if (!produtoEl || !variacaoEl) return;
    const produto = (produtosCache || []).find((p) => String(p.id) === String(produtoEl.value));
    const opcoes = parseOpcoesProduto(produto);
    const atual = valorAtual !== null ? valorAtual : variacaoEl.value;
    variacaoEl.innerHTML = '<option value="">Todas as variações do produto</option>' +
      opcoes.map((o) => `<option value="${String(o.nome).replace(/"/g, '&quot;')}">${o.nome}</option>`).join('');
    if (atual && Array.from(variacaoEl.options).some((opt) => opt.value === String(atual))) {
      variacaoEl.value = String(atual);
    }
  }

  function preencherSelectCategoriaPromocao() {
    const el = document.getElementById('promoCategoria');
    if (!el) return;
    const cats = categoriasCache.length
      ? categoriasCache.filter((c) => Number(c.ativo || 0) === 1).map((c) => normalizarCategoria(c.nome)).filter(Boolean).sort()
      : [
          ...new Set(
            (produtosCache || [])
              .filter((p) => p.tipo !== 'avulso')
              .map((p) => normalizarCategoria(p.categoria))
          )
        ].sort();
    el.innerHTML = cats.length
      ? cats.map((c) => `<option value="${c}">${rotuloCategoria(c)}</option>`).join('')
      : '<option value="">Sem categorias</option>';
  }

  function atualizarVisibilidadePromoTipo() {
    const tipo = String(document.getElementById('promoTipo')?.value || 'combo_produto');
    const prodSel = document.getElementById('promoProdutoId');
    const catSel = document.getElementById('promoCategoria');
    const catLabel = document.getElementById('promoCategoriaLabel');
    if (tipo === 'combo_categoria') {
      if (prodSel) prodSel.style.display = 'none';
      if (catSel) catSel.style.display = '';
      if (catLabel) catLabel.style.display = 'block';
    } else {
      if (prodSel) prodSel.style.display = '';
      if (catSel) catSel.style.display = 'none';
      if (catLabel) catLabel.style.display = 'none';
    }
  }

  function limparFormularioPromocao() {
    promocaoEmEdicaoId = null;
    document.getElementById('promoNome').value = '';
    document.getElementById('promoDescricao').value = '';
    document.getElementById('promoTipo').value = 'combo_produto';
    atualizarSelectVariacoesPromocao('');
    atualizarCamposTipoPromocao();
    document.getElementById('promoCategoria').value = '';
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
            ? `${Number(p.quantidade_min || 0)}x ${p.produto_nome || `#${p.produto_id}`}${p.variacao_nome ? ` (${p.variacao_nome})` : ''} por ${formatarMoedaBR(p.preco_combo || 0)}`
            : String(p.tipo || '') === 'ganhe_produto'
              ? `${Number(p.quantidade_min || 0)}x ${p.produto_nome || `#${p.produto_id}`}${p.variacao_nome ? ` (${p.variacao_nome})` : ''} ganha ${Number(p.produto_bonus_quantidade || 1)}x ${p.produto_bonus_nome || `#${p.produto_bonus_id}`}`
            : `${Number(p.quantidade_min || 0)}x ${rotuloCategoria(p.categoria || '')} por ${formatarMoedaBR(p.preco_combo || 0)}`;
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
      atualizarVisibilidadePromoTipo();
    } catch (e) {
      console.error('Erro ao carregar promoções:', e);
    }
  }

  const btnSalvarPromocao = document.getElementById('btnSalvarPromocao');
  document.getElementById('promoProdutoId')?.addEventListener('change', () => atualizarSelectVariacoesPromocao(''));
  document.getElementById('promoTipo')?.addEventListener('change', atualizarCamposTipoPromocao);
  if (btnSalvarPromocao) {
    document.getElementById('promoTipo')?.addEventListener('change', atualizarVisibilidadePromoTipo);
    btnSalvarPromocao.addEventListener('click', async () => {
        const nome = String(document.getElementById('promoNome')?.value || '').trim();
        const descricao = String(document.getElementById('promoDescricao')?.value || '').trim();
        const tipo = String(document.getElementById('promoTipo')?.value || 'combo_produto');
        const produtoId = Number(document.getElementById('promoProdutoId')?.value || 0) || null;
      const variacaoNome = String(document.getElementById('promoVariacaoNome')?.value || '').trim();
      const produtoBonusId = Number(document.getElementById('promoProdutoBonusId')?.value || 0) || null;
      const produtoBonusQtd = Math.max(1, Number(document.getElementById('promoProdutoBonusQtd')?.value || 1));
        const categoria = String(document.getElementById('promoCategoria')?.value || '').trim();
        const quantidadeMin = Math.max(1, Number(document.getElementById('promoQuantidadeMin')?.value || 1));
        const precoCombo = Number.parseFloat(String(document.getElementById('promoPrecoCombo')?.value || '0').replace(',', '.')) || 0;
        const repetirNaVenda = !!document.getElementById('promoRepetirNaVenda')?.checked;
        const ativa = !!document.getElementById('promoAtiva')?.checked;
        if (!nome) return uiAlert('Informe o nome da promoção', 'warning');
        if (tipo === 'combo_produto' && !produtoId) return uiAlert('Selecione um produto', 'warning');
        if (tipo === 'combo_categoria' && !categoria) return uiAlert('Selecione uma categoria', 'warning');
        if (tipo === 'combo_produto' && precoCombo <= 0) return uiAlert('Preço do combo deve ser maior que zero', 'warning');
      if (tipo === 'ganhe_produto' && !produtoBonusId) return uiAlert('Selecione o produto bônus', 'warning');
        try {
          const payload = {
            nome,
            descricao: descricao || null,
            tipo,
            produto_id: produtoId,
          variacao_nome: variacaoNome || null,
          produto_bonus_id: tipo === 'ganhe_produto' ? produtoBonusId : null,
          produto_bonus_quantidade: tipo === 'ganhe_produto' ? produtoBonusQtd : 1,
            categoria: tipo === 'combo_categoria' ? categoria : null,
            quantidade_min: quantidadeMin,
            repetir_na_venda: repetirNaVenda,
            preco_combo: tipo === 'combo_produto' ? precoCombo : null,
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
    atualizarSelectVariacoesPromocao(promo.variacao_nome || '');
    if (document.getElementById('promoProdutoBonusId')) document.getElementById('promoProdutoBonusId').value = String(promo.produto_bonus_id || '');
    if (document.getElementById('promoProdutoBonusQtd')) document.getElementById('promoProdutoBonusQtd').value = String(Number(promo.produto_bonus_quantidade || 1));
    atualizarCamposTipoPromocao();
    document.getElementById('promoCategoria').value = String(promo.categoria || '');
    document.getElementById('promoQuantidadeMin').value = String(Number(promo.quantidade_min || 1));
    document.getElementById('promoPrecoCombo').value = String(Number(promo.preco_combo || 0));
    document.getElementById('promoRepetirNaVenda').checked = Number(promo.repetir_na_venda ?? 1) === 1;
    document.getElementById('promoAtiva').checked = Number(promo.ativo || 0) === 1;
    atualizarVisibilidadePromoTipo();
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

  // ===== CATEGORIAS =====
  async function carregarCategorias(ativas = false) {
    try {
      categoriasCache = await API.listarCategorias(ativas);
      renderCategoriasLista();
      atualizarListaCategoriasFormulario(produtosCache);
      preencherSelectCategoriaPromocao();
    } catch (e) {
      console.error('Erro ao carregar categorias:', e);
      const catsFallback = [...new Set((produtosCache || []).map((p) => normalizarCategoria(p.categoria)))].filter(Boolean);
      categoriasCache = catsFallback.map((nome, idx) => ({ id: `local-${idx}`, nome, ativo: 1, vai_cozinha: 0 }));
      renderCategoriasLista();
      atualizarListaCategoriasFormulario(produtosCache);
    }
  }

  function renderCategoriasLista() {
    const el = document.getElementById('listaCategorias');
    if (!el) return;
    if (!categoriasCache.length) {
      el.innerHTML = '<p style="font-size:12px;color:#64748b">Nenhuma categoria.</p>';
      return;
    }
    const ordenadas = [...categoriasCache].sort((a, b) =>
      String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR')
    );
    const todasRow = `<div class="product-list-item" style="background:#f8fafc;border-style:dashed;cursor:default">
        <div>
          <div class="product-list-item-name">Todas as categorias</div>
          <div style="font-size:11px;color:#64748b">Resumo apenas para referência</div>
        </div>
        <div class="product-list-item-info"><span class="qty">${ordenadas.length}</span></div>
      </div>`;
    el.innerHTML = todasRow + ordenadas
      .map(
        (c) =>
          `<div class="product-list-item ${String(categoriaSelecionadaId) === String(c.id) ? 'selected' : ''}" data-id="${c.id}">
            <div>
              <div class="product-list-item-name">${rotuloCategoria(c.nome)}</div>
              <div style="font-size:11px;color:#64748b">${Number(c.ativo || 0) === 1 ? 'Ativa' : 'Inativa'}${Number(c.vai_cozinha || 0) === 1 ? ' • cozinha' : ''}</div>
            </div>
            <div class="product-list-item-info">
              <button class="btn btn-secondary btn-soft" type="button" data-action="edit">Editar</button>
              <button class="delete-btn" data-action="delete">X</button>
            </div>
          </div>`
      )
      .join('');
    el.querySelectorAll('.product-list-item[data-id]').forEach((item) => {
      item.addEventListener('click', (e) => {
        const id = item.dataset.id;
        const action = e.target?.dataset?.action;
        if (action === 'delete') return removerCategoria(id);
        editarCategoria(id);
      });
    });
  }

  function limparFormularioCategoria() {
    categoriaSelecionadaId = null;
    const nomeEl = document.getElementById('categoriaNome');
    const ativaEl = document.getElementById('categoriaAtiva');
    const cozinhaEl = document.getElementById('categoriaVaiCozinha');
    if (nomeEl) nomeEl.value = '';
    if (ativaEl) ativaEl.checked = true;
    if (cozinhaEl) cozinhaEl.checked = false;
    const btn = document.getElementById('btnSalvarCategoria');
    if (btn) btn.textContent = 'Salvar Categoria';
    const btnCancelar = document.getElementById('btnCancelarCategoria');
    if (btnCancelar) btnCancelar.style.display = 'none';
  }

  async function editarCategoria(id) {
    const cat = categoriasCache.find((c) => String(c.id) === String(id));
    if (!cat) return;
    categoriaSelecionadaId = String(cat.id);
    const nomeEl = document.getElementById('categoriaNome');
    const ativaEl = document.getElementById('categoriaAtiva');
    const cozinhaEl = document.getElementById('categoriaVaiCozinha');
    if (nomeEl) nomeEl.value = rotuloCategoria(cat.nome);
    if (ativaEl) ativaEl.checked = Number(cat.ativo || 0) === 1;
    if (cozinhaEl) cozinhaEl.checked = Number(cat.vai_cozinha || 0) === 1;
    const btn = document.getElementById('btnSalvarCategoria');
    if (btn) btn.textContent = 'Salvar Alterações';
    const btnCancelar = document.getElementById('btnCancelarCategoria');
    if (btnCancelar) btnCancelar.style.display = 'block';
    renderCategoriasLista();
  }

  async function salvarCategoria() {
    const nome = String(document.getElementById('categoriaNome')?.value || '').trim();
    const ativa = !!document.getElementById('categoriaAtiva')?.checked;
    const vaiCozinha = !!document.getElementById('categoriaVaiCozinha')?.checked;
    if (!nome) return uiAlert('Informe o nome da categoria', 'warning');
    try {
      if (categoriaSelecionadaId) {
        await API.atualizarCategoria(categoriaSelecionadaId, { nome, ativo: ativa, vai_cozinha: vaiCozinha });
        uiNotify('Categoria atualizada', 'success');
      } else {
        await API.criarCategoria({ nome, ativo: ativa, vai_cozinha: vaiCozinha });
        uiNotify('Categoria criada', 'success');
      }
      limparFormularioCategoria();
      await carregarCategorias(false);
      renderCategoriasHome(produtosCache);
      renderProdutosGrid(produtosCache);
      renderProdutosList(produtosCache);
    } catch (e) {
      await uiAlert(e.message || 'Erro ao salvar categoria', 'error');
    }
  }

  async function removerCategoria(id) {
    if (String(id).startsWith('local-')) {
      return uiAlert('Categorias locais precisam ser criadas no backend primeiro.', 'warning');
    }
    if (!(await uiConfirm('Remover categoria?', { title: 'Excluir categoria' }))) return;
    try {
      await API.removerCategoria(id);
      if (String(categoriaSelecionadaId) === String(id)) limparFormularioCategoria();
      await carregarCategorias(false);
      renderCategoriasHome(produtosCache);
      renderProdutosGrid(produtosCache);
      renderProdutosList(produtosCache);
    } catch (e) {
      await uiAlert(e.message || 'Erro ao remover categoria', 'error');
    }
  }

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
  document.getElementById('btnSalvarCategoria')?.addEventListener('click', salvarCategoria);
  document.getElementById('btnCancelarCategoria')?.addEventListener('click', limparFormularioCategoria);
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
