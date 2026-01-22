/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import type {
  DiagnosticEvent,
  AgentMetrics,
  AgentInfo,
} from '../utils/eventTreeUtils';
import { extractAgents, calculateAgentMetrics } from '../utils/eventTreeUtils';

interface AgentContextPanelProps {
  events: DiagnosticEvent[];
  selectedAgentId?: string | null;
  onSelectAgent?: (agentId: string | null) => void;
}

function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

interface AgentCardProps {
  metrics: AgentMetrics;
  agentInfo: AgentInfo;
  isSelected: boolean;
  onSelect: () => void;
  depth: number;
}

function AgentCard({
  metrics,
  agentInfo,
  isSelected,
  onSelect,
  depth,
}: AgentCardProps) {
  const status = agentInfo.endEvent ? 'completed' : 'running';
  const statusColor = agentInfo.endEvent ? '#3fb950' : '#f0883e';

  return (
    <div
      style={{
        ...styles.agentCard,
        ...(isSelected ? styles.agentCardSelected : {}),
        marginLeft: `${depth * 16}px`,
      }}
      onClick={onSelect}
    >
      <div style={styles.cardHeader}>
        <span style={styles.agentName}>{metrics.agentName}</span>
        <span style={{ ...styles.status, color: statusColor }}>{status}</span>
      </div>
      <div style={styles.agentIdRow}>
        <span style={styles.agentIdLabel}>ID:</span>
        <span style={styles.agentId}>{metrics.agentId.slice(-12)}</span>
      </div>
      <div style={styles.metricsGrid}>
        <div style={styles.metric}>
          <span style={styles.metricValue}>{metrics.totalTurns}</span>
          <span style={styles.metricLabel}>turns</span>
        </div>
        <div style={styles.metric}>
          <span style={styles.metricValue}>{metrics.apiRequests}</span>
          <span style={styles.metricLabel}>API calls</span>
        </div>
        <div style={styles.metric}>
          <span style={styles.metricValue}>{metrics.toolCalls}</span>
          <span style={styles.metricLabel}>tool calls</span>
        </div>
        <div style={styles.metric}>
          <span
            style={{
              ...styles.metricValue,
              color: metrics.errors > 0 ? '#da3633' : '#3fb950',
            }}
          >
            {metrics.errors}
          </span>
          <span style={styles.metricLabel}>errors</span>
        </div>
      </div>
      {metrics.durationMs !== undefined && (
        <div style={styles.durationRow}>
          <span style={styles.durationLabel}>Duration:</span>
          <span style={styles.durationValue}>
            {formatDuration(metrics.durationMs)}
          </span>
        </div>
      )}
    </div>
  );
}

