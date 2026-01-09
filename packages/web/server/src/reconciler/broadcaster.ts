/**
 * WebSocket Broadcaster
 *
 * Broadcasts the serialized React component tree to all connected WebSocket clients.
 */

import type { WebSocket } from 'ws';
import type { WSElement, WSTextNode, SerializedTree, RenderUpdate } from './types.js';

// Connected WebSocket clients
const clients: Set<WebSocket> = new Set();

export function addClient(ws: WebSocket) {
  clients.add(ws);
  console.log(`[Broadcaster] Client added. Total: ${clients.size}`);
}

export function removeClient(ws: WebSocket) {
  clients.delete(ws);
  console.log(`[Broadcaster] Client removed. Total: ${clients.size}`);
}

export function getClientCount(): number {
  return clients.size;
}

interface SerializedTreeOutput {
  root: SerializedElement | null;
  timestamp: number;
}

/**
 * Serialize a WSElement tree to a plain JSON-safe object
 */
function serializeTree(root: WSElement | null): SerializedTreeOutput {
  return {
    root: root ? serializeElement(root) : null,
    timestamp: Date.now(),
  };
}

/**
 * Deep clone and sanitize a value for JSON serialization
 */
function sanitizeValue(value: unknown, seen = new WeakSet()): unknown {
  // Handle primitives
  if (value === null || value === undefined) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  // Skip functions
  if (typeof value === 'function') return undefined;

  // Handle arrays
  if (Array.isArray(value)) {
    return value.map(item => sanitizeValue(item, seen));
  }

  // Handle objects
  if (typeof value === 'object') {
    // Detect circular references
    if (seen.has(value as object)) {
      return '[Circular]';
    }
    seen.add(value as object);

    // Skip React internals
    const obj = value as Record<string, unknown>;
    if ('$$typeof' in obj || 'stateNode' in obj || '_owner' in obj) {
      return undefined;
    }

    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      // Skip internal React keys
      if (key.startsWith('__') || key.startsWith('_')) continue;
      const sanitized = sanitizeValue(val, seen);
      if (sanitized !== undefined) {
        result[key] = sanitized;
      }
    }
    return result;
  }

  return undefined;
}

interface SerializedElement {
  id: string;
  type: string;
  props: Record<string, unknown>;
  parentId: string | null;
  children: (SerializedElement | WSTextNode)[];
}

function serializeElement(element: WSElement): SerializedElement {
  const props = (sanitizeValue(element.inkProps) || {}) as Record<string, unknown>;
  return {
    id: element.id,
    type: element.type,
    props, // Rename inkProps back to props for the client
    parentId: element.parentId,
    children: element.children.map(child => {
      if (child.type === 'text') {
        return child; // WSTextNode is already serializable
      }
      return serializeElement(child as WSElement);
    }),
  };
}

/**
 * Broadcast the current tree to all connected clients
 */
export function broadcast(root: WSElement | null) {
  if (clients.size === 0) {
    return;
  }

  const tree = serializeTree(root);
  const message: RenderUpdate = {
    type: 'render',
    tree,
  };

  const data = JSON.stringify(message);
  let sent = 0;

  for (const client of clients) {
    if (client.readyState === client.OPEN) {
      client.send(data);
      sent++;
    }
  }

  console.log(`[Broadcaster] Sent tree update to ${sent} clients (${tree.root?.children.length ?? 0} children)`);
}

/**
 * Send a message to a specific client
 */
export function sendToClient(ws: WebSocket, message: unknown) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
}
