/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';

interface DiagnosticEvent {
  meta: {
    sessionId: string;
    sequence: number;
    timestamp: string;
    category: string;
    eventType: string;
    version: number;
    agentId?: string;
    parentAgentId?: string;
    depth?: number;
    turnNumber?: number;
  };
  timing?: { startedAt: string; endedAt?: string; durationMs?: number };
  data: Record<string, unknown>;
  error?: { name: string; message: string; stack?: string };
}

interface Checkpoint {
  id: string;
  name: string;
  timestamp: string;
  afterEventIndex: number;
}

interface AgentTree {
  agentId: string;
  agentName: string;
  startEvent: DiagnosticEvent;
  endEvent?: DiagnosticEvent;
  events: DiagnosticEvent[];
  status: 'running' | 'completed' | 'error';
  lastStep?: string;
}

interface EventListProps {
  events: DiagnosticEvent[];
  checkpoints?: Checkpoint[];
  onSelectEvent: (event: DiagnosticEvent) => void;
  selectedEvent: DiagnosticEvent | null;
  multiSelectMode?: boolean;
  selectedEvents?: DiagnosticEvent[];
  onToggleEventSelection?: (event: DiagnosticEvent) => void;
  onSelectEventsAfterCheckpoint?: (checkpoint: Checkpoint) => void;
}

const categoryColors: Record<string, string> = {
  api: '#58a6ff',
  thought: '#a371f7',
  tool: '#3fb950',
  user: '#f0883e',
  system: '#8b949e',
  agent: '#f778ba',
};

function formatTime(timestamp: string): string {
  const d = new Date(timestamp);
  return (
    d.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }) +
    '.' +
    d.getMilliseconds().toString().padStart(3, '0')
  );
}

function getEventSummary(event: DiagnosticEvent): string {
  const { category, eventType } = event.meta;
  if (category === 'api' && event.data.model)
    return `${eventType} - ${event.data.model}`;
  if (category === 'tool' && event.data.toolName)
    return `${eventType} - ${event.data.toolName}`;
  if (category === 'thought' && event.data.subject)
    return (
      String(event.data.subject).slice(0, 50) +
      (String(event.data.subject).length > 50 ? '...' : '')
    );
  return eventType;
}

function getApiContextInfo(
  event: DiagnosticEvent,
): { tokens?: number; chars?: number } | null {
  if (event.meta.category !== 'api') return null;

  const usage = event.data.usageMetadata as
    | { promptTokenCount?: number; totalTokenCount?: number }
    | undefined;
  if (usage?.promptTokenCount) {
    return { tokens: usage.promptTokenCount };
  }

  // Fallback to char count estimate
  let chars = 0;
  if (event.data.systemInstruction) {
    chars += JSON.stringify(event.data.systemInstruction).length;
  }
  if (event.data.contents) {
    chars += JSON.stringify(event.data.contents).length;
  }
  if (chars > 0) {
    return { chars };
  }
  return null;
}

function getLastStepSummary(events: DiagnosticEvent[]): string {
  // Find the last meaningful event (not agent start/end)
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event.meta.category === 'agent') continue;

    if (event.meta.category === 'tool') {
      const toolName = event.data.toolName as string;
      return event.meta.eventType === 'complete'
        ? `completed ${toolName}`
        : `running ${toolName}...`;
    }
    if (event.meta.category === 'api') {
      return event.meta.eventType === 'response'
        ? 'got response'
        : 'calling API...';
    }
    if (event.meta.category === 'thought') {
      return 'thinking...';
    }
  }
  return 'starting...';
}

