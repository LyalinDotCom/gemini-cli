/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import { watch, type FSWatcher } from 'chokidar';
import type { DiagnosticEvent } from '@google/gemini-cli-diagnostics';
import { DiagnosticsFileWatcher } from './file-watcher.js';
import { SessionScanner } from './session-scanner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface ServerConfig {
  port: number;
  baseDir: string;
  sessionId?: string;
}

export interface WebSocketMessage {
  type: 'event' | 'sessions' | 'session-events' | 'error';
  payload: unknown;
}

export function createInsightsServer(config: ServerConfig) {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });
  const scanner = new SessionScanner(config.baseDir);
  let fileWatcher: DiagnosticsFileWatcher | null = null;
  let baseDirWatcher: FSWatcher | null = null;
  let currentSessionId: string | null = config.sessionId ?? null;
  const knownSessions = new Set<string>();
  const clients = new Set<WebSocket>();
  const checkpointSequences = new Map<string, number>();

  const clientDir = join(__dirname, '..', 'client');
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
            payload: await scanner.listSessions(),
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

  async function start(): Promise<void> {
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
          resolve();
        })();
      });
    });
  }

  function stop(): void {
    fileWatcher?.stop();
    void baseDirWatcher?.close();
    server.close();
  }

  return { start, stop, app, server };
}
