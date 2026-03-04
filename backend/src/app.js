import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRoutes from './routes/index.js';
import { tenantMiddleware } from './middlewares/tenant.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Servir frontend estático (pasta frontend na raiz do projeto)
const frontendPath = path.join(__dirname, '../../frontend');
app.use(express.static(frontendPath, { index: 'acesso.html' }));

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rotas da API
app.use('/api', tenantMiddleware, apiRoutes);

// Tratamento de rotas não encontradas
app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// Tratamento de erros
app.use((err, req, res, next) => {
  console.error('Erro:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Erro interno do servidor'
  });
});

export default app;