// Build agent trees from events
function buildAgentTrees(events: DiagnosticEvent[]): Map<string, AgentTree> {
  const trees = new Map<string, AgentTree>();

  for (const event of events) {
    const agentId = event.meta.agentId;
    if (!agentId) continue;

    // Agent start event - create tree
    if (event.meta.category === 'agent' && event.meta.eventType === 'start') {
      trees.set(agentId, {
        agentId,
        agentName: (event.data.agentName as string) || 'Agent',
        startEvent: event,
        events: [],
        status: 'running',
      });
      continue;
    }

    // Agent end event - mark complete
    if (event.meta.category === 'agent' && event.meta.eventType === 'end') {
      const tree = trees.get(agentId);
      if (tree) {
        tree.endEvent = event;
        // GOAL and MAX_TURNS are successful completions, everything else is an error
        const status = event.data.status as string;
        tree.status =
          status === 'GOAL' || status === 'MAX_TURNS' ? 'completed' : 'error';
      }
      continue;
    }

    // Other events - add to tree
    const tree = trees.get(agentId);
    if (tree) {
      tree.events.push(event);
      tree.lastStep = getLastStepSummary(tree.events);
    }
  }

  return trees;
}

interface AgentTreeNodeProps {
  tree: AgentTree;
  onSelectEvent: (event: DiagnosticEvent) => void;
  selectedEvent: DiagnosticEvent | null;
}

