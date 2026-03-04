import express from 'express';
import BackupController from '../controllers/BackupController.js';
import { authOptional, authRequired, requireRole } from '../middlewares/auth.js';

const router = express.Router();

router.use(authOptional, authRequired, requireRole('gerente'));
router.get('/', BackupController.listar);
router.post('/executar', BackupController.executar);

export default router;
