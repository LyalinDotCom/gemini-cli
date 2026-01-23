/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { LiveStream, type Checkpoint } from './components/realtime/LiveStream';
import { LiveStats } from './components/realtime/LiveStats';
import { EventDetail } from './components/shared/EventDetail';

interface DiagnosticEvent {
  meta: {
    sessionId: string;
    sequence: number;
    timestamp: string;
    category: string;
    eventType: string;
    version: number;
    // Agent hierarchy fields
    agentId?: string;
    parentAgentId?: string;
    depth?: number;
    turnNumber?: number;
    // Parallel execution fields
    parallelGroupId?: string;
    parallelIndex?: number;
  };
  timing?: { startedAt: string; endedAt?: string; durationMs?: number };
  data: Record<string, unknown>;
  error?: { name: string; message: string; stack?: string };
}

interface SessionInfo {
  sessionId: string;
  path: string;
  eventCount: number;
  firstEventAt: string | null;
  lastEventAt: string | null;
}

export function App() {
  const [events, setEvents] = useState<DiagnosticEvent[]>([]);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<DiagnosticEvent | null>(
    null,
  );
  const [isPaused, setIsPaused] = useState(false);
  const [connected, setConnected] = useState(false);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedEvents, setSelectedEvents] = useState<DiagnosticEvent[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const pausedEventsRef = useRef<DiagnosticEvent[]>([]);

  // Use refs to access current state in WebSocket callbacks without recreating the connection
  const isPausedRef = useRef(isPaused);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: 'get-sessions' }));
    };
    ws.onclose = () => setConnected(false);
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'sessions') {
        if (Array.isArray(message.payload)) setSessions(message.payload);
        else if (message.payload?.currentSessionId)
          setCurrentSessionId(message.payload.currentSessionId);
      } else if (message.type === 'session-events') {
        setCurrentSessionId(message.payload.sessionId);
        setEvents(
          message.payload.events.map(
            (e: { event: DiagnosticEvent }) => e.event,
          ),
        );
      } else if (message.type === 'event') {
        const newEvent = message.payload.event as DiagnosticEvent;
        if (isPausedRef.current) {
          if (
            !pausedEventsRef.current.some(
              (e) => e.meta.sequence === newEvent.meta.sequence,
            )
          ) {
            pausedEventsRef.current.push(newEvent);
          }
        } else {
          setEvents((prev) => {
            if (prev.some((e) => e.meta.sequence === newEvent.meta.sequence))
              return prev;
            return [...prev, newEvent];
          });
        }
      }
    };
    return () => ws.close();
  }, []); // WebSocket connection is stable - no dependencies

  const subscribeToSession = useCallback((sessionId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type: 'subscribe-session', sessionId }),
      );
      setEvents([]);
      setSelectedEvent(null);
      setSelectedEvents([]);
      setCheckpoints([]);
    }
  }, []);

  const handleResume = useCallback(() => {
    setIsPaused(false);
    setEvents((prev) => [...prev, ...pausedEventsRef.current]);
    pausedEventsRef.current = [];
  }, []);
  const handleClear = useCallback(() => {
    setEvents([]);
    setCheckpoints([]);
    setSelectedEvent(null);
    setSelectedEvents([]);
    pausedEventsRef.current = [];
  }, []);

  const handleAddCheckpoint = useCallback(
    (name: string) => {
      const timestamp = new Date().toISOString();
      const newCheckpoint: Checkpoint = {
        id: crypto.randomUUID(),
        name,
        timestamp,
        afterEventIndex: events.length - 1,
      };
      setCheckpoints((prev) => [...prev, newCheckpoint]);
      if (wsRef.current?.readyState === WebSocket.OPEN && currentSessionId) {
        wsRef.current.send(
          JSON.stringify({
            type: 'save-checkpoint',
            sessionId: currentSessionId,
            checkpoint: {
              id: newCheckpoint.id,
              name: newCheckpoint.name,
              timestamp,
              afterEventSequence:
                events.length > 0 ? events[events.length - 1].meta.sequence : 0,
            },
          }),
        );
      }
    },
    [events, currentSessionId],
  );

  const handleSelectEventsAfterCheckpoint = useCallback(
    (checkpoint: Checkpoint) => {
      setSelectedEvents(
        events.filter((_, index) => index > checkpoint.afterEventIndex),
      );
      if (!multiSelectMode) setMultiSelectMode(true);
    },
    [events, multiSelectMode],
  );

  const handleToggleMultiSelect = useCallback(() => {
    setMultiSelectMode((prev) => {
      if (prev) setSelectedEvents([]);
      return !prev;
    });
  }, []);
  const handleToggleEventSelection = useCallback((event: DiagnosticEvent) => {
    setSelectedEvents((prev) =>
      prev.some((e) => e.meta.sequence === event.meta.sequence)
        ? prev.filter((e) => e.meta.sequence !== event.meta.sequence)
        : [...prev, event],
    );
  }, []);

  const handleExportSelected = useCallback(() => {
    if (selectedEvents.length === 0) return;
    const json = JSON.stringify(
      [...selectedEvents].sort((a, b) => a.meta.sequence - b.meta.sequence),
      null,
      2,
    );
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gemini-events-${currentSessionId?.slice(0, 8) || 'unknown'}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [selectedEvents, currentSessionId]);

  const handleCopySelected = useCallback(async () => {
    if (selectedEvents.length === 0) return;
    const json = JSON.stringify(
      [...selectedEvents].sort((a, b) => a.meta.sequence - b.meta.sequence),
      null,
      2,
    );
    try {
      await navigator.clipboard.writeText(json);
      alert(`Copied ${selectedEvents.length} events to clipboard`);
    } catch {
      alert('Failed to copy. Exporting to file...');
      handleExportSelected();
    }
  }, [selectedEvents, handleExportSelected]);

  const refreshSessions = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN)
      wsRef.current.send(JSON.stringify({ type: 'get-sessions' }));
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 24px',
          borderBottom: '1px solid #30363d',
          background: '#161b22',
        }}
      >
        <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#f0f6fc' }}>
          Gemini CLI Insights
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '14px', color: '#8b949e' }}>
              Session:
            </label>
            <select
              style={{
                padding: '6px 12px',
                background: '#21262d',
                border: '1px solid #30363d',
                borderRadius: '6px',
                color: '#f0f6fc',
                fontSize: '13px',
                fontFamily: 'monospace',
                minWidth: '280px',
              }}
              value={currentSessionId || ''}
              onChange={(e) =>
                e.target.value && subscribeToSession(e.target.value)
              }
            >
              {sessions.length === 0 ? (
                <option value="">No sessions</option>
              ) : (
                sessions.map((s) => {
                  const isConnected = s.sessionId === currentSessionId;
                  const time = s.lastEventAt
                    ? new Date(s.lastEventAt).toLocaleTimeString()
                    : 'new';
                  return (
                    <option key={s.sessionId} value={s.sessionId}>
                      {isConnected ? '● ' : ''}
                      {s.sessionId.slice(0, 8)}... ({s.eventCount} events) -{' '}
                      {time}
                      {isConnected ? ' (connected)' : ''}
                    </option>
                  );
                })
              )}
            </select>
            <button
              style={{
                padding: '6px 10px',
                background: '#21262d',
                border: '1px solid #30363d',
                borderRadius: '6px',
                color: '#8b949e',
                cursor: 'pointer',
              }}
              onClick={refreshSessions}
            >
              ↻
            </button>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              color: '#8b949e',
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: connected ? '#238636' : '#da3633',
              }}
            />
            {connected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
      </header>

      <main
        style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <LiveStats events={events} />
          <LiveStream
            events={events}
            checkpoints={checkpoints}
            isPaused={isPaused}
            onPause={() => setIsPaused(true)}
            onResume={handleResume}
            onSelectEvent={setSelectedEvent}
            onClear={handleClear}
            onAddCheckpoint={handleAddCheckpoint}
            selectedEvent={selectedEvent}
            selectedEvents={selectedEvents}
            multiSelectMode={multiSelectMode}
            onToggleMultiSelect={handleToggleMultiSelect}
            onToggleEventSelection={handleToggleEventSelection}
            onCopySelected={handleCopySelected}
            onExportSelected={handleExportSelected}
            onSelectEventsAfterCheckpoint={handleSelectEventsAfterCheckpoint}
          />
        </div>
        {selectedEvent && !multiSelectMode && (
          <EventDetail
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
          />
        )}
      </main>
    </div>
  );
}
