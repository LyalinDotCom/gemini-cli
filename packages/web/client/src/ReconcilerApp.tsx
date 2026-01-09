/**
 * Reconciler App
 *
 * Main app component that connects to the WebSocket reconciler
 * and renders the serialized component tree.
 */

import React, { useCallback, useRef, useEffect, useState } from 'react';
import { useReconcilerWebSocket } from './hooks/useReconcilerWebSocket';
import { TreeRenderer } from './components/TreeRenderer';

export function ReconcilerApp(): React.ReactElement {
  const [state, actions] = useReconcilerWebSocket();
  const { tree, isConnected, lastUpdate, error } = state;
  const { sendInput, sendKeypress } = actions;

  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle input submission
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (inputValue.trim()) {
        sendInput(inputValue);
        sendKeypress('return');
        setInputValue('');
      }
    },
    [inputValue, sendInput, sendKeypress]
  );

  // Handle key presses for special keys
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Handle special keys
      if (e.key === 'Escape') {
        sendKeypress('escape');
      } else if (e.key === 'ArrowUp') {
        sendKeypress('up');
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        sendKeypress('down');
        e.preventDefault();
      } else if (e.key === 'y' && e.ctrlKey) {
        sendKeypress('y', { ctrl: true });
        e.preventDefault();
      } else if (e.key === 'n' && e.ctrlKey) {
        sendKeypress('n', { ctrl: true });
        e.preventDefault();
      }
    },
    [sendKeypress]
  );

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="reconciler-app">
      {/* Status bar */}
      <div className="reconciler-status">
        <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '● Connected' : '○ Disconnected'}
        </span>
        {lastUpdate && (
          <span className="last-update">
            Last update: {new Date(lastUpdate).toLocaleTimeString()}
          </span>
        )}
        {error && <span className="error">{error}</span>}
      </div>

      {/* Rendered tree */}
      <div className="reconciler-content">
        <TreeRenderer tree={tree} />
      </div>

      {/* Input area */}
      <form className="reconciler-input" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isConnected ? 'Type a message...' : 'Connecting...'}
          disabled={!isConnected}
          autoFocus
        />
        <button type="submit" disabled={!isConnected || !inputValue.trim()}>
          Send
        </button>
      </form>

      {/* Quick action buttons for tool confirmations */}
      <div className="reconciler-actions">
        <button onClick={() => sendKeypress('y')} disabled={!isConnected}>
          Yes (y)
        </button>
        <button onClick={() => sendKeypress('n')} disabled={!isConnected}>
          No (n)
        </button>
        <button onClick={() => sendKeypress('escape')} disabled={!isConnected}>
          Cancel (Esc)
        </button>
      </div>

      <style>{`
        .reconciler-app {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: #1a1a1a;
          color: #e0e0e0;
          font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
        }

        .reconciler-status {
          display: flex;
          gap: 16px;
          padding: 8px 16px;
          background: #2a2a2a;
          border-bottom: 1px solid #3a3a3a;
          font-size: 12px;
        }

        .connection-status {
          font-weight: bold;
        }

        .connection-status.connected {
          color: #4ade80;
        }

        .connection-status.disconnected {
          color: #f87171;
        }

        .last-update {
          color: #888;
        }

        .error {
          color: #f87171;
        }

        .reconciler-content {
          flex: 1;
          overflow: auto;
          padding: 16px;
        }

        .reconciler-input {
          display: flex;
          gap: 8px;
          padding: 16px;
          background: #2a2a2a;
          border-top: 1px solid #3a3a3a;
        }

        .reconciler-input input {
          flex: 1;
          padding: 12px 16px;
          background: #1a1a1a;
          border: 1px solid #3a3a3a;
          border-radius: 8px;
          color: #e0e0e0;
          font-family: inherit;
          font-size: 14px;
        }

        .reconciler-input input:focus {
          outline: none;
          border-color: #4ade80;
        }

        .reconciler-input input:disabled {
          opacity: 0.5;
        }

        .reconciler-input button {
          padding: 12px 24px;
          background: #4ade80;
          border: none;
          border-radius: 8px;
          color: #000;
          font-weight: bold;
          cursor: pointer;
        }

        .reconciler-input button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .reconciler-input button:hover:not(:disabled) {
          background: #6ee7a0;
        }

        .reconciler-actions {
          display: flex;
          gap: 8px;
          padding: 8px 16px;
          background: #2a2a2a;
          border-top: 1px solid #3a3a3a;
        }

        .reconciler-actions button {
          padding: 8px 16px;
          background: #3a3a3a;
          border: none;
          border-radius: 4px;
          color: #e0e0e0;
          cursor: pointer;
          font-size: 12px;
        }

        .reconciler-actions button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .reconciler-actions button:hover:not(:disabled) {
          background: #4a4a4a;
        }

        /* TreeRenderer styles */
        .tree-renderer {
          min-height: 100%;
        }

        .tree-renderer-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 200px;
          color: #888;
        }

        .ws-root {
          font-size: 14px;
          line-height: 1;
          white-space: pre;
        }

        .ink-box {
          display: flex;
        }

        .ink-text {
          white-space: pre;
        }
      `}</style>
    </div>
  );
}

export default ReconcilerApp;
