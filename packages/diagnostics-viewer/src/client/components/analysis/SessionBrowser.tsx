/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useState } from 'react';
import { EventList } from '../shared/EventList';

interface SessionInfo {
  sessionId: string;
  path: string;
  eventCount: number;
  firstEventAt: string | null;
  lastEventAt: string | null;
}
interface DiagnosticEvent {
  meta: {
    sessionId: string;
    sequence: number;
    timestamp: string;
    category: string;
    eventType: string;
    version: number;
  };
  timing?: { startedAt: string; endedAt?: string; durationMs?: number };
  data: Record<string, unknown>;
  error?: { name: string; message: string; stack?: string };
}

interface SessionBrowserProps {
  sessions: SessionInfo[];
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  events: DiagnosticEvent[];
  onSelectEvent: (event: DiagnosticEvent) => void;
  selectedEvent: DiagnosticEvent | null;
  selectedEvents: DiagnosticEvent[];
  multiSelectMode: boolean;
  onToggleMultiSelect: () => void;
  onToggleEventSelection: (event: DiagnosticEvent) => void;
  onCopySelected: () => void;
  onExportSelected: () => void;
}

export function SessionBrowser({
  sessions,
  currentSessionId,
  onSelectSession,
  events,
  onSelectEvent,
  selectedEvent,
  selectedEvents,
  multiSelectMode,
  onToggleMultiSelect,
  onToggleEventSelection,
  onCopySelected,
  onExportSelected,
}: SessionBrowserProps) {
  const [filter, setFilter] = useState('');
  const filteredEvents = filter
    ? events.filter((e) =>
        `${e.meta.category} ${e.meta.eventType} ${JSON.stringify(e.data)}`
          .toLowerCase()
          .includes(filter.toLowerCase()),
      )
    : events;
  const btn: React.CSSProperties = {
    padding: '6px 12px',
    border: '1px solid #30363d',
    borderRadius: '6px',
    background: '#21262d',
    color: '#c9d1d9',
    fontSize: '12px',
    cursor: 'pointer',
  };

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      <div
        style={{
          width: '280px',
          borderRight: '1px solid #30363d',
          display: 'flex',
          flexDirection: 'column',
          background: '#0d1117',
        }}
      >
        <h3
          style={{
            padding: '16px',
            margin: 0,
            fontSize: '14px',
            fontWeight: 600,
            color: '#f0f6fc',
            borderBottom: '1px solid #30363d',
          }}
        >
          Sessions
        </h3>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {sessions.map((s) => (
            <div
              key={s.sessionId}
              onClick={() => onSelectSession(s.sessionId)}
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                borderBottom: '1px solid #21262d',
                background:
                  s.sessionId === currentSessionId ? '#21262d' : 'transparent',
              }}
            >
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  color: '#58a6ff',
                  marginBottom: '4px',
                }}
              >
                {s.sessionId.slice(0, 8)}...
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  color: '#8b949e',
                }}
              >
                <span>{s.eventCount} events</span>
                <span>
                  {s.lastEventAt
                    ? new Date(s.lastEventAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '-'}
                </span>
              </div>
            </div>
          ))}
          {sessions.length === 0 && (
            <div
              style={{
                padding: '24px',
                textAlign: 'center',
                color: '#8b949e',
                fontSize: '13px',
              }}
            >
              No sessions found
            </div>
          )}
        </div>
      </div>
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 24px',
            borderBottom: '1px solid #30363d',
          }}
        >
          <input
            type="text"
            placeholder="Filter events..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              flex: 1,
              maxWidth: '300px',
              padding: '8px 12px',
              border: '1px solid #30363d',
              borderRadius: '6px',
              background: '#0d1117',
              color: '#c9d1d9',
              fontSize: '13px',
              outline: 'none',
            }}
          />
          <span style={{ fontSize: '12px', color: '#8b949e' }}>
            {filteredEvents.length} of {events.length} events
          </span>
          <div
            style={{
              width: '1px',
              height: '20px',
              background: '#30363d',
              margin: '0 4px',
            }}
          />
          <button
            style={{
              ...btn,
              ...(multiSelectMode
                ? { background: '#238636', borderColor: '#238636' }
                : {}),
            }}
            onClick={onToggleMultiSelect}
          >
            {multiSelectMode ? 'Exit Select' : 'Multi-Select'}
          </button>
          {multiSelectMode && selectedEvents.length > 0 && (
            <>
              <button
                style={{
                  ...btn,
                  border: '1px solid #58a6ff',
                  background: '#58a6ff20',
                  color: '#58a6ff',
                }}
                onClick={onCopySelected}
              >
                Copy {selectedEvents.length}
              </button>
              <button
                style={{
                  ...btn,
                  border: '1px solid #3fb950',
                  background: '#3fb95020',
                  color: '#3fb950',
                }}
                onClick={onExportSelected}
              >
                Export {selectedEvents.length}
              </button>
            </>
          )}
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
          <EventList
            events={filteredEvents}
            onSelectEvent={onSelectEvent}
            selectedEvent={selectedEvent}
            multiSelectMode={multiSelectMode}
            selectedEvents={selectedEvents}
            onToggleEventSelection={onToggleEventSelection}
          />
        </div>
      </div>
    </div>
  );
}
