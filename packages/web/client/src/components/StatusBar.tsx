/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

interface StatusBarProps {
  isConnected: boolean;
  isStreaming: boolean;
  model: string;
  directory: string;
}

function shortenPath(path: string): string {
  // Replace home directory with ~
  const home = '/Users/';
  if (path.startsWith(home)) {
    const afterHome = path.slice(home.length);
    const parts = afterHome.split('/');
    if (parts.length > 0) {
      return '~/' + parts.slice(1).join('/');
    }
  }
  // If path is too long, show only last 2 segments
  const parts = path.split('/');
  if (parts.length > 3) {
    return '.../' + parts.slice(-2).join('/');
  }
  return path;
}

export default function StatusBar({
  isConnected,
  isStreaming,
  model,
  directory,
}: StatusBarProps) {
  const displayPath =
    directory === 'connecting...' ? directory : shortenPath(directory);

  return (
    <div className="status-bar">
      <div className="status-left">
        <span className="status-item">
          {isConnected ? (
            <span style={{ color: 'var(--accent-green)' }}>●</span>
          ) : (
            <span style={{ color: 'var(--accent-red)' }}>○</span>
          )}
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
        <span className="status-item">{displayPath}</span>
      </div>
      <div className="status-right">
        <span className="status-item">
          {isStreaming && <span className="spinner" />}
          {isStreaming ? 'Responding' : 'Manual'}
        </span>
        <span className="status-item">({model})</span>
        <span className="status-item">/model</span>
      </div>
    </div>
  );
}
