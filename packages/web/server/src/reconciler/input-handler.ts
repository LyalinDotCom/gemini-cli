/**
 * WebSocket Input Handler
 *
 * Handles incoming WebSocket messages from the browser client
 * and translates them to stdin events for the CLI components.
 */

import type { WebSocket } from 'ws';
import { emitStdinData, emitKeypress, getMockStdout, setInputWebSocket } from './ink-adapters.js';

export interface InputMessage {
  type: 'input' | 'keypress' | 'resize' | 'paste';
  value?: string;
  key?: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  columns?: number;
  rows?: number;
}

/**
 * Set up input handling for a WebSocket connection
 */
export function setupInputHandler(ws: WebSocket) {
  setInputWebSocket(ws);

  ws.on('message', (data) => {
    try {
      const message: InputMessage = JSON.parse(data.toString());
      handleMessage(message);
    } catch (error) {
      console.error('[InputHandler] Failed to parse message:', error);
    }
  });

  ws.on('close', () => {
    setInputWebSocket(null);
  });
}

/**
 * Handle an input message from the client
 */
function handleMessage(message: InputMessage) {
  switch (message.type) {
    case 'input':
      // Raw text input (user typed in composer)
      if (message.value !== undefined) {
        emitStdinData(message.value);
      }
      break;

    case 'keypress':
      // Special key press (Enter, arrows, etc.)
      if (message.key) {
        emitKeypress(
          message.key,
          message.ctrl ?? false,
          message.meta ?? false,
          message.shift ?? false
        );
      }
      break;

    case 'resize':
      // Browser viewport resize
      if (message.columns !== undefined && message.rows !== undefined) {
        getMockStdout().setDimensions(message.columns, message.rows);
      }
      break;

    case 'paste':
      // Paste event with larger text
      if (message.value !== undefined) {
        // Paste events are typically wrapped with specific sequences
        // For now, just emit the data directly
        emitStdinData(message.value);
      }
      break;

    default:
      console.warn('[InputHandler] Unknown message type:', (message as { type: string }).type);
  }
}

/**
 * Simulate pressing Enter to submit input
 */
export function simulateEnter() {
  emitKeypress('return');
}

/**
 * Simulate pressing a confirmation key (y/n)
 */
export function simulateConfirm(confirmed: boolean) {
  emitKeypress(confirmed ? 'y' : 'n');
}

/**
 * Simulate Ctrl+C to cancel
 */
export function simulateCancel() {
  emitKeypress('c', true);
}
