/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';

export type TabId = 'timeline' | 'agents' | 'parallel';

interface TabContainerProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  newEventCount: number;
  agentCount?: number;
  parallelGroupCount?: number;
}

export function TabContainer({
  activeTab,
  onTabChange,
  newEventCount,
  agentCount = 0,
  parallelGroupCount = 0,
}: TabContainerProps) {
  return (
    <div style={styles.container}>
      <button
        style={{
          ...styles.tab,
          ...(activeTab === 'timeline' ? styles.activeTab : {}),
        }}
        onClick={() => onTabChange('timeline')}
      >
        Timeline
        {activeTab !== 'timeline' && newEventCount > 0 && (
          <span style={styles.badge}>{newEventCount}</span>
        )}
      </button>
      <button
        style={{
          ...styles.tab,
          ...(activeTab === 'agents' ? styles.activeTab : {}),
        }}
        onClick={() => onTabChange('agents')}
      >
        Agents
        {agentCount > 0 && <span style={styles.agentBadge}>{agentCount}</span>}
      </button>
      <button
        style={{
          ...styles.tab,
          ...(activeTab === 'parallel' ? styles.activeTab : {}),
        }}
        onClick={() => onTabChange('parallel')}
      >
        Parallel
        {parallelGroupCount > 0 && (
          <span style={styles.parallelBadge}>{parallelGroupCount}</span>
        )}
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    gap: '4px',
    padding: '8px 24px',
    borderBottom: '1px solid #30363d',
    background: '#0d1117',
  },
  tab: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: '6px',
    background: 'transparent',
    color: '#8b949e',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.2s',
  },
  activeTab: {
    background: '#21262d',
    color: '#f0f6fc',
  },
  badge: {
    padding: '2px 6px',
    borderRadius: '10px',
    background: '#238636',
    color: '#fff',
    fontSize: '12px',
    fontWeight: 600,
  },
  agentBadge: {
    padding: '2px 6px',
    borderRadius: '10px',
    background: '#f778ba30',
    color: '#f778ba',
    fontSize: '11px',
    fontWeight: 600,
  },
  parallelBadge: {
    padding: '2px 6px',
    borderRadius: '10px',
    background: '#f0883e30',
    color: '#f0883e',
    fontSize: '11px',
    fontWeight: 600,
  },
};
