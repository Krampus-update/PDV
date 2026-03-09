import express from 'express';
import PromocaoController from '../controllers/PromocaoController.js';
import { authOptional, authRequired, requireRole } from '../middlewares/auth.js';

const router = express.Router();
router.use(authOptional, authRequired);

router.get('/', requireRole('funcionario'), PromocaoController.listar);
router.get('/:id', requireRole('funcionario'), PromocaoController.obter);
router.post('/', requireRole('gerente'), PromocaoController.criar);
router.put('/:id', requireRole('gerente'), PromocaoController.atualizar);
router.delete('/:id', requireRole('gerente'), PromocaoController.remover);

export default router;
