import express from 'express';
import produtosRoutes from './produtos.js';
import vendasRoutes from './vendas.js';

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    system: 'PDV System',
    version: '1.0.0',
    message: 'API do sistema de PDV para Bar e Fast Food',
    endpoints: {
      status: '/api/status',
      produtos: '/api/produtos',
      vendas: '/api/vendas'
    }
  });
});

// Rotas da API
router.use('/produtos', produtosRoutes);
router.use('/vendas', vendasRoutes);

// Health check
router.get('/status', (req, res) => {
  res.json({ 
    status: 'OK',
    message: 'API PDV está funcionando'
  });
});

export default router;
