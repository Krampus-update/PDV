import express from 'express';
import AuthController from '../controllers/AuthController.js';
import { authOptional, authRequired, requireRole } from '../middlewares/auth.js';

const router = express.Router();

router.post('/registrar', AuthController.registrar);
router.post('/login', authOptional, AuthController.login);
router.get('/me', authOptional, authRequired, AuthController.me);
router.post('/refresh', authOptional, authRequired, AuthController.refresh);
router.post('/logout', authOptional, authRequired, AuthController.logout);
router.get('/usuarios', authOptional, authRequired, requireRole('gerente'), AuthController.listarUsuarios);
router.post('/usuarios', authOptional, authRequired, requireRole('gerente'), AuthController.criarUsuario);
router.put('/usuarios/:id', authOptional, authRequired, requireRole('gerente'), AuthController.atualizarUsuario);
router.delete('/usuarios/:id', authOptional, authRequired, requireRole('gerente'), AuthController.removerUsuario);

export default router;
