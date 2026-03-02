import app from './src/app.js';
import { initializeDatabase } from './src/database/database.js';

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Inicializar banco de dados
    await initializeDatabase();

    // Iniciar servidor
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n===================================`);
      console.log(`🚀 PDV System - Backend iniciado`);
      console.log(`===================================`);
      console.log(`📡 Servidor rodando em http://localhost:${PORT}`);
      console.log(`🌐 Acessível via rede: http://<seu-ip>:${PORT}`);
      console.log(`📊 API de status: http://localhost:${PORT}/api/status`);
      console.log(`===================================\n`);
    });
  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error);
    process.exit(1);
  }
}

startServer();
