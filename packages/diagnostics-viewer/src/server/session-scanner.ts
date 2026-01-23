/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { DiagnosticEvent } from '@google/gemini-cli-diagnostics';

export interface SessionInfo {
  sessionId: string;
  path: string;
  eventCount: number;
  firstEventAt: string | null;
  lastEventAt: string | null;
}

export interface SessionEvent {
  event: DiagnosticEvent;
  filename: string;
}

export class SessionScanner {
  constructor(private readonly baseDir: string) {}

  async listSessions(): Promise<SessionInfo[]> {
    try {
      const entries = await readdir(this.baseDir, { withFileTypes: true });
      const sessions: SessionInfo[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const sessionPath = join(this.baseDir, entry.name);
        let jsonFiles: string[] = [];
        try {
          const files = await readdir(sessionPath);
          jsonFiles = files.filter((f) => f.endsWith('.json'));
          jsonFiles.sort();
        } catch {
          // Directory might be empty or inaccessible, still include it
        }

        let firstEventAt: string | null = null;
        let lastEventAt: string | null = null;

        if (jsonFiles.length > 0) {
          try {
            const first = JSON.parse(
              await readFile(join(sessionPath, jsonFiles[0]), 'utf-8'),
            ) as DiagnosticEvent;
            firstEventAt = first.meta.timestamp;
          } catch {
            /* ignore */
          }

          try {
            const last = JSON.parse(
              await readFile(
                join(sessionPath, jsonFiles[jsonFiles.length - 1]),
                'utf-8',
              ),
            ) as DiagnosticEvent;
            lastEventAt = last.meta.timestamp;
          } catch {
            /* ignore */
          }
        }

        // Use directory creation time as fallback for empty sessions
        // This helps sort new sessions that don't have events yet
        const createdAt = firstEventAt || new Date().toISOString();

        sessions.push({
          sessionId: entry.name,
          path: sessionPath,
          eventCount: jsonFiles.length,
          firstEventAt: firstEventAt || createdAt,
          lastEventAt: lastEventAt || createdAt,
        });
      }

      sessions.sort((a, b) => {
        if (!a.lastEventAt) return 1;
        if (!b.lastEventAt) return -1;
        return b.lastEventAt.localeCompare(a.lastEventAt);
      });

      return sessions;
    } catch {
      return [];
    }
  }

  async getSessionEvents(sessionId: string): Promise<SessionEvent[]> {
    const sessionPath = join(this.baseDir, sessionId);
    const events: SessionEvent[] = [];
    try {
      const files = await readdir(sessionPath);
      const jsonFiles = files.filter((f) => f.endsWith('.json')).sort();
      for (const filename of jsonFiles) {
        try {
          const event = JSON.parse(
            await readFile(join(sessionPath, filename), 'utf-8'),
          ) as DiagnosticEvent;
          events.push({ event, filename });
        } catch {
          /* skip */
        }
      }
    } catch {
      /* ignore */
    }
    return events;
  }

  async getMostRecentSession(): Promise<string | null> {
    const sessions = await this.listSessions();
    return sessions.length > 0 ? sessions[0].sessionId : null;
  }
}
