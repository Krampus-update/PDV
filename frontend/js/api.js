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
    static async request(method, endpoint, data = null) {
        try {
            const options = {
                method,
                headers: {
                    'Content-Type': 'application/json'
                }
            };

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

    static async atualizarProduto(id, dados) {
        return this.request('PUT', `/produtos/${id}`, dados);
    }

    static async deletarProduto(id) {
        return this.request('DELETE', `/produtos/${id}`);
    }

    // ===== VENDAS =====
    static async criarVenda(tipo, mesa = null) {
        return this.request('POST', '/vendas', { tipo, mesa });
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

    static async obterEmPreparo() {
        return this.request('GET', '/vendas/preparacao/em-preparo');
    }

    static async obterProducao(status = 'em_preparo') {
        const query = status ? `?status=${encodeURIComponent(status)}` : '';
        return this.request('GET', `/vendas/preparacao${query}`);
    }

    // ===== ITENS DA VENDA =====
    static async adicionarItem(vendaId, produtoId, quantidade) {
        return this.request('POST', `/vendas/${vendaId}/itens`, {
            produto_id: produtoId,
            quantidade
        });
    }

    static async atualizarItem(vendaId, itemId, quantidade) {
        return this.request('PUT', `/vendas/${vendaId}/itens/${itemId}`, {
            quantidade
        });
    }

    static async removerItem(vendaId, itemId) {
        return this.request('DELETE', `/vendas/${vendaId}/itens/${itemId}`);
    }

    // ===== OPERAÇÕES NA VENDA =====
    static async fecharVenda(vendaId, formaPagamento, observacoes = '') {
        return this.request('PUT', `/vendas/${vendaId}/fechar`, {
            forma_pagamento: formaPagamento,
            observacoes
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
