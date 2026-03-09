// Utilitários compartilhados entre as interfaces (painel, garçom, produção)

(function(){
  const NOTIF_LIMIT = 120;
  const NOTIF_KEY_PREFIX = 'pdv_notifs_';

  function getNotifKey(){
    const tenant = localStorage.getItem('pdv_tenant') || 'default';
    return `${NOTIF_KEY_PREFIX}${tenant}`;
  }

  function loadNotifs(){
    try{
      const arr = JSON.parse(localStorage.getItem(getNotifKey()) || '[]');
      return Array.isArray(arr) ? arr : [];
    }catch{
      return [];
    }
  }

  function saveNotifs(list){
    localStorage.setItem(getNotifKey(), JSON.stringify((list || []).slice(0, NOTIF_LIMIT)));
  }

  function ensureUIRoot(){
    let root = document.getElementById('pdvUiRoot');
    if(root) return root;
    root = document.createElement('div');
    root.id = 'pdvUiRoot';
    root.innerHTML = `
      <div id="pdvToastStack" class="pdv-toast-stack"></div>
      <div id="pdvDialogBackdrop" class="pdv-dialog-backdrop hidden"></div>
      <div id="pdvNotifCenter" class="pdv-notif-center hidden">
        <div class="pdv-notif-card">
          <div class="pdv-notif-head">
            <h3>Avisos</h3>
            <button type="button" id="pdvNotifClose" class="pdv-icon-btn">x</button>
          </div>
          <div id="pdvNotifList" class="pdv-notif-list"></div>
        </div>
      </div>
    `;
    document.body.appendChild(root);
    root.querySelector('#pdvNotifClose')?.addEventListener('click', ()=>toggleNotifCenter(false));
    root.querySelector('#pdvNotifCenter')?.addEventListener('click', (e)=>{
      if(e.target?.id === 'pdvNotifCenter') toggleNotifCenter(false);
    });
    return root;
  }

  function renderNotifCenter(){
    ensureUIRoot();
    const list = document.getElementById('pdvNotifList');
    if(!list) return;
    const notifs = loadNotifs();
    if(!notifs.length){
      list.innerHTML = '<p class="pdv-notif-empty">Sem avisos ainda.</p>';
      return;
    }
    list.innerHTML = notifs.map((n)=>
      `<div class="pdv-notif-item ${n.type || 'info'}">
        <div class="pdv-notif-title">${n.title || 'Aviso'}</div>
        <div class="pdv-notif-msg">${n.message || ''}</div>
        <div class="pdv-notif-time">${new Date(n.at).toLocaleString('pt-BR')}</div>
      </div>`
    ).join('');
  }

  function updateNotifBadge(){
    const badge = document.getElementById('pdvNotifBadge');
    if(!badge) return;
    const total = loadNotifs().length;
    badge.textContent = String(total);
    badge.style.display = total ? 'inline-flex' : 'none';
  }

  function toggleNotifCenter(show){
    ensureUIRoot();
    const center = document.getElementById('pdvNotifCenter');
    if(!center) return;
    if(show){
      renderNotifCenter();
      center.classList.remove('hidden');
      return;
    }
    center.classList.add('hidden');
  }

  function pushNotif({title='Aviso', message='', type='info', keepHistory=true}){
    ensureUIRoot();
    if(keepHistory){
      const list = loadNotifs();
      list.unshift({ title, message, type, at: new Date().toISOString() });
      saveNotifs(list);
      updateNotifBadge();
    }

    const stack = document.getElementById('pdvToastStack');
    if(!stack) return;
    const toast = document.createElement('div');
    toast.className = `pdv-toast ${type}`;
    toast.innerHTML = `<strong>${title}</strong><span>${message}</span>`;
    stack.appendChild(toast);
    setTimeout(()=>toast.classList.add('show'), 10);
    setTimeout(()=>{
      toast.classList.remove('show');
      setTimeout(()=>toast.remove(), 240);
    }, 2800);
  }

  function dialogBase({title='Aviso', message='', bodyHtml='', okLabel='OK', cancelLabel='Cancelar', showCancel=false}){
    ensureUIRoot();
    const backdrop = document.getElementById('pdvDialogBackdrop');
    if(!backdrop) return null;
    backdrop.classList.remove('hidden');
    backdrop.innerHTML = `
      <div class="pdv-dialog-card" role="dialog" aria-modal="true">
        <div class="pdv-dialog-head"><h3>${title}</h3></div>
        <div class="pdv-dialog-body">
          ${message ? `<p>${message}</p>` : ''}
          ${bodyHtml || ''}
        </div>
        <div class="pdv-dialog-actions">
          ${showCancel ? `<button type="button" class="btn btn-secondary" data-action="cancel">${cancelLabel}</button>` : ''}
          <button type="button" class="btn btn-primary" data-action="ok">${okLabel}</button>
        </div>
      </div>
    `;
    return backdrop;
  }

  function closeDialog(){
    const backdrop = document.getElementById('pdvDialogBackdrop');
    if(!backdrop) return;
    backdrop.classList.add('hidden');
    backdrop.innerHTML = '';
  }

  function uiAlert(message, type='info', title='Aviso'){
    return new Promise((resolve)=>{
      pushNotif({title, message, type, keepHistory:true});
      const backdrop = dialogBase({ title, message, okLabel: 'OK' });
      if(!backdrop) return resolve();
      backdrop.addEventListener('click', (e)=>{
        if(e.target?.dataset?.action === 'ok' || e.target === backdrop){
          closeDialog();
          resolve();
        }
      });
    });
  }

  function uiConfirm(message, {title='Confirmar', okLabel='Confirmar', cancelLabel='Cancelar'} = {}){
    return new Promise((resolve)=>{
      const backdrop = dialogBase({ title, message, okLabel, cancelLabel, showCancel: true });
      if(!backdrop) return resolve(false);
      backdrop.addEventListener('click', (e)=>{
        if(e.target === backdrop || e.target?.dataset?.action === 'cancel'){
          closeDialog();
          resolve(false);
        }
        if(e.target?.dataset?.action === 'ok'){
          closeDialog();
          resolve(true);
        }
      });
    });
  }

  function uiPrompt({title='Entrada', message='', placeholder='', value='', okLabel='Confirmar', cancelLabel='Cancelar'}){
    return new Promise((resolve)=>{
      const inputId = `pdvPromptInput_${Date.now()}`;
      const backdrop = dialogBase({
        title,
        message,
        bodyHtml: `<input id="${inputId}" class="input-field" placeholder="${placeholder}" value="${String(value || '').replace(/"/g, '&quot;')}" />`,
        okLabel,
        cancelLabel,
        showCancel: true
      });
      if(!backdrop) return resolve(null);
      const input = backdrop.querySelector(`#${inputId}`);
      setTimeout(()=>input?.focus(), 30);

      const done = (val)=>{
        closeDialog();
        resolve(val);
      };

      input?.addEventListener('keydown', (e)=>{
        if(e.key === 'Enter') done(input.value);
      });

      backdrop.addEventListener('click', (e)=>{
        if(e.target === backdrop || e.target?.dataset?.action === 'cancel') return done(null);
        if(e.target?.dataset?.action === 'ok') return done(input ? input.value : null);
      });
    });
  }

  function uiChoose({title='Selecione', message='', items=[], okLabel='Selecionar', cancelLabel='Cancelar', allowNull=true}){
    return new Promise((resolve)=>{
      const listHtml = items.map((it, idx)=>
        `<label class="pdv-choice-item">
           <input type="radio" name="pdvChoice" value="${idx}">
           <span><strong>${it.label}</strong>${it.meta ? `<small>${it.meta}</small>` : ''}</span>
         </label>`
      ).join('');
      const backdrop = dialogBase({
        title,
        message,
        bodyHtml: `<div class="pdv-choice-list">${listHtml || '<p class="pdv-notif-empty">Nenhuma opção disponível.</p>'}</div>`,
        okLabel,
        cancelLabel,
        showCancel: true
      });
      if(!backdrop) return resolve(null);
      const first = backdrop.querySelector('input[name="pdvChoice"]');
      if(first) first.checked = true;

      backdrop.addEventListener('click', (e)=>{
        if(e.target === backdrop || e.target?.dataset?.action === 'cancel'){
          closeDialog();
          resolve(null);
        }
        if(e.target?.dataset?.action === 'ok'){
          const selected = backdrop.querySelector('input[name="pdvChoice"]:checked');
          if(!selected){
            if(allowNull){
              closeDialog();
              return resolve(null);
            }
            return;
          }
          const idx = Number(selected.value);
          const item = items[idx] || null;
          closeDialog();
          resolve(item ? item.value : null);
        }
      });
    });
  }

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

    let notifBtn = document.getElementById('pdvNotifTrigger');
    if(!notifBtn){
      notifBtn = document.createElement('button');
      notifBtn.id = 'pdvNotifTrigger';
      notifBtn.className = 'btn-topbar';
      notifBtn.type = 'button';
      notifBtn.innerHTML = `Avisos <span id="pdvNotifBadge" class="pdv-notif-badge" style="display:none">0</span>`;
      const topbarRight = document.querySelector('.topbar-right');
      if(topbarRight) topbarRight.insertBefore(notifBtn, topbarRight.firstChild);
      notifBtn.addEventListener('click', ()=>toggleNotifCenter(true));
    }
    updateNotifBadge();
  }

  window.formatarMoedaBR = formatarMoedaBR;
  window.converterBufferParaValor = converterBufferParaValor;
  window.criarTeclado = criarTeclado;
  window.initRealtime = initRealtime;
  window.initTopbarContext = initTopbarContext;
  window.PDVUI = {
    notify: pushNotif,
    alert: uiAlert,
    confirm: uiConfirm,
    prompt: uiPrompt,
    choose: uiChoose,
    openNotificationCenter: () => toggleNotifCenter(true)
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initTopbarContext);
  }else{
    initTopbarContext();
  }
})();
