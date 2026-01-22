/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';

interface TabContainerProps {
  activeTab: 'realtime' | 'analysis';
  onTabChange: (tab: 'realtime' | 'analysis') => void;
  newEventCount: number;
}

export function TabContainer({
  activeTab,
  onTabChange,
  newEventCount,
}: TabContainerProps) {
  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    border: 'none',
    borderRadius: '6px',
    background: active ? '#21262d' : 'transparent',
    color: active ? '#f0f6fc' : '#8b949e',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  });

  return (
    <div
      style={{
        display: 'flex',
        gap: '4px',
        padding: '8px 24px',
        borderBottom: '1px solid #30363d',
        background: '#0d1117',
      }}
    >
      <button
        style={tabStyle(activeTab === 'realtime')}
        onClick={() => onTabChange('realtime')}
      >
        Real-time
        {activeTab !== 'realtime' && newEventCount > 0 && (
          <span
            style={{
              padding: '2px 6px',
              borderRadius: '10px',
              background: '#238636',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            {newEventCount}
          </span>
        )}
      </button>
      <button
        style={tabStyle(activeTab === 'analysis')}
        onClick={() => onTabChange('analysis')}
      >
        Analysis
      </button>
    </div>
  );
}
