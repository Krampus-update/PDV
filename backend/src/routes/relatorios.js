import express from 'express';
import RelatorioController from '../controllers/RelatorioController.js';
import { authOptional, authRequired, requireRole } from '../middlewares/auth.js';

const router = express.Router();

router.use(authOptional, authRequired, requireRole('gerente'));
router.get('/resumo', RelatorioController.resumo);
router.get('/produtos', RelatorioController.produtos);

export default router;
