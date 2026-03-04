// Utilitários compartilhados entre as interfaces (painel, garçom, produção)

(function(){
  // formata moeda (usa formatarMoeda de api.js se disponível)
  function formatarMoedaBR(v){
    const n = Number(v||0);
    if(window.formatarMoeda) return window.formatarMoeda(n);
    return n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  }

  function converterBufferParaValor(buffer){
    if(!buffer) return 0;
    let v = String(buffer).replace(',', '.');
    if(v.includes('.')){
      const n = parseFloat(v);
      return isNaN(n) ? null : n;
    }
    let reais = 0, centavos = v;
    if(centavos.length > 2){
      reais = parseInt(centavos.slice(0,-2));
      centavos = centavos.slice(-2);
    } else {
      centavos = centavos.padStart(2,'0');
    }
    const n = reais + parseInt(centavos)/100;
    return isNaN(n) ? null : n;
  }

  function criarTeclado(container, display){
    if(!container) return null;
    const max = 6;
    const teclas = ['7','8','9','4','5','6','1','2','3','0',','];
    let buffer = '';
    const update = ()=>{ if(display) display.textContent = formatarMoedaBR(converterBufferParaValor(buffer)||0); };
    container.innerHTML = '';
    teclas.forEach(k=>{
      const btn = document.createElement('button');
      btn.className = 'pad-key' + (k === ',' ? ' secondary' : '');
      btn.style.fontSize = '14px';
      btn.textContent = k;
      btn.addEventListener('click', (e)=>{
        e.preventDefault();
        if(k === ','){
          if(buffer.includes(',')) return;
          buffer += k;
        } else {
          if(buffer.length < max) buffer += k;
        }
        update();
      });
      container.appendChild(btn);
    });
    // botão de backspace
    const btnBackspace = document.createElement('button');
    btnBackspace.className = 'pad-key secondary';
    btnBackspace.style.fontSize = '14px';
    btnBackspace.textContent = '⌫';
    btnBackspace.addEventListener('click', (e)=>{
      e.preventDefault();
      if(buffer.length > 0){
        buffer = buffer.slice(0, -1);
        update();
      }
    });
    container.appendChild(btnBackspace);
    return {
      clear(){ buffer=''; update(); },
      getValue(){ return converterBufferParaValor(buffer); },
      setValue(v){
        const n = Number(String(v).replace(',', '.'));
        if(isNaN(n) || n < 0){
          buffer = '';
          update();
          return;
        }
        // Mantem consistencia do teclado: buffer sem separador = centavos.
        buffer = String(Math.round(n * 100));
        update();
      },
      container
    };
  }

  function initRealtime(onMessage){
    try{
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${window.location.hostname}:3000/ws`);
      ws.onmessage = (evt)=>{
        try{
          const data = JSON.parse(evt.data);
          if(typeof onMessage === 'function') onMessage(data);
        }catch{}
      };
      ws.onerror = ()=>{};
      return ws;
    }catch{
      return null;
    }
  }

  function userInitials(nome){
    const base = String(nome || '').trim();
    if(!base) return 'US';
    const parts = base.split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0] || 'U';
    const b = parts.length > 1 ? (parts[parts.length - 1]?.[0] || '') : '';
    return `${a}${b}`.toUpperCase();
  }

  function initTopbarContext(retry){
    const attempt = Number(retry || 0);
    const user = JSON.parse(localStorage.getItem('pdv_user') || '{}');
    const tenant = localStorage.getItem('pdv_tenant') || '';
    const cfg = JSON.parse(localStorage.getItem('pdv_config') || '{}');
    if((!user || !user.role) && tenant && attempt < 10){
      setTimeout(()=>initTopbarContext(attempt + 1), 150);
      return;
    }

    const restauranteNome = cfg.nome || (tenant ? `Restaurante ${tenant}` : 'Restaurante');
    if(cfg.cor){
      document.documentElement.style.setProperty('--primary', cfg.cor);
    }
    const nomeEl = document.getElementById('topRestaurantName');
    if(nomeEl) nomeEl.textContent = restauranteNome;

    const metaEl = document.getElementById('topRestaurantMeta');
    if(metaEl) metaEl.textContent = tenant ? `Tenant: ${tenant}` : 'Tenant não definido';

    const userNameEl = document.getElementById('topUserName');
    if(userNameEl) userNameEl.textContent = user.nome || user.login || 'Usuário';

    const avatarEl = document.getElementById('topUserAvatar');
    if(avatarEl) avatarEl.textContent = userInitials(user.nome || user.login || 'Usuario');

    const userRoleEl = document.getElementById('topUserRole');
    if(userRoleEl) userRoleEl.textContent = user.role ? `Perfil: ${user.role}` : '';

    initUserMenu();
  }

  function initUserMenu(){
    const trigger = document.getElementById('topUserTrigger');
    const menu = document.getElementById('topUserMenu');
    if(!trigger || !menu) return;

    const user = JSON.parse(localStorage.getItem('pdv_user') || '{}');
    const role = String(user.role || '').toLowerCase();
    const canManage = role === 'gerente' || role === 'dev';
    const canAdmin = role === 'gerente' || role === 'dev';

    const operacaoLinks = [
      '<a href="painel.html">Painel</a>',
      '<a href="garcom.html">Garçom</a>',
      '<a href="producao.html">Cozinha</a>'
    ].join('');

    const gestaoLinks = [
      canAdmin ? '<a href="admin.html">Admin</a>' : '',
      canManage ? '<button type="button" data-action="open-config">Configurações</button>' : ''
    ].filter(Boolean).join('');

    menu.innerHTML = `
      <div class="user-menu-group-title">Operação</div>
      ${operacaoLinks}
      ${gestaoLinks ? `<div class="user-menu-sep"></div><div class="user-menu-group-title">Gestão</div>${gestaoLinks}` : ''}
      <div class="user-menu-sep"></div>
      <div class="user-menu-group-title">Sessão</div>
      <button type="button" data-action="logout">Sair</button>
    `;

    const closeMenu = () => menu.classList.add('hidden');
    const openMenu = () => menu.classList.remove('hidden');
    const toggleMenu = () => menu.classList.toggle('hidden');

    trigger.addEventListener('click', (e)=>{
      e.preventDefault();
      e.stopPropagation();
      toggleMenu();
    });

    menu.addEventListener('click', (e)=>{
      const action = e.target?.dataset?.action;
      if(!action) return;
      if(action === 'logout'){
        // o auth-guard escuta esse elemento
        closeMenu();
        return;
      }
      if(action === 'open-config'){
        closeMenu();
        if(window.PDVConfigModal && typeof window.PDVConfigModal.open === 'function'){
          window.PDVConfigModal.open();
        }
      }
    });

    document.addEventListener('click', (e)=>{
      if(menu.classList.contains('hidden')) return;
      if(!menu.contains(e.target) && !trigger.contains(e.target)) closeMenu();
    });

    openMenu();
    closeMenu();
  }

  window.formatarMoedaBR = formatarMoedaBR;
  window.converterBufferParaValor = converterBufferParaValor;
  window.criarTeclado = criarTeclado;
  window.initRealtime = initRealtime;
  window.initTopbarContext = initTopbarContext;

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initTopbarContext);
  }else{
    initTopbarContext();
  }
})();
