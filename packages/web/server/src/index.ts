/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';

import { SessionManager } from './services/session.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const WORKSPACE_PATH = process.env.WORKSPACE_PATH || process.cwd();

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Services
const sessionManager = new SessionManager();

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', workspace: WORKSPACE_PATH });
});

// WebSocket connection handling
wss.on('connection', async (ws: WebSocket) => {
  const connectionId = uuidv4();
  console.log(`[WebSocket] Client connected: ${connectionId}`);

  // Create session for this connection
  const session = await sessionManager.createSession(
    connectionId,
    WORKSPACE_PATH,
  );

  if (!session) {
    ws.send(
      JSON.stringify({
        type: 'error',
        message: 'Failed to initialize session',
      }),
    );
    ws.close();
    return;
  }

  // Send connection confirmation with session details
  ws.send(
    JSON.stringify({
      type: 'connected',
      sessionId: session.id,
      workspacePath: session.workspacePath,
      model: session.geminiService.getModelName(),
    }),
  );

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      await handleMessage(ws, session.id, message);
    } catch (err) {
      console.error('[WebSocket] Error handling message:', err);
      ws.send(
        JSON.stringify({
          type: 'error',
          message: err instanceof Error ? err.message : 'Unknown error',
        }),
      );
    }
  });

  ws.on('close', () => {
    console.log(`[WebSocket] Client disconnected: ${connectionId}`);
    sessionManager.endSession(session.id);
  });

  ws.on('error', (err) => {
    console.error(`[WebSocket] Error for ${connectionId}:`, err);
  });
});

async function handleMessage(
  ws: WebSocket,
  sessionId: string,
  message: { type: string; [key: string]: unknown },
) {
  const session = sessionManager.getSession(sessionId);
  if (!session) {
    ws.send(JSON.stringify({ type: 'error', message: 'Session not found' }));
    return;
  }

  switch (message.type) {
    case 'chat': {
      const userMessage = message.message as string;
      if (!userMessage) {
        ws.send(
          JSON.stringify({ type: 'error', message: 'No message provided' }),
        );
        return;
      }

      // Signal stream start
      ws.send(JSON.stringify({ type: 'stream_start' }));

      try {
        // Stream response from Gemini
        await session.geminiService.chat(userMessage, {
          onContent: (text: string) => {
            ws.send(JSON.stringify({ type: 'content', text }));
          },
          onToolCall: (
            toolId: string,
            toolName: string,
            args: Record<string, unknown>,
          ) => {
            ws.send(
              JSON.stringify({ type: 'tool_call', toolId, toolName, args }),
            );
          },
          onToolStatus: (
            toolId: string,
            status: 'executing' | 'success' | 'error',
            result?: string,
          ) => {
            ws.send(
              JSON.stringify({ type: 'tool_status', toolId, status, result }),
            );
          },
          onConfirmationRequest: (
            correlationId: string,
            toolName: string,
            args: Record<string, unknown>,
          ) => {
            // Store pending confirmation
            session.pendingConfirmation = { correlationId, toolName, args };
            ws.send(
              JSON.stringify({
                type: 'confirmation_request',
                correlationId,
                toolName,
                args,
              }),
            );
          },
          onError: (error: string) => {
            ws.send(JSON.stringify({ type: 'error', message: error }));
          },
          onFinished: () => {
            // Signal stream end when the model is done
            ws.send(JSON.stringify({ type: 'stream_end' }));
          },
        });
      } catch (err) {
        ws.send(
          JSON.stringify({
            type: 'error',
            message: err instanceof Error ? err.message : 'Chat error',
          }),
        );
        // Signal stream end on error too
        ws.send(JSON.stringify({ type: 'stream_end' }));
      }
      break;
    }

    case 'confirmation_response': {
      const correlationId = message.correlationId as string;
      const confirmed = message.confirmed as boolean;

      if (!session.pendingConfirmation) {
        ws.send(
          JSON.stringify({ type: 'error', message: 'No pending confirmation' }),
        );
        return;
      }

      if (session.pendingConfirmation.correlationId !== correlationId) {
        ws.send(
          JSON.stringify({ type: 'error', message: 'Correlation ID mismatch' }),
        );
        return;
      }

      // Resolve the confirmation
      session.geminiService.resolveConfirmation(correlationId, confirmed);
      session.pendingConfirmation = null;
      break;
    }

    default:
      ws.send(
        JSON.stringify({
          type: 'error',
          message: `Unknown message type: ${message.type}`,
        }),
      );
  }
}

server.listen(PORT, () => {
  console.log(`[Server] Listening on port ${PORT}`);
  console.log(`[Server] Workspace: ${WORKSPACE_PATH}`);
  console.log(`[Server] WebSocket available at ws://localhost:${PORT}/ws`);
});
