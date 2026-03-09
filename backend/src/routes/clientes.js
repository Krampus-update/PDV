import express from 'express';
import ClienteController from '../controllers/ClienteController.js';
import { authOptional, authRequired } from '../middlewares/auth.js';

const router = express.Router();
router.use(authOptional, authRequired);

router.get('/', ClienteController.listar);
router.get('/:id/historico', ClienteController.historico);
router.get('/:id', ClienteController.obter);
router.post('/', ClienteController.criar);
router.put('/:id', ClienteController.atualizar);
router.delete('/:id', ClienteController.remover);

export default router;