function AgentTreeNode({
  tree,
  onSelectEvent,
  selectedEvent,
}: AgentTreeNodeProps) {
  const [expanded, setExpanded] = useState(false);

  const statusColor =
    tree.status === 'completed'
      ? '#3fb950'
      : tree.status === 'error'
        ? '#f85149'
        : '#f0883e';

  const durationMs = tree.endEvent?.data.durationMs as number | undefined;
  const totalTurns = tree.endEvent?.data.totalTurns as number | undefined;

  return (
    <div style={{ marginTop: '8px', marginBottom: '8px' }}>
      {/* Tree header - collapsible */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 24px',
          cursor: 'pointer',
          background: '#f778ba12',
          borderLeft: '4px solid #f778ba',
          borderRadius: '0 8px 8px 0',
        }}
      >
        <span
          style={{
            fontSize: '12px',
            color: '#8b949e',
            width: '16px',
          }}
        >
          {expanded ? '▼' : '▶'}
        </span>
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#8b949e',
            width: '90px',
            flexShrink: 0,
          }}
        >
          {formatTime(tree.startEvent.meta.timestamp)}
        </span>
        <span
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: '#f778ba',
          }}
        >
          {tree.agentName}
        </span>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 500,
            color: statusColor,
            textTransform: 'uppercase',
          }}
        >
          {tree.status}
        </span>
        {tree.status === 'running' && tree.lastStep && (
          <span
            style={{
              fontSize: '12px',
              color: '#8b949e',
              fontStyle: 'italic',
            }}
          >
            {tree.lastStep}
          </span>
        )}
        {tree.status !== 'running' && (
          <>
            {totalTurns !== undefined && (
              <span style={{ fontSize: '11px', color: '#8b949e' }}>
                {totalTurns} turns
              </span>
            )}
            {durationMs !== undefined && (
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  color: '#3fb950',
                }}
              >
                {(durationMs / 1000).toFixed(1)}s
              </span>
            )}
          </>
        )}
        <span
          style={{
            marginLeft: 'auto',
            fontSize: '11px',
            color: '#8b949e',
          }}
        >
          {tree.events.length} events
        </span>
      </div>

      {/* Expanded content - agent's events */}
      {expanded && (
        <div
          style={{
            borderLeft: '2px solid #f778ba40',
            marginLeft: '12px',
            background: '#f778ba08',
          }}
        >
          {tree.events.map((event) => {
            const isSel = selectedEvent?.meta.sequence === event.meta.sequence;
            const color = categoryColors[event.meta.category] || '#8b949e';

            return (
              <div
                key={`${event.meta.sessionId}-${event.meta.sequence}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectEvent(event);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '6px 24px',
                  paddingLeft: '36px',
                  cursor: 'pointer',
                  background: isSel ? '#21262d' : 'transparent',
                }}
              >
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    color: '#8b949e',
                    width: '90px',
                    flexShrink: 0,
                  }}
                >
                  {formatTime(event.meta.timestamp)}
                </span>
                <span
                  style={{
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    background: color + '20',
                    color,
                  }}
                >
                  {event.meta.category}
                </span>
                <span
                  style={{
                    fontSize: '12px',
                    color: '#c9d1d9',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                >
                  {getEventSummary(event)}
                </span>
                {(() => {
                  const ctxInfo = getApiContextInfo(event);
                  if (!ctxInfo) return null;
                  return (
                    <span
                      style={{
                        fontSize: '9px',
                        fontFamily: 'monospace',
                        color: '#58a6ff',
                        background: '#58a6ff15',
                        padding: '1px 4px',
                        borderRadius: '3px',
                      }}
                      title={
                        ctxInfo.tokens
                          ? `${ctxInfo.tokens.toLocaleString()} prompt tokens`
                          : `${ctxInfo.chars?.toLocaleString()} chars`
                      }
                    >
                      {ctxInfo.tokens
                        ? `${(ctxInfo.tokens / 1000).toFixed(1)}k`
                        : `${((ctxInfo.chars || 0) / 1000).toFixed(0)}k`}
                    </span>
                  );
                })()}
                {event.timing?.durationMs !== undefined && (
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '11px',
                      color: '#8b949e',
                    }}
                  >
                    {event.timing.durationMs}ms
                  </span>
                )}
                {event.error && (
                  <span
                    style={{
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 600,
                      background: '#da363320',
                      color: '#da3633',
                    }}
                  >
                    ERROR
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function EventList({
  events,
  checkpoints = [],
  onSelectEvent,
  selectedEvent,
  multiSelectMode = false,
  selectedEvents = [],
  onToggleEventSelection,
  onSelectEventsAfterCheckpoint,
}: EventListProps) {
  // Build agent trees - must be before any early returns (React hooks rule)
  const agentTrees = useMemo(() => buildAgentTrees(events), [events]);

  if (events.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#8b949e',
          fontSize: '14px',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        No events yet. Run /diagnostics in Gemini CLI to enable diagnostics.
      </div>
    );
  }

  // Track which agents we've already rendered
  const renderedAgents = new Set<string>();

  const checkpointMap = new Map<number, Checkpoint>();
  for (const cp of checkpoints) checkpointMap.set(cp.afterEventIndex, cp);

  const isSelected = (e: DiagnosticEvent) =>
    selectedEvents.some((s) => s.meta.sequence === e.meta.sequence);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {events.map((event, index) => {
        const checkpoint = checkpointMap.get(index);
        const agentId = event.meta.agentId;

        // If this event belongs to an agent, check if we should render the tree
        if (agentId) {
          // Agent start - render the whole tree here
          if (
            event.meta.category === 'agent' &&
            event.meta.eventType === 'start'
          ) {
            const tree = agentTrees.get(agentId);
            if (tree && !renderedAgents.has(agentId)) {
              renderedAgents.add(agentId);
              return (
                <React.Fragment
                  key={`${event.meta.sessionId}-${event.meta.sequence}`}
                >
                  <AgentTreeNode
                    tree={tree}
                    onSelectEvent={onSelectEvent}
                    selectedEvent={selectedEvent}
                  />
                  {checkpoint &&
                    renderCheckpoint(checkpoint, onSelectEventsAfterCheckpoint)}
                </React.Fragment>
              );
            }
          }
          // Skip all other agent events - they're rendered in the tree
          return null;
        }

        // Regular event (no agent) - render normally
        const isSel = selectedEvent?.meta.sequence === event.meta.sequence;
        const isMultiSel = multiSelectMode && isSelected(event);
        const color = categoryColors[event.meta.category] || '#8b949e';

        return (
          <React.Fragment
            key={`${event.meta.sessionId}-${event.meta.sequence}`}
          >
            <div
              onClick={() =>
                multiSelectMode && onToggleEventSelection
                  ? onToggleEventSelection(event)
                  : onSelectEvent(event)
              }
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '8px 24px',
                cursor: 'pointer',
                background: isMultiSel
                  ? '#238636'
                  : isSel
                    ? '#21262d'
                    : 'transparent',
                borderLeft: isMultiSel ? '3px solid #3fb950' : 'none',
              }}
            >
              {multiSelectMode && (
                <span
                  style={{
                    width: '18px',
                    height: '18px',
                    border: '1px solid #30363d',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    color: '#fff',
                    background: isMultiSel ? '#238636' : 'transparent',
                    borderColor: isMultiSel ? '#238636' : '#30363d',
                  }}
                >
                  {isMultiSel ? '✓' : ''}
                </span>
              )}
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  color: '#8b949e',
                  width: '100px',
                  flexShrink: 0,
                }}
              >
                {formatTime(event.meta.timestamp)}
              </span>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  width: '70px',
                  textAlign: 'center',
                  background: color + '20',
                  color,
                }}
              >
                {event.meta.category}
              </span>
              <span
                style={{
                  fontSize: '13px',
                  color: '#c9d1d9',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '300px',
                }}
              >
                {getEventSummary(event)}
              </span>
              {(() => {
                const ctxInfo = getApiContextInfo(event);
                if (!ctxInfo) return null;
                return (
                  <span
                    style={{
                      fontSize: '10px',
                      fontFamily: 'monospace',
                      color: '#58a6ff',
                      background: '#58a6ff15',
                      padding: '2px 6px',
                      borderRadius: '4px',
                    }}
                    title={
                      ctxInfo.tokens
                        ? `${ctxInfo.tokens.toLocaleString()} prompt tokens`
                        : `${ctxInfo.chars?.toLocaleString()} chars in context`
                    }
                  >
                    {ctxInfo.tokens
                      ? `${(ctxInfo.tokens / 1000).toFixed(1)}k tok`
                      : `${((ctxInfo.chars || 0) / 1000).toFixed(1)}k chr`}
                  </span>
                );
              })()}
              <span style={{ flex: 1 }} />
              {event.timing?.durationMs !== undefined && (
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    color: '#8b949e',
                  }}
                >
                  {event.timing.durationMs}ms
                </span>
              )}
              {event.error && (
                <span
                  style={{
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 600,
                    background: '#da363320',
                    color: '#da3633',
                  }}
                >
                  ERROR
                </span>
              )}
            </div>
            {checkpoint &&
              renderCheckpoint(checkpoint, onSelectEventsAfterCheckpoint)}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function renderCheckpoint(
  checkpoint: Checkpoint,
  onSelectEventsAfterCheckpoint?: (checkpoint: Checkpoint) => void,
) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 24px',
      }}
    >
      <div
        style={{
          flex: 1,
          height: '1px',
          background:
            'linear-gradient(90deg, transparent, #a371f7, transparent)',
        }}
      />
      <span
        style={{
          fontSize: '12px',
          fontWeight: 600,
          color: '#a371f7',
          padding: '4px 12px',
          background: '#a371f720',
          borderRadius: '12px',
        }}
      >
        {checkpoint.name}
      </span>
      <span
        style={{
          fontSize: '11px',
          color: '#8b949e',
          fontFamily: 'monospace',
        }}
      >
        {formatTime(checkpoint.timestamp)}
      </span>
      {onSelectEventsAfterCheckpoint && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelectEventsAfterCheckpoint(checkpoint);
          }}
          style={{
            padding: '2px 8px',
            border: '1px solid #a371f7',
            borderRadius: '4px',
            background: '#a371f720',
            color: '#a371f7',
            fontSize: '10px',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          Select Below
        </button>
      )}
      <div
        style={{
          flex: 1,
          height: '1px',
          background:
            'linear-gradient(90deg, transparent, #a371f7, transparent)',
        }}
      />
    </div>
  );
}
