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
            <div class="cfg-card" style="margin-top:12px">
              <h4 style="margin:0 0 6px;color:#0f172a">Versões</h4>
              <div style="display:flex;gap:12px;font-size:12px;color:#64748b">
                <div>Backend: <strong id="cfgVersionBackend">-</strong></div>
                <div>Frontend: <strong id="cfgVersionFrontend">-</strong></div>
              </div>
            </div>
          </section>

          <section class="cfg-popup-pane" data-pane="impressao">
            <div class="cfg-card" style="margin-bottom:12px">
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
            <div class="cfg-grid">
              <div class="cfg-card">
                <h4 style="margin:0 0 8px;color:#0f172a">PIX</h4>
                <label style="font-size:12px;display:flex;align-items:center;gap:6px;margin-bottom:8px">
                  <input id="pixHabilitado" type="checkbox"> Habilitar Pix
                </label>
                <div class="form-group">
                  <label for="pixChave">Chave Pix</label>
                  <input id="pixChave" type="text" placeholder="email, telefone, EVP...">
                </div>
                <div class="form-group">
                  <label for="pixNomeRecebedor">Nome recebedor</label>
                  <input id="pixNomeRecebedor" type="text" placeholder="Nome do estabelecimento">
                </div>
                <div class="form-group">
                  <label for="pixCidade">Cidade</label>
                  <input id="pixCidade" type="text" placeholder="SAO PAULO">
                </div>
                <div class="form-group">
                  <label for="pixDescricaoPadrao">Descrição padrão</label>
                  <input id="pixDescricaoPadrao" type="text" placeholder="Pagamento PDV">
                </div>
                <div class="cfg-actions">
                  <button id="btnSalvarPix" class="btn btn-primary" type="button">Salvar PIX</button>
                </div>
                <small id="pixStatus" style="display:block;margin-top:8px;color:#64748b"></small>
              </div>
              <div class="cfg-card">
                <h4 style="margin:0 0 8px;color:#0f172a">Gateway de pagamento</h4>
                <label style="font-size:12px;display:flex;align-items:center;gap:6px;margin-bottom:8px">
                  <input id="pagAtivo" type="checkbox"> Ativar integração
                </label>
                <div class="form-group">
                  <label for="pagProvider">Provider</label>
                  <select id="pagProvider">
                    <option value="manual">Manual</option>
                    <option value="mock">Mock (teste)</option>
                    <option value="cielo">Cielo (simulado)</option>
                    <option value="pagseguro">PagSeguro (simulado)</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="pagAmbiente">Ambiente</label>
                  <select id="pagAmbiente">
                    <option value="sandbox">Sandbox</option>
                    <option value="producao">Produção</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="pagMerchantId">Merchant ID</label>
                  <input id="pagMerchantId" type="text" placeholder="Cielo Merchant ID">
                </div>
                <div class="form-group">
                  <label for="pagMerchantKey">Merchant Key</label>
                  <input id="pagMerchantKey" type="password" placeholder="Cielo Merchant Key">
                </div>
                <div class="form-group">
                  <label for="pagPagseguroToken">Token PagSeguro</label>
                  <input id="pagPagseguroToken" type="password" placeholder="Token PagSeguro">
                </div>
                <div class="cfg-actions">
                  <button id="btnSalvarPagamento" class="btn btn-primary" type="button">Salvar gateway</button>
                </div>
                <small id="pagStatus" style="display:block;margin-top:8px;color:#64748b"></small>
              </div>
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
    const ui = window.PDVUI || {};
    const uiAlert = async (msg, type = 'info') => {
      if (ui.alert) return ui.alert(msg, type, 'Configurações');
      alert(msg);
    };
    const uiConfirm = async (msg, opts = {}) => {
      if (ui.confirm) return ui.confirm(msg, opts);
      return confirm(msg);
    };
    const uiNotify = (msg, type = 'success') => {
      if (ui.notify) ui.notify({ title: 'Configurações', message: msg, type, keepHistory: true });
    };
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
    const pixHabilitado = modal.querySelector('#pixHabilitado');
    const pixChave = modal.querySelector('#pixChave');
    const pixNomeRecebedor = modal.querySelector('#pixNomeRecebedor');
    const pixCidade = modal.querySelector('#pixCidade');
    const pixDescricaoPadrao = modal.querySelector('#pixDescricaoPadrao');
    const btnSalvarPix = modal.querySelector('#btnSalvarPix');
    const pixStatus = modal.querySelector('#pixStatus');
    const pagAtivo = modal.querySelector('#pagAtivo');
    const pagProvider = modal.querySelector('#pagProvider');
    const pagAmbiente = modal.querySelector('#pagAmbiente');
    const pagMerchantId = modal.querySelector('#pagMerchantId');
    const pagMerchantKey = modal.querySelector('#pagMerchantKey');
    const pagPagseguroToken = modal.querySelector('#pagPagseguroToken');
    const btnSalvarPagamento = modal.querySelector('#btnSalvarPagamento');
    const pagStatus = modal.querySelector('#pagStatus');

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
    function setPixStatus(msg, isError) {
      pixStatus.textContent = msg || '';
      pixStatus.style.color = isError ? '#b91c1c' : '#64748b';
    }
    function setPagStatus(msg, isError) {
      pagStatus.textContent = msg || '';
      pagStatus.style.color = isError ? '#b91c1c' : '#64748b';
    }

    async function loadVersions() {
      const backendEl = modal.querySelector('#cfgVersionBackend');
      const frontendEl = modal.querySelector('#cfgVersionFrontend');
      if (!backendEl || !frontendEl) return;
      backendEl.textContent = '-';
      frontendEl.textContent = '-';
      try {
        const ver = await API.request('GET', '/version');
        backendEl.textContent = ver?.backend || '-';
        frontendEl.textContent = ver?.frontend || '-';
        return;
      } catch {
        // fallback
      }
      try {
        const resp = await fetch('/frontend/version.json');
        const data = await resp.json();
        frontendEl.textContent = data?.version || '-';
      } catch {}
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
      uiNotify('Configurações salvas.', 'success');
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

    async function loadPixCfg() {
      try {
        const cfg = await API.obterConfigPix();
        pixHabilitado.checked = !!cfg.habilitado;
        pixChave.value = cfg.chave || '';
        pixNomeRecebedor.value = cfg.nome_recebedor || '';
        pixCidade.value = cfg.cidade || '';
        pixDescricaoPadrao.value = cfg.descricao_padrao || '';
      } catch (e) {
        setPixStatus(e.message || 'Erro ao carregar PIX', true);
      }
    }

    async function salvarPixCfg() {
      try {
        await API.salvarConfigPix({
          habilitado: !!pixHabilitado.checked,
          chave: pixChave.value.trim(),
          nome_recebedor: pixNomeRecebedor.value.trim(),
          cidade: pixCidade.value.trim(),
          descricao_padrao: pixDescricaoPadrao.value.trim()
        });
        setPixStatus('Configuração PIX salva com sucesso.', false);
      } catch (e) {
        setPixStatus(e.message || 'Erro ao salvar PIX', true);
      }
    }

    async function loadPagCfg() {
      try {
        const cfg = await API.obterConfigPagamento();
        pagAtivo.checked = !!cfg.ativo;
        pagProvider.value = cfg.provider || 'manual';
        pagAmbiente.value = cfg.ambiente || 'sandbox';
        pagMerchantId.value = cfg.merchant_id || '';
        pagMerchantKey.value = cfg.merchant_key || '';
        pagPagseguroToken.value = cfg.pagseguro_token || '';
      } catch (e) {
        setPagStatus(e.message || 'Erro ao carregar gateway', true);
      }
    }

    async function salvarPagCfg() {
      try {
        await API.salvarConfigPagamento({
          ativo: !!pagAtivo.checked,
          provider: pagProvider.value,
          ambiente: pagAmbiente.value,
          merchant_id: pagMerchantId.value.trim(),
          merchant_key: pagMerchantKey.value.trim(),
          pagseguro_token: pagPagseguroToken.value.trim()
        });
        setPagStatus('Configuração de gateway salva.', false);
      } catch (e) {
        setPagStatus(e.message || 'Erro ao salvar gateway', true);
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
            await uiAlert(e.message || 'Erro ao atualizar usuário', 'error');
          }
        });
      });

      usersList.querySelectorAll('[data-action="delete"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const item = btn.closest('.cfg-user-item');
          const id = item.dataset.id;
          if (!(await uiConfirm('Remover usuário?', { title: 'Equipe' }))) return;
          try {
            await API.removerUsuario(id);
            await listarUsuarios();
          } catch (e) {
            await uiAlert(e.message || 'Erro ao remover usuário', 'error');
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
      if (!nome || !login || !senha) return uiAlert('Preencha nome, login e senha.', 'warning');
      try {
        await API.criarUsuario({ nome, login, senha, role });
        novoNome.value = '';
        novoLogin.value = '';
        novoSenha.value = '';
        novoRole.value = 'funcionario';
        await listarUsuarios();
      } catch (e) {
        await uiAlert(e.message || 'Erro ao criar usuário', 'error');
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
    btnSalvarPix.addEventListener('click', salvarPixCfg);
    btnSalvarPagamento.addEventListener('click', salvarPagCfg);
    filtroUsuario.addEventListener('input', renderUsers);
    btnCriarUsuario.addEventListener('click', criarUsuario);

    return {
      loadAll: async () => {
        loadCfg();
        atualizarCamposImpressora();
        await Promise.all([loadPrinterCfg(), loadPixCfg(), loadPagCfg(), listarUsuarios(), loadVersions()]);
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
