import express from 'express';
import ProdutoController from '../controllers/ProdutoController.js';
import { authOptional, authRequired } from '../middlewares/auth.js';

const router = express.Router();

router.use(authOptional, authRequired);

// Criar novo produto
router.post('/', ProdutoController.criar);

// Criar vários produtos na mesma categoria
router.post('/lote', ProdutoController.criarLote);

// Renomear categoria em todos os produtos
router.put('/categoria/renomear', ProdutoController.renomearCategoria);

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
