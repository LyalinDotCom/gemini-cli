/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { WebSocketServer, WebSocket } from 'ws';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { watch, type FSWatcher } from 'chokidar';
import { createConnection } from 'node:net';
import type { DiagnosticEvent } from '@google/gemini-cli-diagnostics';
import { DiagnosticsFileWatcher } from './file-watcher.js';
import { SessionScanner } from './session-scanner.js';

/** Check if a port can be bound to (true test for availability) */
async function canBindToPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const testServer = createNetServer();
    testServer.once('error', () => {
      resolve(false);
    });
    testServer.once('listening', () => {
      testServer.close(() => resolve(true));
    });
    // Don't specify host - matches server.listen() behavior (binds to all interfaces)
    testServer.listen(port);
  });
}

/** Find an available port starting from the given port */
async function findAvailablePort(startPort: number): Promise<number> {
  let port = startPort;
  while (port < startPort + 100) {
    if (await canBindToPort(port)) {
      return port;
    }
    port++;
  }
  throw new Error(
    `Could not find available port in range ${startPort}-${startPort + 99}`,
  );
}

/** Check if an existing viewer is running on the port */
async function isViewerRunning(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: 'localhost' }, () => {
      // Port is in use, try to check if it's our viewer by sending an HTTP request
      socket.write('GET /api/config HTTP/1.1\r\nHost: localhost\r\n\r\n');
      socket.on('data', (data) => {
        const response = data.toString();
        // Check if response contains our config endpoint signature
        resolve(
          response.includes('baseDir') && response.includes('currentSessionId'),
        );
        socket.end();
      });
      socket.on('error', () => {
        resolve(false);
      });
      // Timeout after 500ms
      setTimeout(() => {
        socket.end();
        resolve(false);
      }, 500);
    });
    socket.on('error', () => {
      resolve(false); // Port not in use
    });
  });
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Find client directory - works both in dev (../client) and bundle (./client)
function findClientDir(): string {
  const bundleClientDir = join(__dirname, 'client');
  const devClientDir = join(__dirname, '..', 'client');

  // Prefer bundle location (when running from bundle/insights/server.js)
  if (
    existsSync(bundleClientDir) &&
    existsSync(join(bundleClientDir, 'index.html'))
  ) {
    return bundleClientDir;
  }
  // Fall back to dev location (when running from packages/diagnostics-viewer/dist/server/)
  if (
    existsSync(devClientDir) &&
    existsSync(join(devClientDir, 'index.html'))
  ) {
    return devClientDir;
  }
  // Default to bundle location (will fail gracefully if not found)
  return bundleClientDir;
}

export interface ServerConfig {
  port: number;
  baseDir: string;
  sessionId?: string;
  clientDir?: string; // Optional override for client directory
}

export interface WebSocketMessage {
  type: 'event' | 'sessions' | 'session-events' | 'error';
  payload: unknown;
}

