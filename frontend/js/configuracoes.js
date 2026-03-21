document.addEventListener('DOMContentLoaded', () => {
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
  const cfgNome = document.getElementById('cfgNome');
  const cfgModo = document.getElementById('cfgModo');
  const cfgCor = document.getElementById('cfgCor');
  const btnSalvarCfg = document.getElementById('btnSalvarCfg');
  const btnVoltarPainel = document.getElementById('btnVoltarPainel');
  const impHabilitada = document.getElementById('impHabilitada');
  const impDestino = document.getElementById('impDestino');
  const impNovoDestino = document.getElementById('impNovoDestino');
  const impTipo = document.getElementById('impTipo');
  const impNome = document.getElementById('impNome');
  const impHost = document.getElementById('impHost');
  const impPorta = document.getElementById('impPorta');
  const impLocal = document.getElementById('impLocal');
  const impAutoFechamento = document.getElementById('impAutoFechamento');
  const impAutoCozinhaItem = document.getElementById('impAutoCozinhaItem');
  const impLocaisList = document.getElementById('impLocaisList');
  const impHostGroup = document.getElementById('impHostGroup');
  const impLocalGroup = document.getElementById('impLocalGroup');
  const btnSalvarImpressora = document.getElementById('btnSalvarImpressora');
  const btnListarImpressoras = document.getElementById('btnListarImpressoras');
  const btnTesteImpressora = document.getElementById('btnTesteImpressora');
  const btnNovoDestino = document.getElementById('btnNovoDestino');
  const btnExcluirDestino = document.getElementById('btnExcluirDestino');
  const impStatus = document.getElementById('impStatus');
  const pixHabilitado = document.getElementById('pixHabilitado');
  const pixChave = document.getElementById('pixChave');
  const pixNomeRecebedor = document.getElementById('pixNomeRecebedor');
  const pixCidade = document.getElementById('pixCidade');
  const pixDescricaoPadrao = document.getElementById('pixDescricaoPadrao');
  const pixQrArquivo = document.getElementById('pixQrArquivo');
  const pixQrPreview = document.getElementById('pixQrPreview');
  const btnSalvarPix = document.getElementById('btnSalvarPix');
  const pixStatus = document.getElementById('pixStatus');

  const novoNome = document.getElementById('novoNome');
  const novoLogin = document.getElementById('novoLogin');
  const novoSenha = document.getElementById('novoSenha');
  const novoRole = document.getElementById('novoRole');
  const btnCriarUsuario = document.getElementById('btnCriarUsuario');
  const usersList = document.getElementById('usersList');
  const filtroUsuario = document.getElementById('filtroUsuario');

  const currentUser = JSON.parse(localStorage.getItem('pdv_user') || '{}');
  let usersCache = [];
  let printerCache = {};
  let pixQrAtual = '';

  function normalizeRole(r) {
    return String(r || '').toLowerCase().trim();
  }

  function isDev() {
    return normalizeRole(currentUser.role) === 'dev';
  }

  function loadCfg() {
    const cfg = JSON.parse(localStorage.getItem('pdv_config') || '{}');
    cfgNome.value = cfg.nome || '';
    cfgModo.value = cfg.modo || 'bar';
    cfgCor.value = cfg.cor || '#1d4ed8';
  }

  function saveCfg() {
    const cfg = {
      nome: String(cfgNome.value || '').trim(),
      modo: cfgModo.value,
      cor: cfgCor.value
    };
    localStorage.setItem('pdv_config', JSON.stringify(cfg));
    if (window.initTopbarContext) window.initTopbarContext();
    uiNotify('Configurações salvas.', 'success');
  }

  function setImpStatus(msg, isError = false) {
    if (!impStatus) return;
    impStatus.textContent = msg || '';
    impStatus.style.color = isError ? '#b91c1c' : '#64748b';
  }

  function setPixStatus(msg, isError = false) {
    if (!pixStatus) return;
    pixStatus.textContent = msg || '';
    pixStatus.style.color = isError ? '#b91c1c' : '#64748b';
  }

  function fillPrinterForm(cfg) {
    if (!cfg) return;
    const destinoAtual = normalizeDestinoValue(impDestino?.value || 'balcao');
    impHabilitada.checked = !!cfg.habilitada;
    impTipo.value = cfg.tipo || 'rede';
    const nomePadrao = destinoAtual === 'balcao'
      ? 'Balcão / Fechamento'
      : destinoAtual === 'cozinha'
        ? 'Cozinha'
        : destinoAtual.replace(/_/g, ' ');
    impNome.value = cfg.nome || nomePadrao;
    impHost.value = cfg.host || '';
    impPorta.value = cfg.porta || 9100;
    impLocal.value = cfg.impressora_local || '';
    impAutoFechamento.checked = !!cfg.auto_fechamento;
    impAutoCozinhaItem.checked = !!cfg.auto_cozinha_item;
    atualizarCamposImpressora();
  }

  function normalizeDestinoValue(value) {
    return String(value || '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_-]/g, '')
      .replace(/_+/g, '_')
      .replace(/^-+|-+$/g, '');
  }

  function renderPrinterDestinations(configs = []) {
    const current = String(impDestino?.value || '').trim();
    const ordered = [...configs];
    if (!ordered.some((c) => c.destino === 'balcao')) ordered.unshift({ destino: 'balcao', nome: 'Balcão / Fechamento' });
    if (!ordered.some((c) => c.destino === 'cozinha')) ordered.push({ destino: 'cozinha', nome: 'Cozinha' });
    const uniq = [];
    const seen = new Set();
    for (const cfg of ordered) {
      const destino = normalizeDestinoValue(cfg.destino);
      if (!destino || seen.has(destino)) continue;
      seen.add(destino);
      const nomeBase = destino === 'balcao'
        ? 'Balcão / Fechamento'
        : destino === 'cozinha'
          ? 'Cozinha'
          : String(cfg.nome || '').trim() || destino.replace(/_/g, ' ');
      uniq.push({ ...cfg, destino, label: destino === 'balcao' || destino === 'cozinha' ? nomeBase : `${nomeBase} (${destino})` });
    }
    impDestino.innerHTML = uniq
      .map((cfg) => `<option value="${String(cfg.destino).replace(/"/g, '&quot;')}">${String(cfg.label || cfg.destino).replace(/"/g, '&quot;')}</option>`)
      .join('');
    if (current && seen.has(current)) {
      impDestino.value = current;
    } else {
      impDestino.value = uniq[0]?.destino || 'balcao';
    }
  }

  async function carregarListaImpressoras(destinoPreferido = null) {
    try {
      const data = await API.listarConfigsImpressao();
      const configs = Array.isArray(data.configs) ? data.configs : [];
      printerCache = configs.reduce((acc, cfg) => {
        acc[cfg.destino] = cfg;
        return acc;
      }, {});
      renderPrinterDestinations(configs);
      const destino = normalizeDestinoValue(destinoPreferido || impDestino?.value || 'balcao');
      if (printerCache[destino]) {
        fillPrinterForm(printerCache[destino]);
      } else {
        await loadPrinterCfg(destino);
      }
      return configs;
    } catch (e) {
      setImpStatus(e.message || 'Erro ao carregar destinos de impressora', true);
      return [];
    }
  }

  async function loadPrinterCfg(destino = impDestino?.value || 'balcao') {
    if (!isDev() && normalizeRole(currentUser.role) !== 'gerente') return;
    try {
      const destinoSlug = normalizeDestinoValue(destino);
      impDestino.value = destinoSlug;
      const cfg = await API.obterConfigImpressao(destinoSlug);
      printerCache[destinoSlug] = cfg;
      fillPrinterForm(cfg);
      setImpStatus(`Configuração de impressora (${destinoSlug}) carregada.`);
    } catch (e) {
      setImpStatus(e.message || 'Erro ao carregar impressora', true);
    }
  }

  async function salvarPrinterCfg() {
    try {
      const destino = normalizeDestinoValue(impDestino?.value || 'balcao');
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
      await API.salvarConfigImpressao(payload, destino);
      printerCache[destino] = { ...payload, destino };
      await carregarListaImpressoras(destino);
      setImpStatus(`Configuração de ${destino} salva com sucesso.`);
    } catch (e) {
      setImpStatus(e.message || 'Erro ao salvar impressora', true);
    }
  }

  async function testarImpressora() {
    try {
      await API.testarImpressora(normalizeDestinoValue(impDestino?.value || 'balcao'));
      setImpStatus('Teste enviado para a impressora.');
    } catch (e) {
      setImpStatus(e.message || 'Erro no teste da impressora', true);
    }
  }

  async function criarNovoDestino() {
    const destino = normalizeDestinoValue(impNovoDestino?.value || '');
    if (!destino) {
      await uiAlert('Digite um nome para o novo destino.', 'warning');
      return;
    }
    impDestino.value = destino;
    impNovoDestino.value = '';
    if (!printerCache[destino]) {
      fillPrinterForm({
        habilitada: false,
        tipo: 'rede',
        host: '',
        porta: 9100,
        impressora_local: '',
        auto_fechamento: false,
        auto_cozinha_item: false,
        nome: destino,
        largura: 42,
        corte: true
      });
    } else {
      fillPrinterForm(printerCache[destino]);
    }
    setImpStatus(`Destino "${destino}" pronto para salvar.`);
  }

  async function excluirDestinoAtual() {
    const destino = normalizeDestinoValue(impDestino?.value || 'balcao');
    if (!destino || destino === 'balcao' || destino === 'cozinha') {
      await uiAlert('Os destinos padrão balcao e cozinha não podem ser removidos.', 'warning');
      return;
    }
    const ok = await uiConfirm(`Excluir o destino "${destino}"?`, { title: 'Impressão' });
    if (!ok) return;
    try {
      await API.removerConfigImpressao(destino);
      delete printerCache[destino];
      await carregarListaImpressoras('balcao');
      setImpStatus(`Destino "${destino}" removido.`);
    } catch (e) {
      setImpStatus(e.message || 'Erro ao excluir destino', true);
    }
  }

  function atualizarCamposImpressora() {
    const isLocal = impTipo.value === 'local';
    impHostGroup.style.display = isLocal ? 'none' : '';
    impLocalGroup.style.display = isLocal ? '' : 'none';
  }

  async function listarImpressorasLocais() {
    try {
      const data = await API.listarImpressorasLocais();
      const nomes = Array.isArray(data.impressoras) ? data.impressoras : [];
      impLocaisList.innerHTML = nomes.map((n) => `<option value="${String(n).replace(/"/g, '&quot;')}"></option>`).join('');
      setImpStatus(nomes.length ? `${nomes.length} impressora(s) local(is) encontrada(s).` : 'Nenhuma impressora local encontrada.');
    } catch (e) {
      setImpStatus(e.message || 'Erro ao listar impressoras locais', true);
    }
  }

  function setPixPreview(src) {
    pixQrAtual = src || '';
    if (!pixQrPreview) return;
    if (pixQrAtual) {
      pixQrPreview.src = pixQrAtual;
      pixQrPreview.style.display = 'block';
    } else {
      pixQrPreview.removeAttribute('src');
      pixQrPreview.style.display = 'none';
    }
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
      reader.readAsDataURL(file);
    });
  }

  async function loadPixCfg() {
    try {
      const cfg = await API.obterConfigPix();
      pixHabilitado.checked = !!cfg.habilitado;
      pixChave.value = cfg.chave || '';
      pixNomeRecebedor.value = cfg.nome_recebedor || '';
      pixCidade.value = cfg.cidade || '';
      pixDescricaoPadrao.value = cfg.descricao_padrao || '';
      setPixPreview(cfg.qr_imagem || '');
      setPixStatus('Configuração Pix carregada.');
    } catch (e) {
      setPixStatus(e.message || 'Erro ao carregar PIX', true);
    }
  }

  async function salvarPixCfg() {
    try {
      const payload = {
        habilitado: !!pixHabilitado.checked,
        chave: pixChave.value.trim(),
        nome_recebedor: pixNomeRecebedor.value.trim(),
        cidade: pixCidade.value.trim(),
        descricao_padrao: pixDescricaoPadrao.value.trim(),
        qr_imagem: pixQrAtual || ''
      };
      await API.salvarConfigPix(payload);
      setPixStatus('Configuração Pix salva.');
    } catch (e) {
      setPixStatus(e.message || 'Erro ao salvar PIX', true);
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
      usersList.innerHTML = '<div class="empty">Nenhum usuário encontrado.</div>';
      return;
    }

    usersList.innerHTML = filtered.map((u) => {
      const role = normalizeRole(u.role);
      const canPromoteGerente = isDev();
      const canEditRole = isDev() || role === 'funcionario';
      const isSelf = Number(u.id) === Number(currentUser.id);
      const canDelete = !isSelf && (isDev() || role === 'funcionario');
      const gerenteOpt = canPromoteGerente ? '<option value="gerente">Gerente</option>' : '';

      return `
      <div class="user-item ${u.ativo ? '' : 'inativo'}" data-id="${u.id}">
        <div class="user-head">
          <div>
            <div class="user-title">${u.nome} <span style="font-weight:400;color:#64748b">(@${u.login})</span></div>
            <div class="user-meta">Criado em ${new Date(u.created_at).toLocaleDateString('pt-BR')} • ${u.ativo ? 'Ativo' : 'Inativo'}</div>
          </div>
          <span class="user-pill ${role}">${role}</span>
        </div>

        <div class="user-row-actions">
          <button class="btn btn-small btn-secondary" data-action="edit">Editar</button>
          ${canDelete ? '<button class="btn btn-small btn-danger" data-action="delete">Remover</button>' : ''}
        </div>

        <div class="user-editor">
          <input data-field="nome" value="${u.nome}" placeholder="Nome" />
          <input data-field="login" value="${u.login}" placeholder="Login" />
          <input data-field="senha" type="password" placeholder="Nova senha (opcional)" />
          <select data-field="role" ${canEditRole ? '' : 'disabled'}>
            <option value="funcionario" ${role === 'funcionario' ? 'selected' : ''}>Funcionário</option>
            ${gerenteOpt}
            ${isDev() ? `<option value=\"dev\" ${role === 'dev' ? 'selected' : ''}>Dev</option>` : ''}
          </select>
          <label style="font-size:12px;display:flex;align-items:center;gap:6px;margin-bottom:8px">
            <input data-field="ativo" type="checkbox" ${u.ativo ? 'checked' : ''} /> Ativo
          </label>
          <div class="cfg-actions">
            <button class="btn btn-small btn-primary" data-action="save">Salvar</button>
            <button class="btn btn-small btn-secondary" data-action="cancel">Cancelar</button>
          </div>
        </div>
      </div>`;
    }).join('');

    usersList.querySelectorAll('[data-action="edit"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.user-item');
        const editor = item.querySelector('.user-editor');
        editor.style.display = editor.style.display === 'block' ? 'none' : 'block';
      });
    });

    usersList.querySelectorAll('[data-action="cancel"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        btn.closest('.user-editor').style.display = 'none';
      });
    });

    usersList.querySelectorAll('[data-action="save"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const item = btn.closest('.user-item');
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
        const item = btn.closest('.user-item');
        const id = item.dataset.id;
        const title = item.querySelector('.user-title')?.textContent || 'usuário';
        if (!(await uiConfirm(`Remover ${title}?`, { title: 'Equipe' }))) return;
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
      usersList.innerHTML = `<p class="empty">${e.message || 'Erro ao carregar usuários'}</p>`;
    }
  }

  async function criarUsuario() {
    const nome = String(novoNome.value || '').trim();
    const login = String(novoLogin.value || '').trim();
    const senha = novoSenha.value || '';
    const role = novoRole.value;

    if (!nome || !login || !senha) {
      await uiAlert('Preencha nome, login e senha.', 'warning');
      return;
    }

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

  if (!isDev()) {
    const roleOpt = Array.from(novoRole.options).find((o) => o.value === 'gerente');
    if (roleOpt) roleOpt.remove();
  } else if (!Array.from(novoRole.options).some((o) => o.value === 'dev')) {
    const devOpt = document.createElement('option');
    devOpt.value = 'dev';
    devOpt.textContent = 'Dev';
    novoRole.appendChild(devOpt);
  }

    btnSalvarCfg.addEventListener('click', saveCfg);
    impDestino?.addEventListener('change', async () => {
      const destino = normalizeDestinoValue(impDestino.value || 'balcao');
      if (printerCache[destino]) {
        fillPrinterForm(printerCache[destino]);
        return;
      }
      await loadPrinterCfg(destino);
    });
    btnVoltarPainel.addEventListener('click', () => (window.location.href = 'painel.html'));
    btnCriarUsuario.addEventListener('click', criarUsuario);
    impTipo?.addEventListener('change', atualizarCamposImpressora);
    btnSalvarImpressora?.addEventListener('click', salvarPrinterCfg);
    btnListarImpressoras?.addEventListener('click', listarImpressorasLocais);
    btnTesteImpressora?.addEventListener('click', testarImpressora);
    btnNovoDestino?.addEventListener('click', criarNovoDestino);
    btnExcluirDestino?.addEventListener('click', excluirDestinoAtual);
    pixQrArquivo?.addEventListener('change', async () => {
      const file = pixQrArquivo.files?.[0];
      if (!file) return;
      try {
        const dataUrl = await readFileAsDataUrl(file);
        setPixPreview(dataUrl);
        setPixStatus('Imagem do QR carregada. Clique em salvar.');
      } catch (e) {
        setPixStatus(e.message || 'Falha ao carregar QR', true);
      }
    });
    btnSalvarPix?.addEventListener('click', salvarPixCfg);
    filtroUsuario?.addEventListener('input', renderUsers);

    loadCfg();
    atualizarCamposImpressora();
    carregarListaImpressoras('balcao');
    listarUsuarios();
    loadPixCfg();
  });
