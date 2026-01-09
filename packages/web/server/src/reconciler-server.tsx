/**
 * WebSocket Reconciler Server
 *
 * A new server entry point that uses the WebSocket reconciler
 * to render the CLI's React components and broadcast to web clients.
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { startTestRender } from './reconciler/index.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    mode: 'reconciler',
    message: 'WebSocket Reconciler Server',
  });
});

// Start the test render
console.log('[Server] Starting WebSocket Reconciler...');
const renderInstance = startTestRender(wss);

// Handle shutdown
process.on('SIGINT', () => {
  console.log('[Server] Shutting down...');
  renderInstance.unmount();
  server.close();
  process.exit(0);
});

server.listen(PORT, () => {
  console.log(`[Server] Reconciler server listening on port ${PORT}`);
  console.log(`[Server] WebSocket available at ws://localhost:${PORT}/ws`);
  console.log('[Server] Connect a WebSocket client to see the rendered tree');
});
