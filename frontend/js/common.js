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

  window.formatarMoedaBR = formatarMoedaBR;
  window.converterBufferParaValor = converterBufferParaValor;
  window.criarTeclado = criarTeclado;
})();
