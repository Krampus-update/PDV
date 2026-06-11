document.addEventListener('DOMContentLoaded', () => {
  const ui = window.PDVUI || {};
  const uiNotify = (message, type = 'info') =>
    ui.notify ? ui.notify({ title: 'Aviso', message, type, keepHistory: true }) : console.log(`[${type}] ${message}`);

  const maintenanceInfoEl = document.getElementById('devMaintenanceInfo');
  const tenantsListEl = document.getElementById('devTenantsList');
  const backupsListEl = document.getElementById('devBackupsList');
  const setMaintenanceInfo = (message) => {
    if (maintenanceInfoEl) maintenanceInfoEl.textContent = message;
  };

  async function renderBackups() {
    if (!backupsListEl) return;
    backupsListEl.textContent = 'Carregando...';
    try {
      const backups = await API.listarBackups();
      if (!backups?.length) {
        backupsListEl.innerHTML = '<div class="dev-meta">Nenhum backup encontrado.</div>';
        return;
      }
      backupsListEl.innerHTML = backups
        .slice(0, 8)
        .map((b) => {
          const nome = String(b.nome || b.file || b.path || 'backup');
          const data = String(b.created_at || b.mtime || '-');
          const size = b.size ? `${Math.round(Number(b.size) / 1024)} KB` : '';
          const arquivo = String(b.caminho || b.arquivo || b.file || '');
          return `
            <div class="dev-tenant-row">
              <div>
                <div><strong>${nome}</strong></div>
                <div class="meta">${data}${size ? ` • ${size}` : ''}</div>
              </div>
              <div class="dev-tenant-actions">
                <button type="button" class="btn btn-secondary btn-soft" data-backup-delete="${arquivo}">Excluir</button>
              </div>
            </div>
          `;
        })
        .join('');
      backupsListEl.querySelectorAll('[data-backup-delete]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const arquivo = btn.getAttribute('data-backup-delete');
          if (!arquivo) return;
          const confirm = ui.confirm
            ? await ui.confirm('Excluir este backup?', { title: 'Excluir backup', okLabel: 'Excluir' })
            : window.confirm('Excluir este backup?');
          if (!confirm) return;
          try {
            await API.removerBackup(arquivo);
            uiNotify('Backup removido', 'success');
            await renderBackups();
          } catch (error) {
            uiNotify(error.message || 'Falha ao excluir backup', 'error');
          }
        });
      });
    } catch (error) {
      backupsListEl.innerHTML = `<div class="dev-meta">Falha ao carregar backups: ${error.message || 'erro'}</div>`;
    }
  }

  async function renderTenants() {
    if (!tenantsListEl) return;
    tenantsListEl.textContent = 'Carregando...';
    try {
      const tenants = await API.listarTenants();
      const currentTenant = API.getTenant();
      if (!tenants?.length) {
        tenantsListEl.innerHTML = '<div class="dev-meta">Nenhuma loja cadastrada.</div>';
        return;
      }
      tenantsListEl.innerHTML = tenants
        .map((tenant) => {
          const active = String(tenant.code) === String(currentTenant) ? 'active' : '';
          const status = Number(tenant.ativo || 0) === 1 ? 'Ativa' : 'Inativa';
          return `
            <div class="dev-tenant-row ${active}">
              <div>
                <div><strong>${tenant.nome || tenant.code}</strong> <span class="meta">#${tenant.code}</span></div>
                <div class="meta">${status} • criada em ${tenant.created_at || '-'}</div>
              </div>
              <div class="dev-tenant-actions">
                <button type="button" class="btn btn-secondary btn-soft" data-tenant-use="${tenant.code}">Usar</button>
                <button type="button" class="btn btn-secondary btn-soft" data-tenant-delete="${tenant.code}" ${String(tenant.code) === 'default' ? 'disabled' : ''}>Excluir</button>
              </div>
            </div>
          `;
        })
        .join('');
      tenantsListEl.querySelectorAll('[data-tenant-use]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const code = btn.getAttribute('data-tenant-use');
          if (!code) return;
          API.setTenant(code);
          API.setToken('');
          localStorage.removeItem('pdv_user');
          window.location.href = 'acesso.html';
        });
      });
      tenantsListEl.querySelectorAll('[data-tenant-delete]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const code = btn.getAttribute('data-tenant-delete');
          if (!code) return;
          const confirm = ui.confirm
            ? await ui.confirm(`Excluir a loja ${code}?`, { title: 'Excluir loja', okLabel: 'Excluir' })
            : window.confirm(`Excluir a loja ${code}?`);
          if (!confirm) return;
          try {
            const resp = await API.removerTenant(code);
            uiNotify(`Loja ${resp.tenant} removida`, 'success');
            if (resp.deletedCurrent) {
              API.setTenant('');
              API.setToken('');
              localStorage.removeItem('pdv_user');
              window.location.href = 'acesso.html';
              return;
            }
            await renderTenants();
            await renderBackups();
          } catch (error) {
            uiNotify(error.message || 'Falha ao excluir loja', 'error');
          }
        });
      });
    } catch (error) {
      tenantsListEl.innerHTML = `<div class="dev-meta">Falha ao carregar lojas: ${error.message || 'erro'}</div>`;
    }
  }

  async function criarLoja() {
    const code = ui.prompt
      ? await ui.prompt({
          title: 'Criar loja',
          message: 'Código da loja/tenant (3-40 chars, a-z, 0-9, _ e -)',
          placeholder: 'ex: restaurante01',
          value: ''
        })
      : null;
    if (!code) return;
    const nome = ui.prompt
      ? await ui.prompt({
          title: 'Criar loja',
          message: 'Nome exibido da loja',
          placeholder: 'Nome da loja',
          value: ''
        })
      : null;
    if (!nome) return;
    const gerenteNome = ui.prompt
      ? await ui.prompt({
          title: 'Criar loja',
          message: 'Nome do gerente inicial',
          placeholder: 'Gerente',
          value: ''
        })
      : null;
    if (!gerenteNome) return;
    const gerenteLogin = ui.prompt
      ? await ui.prompt({
          title: 'Criar loja',
          message: 'Login do gerente inicial',
          placeholder: 'admin',
          value: ''
        })
      : null;
    if (!gerenteLogin) return;
    const gerenteSenha = ui.prompt
      ? await ui.prompt({
          title: 'Criar loja',
          message: 'Senha inicial do gerente',
          placeholder: 'senha inicial',
          value: ''
        })
      : null;
    if (!gerenteSenha) return;

    try {
      const resp = await API.criarTenant({
        code: String(code).trim(),
        nome: String(nome).trim(),
        gerente_nome: String(gerenteNome).trim(),
        gerente_login: String(gerenteLogin).trim(),
        gerente_senha: String(gerenteSenha).trim()
      });
      uiNotify(`Loja ${resp.tenant} criada com sucesso`, 'success');
      await renderTenants();
    } catch (error) {
      uiNotify(error.message || 'Falha ao criar loja', 'error');
    }
  }

  async function carregarInfo() {
    const token = API.getToken() || '';
    const tenant = API.getTenant() || '';
    const user = JSON.parse(localStorage.getItem('pdv_user') || '{}');
    const masked = token ? `${token.slice(0, 6)}...${token.slice(-6)}` : 'Sem token';

    const envEl = document.getElementById('devEnvInfo');
    if (envEl) {
      envEl.innerHTML = `
        Tenant: <strong>${tenant || '-'}</strong><br>
        Usuário: <strong>${user.nome || user.login || '-'}</strong><br>
        Perfil: <strong>${user.role || '-'}</strong>
      `;
    }
    const tokenEl = document.getElementById('devTokenInfo');
    if (tokenEl) tokenEl.textContent = masked;

    try {
      const status = await API.request('GET', '/status');
      const statusEl = document.getElementById('devStatusInfo');
      if (statusEl) statusEl.textContent = status?.status ? `Status: ${status.status}` : 'Status OK';
    } catch {
      const statusEl = document.getElementById('devStatusInfo');
      if (statusEl) statusEl.textContent = 'Falha ao obter status';
    }

    try {
      const versao = await API.request('GET', '/version');
      const vEl = document.getElementById('devVersionInfo');
      if (vEl) vEl.innerHTML = `Backend: <strong>${versao.backend || '-'}</strong><br>Frontend: <strong>${versao.frontend || '-'}</strong>`;
    } catch {
      const vEl = document.getElementById('devVersionInfo');
      if (vEl) vEl.textContent = 'Versões indisponíveis';
    }

    try {
      const maint = await API.obterStatusDev();
      setMaintenanceInfo(
        `Tenant: ${maint?.tenant || '-'} | Banco atual: ${maint?.tenantDbExists ? 'ok' : 'ausente'} | Auto-start: ${maint?.autostartInstalled ? 'ativo' : 'inativo'}`
      );
    } catch {
      setMaintenanceInfo('Status de manutenção indisponível');
    }

    await renderTenants();
    await renderBackups();
  }

  document.getElementById('btnDevLimparCache')?.addEventListener('click', () => {
    localStorage.removeItem('pdv_config');
    localStorage.removeItem('pdv_user');
    uiNotify('Cache local limpo', 'success');
  });
  document.getElementById('btnDevRecarregar')?.addEventListener('click', () => window.location.reload());
  document.getElementById('btnDevConfig')?.addEventListener('click', () => {
    if (window.PDVConfigModal && typeof window.PDVConfigModal.open === 'function') {
      window.PDVConfigModal.open();
    } else {
      uiNotify('Configurações indisponíveis', 'warning');
    }
  });
  document.getElementById('btnDevNovaLoja')?.addEventListener('click', criarLoja);
  document.getElementById('btnDevRecarregarLojas')?.addEventListener('click', renderTenants);
  document.getElementById('btnDevReloadBackups')?.addEventListener('click', renderBackups);
  document.getElementById('btnDevBackupNow')?.addEventListener('click', async () => {
    try {
      const resp = await API.executarBackup();
      uiNotify(`Backup gerado em ${resp.arquivo || 'arquivo desconhecido'}`, 'success');
      await renderBackups();
    } catch (error) {
      uiNotify(error.message || 'Falha ao gerar backup', 'error');
    }
  });
  document.getElementById('btnDevResetDb')?.addEventListener('click', async () => {
    const confirm = ui.confirm
      ? await ui.confirm('Isso vai apagar o banco do tenant atual e recriá-lo na próxima entrada. Continuar?', {
          title: 'Resetar banco',
          okLabel: 'Resetar'
        })
      : window.confirm('Isso vai apagar o banco do tenant atual e recriá-lo na próxima entrada. Continuar?');
    if (!confirm) return;
    try {
      const resp = await API.resetarBancoAtual();
      uiNotify(`Banco resetado para o tenant ${resp.tenant}. Backup em ${resp.backupPath}`, 'success');
      await carregarInfo();
    } catch (error) {
      uiNotify(error.message || 'Falha ao resetar banco', 'error');
    }
  });
  document.getElementById('btnDevInstallAutostart')?.addEventListener('click', async () => {
    try {
      const resp = await API.ativarAutostart();
      uiNotify(`Auto-start ativado em ${resp.shortcutPath}`, 'success');
      await carregarInfo();
    } catch (error) {
      uiNotify(error.message || 'Falha ao ativar auto-start', 'error');
    }
  });
  document.getElementById('btnDevRemoveAutostart')?.addEventListener('click', async () => {
    try {
      const resp = await API.desativarAutostart();
      uiNotify(`Auto-start desativado em ${resp.shortcutPath}`, 'success');
      await carregarInfo();
    } catch (error) {
      uiNotify(error.message || 'Falha ao desativar auto-start', 'error');
    }
  });

  carregarInfo();
});
