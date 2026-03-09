import express from 'express';
import PixController from '../controllers/PixController.js';
import { authOptional, authRequired, requireRole } from '../middlewares/auth.js';

const router = express.Router();
router.use(authOptional, authRequired);

router.get('/config', requireRole('gerente'), PixController.obterConfig);
router.put('/config', requireRole('gerente'), PixController.salvarConfig);
router.post('/venda/:id/gerar', requireRole('funcionario'), PixController.gerarCobranca);

export default router;
