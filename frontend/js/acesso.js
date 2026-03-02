(function () {
  const STORAGE_KEY = "pdv_perfil";
  const params = new URLSearchParams(window.location.search);

  const btnAdmin = document.getElementById("btnAdmin");
  const btnCliente = document.getElementById("btnCliente");
  const lembrarAcesso = document.getElementById("lembrarAcesso");

  function navegarParaPerfil(perfil) {
    const lembrar = lembrarAcesso && lembrarAcesso.checked;
    if (lembrar) {
      localStorage.setItem(STORAGE_KEY, perfil);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }

    if (perfil === "admin") {
      window.location.href = "admin.html";
      return;
    }

    const isMobile = window.matchMedia("(max-width: 900px)").matches;
    window.location.href = isMobile ? "garcom.html" : "painel.html";
  }

  btnAdmin?.addEventListener("click", function () {
    navegarParaPerfil("admin");
  });

  btnCliente?.addEventListener("click", function () {
    navegarParaPerfil("cliente");
  });

  const perfilViaQuery = params.get("perfil");
  if (perfilViaQuery === "admin" || perfilViaQuery === "cliente") {
    navegarParaPerfil(perfilViaQuery);
    return;
  }

  const perfilSalvo = localStorage.getItem(STORAGE_KEY);
  if (perfilSalvo === "admin" || perfilSalvo === "cliente") {
    navegarParaPerfil(perfilSalvo);
  }
})();
