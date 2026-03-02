import express from 'express';
import ProdutoController from '../controllers/ProdutoController.js';

const router = express.Router();

// Criar novo produto
router.post('/', ProdutoController.criar);

// Obter todos os produtos
router.get('/', ProdutoController.obterTodos);

// Obter produto específico
router.get('/:id', ProdutoController.obterPorId);

// Obter estoque de produto
router.get('/:id/estoque', ProdutoController.obterEstoque);

// Atualizar produto
router.put('/:id', ProdutoController.atualizar);

// Deletar (desativar) produto
router.delete('/:id', ProdutoController.deletar);

export default router;
