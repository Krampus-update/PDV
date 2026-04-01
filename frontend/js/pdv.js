// ===================================
// PDV - Sistema de Caixa
// ===================================

class PDV {
    constructor() {
        this.vendaAtiva = null;
        this.produtos = [];
        this.vendas = [];
        this.ui = window.PDVUI || {};
        this.init();
    }

    async init() {
        console.log('🏪 Iniciando PDV...');
        
        // Carregar elementos do DOM
        this.elementos = {
            novaVendaBtn: document.getElementById('novaVendaBtn'),
            listaVendas: document.getElementById('listaVendas'),
            gridProdutos: document.getElementById('gridProdutos'),
            buscaProduto: document.getElementById('buscaProduto'),
            filtroTipo: document.getElementById('filtroTipo'),
            numeroComanda: document.getElementById('numeroComanda'),
            statusVenda: document.getElementById('statusVenda'),
            itensCarrinho: document.getElementById('itensCarrinho'),
            subtotal: document.getElementById('subtotal'),
            totalVenda: document.getElementById('totalVenda'),
            fecharVendaBtn: document.getElementById('fecharVendaBtn'),
            cancelarVendaBtn: document.getElementById('cancelarVendaBtn'),
            modalFechamento: document.getElementById('modalFechamento'),
            modalNovaVenda: document.getElementById('modalNovaVenda'),
            formaPagamento: document.getElementById('formaPagamento'),
            relogio: document.getElementById('relogio')
        };

        // Listeners
        this.elementos.novaVendaBtn.addEventListener('click', () => this.mostrarModalNovaVenda());
        this.elementos.buscaProduto.addEventListener('input', () => this.filtrarProdutos());
        this.elementos.filtroTipo.addEventListener('change', () => this.filtrarProdutos());
        this.elementos.fecharVendaBtn.addEventListener('click', () => this.mostrarModalFechamento());
        this.elementos.cancelarVendaBtn.addEventListener('click', () => this.cancelarVenda());

        // Modal Nova Venda
        document.getElementById('btnCriarVenda').addEventListener('click', () => this.criarNovaVenda());
        document.getElementById('btnCancelarNovaVenda').addEventListener('click', () => this.fecharModal('modalNovaVenda'));

        // Modal Fechamento
        document.getElementById('btnConfirmarPagamento').addEventListener('click', () => this.confirmarPagamento());
        document.getElementById('btnCancelarPagamento').addEventListener('click', () => this.fecharModal('modalFechamento'));

        // Atualizar hora
        setInterval(() => this.atualizarRelogio(), 1000);
        this.atualizarRelogio();

        // Carregar dados iniciais
        await this.carregarProdutos();
        await this.carregarVendas();

        // Atualizar a cada 5 segundos
        setInterval(() => this.carregarVendas(), 5000);
    }

    // ===== PRODUTOS =====
    async carregarProdutos() {
        try {
            this.produtos = await API.obterProdutos();
            this.renderizarProdutos();
        } catch (error) {
            console.error('Erro ao carregar produtos:', error);
            this.showNotificacao('Erro ao carregar produtos', 'error');
        }
    }

    renderizarProdutos() {
        const buscaTermo = this.elementos.buscaProduto.value.toLowerCase();
        const filtroTipo = this.elementos.filtroTipo.value;

        const produtosFiltrados = this.produtos.filter(p => {
            const matchesBusca = p.nome.toLowerCase().includes(buscaTermo);
            const matchesTipo = !filtroTipo || p.tipo === filtroTipo;
            return matchesBusca && matchesTipo && p.ativo;
        });

        this.elementos.gridProdutos.innerHTML = produtosFiltrados.map(p => `
            <div class="produto-card ${p.estoque === 0 ? 'sem-estoque' : ''}" data-id="${p.id}">
                <div class="produto-nome">${p.nome}</div>
                <div class="produto-preco">${formatarMoeda(p.preco)}</div>
                <div class="produto-estoque">
                    ${p.estoque > 0 ? `${p.estoque} em estoque` : 'Sem estoque'}
                </div>
                <button class="btn-produto" ${p.estoque === 0 ? 'disabled' : ''} 
                        onclick="pdv.adicionarItem(${p.id}, '${p.nome}', ${p.preco})">
                    Adicionar
                </button>
            </div>
        `).join('');
    }

