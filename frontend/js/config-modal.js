// Configuracoes em popup global (painel, garcom, producao).

(function () {
  function normalizeRole(r) {
    return String(r || '').toLowerCase().trim();
  }

  function readUser() {
    return JSON.parse(localStorage.getItem('pdv_user') || '{}');
  }

  function isManager(user) {
    const role = normalizeRole(user?.role);
    return role === 'dev' || role === 'gerente';
  }

  function isDev(user) {
    return normalizeRole(user?.role) === 'dev';
  }

  function applyThemeColor(hex) {
    if (!hex) return;
    document.documentElement.style.setProperty('--primary', hex);
  }

  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  function ensureModal() {
    if (document.getElementById('cfgGlobalModal')) return document.getElementById('cfgGlobalModal');
    const modal = document.createElement('div');
    modal.id = 'cfgGlobalModal';
    modal.className = 'modal';
    modal.style.display = 'none';
    modal.innerHTML = `
      <div class="modal-content config-modal-content">
        <div class="cfg-popup-header">
          <h3 style="margin:0;color:var(--primary)">Configurações</h3>
          <button id="cfgCloseModal" class="btn-fechar" type="button">&times;</button>
        </div>
        <div class="cfg-popup-tabs">
          <button class="cfg-popup-tab active" data-tab="restaurante" type="button">Restaurante</button>
          <button class="cfg-popup-tab" data-tab="impressao" type="button">Impressão</button>
          <button class="cfg-popup-tab" data-tab="equipe" type="button">Equipe</button>
        </div>
        <div class="cfg-popup-body">
          <section class="cfg-popup-pane active" data-pane="restaurante">
            <div class="cfg-card">
              <div class="form-group">
                <label for="cfgNome">Nome do estabelecimento</label>
                <input id="cfgNome" type="text" placeholder="Nome do restaurante">
              </div>
              <div class="form-group">
                <label for="cfgModo">Modo de operação</label>
                <select id="cfgModo">
                  <option value="bar">Bar</option>
                  <option value="fastfood">Fast Food</option>
                  <option value="hibrido">Híbrido</option>
                </select>
              </div>
              <div class="form-group">
                <label for="cfgCor">Cor de destaque</label>
                <input id="cfgCor" type="color" value="#1d4ed8">
              </div>
              <div class="cfg-actions">
                <button id="btnSalvarCfg" class="btn btn-primary" type="button">Salvar</button>
              </div>
            </div>
          </section>

          <section class="cfg-popup-pane" data-pane="impressao">
            <div class="cfg-card">
              <label style="font-size:12px;display:flex;align-items:center;gap:6px;margin-bottom:8px">
                <input id="impHabilitada" type="checkbox"> Habilitar impressão
              </label>
              <div class="form-group">
                <label for="impTipo">Modo de conexão</label>
                <select id="impTipo">
                  <option value="local">Local (Windows)</option>
                  <option value="rede">Rede (IP/Porta)</option>
                </select>
              </div>
              <div class="form-group">
                <label for="impNome">Nome (identificação)</label>
                <input id="impNome" type="text" placeholder="Ex: Balcão">
              </div>
              <div class="form-group" id="impHostGroup">
                <label>Host e Porta</label>
                <div style="display:grid;grid-template-columns:1fr 110px;gap:8px">
                  <input id="impHost" type="text" placeholder="192.168.0.50">
                  <input id="impPorta" type="number" min="1" max="65535" placeholder="9100">
                </div>
              </div>
              <div class="form-group" id="impLocalGroup">
                <label for="impLocal">Impressora local (Windows)</label>
                <input id="impLocal" list="impLocaisList" type="text" placeholder="Nome da impressora local">
                <datalist id="impLocaisList"></datalist>
              </div>
              <div class="form-group">
                <label>Automação</label>
                <label style="font-size:12px;display:flex;align-items:center;gap:6px;margin-top:6px">
                  <input id="impAutoFechamento" type="checkbox"> Comprovante ao fechar comanda
                </label>
                <label style="font-size:12px;display:flex;align-items:center;gap:6px;margin-top:6px">
                  <input id="impAutoCozinhaItem" type="checkbox"> Ticket da cozinha ao mexer em item
                </label>
              </div>
              <div class="cfg-actions">
                <button id="btnSalvarImpressora" class="btn btn-primary" type="button">Salvar impressora</button>
                <button id="btnListarImpressoras" class="btn btn-secondary" type="button">Listar locais</button>
                <button id="btnTesteImpressora" class="btn btn-secondary" type="button">Imprimir teste</button>
              </div>
              <small id="impStatus" style="display:block;margin-top:8px;color:#64748b"></small>
            </div>
          </section>

          <section class="cfg-popup-pane" data-pane="equipe">
            <div class="cfg-grid">
              <div class="cfg-card">
                <h4 style="margin:0 0 10px 0;color:#0f172a">Novo funcionário</h4>
                <div class="form-group">
                  <label for="novoNome">Nome</label>
                  <input id="novoNome" type="text" placeholder="Nome">
                </div>
                <div class="form-group">
                  <label for="novoLogin">Login</label>
                  <input id="novoLogin" type="text" placeholder="login">
                </div>
                <div class="form-group">
                  <label for="novoSenha">Senha</label>
                  <input id="novoSenha" type="password" placeholder="senha inicial">
                </div>
                <div class="form-group">
                  <label for="novoRole">Nível</label>
                  <select id="novoRole">
                    <option value="funcionario">Funcionário</option>
                    <option value="gerente">Gerente</option>
                  </select>
                </div>
                <div class="cfg-actions">
                  <button id="btnCriarUsuario" class="btn btn-primary" type="button">Adicionar usuário</button>
                </div>
              </div>
              <div class="cfg-card">
                <div class="form-group">
                  <label for="filtroUsuario">Buscar</label>
                  <input id="filtroUsuario" type="text" placeholder="Nome ou login">
                </div>
                <div id="usersList" class="cfg-users-list"></div>
              </div>
            </div>
          </section>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  function setupTabs(modal) {
    const tabs = modal.querySelectorAll('.cfg-popup-tab');
    const panes = modal.querySelectorAll('.cfg-popup-pane');
    tabs.forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
        tabs.forEach((x) => x.classList.toggle('active', x === btn));
        panes.forEach((p) => p.classList.toggle('active', p.dataset.pane === target));
      });
    });
  }

  function initConfigLogic(modal) {
    const currentUser = readUser();
    const cfgNome = modal.querySelector('#cfgNome');
    const cfgModo = modal.querySelector('#cfgModo');
    const cfgCor = modal.querySelector('#cfgCor');
    const btnSalvarCfg = modal.querySelector('#btnSalvarCfg');

    const impHabilitada = modal.querySelector('#impHabilitada');
    const impTipo = modal.querySelector('#impTipo');
    const impNome = modal.querySelector('#impNome');
    const impHost = modal.querySelector('#impHost');
    const impPorta = modal.querySelector('#impPorta');
    const impLocal = modal.querySelector('#impLocal');
    const impAutoFechamento = modal.querySelector('#impAutoFechamento');
    const impAutoCozinhaItem = modal.querySelector('#impAutoCozinhaItem');
    const impLocaisList = modal.querySelector('#impLocaisList');
    const impHostGroup = modal.querySelector('#impHostGroup');
    const impLocalGroup = modal.querySelector('#impLocalGroup');
    const btnSalvarImpressora = modal.querySelector('#btnSalvarImpressora');
    const btnListarImpressoras = modal.querySelector('#btnListarImpressoras');
    const btnTesteImpressora = modal.querySelector('#btnTesteImpressora');
    const impStatus = modal.querySelector('#impStatus');

    const novoNome = modal.querySelector('#novoNome');
    const novoLogin = modal.querySelector('#novoLogin');
    const novoSenha = modal.querySelector('#novoSenha');
    const novoRole = modal.querySelector('#novoRole');
    const btnCriarUsuario = modal.querySelector('#btnCriarUsuario');
    const usersList = modal.querySelector('#usersList');
    const filtroUsuario = modal.querySelector('#filtroUsuario');

    let usersCache = [];

    function setImpStatus(msg, isError) {
      impStatus.textContent = msg || '';
      impStatus.style.color = isError ? '#b91c1c' : '#64748b';
    }

    function atualizarCamposImpressora() {
      const isLocalMode = impTipo.value === 'local';
      impHostGroup.style.display = isLocalMode ? 'none' : '';
      impLocalGroup.style.display = isLocalMode ? '' : 'none';
    }

    function loadCfg() {
      const cfg = JSON.parse(localStorage.getItem('pdv_config') || '{}');
      cfgNome.value = cfg.nome || '';
      cfgModo.value = cfg.modo || 'bar';
      cfgCor.value = cfg.cor || '#1d4ed8';
      applyThemeColor(cfg.cor);
    }

    function saveCfg() {
      const cfg = {
        nome: String(cfgNome.value || '').trim(),
        modo: cfgModo.value,
        cor: cfgCor.value
      };
      localStorage.setItem('pdv_config', JSON.stringify(cfg));
      applyThemeColor(cfg.cor);
      if (window.initTopbarContext) window.initTopbarContext();
      alert('Configurações salvas.');
    }

    async function loadPrinterCfg() {
      try {
        const cfg = await API.obterConfigImpressao();
        impHabilitada.checked = !!cfg.habilitada;
        impTipo.value = cfg.tipo || 'rede';
        impNome.value = cfg.nome || '';
        impHost.value = cfg.host || '';
        impPorta.value = cfg.porta || 9100;
        impLocal.value = cfg.impressora_local || '';
        impAutoFechamento.checked = !!cfg.auto_fechamento;
        impAutoCozinhaItem.checked = !!cfg.auto_cozinha_item;
        atualizarCamposImpressora();
      } catch (e) {
        setImpStatus(e.message || 'Erro ao carregar impressora', true);
      }
    }

    async function salvarPrinterCfg() {
      try {
        const payload = {
          habilitada: impHabilitada.checked,
          tipo: impTipo.value,
          nome: impNome.value.trim(),
          host: impHost.value.trim(),
          porta: Number(impPorta.value || 9100),
          impressora_local: impLocal.value.trim(),
          auto_fechamento: !!impAutoFechamento.checked,
          auto_cozinha_item: !!impAutoCozinhaItem.checked
        };
        await API.salvarConfigImpressao(payload);
        setImpStatus('Configuração salva com sucesso.', false);
      } catch (e) {
        setImpStatus(e.message || 'Erro ao salvar impressora', true);
      }
    }

    async function listarImpressorasLocais() {
      try {
        const data = await API.listarImpressorasLocais();
        const nomes = Array.isArray(data.impressoras) ? data.impressoras : [];
        impLocaisList.innerHTML = nomes.map((n) => `<option value="${esc(n)}"></option>`).join('');
        setImpStatus(nomes.length ? `${nomes.length} impressora(s) encontrada(s).` : 'Nenhuma impressora local encontrada.', false);
      } catch (e) {
        setImpStatus(e.message || 'Erro ao listar impressoras locais', true);
      }
    }

    async function testarImpressora() {
      try {
        await API.testarImpressora();
        setImpStatus('Teste enviado para a impressora.', false);
      } catch (e) {
        setImpStatus(e.message || 'Erro no teste da impressora', true);
      }
    }

    function renderUsers() {
      const term = String(filtroUsuario?.value || '').toLowerCase().trim();
      const filtered = usersCache.filter((u) => {
        const n = String(u.nome || '').toLowerCase();
        const l = String(u.login || '').toLowerCase();
        return !term || n.includes(term) || l.includes(term);
      });
      if (!filtered.length) {
        usersList.innerHTML = '<p class="placeholder" style="padding:8px">Nenhum usuário encontrado.</p>';
        return;
      }
      usersList.innerHTML = filtered.map((u) => {
        const role = normalizeRole(u.role);
        const canPromoteGerente = isDev(currentUser);
        const canEditRole = isDev(currentUser) || role === 'funcionario';
        const isSelf = Number(u.id) === Number(currentUser.id);
        const canDelete = !isSelf && (isDev(currentUser) || role === 'funcionario');
        const gerenteOpt = canPromoteGerente ? '<option value="gerente">Gerente</option>' : '';

        return `
        <div class="cfg-user-item" data-id="${u.id}">
          <div class="cfg-user-head">
            <div>
              <div style="font-size:13px;font-weight:700">${esc(u.nome)} <span style="font-weight:400;color:#64748b">(@${esc(u.login)})</span></div>
              <div style="font-size:11px;color:#64748b">${u.ativo ? 'Ativo' : 'Inativo'}</div>
            </div>
            <span class="status-badge" style="background:#e2e8f0;color:#334155">${esc(role)}</span>
          </div>
          <div class="cfg-actions" style="margin-top:8px">
            <button class="btn btn-small btn-secondary" data-action="edit">Editar</button>
            ${canDelete ? '<button class="btn btn-small btn-danger" data-action="delete">Remover</button>' : ''}
          </div>
          <div class="cfg-user-editor">
            <input data-field="nome" value="${esc(u.nome)}" placeholder="Nome">
            <input data-field="login" value="${esc(u.login)}" placeholder="Login">
            <input data-field="senha" type="password" placeholder="Nova senha (opcional)">
            <select data-field="role" ${canEditRole ? '' : 'disabled'}>
              <option value="funcionario" ${role === 'funcionario' ? 'selected' : ''}>Funcionário</option>
              ${gerenteOpt}
              ${isDev(currentUser) ? `<option value="dev" ${role === 'dev' ? 'selected' : ''}>Dev</option>` : ''}
            </select>
            <label style="font-size:12px;display:flex;align-items:center;gap:6px;margin-top:6px">
              <input data-field="ativo" type="checkbox" ${u.ativo ? 'checked' : ''}> Ativo
            </label>
            <div class="cfg-actions" style="margin-top:8px">
              <button class="btn btn-small btn-primary" data-action="save">Salvar</button>
              <button class="btn btn-small btn-secondary" data-action="cancel">Cancelar</button>
            </div>
          </div>
        </div>`;
      }).join('');

      usersList.querySelectorAll('[data-action="edit"]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const editor = btn.closest('.cfg-user-item').querySelector('.cfg-user-editor');
          editor.classList.toggle('open');
        });
      });

      usersList.querySelectorAll('[data-action="cancel"]').forEach((btn) => {
        btn.addEventListener('click', () => btn.closest('.cfg-user-editor').classList.remove('open'));
      });

      usersList.querySelectorAll('[data-action="save"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const item = btn.closest('.cfg-user-item');
          const id = item.dataset.id;
          const payload = {
            nome: item.querySelector('[data-field="nome"]').value.trim(),
            login: item.querySelector('[data-field="login"]').value.trim(),
            role: item.querySelector('[data-field="role"]').value,
            ativo: item.querySelector('[data-field="ativo"]').checked
          };
          const senha = item.querySelector('[data-field="senha"]').value;
          if (senha) payload.senha = senha;
          try {
            await API.atualizarUsuario(id, payload);
            await listarUsuarios();
          } catch (e) {
            alert(e.message || 'Erro ao atualizar usuário');
          }
        });
      });

      usersList.querySelectorAll('[data-action="delete"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const item = btn.closest('.cfg-user-item');
          const id = item.dataset.id;
          if (!confirm('Remover usuário?')) return;
          try {
            await API.removerUsuario(id);
            await listarUsuarios();
          } catch (e) {
            alert(e.message || 'Erro ao remover usuário');
          }
        });
      });
    }

    async function listarUsuarios() {
      try {
        usersCache = await API.listarUsuarios();
        renderUsers();
      } catch (e) {
        usersList.innerHTML = `<p class="placeholder" style="padding:8px">${esc(e.message || 'Erro ao carregar usuários')}</p>`;
      }
    }

    async function criarUsuario() {
      const nome = String(novoNome.value || '').trim();
      const login = String(novoLogin.value || '').trim();
      const senha = novoSenha.value || '';
      const role = novoRole.value;
      if (!nome || !login || !senha) return alert('Preencha nome, login e senha.');
      try {
        await API.criarUsuario({ nome, login, senha, role });
        novoNome.value = '';
        novoLogin.value = '';
        novoSenha.value = '';
        novoRole.value = 'funcionario';
        await listarUsuarios();
      } catch (e) {
        alert(e.message || 'Erro ao criar usuário');
      }
    }

    if (!isDev(currentUser)) {
      const roleOpt = Array.from(novoRole.options).find((o) => o.value === 'gerente');
      if (roleOpt) roleOpt.remove();
    } else if (!Array.from(novoRole.options).some((o) => o.value === 'dev')) {
      const devOpt = document.createElement('option');
      devOpt.value = 'dev';
      devOpt.textContent = 'Dev';
      novoRole.appendChild(devOpt);
    }

    btnSalvarCfg.addEventListener('click', saveCfg);
    impTipo.addEventListener('change', atualizarCamposImpressora);
    btnSalvarImpressora.addEventListener('click', salvarPrinterCfg);
    btnListarImpressoras.addEventListener('click', listarImpressorasLocais);
    btnTesteImpressora.addEventListener('click', testarImpressora);
    filtroUsuario.addEventListener('input', renderUsers);
    btnCriarUsuario.addEventListener('click', criarUsuario);

    return {
      loadAll: async () => {
        loadCfg();
        atualizarCamposImpressora();
        await Promise.all([loadPrinterCfg(), listarUsuarios()]);
      }
    };
  }

  function init(retry = 0) {
    const currentUser = readUser();
    if (!currentUser || !currentUser.role) {
      if (retry < 10) {
        setTimeout(() => init(retry + 1), 150);
      }
      return;
    }
    if (!isManager(currentUser)) return;
    const modal = ensureModal();
    setupTabs(modal);
    const logic = initConfigLogic(modal);

    const close = () => {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    };
    const open = async () => {
      await logic.loadAll();
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    };

    modal.querySelector('#cfgCloseModal')?.addEventListener('click', close);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.style.display !== 'none') close();
    });

    window.PDVConfigModal = { open, close };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
