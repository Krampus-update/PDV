(async function () {
  const page = (window.location.pathname.split('/').pop() || '').toLowerCase();
  const publicPages = new Set(['', 'acesso.html']);

  if (publicPages.has(page)) return;

  function goLogin() {
    const next = encodeURIComponent(page || 'acesso.html');
    window.location.href = `acesso.html?next=${next}`;
  }

  function setupLogout(user, retry = 0) {
    let btn = document.querySelector('[data-action="logout"]') || document.getElementById('topLogout') || document.getElementById('btnLogout');
    if (!btn) {
      if (retry < 8) {
        setTimeout(() => setupLogout(user, retry + 1), 120);
        return;
      }
      btn = document.createElement('button');
      btn.id = 'btnLogout';
      btn.textContent = 'Sair';
      btn.style.cssText =
        'position:fixed;top:12px;right:12px;z-index:9999;padding:8px 12px;border:none;border-radius:8px;background:#111827;color:#fff;cursor:pointer;font-size:12px;';
      document.body.appendChild(btn);
    }
    btn.title = `Logado como ${user.nome} (${user.role})`;
    if (btn.dataset.boundLogout === '1') return;
    btn.dataset.boundLogout = '1';
    btn.addEventListener('click', async (e) => {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      try {
        await API.logout();
      } catch {
        API.setToken('');
        API.setTenant('');
      }
      localStorage.removeItem('pdv_user');
      window.location.href = 'acesso.html';
    });
  }

  try {
    const token = API.getToken();
    const tenant = API.getTenant();
    if (!token || !tenant) {
      goLogin();
      return;
    }
    const me = await API.me();
    const user = me?.usuario;
    if (!user) {
      goLogin();
      return;
    }

    const role = String(user.role || '').toLowerCase();
    const allowed = {
      dev: new Set(['painel.html', 'garcom.html', 'producao.html', 'configuracoes.html', 'admin.html', 'index.html', 'gerente.html', 'dev.html']),
      gerente: new Set(['painel.html', 'garcom.html', 'producao.html', 'configuracoes.html', 'admin.html', 'index.html', 'gerente.html']),
      funcionario: new Set(['painel.html', 'garcom.html', 'producao.html'])
    };
    const allowedPages = allowed[role] || allowed.funcionario;
    if (!allowedPages.has(page)) {
      window.location.href = 'painel.html';
      return;
    }

    localStorage.setItem('pdv_user', JSON.stringify(user));
    const sessionExpiresAt = me?.session?.expires_at ? new Date(me.session.expires_at).getTime() : 0;
    if (sessionExpiresAt && sessionExpiresAt - Date.now() < 2 * 60 * 60 * 1000) {
      API.refreshSession().catch(() => null);
    }
    if (page === 'index.html') {
      window.location.href = 'admin.html';
      return;
    }

    setupLogout(user);
  } catch {
    API.setToken('');
    API.setTenant('');
    localStorage.removeItem('pdv_user');
    goLogin();
  }
})();
