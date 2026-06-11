import express from 'express';
import VendaController from '../controllers/VendaController.js';
import { authOptional, authRequired } from '../middlewares/auth.js';

const router = express.Router();
router.use(authOptional, authRequired);

// Criar nova venda
router.post('/', VendaController.criar);

// Obter todas as vendas com filtros
router.get('/', VendaController.obterTodas);

// Obter vendas abertas
router.get('/abertas', VendaController.obterAbertas);

// Obter pedidos em preparo (fastfood)
router.get('/preparacao/em-preparo', VendaController.obterEmPreparo);
router.get('/preparacao', VendaController.obterEmPreparo);

// Obter venda específica
router.get('/:id', VendaController.obterPorId);

// Adicionar item à venda
router.post('/:id/itens', VendaController.adicionarItem);

// Atualizar quantidade de item
router.put('/:id/itens/:item_id', VendaController.atualizarItem);

// Atualizar status operacional do item
router.put('/:id/itens/:item_id/status', VendaController.atualizarStatusItem);

// Remover item da venda
router.delete('/:id/itens/:item_id', VendaController.removerItem);

// Atualizar status da venda
router.put('/:id/status', VendaController.atualizarStatus);
router.put('/:id/auto/aprovar', VendaController.aprovarAutoatendimento);
router.put('/:id/auto/recusar', VendaController.recusarAutoatendimento);
router.put('/:id/cliente', VendaController.vincularCliente);
router.put('/:id/reabrir', VendaController.reabrir);
router.put('/:id/financeiro', VendaController.aplicarFinanceiro);
router.post('/:id/divisao', VendaController.simularDivisao);

// Marcar pedido como pronto
router.put('/:id/marcar-pronto', VendaController.marcarPronto);

// Fechar venda
router.put('/:id/fechar', VendaController.fechar);

export default router;
