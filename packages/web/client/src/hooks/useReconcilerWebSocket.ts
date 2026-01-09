/**
 * Reconciler WebSocket Hook
 *
 * Connects to the WebSocket reconciler server and receives
 * serialized component tree updates.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// Types matching the server's serialized format
interface SerializedElement {
  id: string;
  type: string;
  props: Record<string, unknown>;
  parentId: string | null;
  children: (SerializedElement | SerializedTextNode)[];
}

interface SerializedTextNode {
  id: string;
  type: 'text';
  value: string;
  parentId: string | null;
}

interface SerializedTree {
  root: SerializedElement | null;
  timestamp: number;
}

interface RenderMessage {
  type: 'render';
  tree: SerializedTree;
}

interface InputMessage {
  type: 'input' | 'keypress' | 'resize' | 'paste';
  value?: string;
  key?: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  columns?: number;
  rows?: number;
}

export interface ReconcilerState {
  tree: SerializedElement | null;
  isConnected: boolean;
  lastUpdate: number | null;
  error: string | null;
}

export interface ReconcilerActions {
  sendInput: (text: string) => void;
  sendKeypress: (key: string, modifiers?: { ctrl?: boolean; meta?: boolean; shift?: boolean }) => void;
  sendResize: (columns: number, rows: number) => void;
  reconnect: () => void;
}

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws';

export function useReconcilerWebSocket(): [ReconcilerState, ReconcilerActions] {
  const [tree, setTree] = useState<SerializedElement | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    console.log('[ReconcilerWS] Connecting to', WS_URL);
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[ReconcilerWS] Connected');
      setIsConnected(true);
      setError(null);

      // Send initial viewport size
      const message: InputMessage = {
        type: 'resize',
        columns: Math.floor(window.innerWidth / 8), // Approximate character width
        rows: Math.floor(window.innerHeight / 16), // Approximate line height
      };
      ws.send(JSON.stringify(message));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'render') {
          const renderMsg = data as RenderMessage;
          setTree(renderMsg.tree.root);
          setLastUpdate(renderMsg.tree.timestamp);
        }
      } catch (err) {
        console.error('[ReconcilerWS] Failed to parse message:', err);
      }
    };

    ws.onerror = (event) => {
      console.error('[ReconcilerWS] WebSocket error:', event);
      setError('WebSocket connection error');
    };

    ws.onclose = (event) => {
      console.log('[ReconcilerWS] Disconnected:', event.code, event.reason);
      setIsConnected(false);
      wsRef.current = null;

      // Auto-reconnect after 3 seconds
      reconnectTimeoutRef.current = window.setTimeout(() => {
        console.log('[ReconcilerWS] Attempting reconnect...');
        connect();
      }, 3000);
    };
  }, []);

  // Connect on mount
  useEffect(() => {
    connect();

    // Handle window resize
    const handleResize = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const message: InputMessage = {
          type: 'resize',
          columns: Math.floor(window.innerWidth / 8),
          rows: Math.floor(window.innerHeight / 16),
        };
        wsRef.current.send(JSON.stringify(message));
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  // Send text input
  const sendInput = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message: InputMessage = {
        type: 'input',
        value: text,
      };
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  // Send keypress
  const sendKeypress = useCallback((
    key: string,
    modifiers?: { ctrl?: boolean; meta?: boolean; shift?: boolean }
  ) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message: InputMessage = {
        type: 'keypress',
        key,
        ctrl: modifiers?.ctrl,
        meta: modifiers?.meta,
        shift: modifiers?.shift,
      };
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  // Send resize
  const sendResize = useCallback((columns: number, rows: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message: InputMessage = {
        type: 'resize',
        columns,
        rows,
      };
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  // Manual reconnect
  const reconnect = useCallback(() => {
    connect();
  }, [connect]);

  const state: ReconcilerState = {
    tree,
    isConnected,
    lastUpdate,
    error,
  };

  const actions: ReconcilerActions = {
    sendInput,
    sendKeypress,
    sendResize,
    reconnect,
  };

  return [state, actions];
}

export default useReconcilerWebSocket;
