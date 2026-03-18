document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', switchTab));
  const ui = window.PDVUI || {};
  const uiNotify = (message, type = 'info') =>
    ui.notify ? ui.notify({ title: 'Aviso', message, type, keepHistory: true }) : console.log(`[${type}] ${message}`);
  const uiAlert = async (message, type = 'info') => {
    if (ui.alert) return ui.alert(message, type, 'Aviso');
    alert(message);
  };
  const uiConfirm = async (message, opts = {}) => {
    if (ui.confirm) return ui.confirm(message, opts);
    return confirm(message);
  };

  let historicoCache = [];
  let usuarioSelecionado = null;

  function switchTab(e) {
    document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
    e.currentTarget.classList.add('active');
    document.querySelectorAll('.tab-content').forEach((c) => c.classList.add('hidden'));
    const target = e.currentTarget.dataset.target;
    document.getElementById(target).classList.remove('hidden');
    if (target === 'relatorios') carregarRelatorios();
    if (target === 'historico') carregarHistorico();
    if (target === 'usuarios') carregarUsuarios();
    if (target === 'caixa') carregarCaixa();
  }

  async function carregarRelatorios() {
    const periodo = document.getElementById('relPeriodo')?.value || 'hoje';
    try {
      const [resumo, produtos] = await Promise.all([API.relatorioResumo(periodo), API.relatorioProdutos(20)]);
      renderResumoRelatorios(resumo);
      renderProdutosRelatorio(produtos);
    } catch (e) {
      console.error(e);
      uiNotify('Falha ao carregar relatórios', 'error');
    }
  }

  function renderResumoRelatorios(resumo) {
    const cards = document.getElementById('relResumoCards');
    const status = document.getElementById('relStatusList');
    if (!cards || !status) return;
    cards.innerHTML = `
      <div class="info-card"><h4>Vendas</h4><strong>${Number(resumo.total_vendas || 0)}</strong></div>
      <div class="info-card"><h4>Faturamento</h4><strong>${formatarMoedaBR(resumo.faturamento || 0)}</strong></div>
      <div class="info-card"><h4>Ticket médio</h4><strong>${formatarMoedaBR(resumo.ticket_medio || 0)}</strong></div>
    `;
    const list = resumo.por_status || [];
    status.innerHTML = list.length
      ? list
          .map(
            (s) =>
              `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <span>${s.status}</span><span class="tag">${s.quantidade}</span>
              </div>`
          )
          .join('')
      : '<p style="font-size:12px;color:#64748b;margin:0;">Sem dados no período.</p>';
  }

  function renderProdutosRelatorio(lista) {
    const body = document.getElementById('relProdutosBody');
    if (!body) return;
    body.innerHTML = lista.length
      ? lista
          .map(
            (p) =>
              `<tr>
                <td>${p.produto_nome}</td>
                <td>${p.quantidade_total}</td>
                <td>${formatarMoedaBR(p.total_vendido || 0)}</td>
              </tr>`
          )
          .join('')
      : '<tr><td colspan="3">Nenhum registro.</td></tr>';
  }

  async function carregarHistorico() {
    try {
      historicoCache = await API.listarHistorico(200);
      renderHistorico();
    } catch (e) {
      console.error(e);
      uiNotify('Erro ao carregar histórico', 'error');
    }
  }

  function renderHistorico() {
    const filtro = String(document.getElementById('histFiltro')?.value || '').toLowerCase().trim();
    const lista = document.getElementById('histLista');
    const resumo = document.getElementById('histResumo');
    if (!lista) return;
    const itens = historicoCache.filter((h) => {
      if (!filtro) return true;
      return (
        String(h.acao || '').toLowerCase().includes(filtro) ||
        String(h.tipo_entidade || '').toLowerCase().includes(filtro) ||
        String(h.detalhes || '').toLowerCase().includes(filtro)
      );
    });
    lista.innerHTML = itens.length
      ? itens
          .map(
            (h) =>
              `<div class="product-list-item" style="margin-bottom:6px;">
                <div>
                  <div class="product-list-item-name">${h.acao}</div>
                  <div style="font-size:11px;color:#64748b">${h.tipo_entidade || '-'} • #${h.entidade_id || '-'}</div>
                  <div style="font-size:11px;color:#94a3b8">${new Date(h.created_at).toLocaleString('pt-BR')}</div>
                </div>
                <div style="font-size:11px;color:#64748b;max-width:240px;text-align:right">${h.detalhes ? JSON.stringify(h.detalhes) : ''}</div>
              </div>`
          )
          .join('')
      : '<p style="font-size:12px;color:#64748b;">Sem eventos.</p>';
    if (resumo) resumo.textContent = `${itens.length} eventos listados.`;
  }

  async function carregarUsuarios() {
    try {
      const usuarios = await API.listarUsuarios();
      renderUsuarios(usuarios);
    } catch (e) {
      console.error(e);
      uiNotify('Erro ao carregar usuários', 'error');
    }
  }

  function renderUsuarios(usuarios) {
    const lista = document.getElementById('usuariosLista');
    if (!lista) return;
    lista.innerHTML = usuarios.length
      ? usuarios
          .map(
            (u) =>
              `<div class="user-item ${usuarioSelecionado === u.id ? 'selected' : ''}" data-id="${u.id}">
                <div>
                  <strong>${u.nome}</strong>
                  <div style="font-size:11px;color:#64748b">${u.login} • ${u.role} • ${Number(u.ativo || 0) ? 'ativo' : 'inativo'}</div>
                </div>
                <div class="product-list-item-info">
                  <button class="btn btn-secondary btn-soft" type="button" data-action="edit">Editar</button>
                  <button class="delete-btn" data-action="delete">X</button>
                </div>
              </div>`
          )
          .join('')
      : '<p style="font-size:12px;color:#64748b;">Nenhum usuário cadastrado.</p>';
    lista.querySelectorAll('.user-item').forEach((el) => {
      el.addEventListener('click', (e) => {
        const id = Number(el.dataset.id);
        const action = e.target?.dataset?.action;
        if (action === 'delete') return removerUsuario(id);
        if (action === 'edit' || !action) return editarUsuario(id);
      });
    });
  }

  async function editarUsuario(id) {
    const usuarios = await API.listarUsuarios();
    const u = usuarios.find((x) => Number(x.id) === Number(id));
    if (!u) return;
    usuarioSelecionado = u.id;
    document.getElementById('usuarioFormTitulo').textContent = `Usuário #${u.id}`;
    document.getElementById('usuarioNome').value = u.nome || '';
    document.getElementById('usuarioLogin').value = u.login || '';
    document.getElementById('usuarioRole').value = u.role || 'funcionario';
    document.getElementById('usuarioAtivo').value = String(Number(u.ativo || 0));
    document.getElementById('usuarioSenha').value = '';
    const btnCancelar = document.getElementById('btnCancelarUsuario');
    if (btnCancelar) btnCancelar.style.display = 'inline-flex';
  }

  async function removerUsuario(id) {
    if (!(await uiConfirm('Remover usuário?', { title: 'Excluir usuário' }))) return;
    try {
      await API.removerUsuario(id);
      usuarioSelecionado = null;
      limparFormularioUsuario();
      await carregarUsuarios();
    } catch (e) {
      uiAlert(e.message || 'Erro ao remover usuário', 'error');
    }
  }

  function limparFormularioUsuario() {
    usuarioSelecionado = null;
    document.getElementById('usuarioFormTitulo').textContent = 'Novo usuário';
    document.getElementById('usuarioNome').value = '';
    document.getElementById('usuarioLogin').value = '';
    document.getElementById('usuarioRole').value = 'funcionario';
    document.getElementById('usuarioAtivo').value = '1';
    document.getElementById('usuarioSenha').value = '';
    const btnCancelar = document.getElementById('btnCancelarUsuario');
    if (btnCancelar) btnCancelar.style.display = 'none';
  }

  async function salvarUsuario() {
    const nome = String(document.getElementById('usuarioNome').value || '').trim();
    const login = String(document.getElementById('usuarioLogin').value || '').trim();
    const role = String(document.getElementById('usuarioRole').value || 'funcionario');
    const ativo = Number(document.getElementById('usuarioAtivo').value || 1);
    const senha = String(document.getElementById('usuarioSenha').value || '');
    if (!nome || !login) return uiAlert('Nome e login são obrigatórios', 'warning');
    if (!usuarioSelecionado && !senha) return uiAlert('Informe uma senha para o novo usuário', 'warning');
    try {
      if (usuarioSelecionado) {
        const payload = { nome, login, role, ativo };
        if (senha) payload.senha = senha;
        await API.atualizarUsuario(usuarioSelecionado, payload);
        uiNotify('Usuário atualizado', 'success');
      } else {
        await API.criarUsuario({ nome, login, role, senha, ativo });
        uiNotify('Usuário criado', 'success');
      }
      limparFormularioUsuario();
      await carregarUsuarios();
    } catch (e) {
      uiAlert(e.message || 'Erro ao salvar usuário', 'error');
    }
  }

  async function carregarCaixa() {
    try {
      const [caixaAtual, resumo, historico] = await Promise.all([
        API.obterCaixaAtual(),
        API.obterResumoDiaCaixa(),
        API.listarHistoricoCaixa(20)
      ]);
      renderCaixaResumo(caixaAtual, resumo);
      renderCaixaHistorico(historico);
    } catch (e) {
      console.error(e);
      uiNotify('Erro ao carregar caixa', 'error');
    }
  }

  function renderCaixaResumo(caixaAtual, resumo) {
    const cards = document.getElementById('caixaResumoCards');
    const info = document.getElementById('caixaAtualInfo');
    if (cards) {
      cards.innerHTML = `
        <div class="info-card"><h4>Comandas</h4><strong>${Number(resumo.total_comandas || 0)}</strong></div>
        <div class="info-card"><h4>Faturamento</h4><strong>${formatarMoedaBR(resumo.faturamento_fechadas || 0)}</strong></div>
        <div class="info-card"><h4>Ticket médio</h4><strong>${formatarMoedaBR(resumo.ticket_medio || 0)}</strong></div>
      `;
    }
    if (info) {
      if (caixaAtual?.aberto) {
        info.innerHTML = `
          <div class="tag">Aberto</div>
          <p style="margin:6px 0;font-size:12px;">Abertura: ${new Date(caixaAtual.aberto.aberto_em).toLocaleString('pt-BR')}</p>
          <p style="margin:0;font-size:12px;">Saldo inicial: ${formatarMoedaBR(caixaAtual.aberto.saldo_inicial || 0)}</p>
        `;
      } else {
        info.innerHTML = '<div class="tag" style="background:#fee2e2;color:#991b1b;">Fechado</div>';
      }
    }
  }

  function renderCaixaHistorico(lista) {
    const body = document.getElementById('caixaHistoricoBody');
    if (!body) return;
    body.innerHTML = lista.length
      ? lista
          .map(
            (c) =>
              `<tr>
                <td>${new Date(c.aberto_em).toLocaleString('pt-BR')}</td>
                <td>${c.fechado_em ? 'Fechado' : 'Aberto'}</td>
                <td>${formatarMoedaBR(c.total_vendas || 0)}</td>
                <td>${c.aberto_por_nome || '-'}</td>
              </tr>`
          )
          .join('')
      : '<tr><td colspan="4">Sem registros.</td></tr>';
  }

  document.getElementById('btnRelAtualizar')?.addEventListener('click', carregarRelatorios);
  document.getElementById('relPeriodo')?.addEventListener('change', carregarRelatorios);
  document.getElementById('btnHistAtualizar')?.addEventListener('click', carregarHistorico);
  document.getElementById('histFiltro')?.addEventListener('input', renderHistorico);
  document.getElementById('btnSalvarUsuario')?.addEventListener('click', salvarUsuario);
  document.getElementById('btnCancelarUsuario')?.addEventListener('click', limparFormularioUsuario);

  carregarRelatorios();
});