    filtrarProdutos() {
        this.renderizarProdutos();
    }

    // ===== VENDAS =====
    async carregarVendas() {
        try {
            this.vendas = await API.obterVendas({ status: 'aberta' });
            this.renderizarListaVendas();
        } catch (error) {
            console.error('Erro ao carregar vendas:', error);
        }
    }

    renderizarListaVendas() {
        if (this.vendas.length === 0) {
            this.elementos.listaVendas.innerHTML = '<p class="placeholder">Nenhuma venda aberta</p>';
            return;
        }

        this.elementos.listaVendas.innerHTML = this.vendas.map(v => `
            <div class="item-venda ${this.vendaAtiva?.id === v.id ? 'ativo' : ''}" onclick="pdv.selecionarVenda(${v.id})">
                <div class="item-venda-tipo">${v.tipo}</div>
                <div class="item-venda-numero">${v.nome_comanda || (v.origem === 'ifood' && v.origem_codigo ? `iFood (${v.origem_codigo})` : (v.numero_pedido ? `#${v.numero_pedido}` : 'Comanda'))}</div>
                <div class="item-venda-total">${formatarMoeda(v.total)}</div>
            </div>
        `).join('');
    }

    async criarNovaVenda() {
        try {
            const tipo = document.querySelector('input[name="tipoVenda"]:checked').value;
            const venda = await API.criarVenda(tipo);
            
            this.vendaAtiva = {
                id: venda.id,
                tipo: venda.tipo,
                numero_pedido: venda.numero_pedido,
                status: tipo === 'fastfood' ? 'em_preparo' : 'aberta',
                total: 0,
                itens: []
            };

            this.fecharModal('modalNovaVenda');
            await this.carregarVendas();
            this.atualizarCarrinho();
            
            this.showNotificacao(`${tipo === 'bar' ? 'Comanda' : `Pedido #${venda.numero_pedido}`} criada!`);
        } catch (error) {
            console.error('Erro ao criar venda:', error);
            this.showNotificacao(error.message, 'error');
        }
    }

    async selecionarVenda(vendaId) {
        try {
            this.vendaAtiva = await API.obterVenda(vendaId);
            this.renderizarListaVendas();
            this.atualizarCarrinho();
        } catch (error) {
            console.error('Erro ao selecionar venda:', error);
            this.showNotificacao(error.message, 'error');
        }
    }

    async adicionarItem(produtoId, produtoNome, produtoPreco) {
        if (!this.vendaAtiva) {
            this.showNotificacao('Selecione ou crie uma venda', 'warning');
            return;
        }

        try {
            await API.adicionarItem(this.vendaAtiva.id, produtoId, 1);
            await this.carregarVendas();
            await this.selecionarVenda(this.vendaAtiva.id);
            this.showNotificacao(`${produtoNome} adicionado!`);
        } catch (error) {
            console.error('Erro ao adicionar item:', error);
            this.showNotificacao(error.message, 'error');
        }
    }

    async removerItem(vendaId, itemId) {
        try {
            await API.removerItem(vendaId, itemId);
            await this.selecionarVenda(vendaId);
            this.showNotificacao('Item removido');
        } catch (error) {
            console.error('Erro ao remover item:', error);
            this.showNotificacao(error.message, 'error');
        }
    }

    atualizarCarrinho() {
        if (!this.vendaAtiva) {
            this.elementos.itensCarrinho.innerHTML = '<p class="placeholder">Selecione uma venda</p>';
            this.elementos.fecharVendaBtn.disabled = true;
            this.elementos.cancelarVendaBtn.disabled = true;
            this.elementos.numeroComanda.textContent = '--';
            return;
        }

        const itens = this.vendaAtiva.itens || [];

        if (itens.length === 0) {
            this.elementos.itensCarrinho.innerHTML = '<p class="placeholder">Nenhum item na comanda</p>';
        } else {
            this.elementos.itensCarrinho.innerHTML = itens.map((item, idx) => `
                <div class="item-carrinho">
                    <div class="item-carrinho-header">
                        <div class="item-carrinho-nome">${item.produto_nome}</div>
                        <div class="item-carrinho-quantidade">${item.quantidade}</div>
                    </div>
                    <div class="item-carrinho-header">
                        <span class="item-carrinho-preco">${formatarMoeda(item.subtotal)}</span>
                    </div>
                    <div class="item-carrinho-actions">
                        <button class="btn-menos" onclick="pdv.removerItem(${this.vendaAtiva.id}, ${item.id})">✕</button>
                    </div>
                </div>
            `).join('');
        }

        // Atualizar totais
        const total = this.vendaAtiva.total || 0;
        this.elementos.subtotal.textContent = formatarMoeda(total);
        this.elementos.totalVenda.textContent = formatarMoeda(total);

        // Atualizar número da comanda
        if (this.vendaAtiva.nome_comanda) {
            this.elementos.numeroComanda.textContent = this.vendaAtiva.nome_comanda;
        } else
        if (this.vendaAtiva.numero_pedido) {
            this.elementos.numeroComanda.textContent = `#${this.vendaAtiva.numero_pedido}`;
        } else {
            this.elementos.numeroComanda.textContent = 'Comanda';
        }

        // Status
        this.elementos.statusVenda.textContent = this.vendaAtiva.status;

        // Botões
        this.elementos.fecharVendaBtn.disabled = itens.length === 0;
        this.elementos.cancelarVendaBtn.disabled = false;
    }

