// ===================================
// Configuração da API
// ===================================

// Auto-detectar IP local (ou usar localhost se em desenvolvimento)
const API_BASE = `http://${window.location.hostname}:3000/api`;

console.log(`🔗 API Base: ${API_BASE}`);

// ===================================
// Classe API
// ===================================

class API {
    static getToken() {
        return localStorage.getItem('pdv_token') || '';
    }

    static setToken(token) {
        if (token) localStorage.setItem('pdv_token', token);
        else localStorage.removeItem('pdv_token');
    }

    static getTenant() {
        return localStorage.getItem('pdv_tenant') || '';
    }

    static setTenant(tenant) {
        if (tenant) localStorage.setItem('pdv_tenant', tenant);
        else localStorage.removeItem('pdv_tenant');
    }

    static async request(method, endpoint, data = null) {
        try {
            const token = this.getToken();
            const tenant = this.getTenant();
            const options = {
                method,
                headers: {
                    'Content-Type': 'application/json'
                }
            };
            if (token) {
                options.headers.Authorization = `Bearer ${token}`;
            }
            if (tenant) {
                options.headers['x-tenant-code'] = tenant;
            }

            if (data) {
                options.body = JSON.stringify(data);
            }

            const response = await fetch(`${API_BASE}${endpoint}`, options);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `Erro ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`Erro na requisição ${method} ${endpoint}:`, error);
            throw error;
        }
    }

    // ===== PRODUTOS =====
    static async obterProdutos(incluir_inativos = false) {
        return this.request('GET', `/produtos?incluir_inativos=${incluir_inativos}`);
    }

    static async obterProduto(id) {
        return this.request('GET', `/produtos/${id}`);
    }

    static async criarProduto(dados) {
        return this.request('POST', '/produtos', dados);
    }

    static async criarProdutosLote(categoria, itens) {
        return this.request('POST', '/produtos/lote', { categoria, itens });
    }

    static async renomearCategoria(categoriaAtual, categoriaNova) {
        return this.request('PUT', '/produtos/categoria/renomear', {
            categoria_atual: categoriaAtual,
            categoria_nova: categoriaNova
        });
    }

    static async atualizarProduto(id, dados) {
        return this.request('PUT', `/produtos/${id}`, dados);
    }

    static async deletarProduto(id) {
        return this.request('DELETE', `/produtos/${id}`);
    }

    // ===== AUTH =====
    static async registrarRestaurante(dados) {
        return this.request('POST', '/auth/registrar', dados);
    }

    static async login(restaurante, login, senha) {
        return this.request('POST', '/auth/login', { restaurante, login, senha });
    }

    static async me() {
        return this.request('GET', '/auth/me');
    }

    static async refreshSession() {
        return this.request('POST', '/auth/refresh');
    }

    static async logout() {
        const resp = await this.request('POST', '/auth/logout');
        this.setToken('');
        this.setTenant('');
        localStorage.removeItem('pdv_user');
        return resp;
    }

    static async listarUsuarios() {
        return this.request('GET', '/auth/usuarios');
    }

    static async criarUsuario(dados) {
        return this.request('POST', '/auth/usuarios', dados);
    }

    static async atualizarUsuario(id, dados) {
        return this.request('PUT', `/auth/usuarios/${id}`, dados);
    }

    static async removerUsuario(id) {
        try {
            return await this.request('DELETE', `/auth/usuarios/${id}`);
        } catch (error) {
            // Compatibilidade com versões antigas que só tinham "desativar" por PUT.
            return this.request('PUT', `/auth/usuarios/${id}`, { ativo: false });
        }
    }

    // ===== IMPRESSÃO TÉRMICA =====
    static async listarConfigsImpressao() {
        return this.request('GET', '/impressao/configs');
    }

    static async obterConfigImpressao(destino = 'balcao') {
        const query = destino ? `?destino=${encodeURIComponent(destino)}` : '';
        return this.request('GET', `/impressao/config${query}`);
    }

    static async salvarConfigImpressao(dados, destino = 'balcao') {
        return this.request('PUT', `/impressao/config?destino=${encodeURIComponent(destino)}`, {
            ...(dados || {}),
            destino
        });
    }

    static async removerConfigImpressao(destino = 'balcao') {
        const query = destino ? `?destino=${encodeURIComponent(destino)}` : '';
        return this.request('DELETE', `/impressao/config${query}`);
    }

    static async listarImpressorasLocais() {
        return this.request('GET', '/impressao/locais');
    }

    static async testarImpressora(destino = 'balcao') {
        const query = destino ? `?destino=${encodeURIComponent(destino)}` : '';
        return this.request('POST', `/impressao/teste${query}`);
    }

    static async imprimirVenda(vendaId, destino = 'balcao') {
        return this.request('POST', `/impressao/venda/${vendaId}?destino=${encodeURIComponent(destino)}`);
    }

    // ===== VENDAS =====
    static async criarVenda(tipo, mesa = null) {
        return this.request('POST', '/vendas', { tipo, mesa });
    }

    static async criarVendaComCliente(tipo, mesa = null, cliente_id = null) {
        return this.request('POST', '/vendas', { tipo, mesa, cliente_id });
    }

    static async obterVenda(id) {
        return this.request('GET', `/vendas/${id}`);
    }

    static async obterVendas(filtros = {}) {
        const params = new URLSearchParams();
        if (filtros.tipo) params.append('tipo', filtros.tipo);
        if (filtros.status) params.append('status', filtros.status);

        const query = params.toString() ? `?${params.toString()}` : '';
        return this.request('GET', `/vendas${query}`);
    }

    static async obterVendasAbertas(tipo = null) {
        const query = tipo ? `?tipo=${tipo}` : '';
        return this.request('GET', `/vendas/abertas${query}`);
    }

    // ===== CAIXA =====
    static async obterCaixaAtual() {
        return this.request('GET', '/caixa/atual');
    }

    static async abrirCaixa(saldo_inicial = 0) {
        return this.request('POST', '/caixa/abrir', { saldo_inicial });
    }

    static async fecharCaixa(saldo_final = null, observacoes = '') {
        return this.request('POST', '/caixa/fechar', { saldo_final, observacoes });
    }

    static async obterResumoDiaCaixa(data = null) {
        const query = data ? `?data=${encodeURIComponent(data)}` : '';
        return this.request('GET', `/caixa/resumo-dia${query}`);
    }

    static async listarHistoricoCaixa(limite = 30) {
        return this.request('GET', `/caixa/historico?limite=${encodeURIComponent(limite)}`);
    }

    static async obterEmPreparo() {
        return this.request('GET', '/vendas/preparacao/em-preparo');
    }

    static async obterProducao(status = 'em_preparo') {
        const query = status ? `?status=${encodeURIComponent(status)}` : '';
        return this.request('GET', `/vendas/preparacao${query}`);
    }

    // ===== RELATÓRIOS =====
    static async relatorioResumo(periodo = 'hoje') {
        return this.request('GET', `/relatorios/resumo?periodo=${encodeURIComponent(periodo)}`);
    }

    static async relatorioProdutos(limite = 20) {
        return this.request('GET', `/relatorios/produtos?limite=${encodeURIComponent(limite)}`);
    }

    // ===== BACKUP =====
    static async listarBackups() {
        return this.request('GET', '/backup');
    }

    static async executarBackup() {
        return this.request('POST', '/backup/executar');
    }

    static async removerBackup(arquivo) {
        const query = arquivo ? `?arquivo=${encodeURIComponent(arquivo)}` : '';
        return this.request('DELETE', `/backup${query}`);
    }

    static async obterStatusDev() {
        return this.request('GET', '/dev/maintenance/status');
    }

    static async resetarBancoAtual() {
        return this.request('POST', '/dev/maintenance/reset-db');
    }

    static async ativarAutostart() {
        return this.request('POST', '/dev/maintenance/autostart/install');
    }

    static async desativarAutostart() {
        return this.request('POST', '/dev/maintenance/autostart/remove');
    }

    static async listarTenants() {
        return this.request('GET', '/dev/tenants');
    }

    static async criarTenant(dados) {
        return this.request('POST', '/dev/tenants', dados);
    }

    static async removerTenant(code) {
        return this.request('DELETE', `/dev/tenants/${encodeURIComponent(code)}`);
    }

    // ===== HISTÓRICO =====
    static async listarHistorico(limite = 100) {
        return this.request('GET', `/historico?limite=${encodeURIComponent(limite)}`);
    }

    // ===== CLIENTES =====
    static async obterClientes(busca = '') {
        const query = busca ? `?busca=${encodeURIComponent(busca)}` : '';
        return this.request('GET', `/clientes${query}`);
    }

    static async criarCliente(dados) {
        return this.request('POST', '/clientes', dados);
    }

    static async atualizarCliente(id, dados) {
        return this.request('PUT', `/clientes/${id}`, dados);
    }

    static async removerCliente(id) {
        return this.request('DELETE', `/clientes/${id}`);
    }

    static async obterHistoricoCliente(id, limite = 30) {
        return this.request('GET', `/clientes/${id}/historico?limite=${encodeURIComponent(limite)}`);
    }

    // ===== ITENS DA VENDA =====
    static async adicionarItem(vendaId, produtoId, quantidade, extras = {}) {
        return this.request('POST', `/vendas/${vendaId}/itens`, {
            produto_id: produtoId,
            quantidade,
            ...extras
        });
    }

    static async atualizarItem(vendaId, itemId, quantidade) {
        return this.request('PUT', `/vendas/${vendaId}/itens/${itemId}`, {
            quantidade
        });
    }

    static async atualizarStatusItem(vendaId, itemId, statusItem) {
        return this.request('PUT', `/vendas/${vendaId}/itens/${itemId}/status`, {
            status_item: statusItem
        });
    }

    static async removerItem(vendaId, itemId) {
        return this.request('DELETE', `/vendas/${vendaId}/itens/${itemId}`);
    }

    // ===== OPERAÇÕES NA VENDA =====
    static async fecharVenda(vendaId, formaPagamento, observacoes = '', extras = {}) {
        return this.request('PUT', `/vendas/${vendaId}/fechar`, {
            forma_pagamento: formaPagamento,
            observacoes,
            ...extras
        });
    }

    static async marcarPronto(vendaId) {
        return this.request('PUT', `/vendas/${vendaId}/marcar-pronto`);
    }

    static async atualizarStatus(vendaId, status) {
        return this.request('PUT', `/vendas/${vendaId}/status`, {
            status
        });
    }

    static async aprovarAutoatendimento(vendaId) {
        return this.request('PUT', `/vendas/${vendaId}/auto/aprovar`);
    }

    static async recusarAutoatendimento(vendaId, motivo = '') {
        return this.request('PUT', `/vendas/${vendaId}/auto/recusar`, { motivo });
    }

    static async vincularClienteVenda(vendaId, cliente_id = null) {
        return this.request('PUT', `/vendas/${vendaId}/cliente`, { cliente_id });
    }

    static async reabrirVenda(vendaId) {
        return this.request('PUT', `/vendas/${vendaId}/reabrir`);
    }

    static async aplicarFinanceiroVenda(vendaId, dados) {
        return this.request('PUT', `/vendas/${vendaId}/financeiro`, dados || {});
    }

    static async simularDivisaoVenda(vendaId, modo = 'valor_igual', pessoas = 2) {
        return this.request('POST', `/vendas/${vendaId}/divisao`, { modo, pessoas });
    }

    // ===== PIX =====
    static async obterConfigPix() {
        return this.request('GET', '/pix/config');
    }

    static async salvarConfigPix(dados) {
        return this.request('PUT', '/pix/config', dados || {});
    }

    static async gerarPixVenda(vendaId, valor = 0, descricao = '') {
        return this.request('POST', `/pix/venda/${vendaId}/gerar`, { valor, descricao });
    }

    // ===== PAGAMENTOS =====
    static async obterProvidersPagamento() {
        return this.request('GET', '/pagamentos/providers');
    }

    static async obterConfigPagamento() {
        return this.request('GET', '/pagamentos/config');
    }

    static async salvarConfigPagamento(dados) {
        return this.request('PUT', '/pagamentos/config', dados || {});
    }

    static async processarPagamento(dados) {
        return this.request('POST', '/pagamentos/processar', dados || {});
    }

    // ===== PROMOÇÕES =====
    static async obterPromocoes(ativo = null) {
        const query = ativo === null ? '' : `?ativo=${ativo ? 1 : 0}`;
        return this.request('GET', `/promocoes${query}`);
    }

    static async criarPromocao(dados) {
        return this.request('POST', '/promocoes', dados || {});
    }

    static async atualizarPromocao(id, dados) {
        return this.request('PUT', `/promocoes/${id}`, dados || {});
    }

    static async removerPromocao(id) {
        return this.request('DELETE', `/promocoes/${id}`);
    }

    // ===== HEALTH CHECK =====
    static async verificarConexao() {
        try {
            const response = await this.request('GET', '/status');
            return response.status === 'OK';
        } catch {
            return false;
        }
    }
}

// ===================================
// Utilitários
// ===================================

const formatarMoeda = (valor) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor);
};

const formatarData = (data) => {
    return new Intl.DateTimeFormat('pt-BR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    }).format(new Date(data));
};

const formatarHora = (data) => {
    return new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    }).format(new Date(data));
};

const calcularTempoEspera = (dataInicio) => {
    const agora = new Date();
    const inicio = new Date(dataInicio);
    const diff = Math.floor((agora - inicio) / 1000);

    const horas = Math.floor(diff / 3600);
    const minutos = Math.floor((diff % 3600) / 60);
    const segundos = diff % 60;

    if (horas > 0) {
        return `${horas}h ${minutos}m`;
    } else if (minutos > 0) {
        return `${minutos}m ${segundos}s`;
    } else {
        return `${segundos}s`;
    }
};

// ===================================
// Gerenciador de Conexão
// ===================================

class ConexaoManager {
    static init() {
        this.verificarConexao();
        setInterval(() => this.verificarConexao(), 5000);
    }

    static async verificarConexao() {
        const online = await API.verificarConexao();
        const elemento = document.getElementById('conexao');

        if (online) {
            elemento?.classList.remove('offline');
            elemento?.classList.add('online');
            elemento?.setAttribute('data-status', 'online');
        } else {
            elemento?.classList.remove('online');
            elemento?.classList.add('offline');
            elemento?.setAttribute('data-status', 'offline');
        }
    }
}

// Inicializar gerenciador de conexão quando o documento estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ConexaoManager.init());
} else {
    ConexaoManager.init();
}
