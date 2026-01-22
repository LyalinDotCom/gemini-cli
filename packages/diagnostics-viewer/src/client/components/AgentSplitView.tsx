/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useMemo, useState } from 'react';
import { AgentContextPanel } from './AgentContextPanel';
import type {
  DiagnosticEvent,
  AgentInfo,
  TurnInfo,
} from '../utils/eventTreeUtils';
import { extractAgents } from '../utils/eventTreeUtils';

interface AgentSplitViewProps {
  events: DiagnosticEvent[];
  onSelectEvent: (event: DiagnosticEvent) => void;
  selectedEvent: DiagnosticEvent | null;
  lastViewedSequence?: number | null;
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
  const date = new Date(timestamp);
  return (
    date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }) +
    '.' +
    date.getMilliseconds().toString().padStart(3, '0')
  );
}

function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function getEventSummary(event: DiagnosticEvent): string {
  const { category, eventType } = event.meta;

  if (category === 'api') {
    const model = event.data.model as string | undefined;
    if (model) {
      return `${eventType} - ${model}`;
    }
  }

  if (category === 'tool') {
    const toolName = event.data.toolName as string | undefined;
    if (toolName) {
      return `${eventType} - ${toolName}`;
    }
  }

  if (category === 'thought') {
    const subject = event.data.subject as string | undefined;
    if (subject) {
      return subject.slice(0, 50) + (subject.length > 50 ? '...' : '');
    }
  }

  return eventType;
}

interface TurnGroupProps {
  turn: TurnInfo;
  onSelectEvent: (event: DiagnosticEvent) => void;
  selectedEvent: DiagnosticEvent | null;
  lastViewedSequence?: number | null;
  isExpanded: boolean;
  onToggle: () => void;
}