export function createInsightsServer(config: ServerConfig) {
  const app = express();
  const server = createHttpServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });
  const scanner = new SessionScanner(config.baseDir);
  let fileWatcher: DiagnosticsFileWatcher | null = null;
  let baseDirWatcher: FSWatcher | null = null;
  let currentSessionId: string | null = config.sessionId ?? null;
  const knownSessions = new Set<string>();
  const clients = new Set<WebSocket>();
  const checkpointSequences = new Map<string, number>();

  const clientDir = config.clientDir ?? findClientDir();
  app.use(express.static(clientDir));

  app.get('/api/sessions', async (_req, res) => {
    res.json(await scanner.listSessions());
  });

  app.get('/api/sessions/:sessionId/events', async (req, res) => {
    res.json(await scanner.getSessionEvents(req.params.sessionId));
  });

  app.get('/api/config', (_req, res) => {
    res.json({ baseDir: config.baseDir, currentSessionId });
  });

  app.get('*', (_req, res) => {
    res.sendFile(join(clientDir, 'index.html'));
  });

  function sendMessage(ws: WebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
  }

  function broadcast(message: WebSocketMessage): void {
    for (const client of clients) sendMessage(client, message);
  }

  async function saveCheckpointToFile(
    sessionId: string,
    checkpoint: {
      id: string;
      name: string;
      timestamp: string;
      afterEventSequence: number;
    },
  ): Promise<void> {
    const sessionDir = join(config.baseDir, sessionId);
    const currentSeq = checkpointSequences.get(sessionId) || 900000;
    const nextSeq = currentSeq + 1;
    checkpointSequences.set(sessionId, nextSeq);

    const checkpointEvent: DiagnosticEvent = {
      meta: {
        sessionId,
        sequence: nextSeq,
        timestamp: checkpoint.timestamp,
        category: 'system',
        eventType: 'checkpoint',
        version: 1,
      },
      data: {
        checkpointId: checkpoint.id,
        name: checkpoint.name,
        afterEventSequence: checkpoint.afterEventSequence,
      },
    };

    const isoTimestamp = checkpoint.timestamp
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
    const filename = `${isoTimestamp}_${String(nextSeq).padStart(6, '0')}_system_checkpoint.json`;
    try {
      await mkdir(sessionDir, { recursive: true });
      await writeFile(
        join(sessionDir, filename),
        JSON.stringify(checkpointEvent, null, 2),
        'utf-8',
      );
    } catch (error) {
      // eslint-disable-next-line no-console -- Server logging
      console.error('Failed to save checkpoint:', error);
    }
  }

  async function subscribeToSession(sessionId: string): Promise<void> {
    if (fileWatcher) fileWatcher.stop();
    currentSessionId = sessionId;
    knownSessions.add(sessionId);

    fileWatcher = new DiagnosticsFileWatcher(join(config.baseDir, sessionId));
    fileWatcher.on('event', (event: DiagnosticEvent, filePath: string) => {
      broadcast({ type: 'event', payload: { event, filePath } });
    });
    fileWatcher.start();

    broadcast({
      type: 'session-events',
      payload: { sessionId, events: await scanner.getSessionEvents(sessionId) },
    });
    broadcast({
      type: 'sessions',
      payload: {
        currentSessionId,
        message: `Switched to session: ${sessionId}`,
      },
    });
    // eslint-disable-next-line no-console -- Server logging
    console.log(`Now watching session: ${sessionId}`);
  }

  function startBaseDirWatcher(): void {
    if (baseDirWatcher) return;
    baseDirWatcher = watch(config.baseDir, {
      persistent: true,
      ignoreInitial: true,
      depth: 0,
      ignorePermissionErrors: true,
    });
    baseDirWatcher.on('addDir', (dirPath: string) => {
      const sessionId = dirPath.split('/').pop();
      if (
        !sessionId ||
        sessionId === config.baseDir ||
        knownSessions.has(sessionId)
      )
        return;
      // eslint-disable-next-line no-console -- Server logging
      console.log(`New session detected: ${sessionId}`);
      knownSessions.add(sessionId);
      void subscribeToSession(sessionId);
    });
    // eslint-disable-next-line no-console -- Server logging
    console.log(`Watching for new sessions in: ${config.baseDir}`);
  }

  wss.on('connection', (ws) => {
    clients.add(ws);
    sendMessage(ws, { type: 'sessions', payload: { currentSessionId } });

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === 'subscribe-session')
          await subscribeToSession(message.sessionId);
        else if (message.type === 'get-sessions')
          sendMessage(ws, {
            type: 'sessions',
            payload: {
              sessions: await scanner.listSessions(),
              currentSessionId,
            },
          });
        else if (message.type === 'get-session-events')
          sendMessage(ws, {
            type: 'session-events',
            payload: {
              sessionId: message.sessionId,
              events: await scanner.getSessionEvents(message.sessionId),
            },
          });
        else if (message.type === 'save-checkpoint')
          await saveCheckpointToFile(message.sessionId, message.checkpoint);
      } catch (error) {
        sendMessage(ws, { type: 'error', payload: String(error) });
      }
    });

    ws.on('close', () => clients.delete(ws));
  });

  async function start(): Promise<{ port: number; reused: boolean }> {
    // Check if port can be bound (true availability test)
    const portAvailable = await canBindToPort(config.port);

    if (!portAvailable) {
      // Check if it's already our viewer running
      const viewerRunning = await isViewerRunning(config.port);
      if (viewerRunning) {
        // eslint-disable-next-line no-console -- Server logging
        console.log(
          `Viewer already running at http://localhost:${config.port}`,
        );
        return { port: config.port, reused: true };
      }

      // Port in use by something else, find a new port
      const newPort = await findAvailablePort(config.port + 1);
      // eslint-disable-next-line no-console -- Server logging
      console.log(`Port ${config.port} in use, using port ${newPort} instead`);
      config.port = newPort;
    }

    return new Promise((resolve, reject) => {
      server.once('error', (err) => {
        reject(err);
      });
      server.listen(config.port, () => {
        // eslint-disable-next-line no-console -- Server logging
        console.log(
          `Gemini Insights viewer running at http://localhost:${config.port}`,
        );
        void (async () => {
          for (const session of await scanner.listSessions())
            knownSessions.add(session.sessionId);
          startBaseDirWatcher();
          if (!currentSessionId)
            currentSessionId = await scanner.getMostRecentSession();
          if (currentSessionId) {
            // eslint-disable-next-line no-console -- Server logging
            console.log(`Initial session: ${currentSessionId}`);
            await subscribeToSession(currentSessionId);
          } else {
            // eslint-disable-next-line no-console -- Server logging
            console.log('No sessions found. Waiting for new sessions...');
          }
          resolve({ port: config.port, reused: false });
        })();
      });
    });
  }

  function stop(): void {
    fileWatcher?.stop();
    void baseDirWatcher?.close();
    server.close();
  }

  function getPort(): number {
    return config.port;
  }

  return { start, stop, getPort, app, server };
}
