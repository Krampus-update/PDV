(function () {
  const params = new URLSearchParams(window.location.search);
  const STORAGE_KEY = 'pdv_role';

  const tabLogin = document.getElementById('tabLogin');
  const tabCadastro = document.getElementById('tabCadastro');
  const painelLogin = document.getElementById('painelLogin');
  const painelCadastro = document.getElementById('painelCadastro');

  const lembrarAcesso = document.getElementById('lembrarAcesso');
  const loginRestaurante = document.getElementById('loginRestaurante');
  const loginInput = document.getElementById('loginUsuario');
  const senhaInput = document.getElementById('senhaUsuario');
  const btnEntrar = document.getElementById('btnEntrar');
  const statusLogin = document.getElementById('statusLogin');

  const cadCodigo = document.getElementById('cadCodigo');
  const cadNomeRestaurante = document.getElementById('cadNomeRestaurante');
  const cadNomeUsuario = document.getElementById('cadNomeUsuario');
  const cadLogin = document.getElementById('cadLogin');
  const cadSenha = document.getElementById('cadSenha');
  const btnCadastrar = document.getElementById('btnCadastrar');
  const statusCadastro = document.getElementById('statusCadastro');

  function setStatus(el, msg, isError) {
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('error', !!isError);
  }

  function activateTab(tab) {
    const onLogin = tab === 'login';
    tabLogin.classList.toggle('active', onLogin);
    tabCadastro.classList.toggle('active', !onLogin);
    painelLogin.classList.toggle('active', onLogin);
    painelCadastro.classList.toggle('active', !onLogin);
  }

  function navegarPorRole(role) {
    const lembrar = lembrarAcesso && lembrarAcesso.checked;
    if (lembrar) localStorage.setItem(STORAGE_KEY, role);
    else localStorage.removeItem(STORAGE_KEY);

    const next = (params.get('next') || '').toLowerCase();
    if (next && ['admin.html', 'index.html', 'painel.html', 'garcom.html', 'producao.html', 'configuracoes.html'].includes(next)) {
      window.location.href = next;
      return;
    }

    const isMobile = window.matchMedia('(max-width: 900px)').matches;
    window.location.href = isMobile ? 'garcom.html' : 'painel.html';
  }

  async function tentarSessaoExistente() {
    try {
      if (!API.getToken() || !API.getTenant()) return;
      const me = await API.me();
      if (!me?.usuario?.role) return;
      setStatus(statusLogin, 'Sessão ativa. Redirecionando...', false);
      navegarPorRole(me.usuario.role);
    } catch {
      API.setToken('');
      API.setTenant('');
      localStorage.removeItem('pdv_user');
    }
  }

  async function fazerLogin() {
    const restaurante = (loginRestaurante?.value || '').trim().toLowerCase();
    const login = (loginInput?.value || '').trim();
    const senha = senhaInput?.value || '';

    if (!restaurante || !login || !senha) {
      setStatus(statusLogin, 'Informe restaurante, usuário e senha.', true);
      return;
    }

    try {
      btnEntrar.disabled = true;
      btnEntrar.textContent = 'Entrando...';
      const resp = await API.login(restaurante, login, senha);
      API.setToken(resp.token);
      API.setTenant(resp.restaurante || restaurante);
      localStorage.setItem('pdv_user', JSON.stringify(resp.usuario));
      setStatus(statusLogin, 'Login realizado. Redirecionando...', false);
      navegarPorRole(resp.usuario.role);
    } catch (e) {
      setStatus(statusLogin, e.message || 'Falha no login', true);
    } finally {
      btnEntrar.disabled = false;
      btnEntrar.textContent = 'Entrar';
    }
  }

  async function fazerCadastro() {
    const restaurante_codigo = (cadCodigo?.value || '').trim().toLowerCase();
    const restaurante_nome = (cadNomeRestaurante?.value || '').trim();
    const nome = (cadNomeUsuario?.value || '').trim();
    const login = (cadLogin?.value || '').trim();
    const senha = cadSenha?.value || '';

    if (!restaurante_codigo || !nome || !login || !senha) {
      setStatus(statusCadastro, 'Preencha todos os campos obrigatórios.', true);
      return;
    }

    try {
      btnCadastrar.disabled = true;
      btnCadastrar.textContent = 'Criando...';
      await API.registrarRestaurante({
        restaurante_codigo,
        restaurante_nome,
        nome,
        login,
        senha
      });
      setStatus(statusCadastro, 'Conta criada com sucesso. Faça login na aba Entrar.', false);
      activateTab('login');
      loginRestaurante.value = restaurante_codigo;
      loginInput.value = login;
      senhaInput.focus();
    } catch (e) {
      setStatus(statusCadastro, e.message || 'Falha ao criar conta', true);
    } finally {
      btnCadastrar.disabled = false;
      btnCadastrar.textContent = 'Criar Restaurante + Conta';
    }
  }

  tabLogin?.addEventListener('click', () => activateTab('login'));
  tabCadastro?.addEventListener('click', () => activateTab('cadastro'));
  btnEntrar?.addEventListener('click', fazerLogin);
  btnCadastrar?.addEventListener('click', fazerCadastro);

  senhaInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') fazerLogin();
  });

  cadSenha?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') fazerCadastro();
  });

  try {
    const savedTenant = API.getTenant();
    if (savedTenant && loginRestaurante) loginRestaurante.value = savedTenant;
  } catch {
    // noop
  }

  activateTab('login');
  tentarSessaoExistente();
})();