    async cancelarVenda() {
        if (!this.vendaAtiva) return;
        const confirmado = this.ui.confirm
            ? await this.ui.confirm('Tem certeza que deseja cancelar esta venda?', { title: 'Cancelar venda' })
            : confirm('Tem certeza que deseja cancelar esta venda?');
        if (confirmado) {
            try {
                await API.atualizarStatus(this.vendaAtiva.id, 'fechada');
                this.vendaAtiva = null;
                await this.carregarVendas();
                this.atualizarCarrinho();
                this.showNotificacao('Venda cancelada');
            } catch (error) {
                console.error('Erro ao cancelar venda:', error);
                this.showNotificacao(error.message, 'error');
            }
        }
    }

    // ===== PAGAMENTO =====
    mostrarModalFechamento() {
        if (!this.vendaAtiva || !this.vendaAtiva.itens || this.vendaAtiva.itens.length === 0) {
            this.showNotificacao('Adicione itens à comanda', 'warning');
            return;
        }
        this.abrirModal('modalFechamento');
    }

    async confirmarPagamento() {
        try {
            const formaPagamento = this.elementos.formaPagamento.value;
            const observacoes = document.getElementById('observacoesPagamento').value;

            if (!formaPagamento) {
                this.showNotificacao('Selecione a forma de pagamento', 'warning');
                return;
            }

            await API.fecharVenda(this.vendaAtiva.id, formaPagamento, observacoes);
            
            this.fecharModal('modalFechamento');
            this.vendaAtiva = null;
            await this.carregarVendas();
            this.atualizarCarrinho();
            
            this.showNotificacao('Venda finalizada com sucesso!');
        } catch (error) {
            console.error('Erro ao confirmar pagamento:', error);
            this.showNotificacao(error.message, 'error');
        }
    }

    // ===== MODAIS =====
    mostrarModalNovaVenda() {
        this.abrirModal('modalNovaVenda');
    }

    abrirModal(modalId) {
        document.getElementById(modalId).style.display = 'flex';
    }

    fecharModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }

    // ===== UTILIDADES =====
    atualizarRelogio() {
        const agora = new Date();
        const horas = String(agora.getHours()).padStart(2, '0');
        const minutos = String(agora.getMinutes()).padStart(2, '0');
        const segundos = String(agora.getSeconds()).padStart(2, '0');
        this.elementos.relogio.textContent = `${horas}:${minutos}:${segundos}`;
    }

    showNotificacao(mensagem, tipo = 'success') {
        console.log(`[${tipo.toUpperCase()}] ${mensagem}`);
        // Pode ser expandido para mostrar notificação visual
    }
}

// Iniciar PDV quando o documento estiver carregado
let pdv;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        pdv = new PDV();
    });
} else {
    pdv = new PDV();
}
