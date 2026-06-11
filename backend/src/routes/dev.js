import express from 'express';
import DevController from '../controllers/DevController.js';
import { authOptional, authRequired, requireRole } from '../middlewares/auth.js';

const router = express.Router();

router.use(authOptional, authRequired, requireRole('dev'));

router.get('/maintenance/status', DevController.status);
router.post('/maintenance/reset-db', DevController.resetDb);
router.post('/maintenance/autostart/install', DevController.autostartInstall);
router.post('/maintenance/autostart/remove', DevController.autostartRemove);
router.get('/tenants', DevController.tenantsList);
router.post('/tenants', DevController.tenantsCreate);
router.delete('/tenants/:code', DevController.tenantsDelete);

export default router;
