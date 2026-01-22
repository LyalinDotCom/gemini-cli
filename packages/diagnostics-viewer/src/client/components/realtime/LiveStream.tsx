/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useRef, useEffect, useState } from 'react';
import { EventList } from '../shared/EventList';

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

export interface Checkpoint {
  id: string;
  name: string;
  timestamp: string;
  afterEventIndex: number;
}

interface LiveStreamProps {
  events: DiagnosticEvent[];
  checkpoints: Checkpoint[];
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onSelectEvent: (event: DiagnosticEvent) => void;
  onClear: () => void;
  onAddCheckpoint: (name: string) => void;
  selectedEvent: DiagnosticEvent | null;
  selectedEvents: DiagnosticEvent[];
  multiSelectMode: boolean;
  onToggleMultiSelect: () => void;
  onToggleEventSelection: (event: DiagnosticEvent) => void;
  onCopySelected: () => void;
  onExportSelected: () => void;
  onSelectEventsAfterCheckpoint: (checkpoint: Checkpoint) => void;
}

export function LiveStream({
  events,
  checkpoints,
  isPaused,
  onPause,
  onResume,
  onSelectEvent,
  onClear,
  onAddCheckpoint,
  selectedEvent,
  selectedEvents,
  multiSelectMode,
  onToggleMultiSelect,
  onToggleEventSelection,
  onCopySelected,
  onExportSelected,
  onSelectEventsAfterCheckpoint,
}: LiveStreamProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showCheckpointInput, setShowCheckpointInput] = useState(false);
  const [checkpointName, setCheckpointName] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const prevEventsLengthRef = useRef(events.length);

  // Only auto-scroll if enabled and new events were added
  useEffect(() => {
    if (
      !isPaused &&
      autoScroll &&
      scrollRef.current &&
      events.length > prevEventsLengthRef.current
    ) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevEventsLengthRef.current = events.length;
  }, [events, isPaused, autoScroll]);

  // Detect if user scrolled away from bottom
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  const handleAddCheckpoint = () => {
    if (showCheckpointInput) {
      onAddCheckpoint(checkpointName || `Checkpoint ${checkpoints.length + 1}`);
      setCheckpointName('');
      setShowCheckpointInput(false);
    } else setShowCheckpointInput(true);
  };

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
          gap: '8px',
          padding: '8px 24px',
          borderBottom: '1px solid #30363d',
          flexWrap: 'wrap',
        }}
      >
        <button style={btn} onClick={isPaused ? onResume : onPause}>
          {isPaused ? 'Resume' : 'Pause'}
        </button>
        {showClearConfirm ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#f0883e' }}>
              Clear all events?
            </span>
            <button
              style={{
                ...btn,
                border: '1px solid #da3633',
                background: '#da363320',
                color: '#da3633',
              }}
              onClick={() => {
                onClear();
                setShowClearConfirm(false);
              }}
            >
              Yes
            </button>
            <button style={btn} onClick={() => setShowClearConfirm(false)}>
              No
            </button>
          </div>
        ) : (
          <button style={btn} onClick={() => setShowClearConfirm(true)}>
            Clear
          </button>
        )}
        {showCheckpointInput ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="text"
              placeholder="Checkpoint name (optional)"
              value={checkpointName}
              onChange={(e) => setCheckpointName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddCheckpoint();
                else if (e.key === 'Escape') {
                  setShowCheckpointInput(false);
                  setCheckpointName('');
                }
              }}
              style={{
                padding: '6px 12px',
                border: '1px solid #30363d',
                borderRadius: '6px',
                background: '#0d1117',
                color: '#c9d1d9',
                fontSize: '12px',
                outline: 'none',
                width: '180px',
              }}
              autoFocus
            />
            <button style={btn} onClick={handleAddCheckpoint}>
              Add
            </button>
            <button
              style={btn}
              onClick={() => {
                setShowCheckpointInput(false);
                setCheckpointName('');
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button style={btn} onClick={handleAddCheckpoint}>
            + Checkpoint
          </button>
        )}
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
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          {!autoScroll && (
            <button
              style={{
                ...btn,
                border: '1px solid #58a6ff',
                background: '#58a6ff20',
                color: '#58a6ff',
              }}
              onClick={() => {
                setAutoScroll(true);
                if (scrollRef.current)
                  scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
              }}
            >
              ↓ Jump to latest
            </button>
          )}
          {isPaused && (
            <span style={{ fontSize: '12px', color: '#f0883e' }}>
              Paused - new events queued
            </span>
          )}
        </div>
      </div>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}
      >
        <EventList
          events={events}
          checkpoints={checkpoints}
          onSelectEvent={onSelectEvent}
          selectedEvent={selectedEvent}
          multiSelectMode={multiSelectMode}
          selectedEvents={selectedEvents}
          onToggleEventSelection={onToggleEventSelection}
          onSelectEventsAfterCheckpoint={onSelectEventsAfterCheckpoint}
        />
      </div>
    </div>
  );
}
