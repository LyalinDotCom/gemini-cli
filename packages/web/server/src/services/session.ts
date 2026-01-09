/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { v4 as uuidv4 } from 'uuid';
import { GeminiService } from './gemini.js';

export interface Session {
  id: string;
  connectionId: string;
  workspacePath: string;
  geminiService: GeminiService;
  pendingConfirmation: {
    correlationId: string;
    toolName: string;
    args: Record<string, unknown>;
  } | null;
  createdAt: Date;
}

export class SessionManager {
  private sessions: Map<string, Session> = new Map();

  async createSession(
    connectionId: string,
    workspacePath: string,
  ): Promise<Session | null> {
    const sessionId = uuidv4();

    try {
      const geminiService = new GeminiService(workspacePath, sessionId);
      await geminiService.initialize();

      const session: Session = {
        id: sessionId,
        connectionId,
        workspacePath,
        geminiService,
        pendingConfirmation: null,
        createdAt: new Date(),
      };

      this.sessions.set(sessionId, session);
      console.log(
        `[SessionManager] Created session ${sessionId} for connection ${connectionId}`,
      );

      return session;
    } catch (err) {
      console.error(`[SessionManager] Failed to create session:`, err);
      return null;
    }
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.geminiService.dispose();
      this.sessions.delete(sessionId);
      console.log(`[SessionManager] Ended session ${sessionId}`);
    }
  }

  getSessionByConnection(connectionId: string): Session | undefined {
    for (const session of this.sessions.values()) {
      if (session.connectionId === connectionId) {
        return session;
      }
    }
    return undefined;
  }
}
