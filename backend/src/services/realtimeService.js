import { WebSocketServer } from 'ws';

let wss = null;

function initRealtime(server) {
  wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (socket) => {
    socket.send(
      JSON.stringify({
        type: 'connection',
        message: 'Conectado ao realtime',
        at: new Date().toISOString()
      })
    );
  });
  console.log('✓ WebSocket realtime ativo em /ws');
}

function broadcast(type, payload = {}) {
  if (!wss) return;
  const message = JSON.stringify({ type, payload, at: new Date().toISOString() });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
}

export { initRealtime, broadcast };
