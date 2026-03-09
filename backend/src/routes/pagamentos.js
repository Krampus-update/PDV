import express from 'express';
import PagamentoController from '../controllers/PagamentoController.js';
import { authOptional, authRequired, requireRole } from '../middlewares/auth.js';

const router = express.Router();
router.use(authOptional, authRequired);

router.get('/providers', requireRole('gerente'), PagamentoController.providers);
router.get('/config', requireRole('gerente'), PagamentoController.obterConfig);
router.put('/config', requireRole('gerente'), PagamentoController.salvarConfig);
router.post('/processar', requireRole('funcionario'), PagamentoController.processar);

export default router;
