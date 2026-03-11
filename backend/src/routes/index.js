import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import produtosRoutes from './produtos.js';
import vendasRoutes from './vendas.js';
import historicoRoutes from './historico.js';
import authRoutes from './auth.js';
import relatoriosRoutes from './relatorios.js';
import backupRoutes from './backup.js';
import impressaoRoutes from './impressao.js';
import clientesRoutes from './clientes.js';
import caixaRoutes from './caixa.js';
import pixRoutes from './pix.js';
import pagamentosRoutes from './pagamentos.js';
import promocoesRoutes from './promocoes.js';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendPkgPath = path.join(__dirname, '../../package.json');
const frontendVersionPath = path.join(__dirname, '../../../frontend/version.json');
let backendVersion = 'unknown';
let frontendVersion = 'unknown';
try {
  backendVersion = JSON.parse(fs.readFileSync(backendPkgPath, 'utf8')).version || 'unknown';
} catch {}
try {
  frontendVersion = JSON.parse(fs.readFileSync(frontendVersionPath, 'utf8')).version || 'unknown';
} catch {}

router.get('/', (req, res) => {
  res.json({
    system: 'PDV System',
    version: backendVersion,
    message: 'API do sistema de PDV para Bar e Fast Food',
    endpoints: {
      status: '/api/status',
      produtos: '/api/produtos',
      vendas: '/api/vendas',
      historico: '/api/historico',
      auth: '/api/auth',
      relatorios: '/api/relatorios',
      backup: '/api/backup',
      impressao: '/api/impressao',
      clientes: '/api/clientes',
      caixa: '/api/caixa',
      pix: '/api/pix',
      pagamentos: '/api/pagamentos'
      ,
      promocoes: '/api/promocoes'
    }
  });
});

// Rotas da API
router.use('/produtos', produtosRoutes);
router.use('/vendas', vendasRoutes);
router.use('/historico', historicoRoutes);
router.use('/auth', authRoutes);
router.use('/relatorios', relatoriosRoutes);
router.use('/backup', backupRoutes);
router.use('/impressao', impressaoRoutes);
router.use('/clientes', clientesRoutes);
router.use('/caixa', caixaRoutes);
router.use('/pix', pixRoutes);
router.use('/pagamentos', pagamentosRoutes);
router.use('/promocoes', promocoesRoutes);

// Health check
router.get('/status', (req, res) => {
  res.json({ 
    status: 'OK',
    message: 'API PDV está funcionando'
  });
});

router.get('/version', (req, res) => {
  res.json({
    backend: backendVersion,
    frontend: frontendVersion
  });
});

export default router;
