/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useMemo } from 'react';
import type {
  DiagnosticEvent,
  ParallelGroupInfo,
} from '../utils/eventTreeUtils';
import { extractParallelGroups } from '../utils/eventTreeUtils';

interface ParallelExecutionViewProps {
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

function formatDuration(startTime: Date, endTime: Date): string {
  const durationMs = endTime.getTime() - startTime.getTime();
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }
  return `${(durationMs / 1000).toFixed(2)}s`;
}

interface ParallelGroupCardProps {
  group: ParallelGroupInfo;
  onSelectEvent: (event: DiagnosticEvent) => void;
  selectedEvent: DiagnosticEvent | null;
}

function ParallelGroupCard({
  group,
  onSelectEvent,
  selectedEvent,
}: ParallelGroupCardProps) {
  // Group events by parallelIndex (lane)
  const lanes = useMemo(() => {
    const laneMap = new Map<number, DiagnosticEvent[]>();
    for (const event of group.events) {
      const laneIndex = event.meta.parallelIndex ?? 0;
      if (!laneMap.has(laneIndex)) {
        laneMap.set(laneIndex, []);
      }
      laneMap.get(laneIndex)!.push(event);
    }
    return Array.from(laneMap.entries()).sort((a, b) => a[0] - b[0]);
  }, [group.events]);

  const duration = group.endTime
    ? formatDuration(group.startTime, group.endTime)
    : 'running...';

  return (
    <div style={styles.groupCard}>
      <div style={styles.groupHeader}>
        <span style={styles.groupId}>{group.groupId}</span>
        <span style={styles.groupTime}>
          {formatTime(group.startTime.toISOString())}
        </span>
        <span style={styles.groupDuration}>{duration}</span>
        <span style={styles.groupCount}>
          {group.events.length} events in {lanes.length} lanes
        </span>
      </div>
      <div style={styles.swimlanes}>
        {lanes.map(([laneIndex, laneEvents]) => (
          <div key={laneIndex} style={styles.lane}>
            <div style={styles.laneHeader}>Lane {laneIndex}</div>
            <div style={styles.laneEvents}>
              {laneEvents.map((event) => {
                const isSelected =
                  selectedEvent?.meta.sequence === event.meta.sequence;
                const color = categoryColors[event.meta.category] || '#8b949e';
                const toolName = event.data.toolName as string | undefined;

                return (
                  <div
                    key={event.meta.sequence}
                    style={{
                      ...styles.laneEvent,
                      ...(isSelected ? styles.laneEventSelected : {}),
                      borderLeftColor: color,
                    }}
                    onClick={() => onSelectEvent(event)}
                    title={`${event.meta.category} ${event.meta.eventType}${toolName ? ` - ${toolName}` : ''}`}
                  >
                    <span style={{ ...styles.eventCategory, color }}>
                      {event.meta.category}
                    </span>
                    <span style={styles.eventType}>{event.meta.eventType}</span>
                    {toolName && (
                      <span style={styles.toolName}>{toolName}</span>
                    )}
                    {event.timing?.durationMs !== undefined && (
                      <span style={styles.eventDuration}>
                        {event.timing.durationMs}ms
                      </span>
                    )}
                    {event.error && <span style={styles.eventError}>ERR</span>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ParallelExecutionView({
  events,
  onSelectEvent,
  selectedEvent,
}: ParallelExecutionViewProps) {
  const parallelGroups = useMemo(() => extractParallelGroups(events), [events]);

  const groupsArray = useMemo(
    () =>
      Array.from(parallelGroups.values()).sort(
        (a, b) => a.startTime.getTime() - b.startTime.getTime(),
      ),
    [parallelGroups],
  );

  if (groupsArray.length === 0) {
    return (
      <div style={styles.empty}>
        No parallel execution groups found. Parallel groups are created when
        multiple tools are executed concurrently.
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Parallel Execution Groups</h3>
        <span style={styles.summary}>
          {groupsArray.length} group{groupsArray.length !== 1 ? 's' : ''} found
        </span>
      </div>
      <div style={styles.groupsList}>
        {groupsArray.map((group) => (
          <ParallelGroupCard
            key={group.groupId}
            group={group}
            onSelectEvent={onSelectEvent}
            selectedEvent={selectedEvent}
          />
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid #30363d',
  },
  title: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#f0f6fc',
    margin: 0,
  },
  summary: {
    fontSize: '12px',
    color: '#8b949e',
  },
  groupsList: {
    flex: 1,
    overflow: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  groupCard: {
    background: '#161b22',
    borderRadius: '8px',
    border: '1px solid #30363d',
    overflow: 'hidden',
  },
  groupHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '12px 16px',
    background: '#21262d',
    borderBottom: '1px solid #30363d',
  },
  groupId: {
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#f0883e',
    fontWeight: 600,
  },
  groupTime: {
    fontFamily: 'monospace',
    fontSize: '11px',
    color: '#8b949e',
  },
  groupDuration: {
    fontFamily: 'monospace',
    fontSize: '11px',
    color: '#3fb950',
  },
  groupCount: {
    fontSize: '11px',
    color: '#8b949e',
    marginLeft: 'auto',
  },
  swimlanes: {
    display: 'flex',
    flexDirection: 'row',
    gap: '1px',
    background: '#30363d',
    padding: '1px',
  },
  lane: {
    flex: 1,
    minWidth: '200px',
    background: '#0d1117',
  },
  laneHeader: {
    padding: '8px 12px',
    fontSize: '11px',
    fontWeight: 600,
    color: '#8b949e',
    background: '#161b22',
    borderBottom: '1px solid #30363d',
    textAlign: 'center',
  },
  laneEvents: {
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  laneEvent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '8px',
    background: '#21262d',
    borderRadius: '4px',
    borderLeft: '3px solid #8b949e',
    cursor: 'pointer',
    transition: 'background 0.1s',
  },
  laneEventSelected: {
    background: '#30363d',
    outline: '1px solid #58a6ff',
  },
  eventCategory: {
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
  },
  eventType: {
    fontSize: '11px',
    color: '#c9d1d9',
  },
  toolName: {
    fontSize: '10px',
    color: '#8b949e',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  eventDuration: {
    fontSize: '10px',
    fontFamily: 'monospace',
    color: '#3fb950',
  },
  eventError: {
    fontSize: '9px',
    fontWeight: 600,
    color: '#da3633',
    background: '#da363320',
    padding: '1px 4px',
    borderRadius: '2px',
    alignSelf: 'flex-start',
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
};