export function AgentContextPanel({
  events,
  selectedAgentId,
  onSelectAgent,
}: AgentContextPanelProps) {
  const agents = useMemo(() => extractAgents(events), [events]);
  const metrics = useMemo(() => calculateAgentMetrics(events), [events]);

  // Build hierarchy for display
  const rootAgents = useMemo(
    () => Array.from(agents.values()).filter((a) => !a.parentAgentId),
    [agents],
  );

  const getChildAgents = (parentId: string): AgentInfo[] =>
    Array.from(agents.values()).filter((a) => a.parentAgentId === parentId);

  const renderAgentHierarchy = (
    agentInfo: AgentInfo,
    depth: number = 0,
  ): React.ReactNode => {
    const agentMetrics = metrics.find((m) => m.agentId === agentInfo.agentId);
    if (!agentMetrics) return null;

    const children = getChildAgents(agentInfo.agentId);

    return (
      <React.Fragment key={agentInfo.agentId}>
        <AgentCard
          metrics={agentMetrics}
          agentInfo={agentInfo}
          isSelected={selectedAgentId === agentInfo.agentId}
          onSelect={() =>
            onSelectAgent?.(
              selectedAgentId === agentInfo.agentId ? null : agentInfo.agentId,
            )
          }
          depth={depth}
        />
        {children.map((child) => renderAgentHierarchy(child, depth + 1))}
      </React.Fragment>
    );
  };

  if (agents.size === 0) {
    return (
      <div style={styles.empty}>
        No agent context found in events. Run with agent instrumentation
        enabled.
      </div>
    );
  }

  // Calculate totals
  const totalTurns = metrics.reduce((sum, m) => sum + m.totalTurns, 0);
  const totalApiCalls = metrics.reduce((sum, m) => sum + m.apiRequests, 0);
  const totalToolCalls = metrics.reduce((sum, m) => sum + m.toolCalls, 0);
  const totalErrors = metrics.reduce((sum, m) => sum + m.errors, 0);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Agent Context</h3>
        <span style={styles.agentCount}>
          {agents.size} agent{agents.size !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Summary stats */}
      <div style={styles.summary}>
        <div style={styles.summaryItem}>
          <span style={styles.summaryValue}>{totalTurns}</span>
          <span style={styles.summaryLabel}>total turns</span>
        </div>
        <div style={styles.summaryItem}>
          <span style={styles.summaryValue}>{totalApiCalls}</span>
          <span style={styles.summaryLabel}>API calls</span>
        </div>
        <div style={styles.summaryItem}>
          <span style={styles.summaryValue}>{totalToolCalls}</span>
          <span style={styles.summaryLabel}>tool calls</span>
        </div>
        <div style={styles.summaryItem}>
          <span
            style={{
              ...styles.summaryValue,
              color: totalErrors > 0 ? '#da3633' : '#3fb950',
            }}
          >
            {totalErrors}
          </span>
          <span style={styles.summaryLabel}>errors</span>
        </div>
      </div>

      {/* Agent hierarchy */}
      <div style={styles.agentList}>
        {selectedAgentId && (
          <button
            style={styles.clearFilter}
            onClick={() => onSelectAgent?.(null)}
          >
            Clear Selection
          </button>
        )}
        {rootAgents.map((agent) => renderAgentHierarchy(agent))}
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
  agentCount: {
    fontSize: '12px',
    color: '#8b949e',
  },
  summary: {
    display: 'flex',
    gap: '16px',
    padding: '12px 16px',
    background: '#21262d',
    borderBottom: '1px solid #30363d',
  },
  summaryItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#f0f6fc',
  },
  summaryLabel: {
    fontSize: '10px',
    color: '#8b949e',
    textTransform: 'uppercase',
  },
  agentList: {
    flex: 1,
    overflow: 'auto',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  clearFilter: {
    alignSelf: 'flex-start',
    padding: '4px 12px',
    border: '1px solid #58a6ff',
    borderRadius: '4px',
    background: '#58a6ff20',
    color: '#58a6ff',
    fontSize: '11px',
    cursor: 'pointer',
    marginBottom: '8px',
  },
  agentCard: {
    background: '#161b22',
    borderRadius: '6px',
    border: '1px solid #30363d',
    padding: '12px',
    cursor: 'pointer',
    transition: 'all 0.1s',
  },
  agentCardSelected: {
    borderColor: '#f778ba',
    background: '#f778ba10',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '4px',
  },
  agentName: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#f778ba',
  },
  status: {
    fontSize: '10px',
    fontWeight: 500,
    textTransform: 'uppercase',
  },
  agentIdRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    marginBottom: '8px',
  },
  agentIdLabel: {
    fontSize: '10px',
    color: '#8b949e',
  },
  agentId: {
    fontSize: '10px',
    fontFamily: 'monospace',
    color: '#8b949e',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '8px',
    marginBottom: '8px',
  },
  metric: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '4px',
    background: '#21262d',
    borderRadius: '4px',
  },
  metricValue: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#f0f6fc',
  },
  metricLabel: {
    fontSize: '9px',
    color: '#8b949e',
  },
  durationRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  durationLabel: {
    fontSize: '10px',
    color: '#8b949e',
  },
  durationValue: {
    fontSize: '11px',
    fontFamily: 'monospace',
    color: '#3fb950',
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
