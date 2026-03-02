import express from 'express';
import HistoricoController from '../controllers/HistoricoController.js';

const router = express.Router();

router.get('/', HistoricoController.listar);

export default router;
