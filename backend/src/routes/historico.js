import express from 'express';
import HistoricoController from '../controllers/HistoricoController.js';
import { authOptional, authRequired, requireRole } from '../middlewares/auth.js';

const router = express.Router();

router.use(authOptional, authRequired, requireRole('gerente'));
router.get('/', HistoricoController.listar);

export default router;