function TurnGroup({
  turn,
  onSelectEvent,
  selectedEvent,
  lastViewedSequence,
  isExpanded,
  onToggle,
}: TurnGroupProps) {
  const duration =
    turn.startEvent && turn.endEvent
      ? new Date(turn.endEvent.meta.timestamp).getTime() -
        new Date(turn.startEvent.meta.timestamp).getTime()
      : undefined;

  return (
    <div style={styles.turnGroup}>
      <div style={styles.turnHeader} onClick={onToggle}>
        <span style={styles.turnToggle}>{isExpanded ? '▼' : '▶'}</span>
        <span style={styles.turnNumber}>Turn {turn.turnNumber}</span>
        <span style={styles.turnEventCount}>{turn.events.length} events</span>
        {duration !== undefined && (
          <span style={styles.turnDuration}>{formatDuration(duration)}</span>
        )}
      </div>
      {isExpanded && (
        <div style={styles.turnEvents}>
          {turn.events.map((event) => {
            const isSelected =
              selectedEvent?.meta.sequence === event.meta.sequence;
            const isLastViewed =
              lastViewedSequence !== undefined &&
              lastViewedSequence !== null &&
              event.meta.sequence === lastViewedSequence;
            const color = categoryColors[event.meta.category] || '#8b949e';

            return (
              <div
                key={event.meta.sequence}
                style={{
                  ...styles.eventItem,
                  ...(isSelected ? styles.eventItemSelected : {}),
                  ...(isLastViewed && !isSelected
                    ? styles.eventItemLastViewed
                    : {}),
                }}
                onClick={() => onSelectEvent(event)}
              >
                <span style={styles.eventTime}>
                  {formatTime(event.meta.timestamp)}
                </span>
                <span
                  style={{
                    ...styles.eventCategory,
                    backgroundColor: color + '20',
                    color,
                  }}
                >
                  {event.meta.category}
                </span>
                <span style={styles.eventSummary}>
                  {getEventSummary(event)}
                </span>
                {event.timing?.durationMs !== undefined && (
                  <span style={styles.eventDuration}>
                    {event.timing.durationMs}ms
                  </span>
                )}
                {event.error && <span style={styles.eventError}>ERROR</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface AgentEventsViewProps {
  agent: AgentInfo | null;
  events: DiagnosticEvent[];
  onSelectEvent: (event: DiagnosticEvent) => void;
  selectedEvent: DiagnosticEvent | null;
  lastViewedSequence?: number | null;
}

function AgentEventsView({
  agent,
  events: _events,
  onSelectEvent,
  selectedEvent,
  lastViewedSequence,
}: AgentEventsViewProps) {
  const [expandedTurns, setExpandedTurns] = useState<Set<number>>(
    new Set([0, 1, 2]),
  ); // Expand first 3 turns by default

  const toggleTurn = (turnNumber: number) => {
    setExpandedTurns((prev) => {
      const next = new Set(prev);
      if (next.has(turnNumber)) {
        next.delete(turnNumber);
      } else {
        next.add(turnNumber);
      }
      return next;
    });
  };

  const expandAll = () => {
    if (agent) {
      setExpandedTurns(new Set(agent.turns.map((t) => t.turnNumber)));
    }
  };

  const collapseAll = () => {
    setExpandedTurns(new Set());
  };

  if (!agent) {
    return (
      <div style={styles.noAgentSelected}>
        <p style={styles.noAgentText}>
          Select an agent from the sidebar to view its events
        </p>
        <p style={styles.noAgentSubtext}>
          Events will be grouped by turn for easier navigation
        </p>
      </div>
    );
  }

  const status = agent.endEvent ? 'completed' : 'running';
  const statusColor = agent.endEvent ? '#3fb950' : '#f0883e';
  const totalDuration =
    agent.startEvent && agent.endEvent
      ? new Date(agent.endEvent.meta.timestamp).getTime() -
        new Date(agent.startEvent.meta.timestamp).getTime()
      : undefined;

  return (
    <div style={styles.agentEventsContainer}>
      <div style={styles.agentHeader}>
        <div style={styles.agentHeaderMain}>
          <span style={styles.agentName}>{agent.agentName}</span>
          <span style={{ ...styles.agentStatus, color: statusColor }}>
            {status}
          </span>
        </div>
        <div style={styles.agentHeaderMeta}>
          <span style={styles.agentMetaItem}>{agent.turns.length} turns</span>
          <span style={styles.agentMetaItem}>{agent.events.length} events</span>
          {totalDuration !== undefined && (
            <span style={styles.agentMetaItem}>
              {formatDuration(totalDuration)}
            </span>
          )}
        </div>
        <div style={styles.expandCollapseButtons}>
          <button style={styles.expandButton} onClick={expandAll}>
            Expand All
          </button>
          <button style={styles.expandButton} onClick={collapseAll}>
            Collapse All
          </button>
        </div>
      </div>
      <div style={styles.turnsContainer}>
        {agent.turns.length > 0 ? (
          agent.turns.map((turn) => (
            <TurnGroup
              key={turn.turnNumber}
              turn={turn}
              onSelectEvent={onSelectEvent}
              selectedEvent={selectedEvent}
              lastViewedSequence={lastViewedSequence}
              isExpanded={expandedTurns.has(turn.turnNumber)}
              onToggle={() => toggleTurn(turn.turnNumber)}
            />
          ))
        ) : (
          <div style={styles.noTurns}>
            No turns recorded for this agent yet.
          </div>
        )}
      </div>
    </div>
  );
}

export function AgentSplitView({
  events,
  onSelectEvent,
  selectedEvent,
  lastViewedSequence,
}: AgentSplitViewProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const agents = useMemo(() => extractAgents(events), [events]);

  const selectedAgent = selectedAgentId
    ? (agents.get(selectedAgentId) ?? null)
    : null;

  return (
    <div style={styles.container}>
      <div style={styles.sidebar}>
        <AgentContextPanel
          events={events}
          selectedAgentId={selectedAgentId}
          onSelectAgent={setSelectedAgentId}
        />
      </div>
      <div style={styles.content}>
        <AgentEventsView
          agent={selectedAgent}
          events={events}
          onSelectEvent={onSelectEvent}
          selectedEvent={selectedEvent}
          lastViewedSequence={lastViewedSequence}
        />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  sidebar: {
    width: '320px',
    minWidth: '280px',
    maxWidth: '400px',
    borderRight: '1px solid #30363d',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  noAgentSelected: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px',
  },
  noAgentText: {
    fontSize: '16px',
    color: '#c9d1d9',
    marginBottom: '8px',
  },
  noAgentSubtext: {
    fontSize: '13px',
    color: '#8b949e',
  },
  agentEventsContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  agentHeader: {
    padding: '16px',
    borderBottom: '1px solid #30363d',
    background: '#161b22',
  },
  agentHeaderMain: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '8px',
  },
  agentName: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#f778ba',
  },
  agentStatus: {
    fontSize: '11px',
    fontWeight: 500,
    textTransform: 'uppercase',
  },
  agentHeaderMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '12px',
  },
  agentMetaItem: {
    fontSize: '12px',
    color: '#8b949e',
  },
  expandCollapseButtons: {
    display: 'flex',
    gap: '8px',
  },
  expandButton: {
    padding: '4px 12px',
    border: '1px solid #30363d',
    borderRadius: '4px',
    background: '#21262d',
    color: '#8b949e',
    fontSize: '11px',
    cursor: 'pointer',
  },
  turnsContainer: {
    flex: 1,
    overflow: 'auto',
    padding: '16px',
  },
  turnGroup: {
    marginBottom: '16px',
    background: '#161b22',
    borderRadius: '8px',
    border: '1px solid #30363d',
    overflow: 'hidden',
  },
  turnHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    background: '#21262d',
    cursor: 'pointer',
    borderBottom: '1px solid #30363d',
  },
  turnToggle: {
    fontSize: '10px',
    color: '#8b949e',
    width: '12px',
  },
  turnNumber: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#f0f6fc',
  },
  turnEventCount: {
    fontSize: '11px',
    color: '#8b949e',
    marginLeft: 'auto',
  },
  turnDuration: {
    fontSize: '11px',
    fontFamily: 'monospace',
    color: '#3fb950',
  },
  turnEvents: {
    display: 'flex',
    flexDirection: 'column',
  },
  eventItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 16px',
    cursor: 'pointer',
    transition: 'background 0.1s',
    borderBottom: '1px solid #21262d',
  },
  eventItemSelected: {
    background: '#30363d',
  },
  eventItemLastViewed: {
    borderLeft: '3px solid #58a6ff',
    background: '#58a6ff10',
  },
  eventTime: {
    fontFamily: 'monospace',
    fontSize: '11px',
    color: '#8b949e',
    flexShrink: 0,
  },
  eventCategory: {
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: 500,
    textTransform: 'uppercase',
    flexShrink: 0,
  },
  eventSummary: {
    flex: 1,
    fontSize: '12px',
    color: '#c9d1d9',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  eventDuration: {
    fontFamily: 'monospace',
    fontSize: '11px',
    color: '#8b949e',
    flexShrink: 0,
  },
  eventError: {
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: 600,
    background: '#da363320',
    color: '#da3633',
    flexShrink: 0,
  },
  noTurns: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px',
    color: '#8b949e',
    fontSize: '14px',
  },
};
