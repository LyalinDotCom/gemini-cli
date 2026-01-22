/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useState, useMemo } from 'react';
import type { DiagnosticEvent, EventTreeNode } from '../utils/eventTreeUtils';
import { buildEventTree } from '../utils/eventTreeUtils';

interface EventTreeViewProps {
  events: DiagnosticEvent[];
  onSelectEvent: (event: DiagnosticEvent) => void;
  selectedEvent: DiagnosticEvent | null;
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

  if (category === 'agent') {
    const agentName = event.data.agentName as string | undefined;
    if (eventType === 'start' || eventType === 'end') {
      return `${eventType} - ${agentName || 'unknown'}`;
    }
    if (eventType === 'turn-start' || eventType === 'turn-end') {
      const turnNumber = event.meta.turnNumber ?? event.data.turnNumber;
      return `${eventType} #${turnNumber}`;
    }
  }

  return eventType;
}

interface TreeNodeProps {
  node: EventTreeNode;
  onSelectEvent: (event: DiagnosticEvent) => void;
  selectedEvent: DiagnosticEvent | null;
  defaultExpanded?: boolean;
}

function TreeNode({
  node,
  onSelectEvent,
  selectedEvent,
  defaultExpanded = true,
}: TreeNodeProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const { event, children } = node;
  const hasChildren = children.length > 0;
  const isSelected = selectedEvent?.meta.sequence === event.meta.sequence;
  const color = categoryColors[event.meta.category] || '#8b949e';
  const isAgentEvent =
    event.meta.category === 'agent' &&
    (event.meta.eventType === 'start' || event.meta.eventType === 'end');

  return (
    <div style={styles.treeNode}>
      <div
        style={{
          ...styles.nodeItem,
          ...(isSelected ? styles.nodeItemSelected : {}),
          ...(isAgentEvent ? styles.agentNode : {}),
        }}
        onClick={() => onSelectEvent(event)}
      >
        {hasChildren ? (
          <button
            style={styles.expandButton}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            {expanded ? '▼' : '▶'}
          </button>
        ) : (
          <span style={styles.expandPlaceholder} />
        )}
        <span style={styles.time}>{formatTime(event.meta.timestamp)}</span>
        <span
          style={{
            ...styles.category,
            backgroundColor: color + '20',
            color,
          }}
        >
          {event.meta.category}
        </span>
        <span style={styles.summary}>{getEventSummary(event)}</span>
        {event.timing?.durationMs !== undefined && (
          <span style={styles.duration}>{event.timing.durationMs}ms</span>
        )}
        {event.error && <span style={styles.error}>ERROR</span>}
      </div>
      {hasChildren && expanded && (
        <div style={styles.childrenContainer}>
          {children.map((child, index) => (
            <TreeNode
              key={`${child.event.meta.sessionId}-${child.event.meta.sequence}-${index}`}
              node={child}
              onSelectEvent={onSelectEvent}
              selectedEvent={selectedEvent}
              defaultExpanded={node.depth < 1} // Auto-expand only first level
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function EventTreeView({
  events,
  onSelectEvent,
  selectedEvent,
}: EventTreeViewProps) {
  const treeNodes = useMemo(() => buildEventTree(events), [events]);

  if (events.length === 0) {
    return (
      <div style={styles.empty}>
        No events yet. Run /diagnostics in Gemini CLI to enable diagnostics.
      </div>
    );
  }

  if (treeNodes.length === 0) {
    return (
      <div style={styles.empty}>
        No hierarchical structure found. Events may not have agent context.
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {treeNodes.map((node, index) => (
        <TreeNode
          key={`${node.event.meta.sessionId}-${node.event.meta.sequence}-${index}`}
          node={node}
          onSelectEvent={onSelectEvent}
          selectedEvent={selectedEvent}
          defaultExpanded={true}
        />
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    padding: '8px 0',
  },
  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#8b949e',
    fontSize: '14px',
    padding: '24px',
    textAlign: 'center',
  },
  treeNode: {
    display: 'flex',
    flexDirection: 'column',
  },
  nodeItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 16px',
    cursor: 'pointer',
    transition: 'background 0.1s',
  },
  nodeItemSelected: {
    background: '#21262d',
  },
  agentNode: {
    borderLeft: '2px solid #f778ba',
    background: '#f778ba10',
  },
  expandButton: {
    background: 'none',
    border: 'none',
    color: '#8b949e',
    cursor: 'pointer',
    padding: '2px 4px',
    fontSize: '10px',
    width: '20px',
    flexShrink: 0,
  },
  expandPlaceholder: {
    width: '20px',
    flexShrink: 0,
  },
  time: {
    fontFamily: 'monospace',
    fontSize: '11px',
    color: '#8b949e',
    width: '90px',
    flexShrink: 0,
  },
  category: {
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: 500,
    textTransform: 'uppercase',
    width: '60px',
    textAlign: 'center',
    flexShrink: 0,
  },
  summary: {
    flex: 1,
    fontSize: '12px',
    color: '#c9d1d9',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  duration: {
    fontFamily: 'monospace',
    fontSize: '11px',
    color: '#8b949e',
    flexShrink: 0,
  },
  error: {
    padding: '2px 4px',
    borderRadius: '4px',
    fontSize: '9px',
    fontWeight: 600,
    background: '#da363320',
    color: '#da3633',
  },
  childrenContainer: {
    marginLeft: '20px',
    borderLeft: '1px solid #30363d',
  },
};
