/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';

interface DiagnosticEvent {
  meta: { category: string; eventType: string };
  timing?: { durationMs?: number };
  data: Record<string, unknown>;
}

interface LiveStatsProps {
  events: DiagnosticEvent[];
}

export function LiveStats({ events }: LiveStatsProps) {
  const stats = useMemo(() => {
    let totalTokens = 0;
    let apiCalls = 0;
    let toolCalls = 0;
    let thoughts = 0;
    let totalDuration = 0;
    for (const event of events) {
      if (event.meta.category === 'api') {
        if (event.meta.eventType === 'request') apiCalls++;
        const usage = event.data.usageMetadata as
          | { totalTokenCount?: number }
          | undefined;
        if (usage?.totalTokenCount) totalTokens += usage.totalTokenCount;
        if (event.timing?.durationMs) totalDuration += event.timing.durationMs;
      } else if (event.meta.category === 'tool') toolCalls++;
      else if (event.meta.category === 'thought') thoughts++;
    }
    return { totalTokens, apiCalls, toolCalls, thoughts, totalDuration };
  }, [events]);

  const Stat = ({
    value,
    label,
  }: {
    value: string | number;
    label: string;
  }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <span
        style={{
          fontSize: '24px',
          fontWeight: 600,
          color: '#f0f6fc',
          fontFamily: 'monospace',
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: '12px',
          color: '#8b949e',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
    </div>
  );

  return (
    <div
      style={{
        display: 'flex',
        gap: '24px',
        padding: '16px 24px',
        borderBottom: '1px solid #30363d',
        background: '#161b22',
      }}
    >
      <Stat value={events.length} label="Events" />
      <Stat value={stats.apiCalls} label="API Calls" />
      <Stat value={stats.toolCalls} label="Tool Calls" />
      <Stat value={stats.thoughts} label="Thoughts" />
      <Stat value={stats.totalTokens.toLocaleString()} label="Tokens" />
      <Stat
        value={`${(stats.totalDuration / 1000).toFixed(1)}s`}
        label="Total Time"
      />
    </div>
  );
}
