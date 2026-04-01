import express from 'express';
import IfoodController from '../controllers/IfoodController.js';
import { authOptional, authRequired, requireRole } from '../middlewares/auth.js';

const router = express.Router();

router.get('/ifood/config', authOptional, authRequired, requireRole('gerente'), IfoodController.obterConfig);
router.put('/ifood/config', authOptional, authRequired, requireRole('gerente'), IfoodController.salvarConfig);
router.post('/ifood/login/start', authOptional, authRequired, requireRole('gerente'), IfoodController.iniciarLogin);
router.post('/ifood/login/finish', authOptional, authRequired, requireRole('gerente'), IfoodController.finalizarLogin);
router.post('/ifood/webhook', IfoodController.webhook);
router.post('/ifood/:id/pronto', authOptional, authRequired, requireRole('funcionario'), IfoodController.marcarPronto);

export default router;
