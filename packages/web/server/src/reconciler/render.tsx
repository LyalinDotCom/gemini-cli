/**
 * WebSocket Render Entry Point
 *
 * Renders React components using our custom reconciler and broadcasts
 * the tree over WebSocket.
 */

import React, { useState, useEffect } from 'react';
import type { WebSocketServer, WebSocket } from 'ws';
import { reconciler, createRoot, setBroadcastCallback } from './host-config.js';
import { broadcast, addClient, removeClient } from './broadcaster.js';
import type { WSElement } from './types.js';

// Simple test component to verify reconciler works
function TestApp({ message }: { message: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCount(c => c + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return React.createElement('ink-box', { flexDirection: 'column' },
    React.createElement('ink-text', { color: 'green' }, `Message: ${message}`),
    React.createElement('ink-text', {}, `Count: ${count}`),
    React.createElement('ink-box', { marginTop: 1 },
      React.createElement('ink-text', { bold: true }, 'WebSocket Reconciler Test')
    )
  );
}

interface RenderInstance {
  update: (element: React.ReactElement) => void;
  unmount: () => void;
}

/**
 * Render a React element using our WebSocket reconciler
 */
export function renderToWebSocket(
  element: React.ReactElement,
  wsServer: WebSocketServer
): RenderInstance {
  // Create root container
  const root = createRoot();

  // Set up broadcast callback
  setBroadcastCallback((rootElement: WSElement | null) => {
    broadcast(rootElement);
  });

  // Handle WebSocket connections
  wsServer.on('connection', (ws: WebSocket) => {
    addClient(ws);

    ws.on('close', () => {
      removeClient(ws);
    });

    ws.on('error', (err) => {
      console.error('[Reconciler] WebSocket error:', err);
      removeClient(ws);
    });
  });

  // Create reconciler container
  const container = reconciler.createContainer(
    root,           // containerInfo
    0,              // tag (LegacyRoot = 0)
    null,           // hydrationCallbacks
    false,          // isStrictMode
    null,           // concurrentUpdatesByDefaultOverride
    '',             // identifierPrefix
    (error: Error) => console.error('[Reconciler] Error:', error), // onRecoverableError
    null            // transitionCallbacks
  );

  // Initial render
  reconciler.updateContainer(element, container, null, () => {
    console.log('[Reconciler] Initial render complete');
  });

  return {
    update: (newElement: React.ReactElement) => {
      reconciler.updateContainer(newElement, container, null, () => {
        console.log('[Reconciler] Update complete');
      });
    },
    unmount: () => {
      reconciler.updateContainer(null, container, null, () => {
        console.log('[Reconciler] Unmounted');
      });
    },
  };
}

/**
 * Start a test render to verify the reconciler works
 */
export function startTestRender(wsServer: WebSocketServer): RenderInstance {
  console.log('[Reconciler] Starting test render...');

  const element = React.createElement(TestApp, { message: 'Hello from WebSocket Reconciler!' });
  return renderToWebSocket(element, wsServer);
}
