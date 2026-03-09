import express from 'express';
import CaixaController from '../controllers/CaixaController.js';
import { authOptional, authRequired, requireRole } from '../middlewares/auth.js';

const router = express.Router();
router.use(authOptional, authRequired);

router.get('/atual', CaixaController.atual);
router.get('/historico', requireRole('gerente'), CaixaController.historico);
router.get('/resumo-dia', CaixaController.resumoDia);
router.post('/abrir', requireRole('gerente'), CaixaController.abrir);
router.post('/fechar', requireRole('gerente'), CaixaController.fechar);

export default router;
