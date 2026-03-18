import express from 'express';
import CategoriaController from '../controllers/CategoriaController.js';
import { authOptional, authRequired, requireRole } from '../middlewares/auth.js';

const router = express.Router();

router.use(authOptional, authRequired, requireRole('gerente'));
router.get('/', CategoriaController.listar);
router.post('/', CategoriaController.criar);
router.put('/:id', CategoriaController.atualizar);
router.delete('/:id', CategoriaController.remover);

export default router;
