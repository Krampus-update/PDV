import express from 'express';
import ProdutoModel from '../models/ProdutoModel.js';
import VendaModel from '../models/VendaModel.js';
import VendaItemModel from '../models/VendaItemModel.js';

const router = express.Router();

router.get('/cardapio', async (req, res) => {
  try {
    const produtos = await ProdutoModel.obterTodos(true);
    res.json({
      restaurante: req.tenantCode || null,
      produtos: (produtos || []).filter((p) => p.tipo !== 'avulso' && Number(p.ativo || 0) === 1)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/pedidos', async (req, res) => {
  try {
    const itens = Array.isArray(req.body?.itens) ? req.body.itens : [];
    const nome = String(req.body?.cliente_nome || '').trim();
    const contato = String(req.body?.cliente_contato || '').trim();
    const mesa = String(req.body?.mesa || 'autoatendimento').trim() || 'autoatendimento';
    if (!itens.length) return res.status(400).json({ error: 'Pedido sem itens' });

    const agrupados = new Map();
    for (const item of itens) {
      const produtoId = Number(item.produto_id || 0);
      const quantidade = Math.max(1, Number(item.quantidade || 1));
      if (!produtoId) continue;
      agrupados.set(produtoId, (agrupados.get(produtoId) || 0) + quantidade);
    }
    if (!agrupados.size) return res.status(400).json({ error: 'Pedido sem itens válidos' });

    const produtosPorId = new Map();
    for (const [produtoId, quantidade] of agrupados.entries()) {
      const produto = await ProdutoModel.obterPorId(produtoId);
      if (!produto || Number(produto.ativo || 0) !== 1) {
        return res.status(400).json({ error: 'Produto indisponível no cardápio' });
      }
      if (Number(produto.estoque || 0) < quantidade) {
        return res.status(400).json({ error: `Estoque insuficiente para ${produto.nome}` });
      }
      produtosPorId.set(produtoId, produto);
    }

    const venda = await VendaModel.criar({
      tipo: 'bar',
      status: 'aberta',
      mesa,
      auto_cliente_nome: nome || 'Cliente',
      auto_cliente_contato: contato || null,
      origem: 'autoatendimento',
      aprovacao_status: 'pendente'
    });

    for (const [produtoId, quantidade] of agrupados.entries()) {
      const produto = produtosPorId.get(produtoId);
      const preco = Number(produto.preco || 0);
      await VendaItemModel.criar({
        venda_id: venda.id,
        produto_id: produto.id,
        quantidade,
        preco_unitario: preco,
        consumo_estoque: 1,
        subtotal: Number((preco * quantidade).toFixed(2)),
        observacoes: null,
        status_item: 'anotado'
      });
    }

    const total = await VendaModel.obterTotal(venda.id);
    res.status(201).json({ message: 'Pedido enviado para aprovação', venda_id: venda.id, total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
