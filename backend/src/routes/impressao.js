import express from 'express';
import ImpressaoController from '../controllers/ImpressaoController.js';
import { authOptional, authRequired, requireRole } from '../middlewares/auth.js';

const router = express.Router();
router.use(authOptional, authRequired);

router.get('/config', requireRole('gerente'), ImpressaoController.obterConfig);
router.put('/config', requireRole('gerente'), ImpressaoController.salvarConfig);
router.get('/locais', requireRole('gerente'), ImpressaoController.listarLocais);
router.post('/teste', requireRole('gerente'), ImpressaoController.teste);
router.post('/venda/:id', requireRole('funcionario'), ImpressaoController.imprimirVenda);

export default router;
