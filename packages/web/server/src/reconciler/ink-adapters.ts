/**
 * Ink Hook Adapters for WebSocket Reconciler
 *
 * These adapters provide compatible interfaces to Ink's hooks,
 * but forward input from WebSocket clients instead of stdin
 * and handle output differently (no terminal).
 */

import { EventEmitter } from 'events';
import type { WebSocket } from 'ws';

// Global event emitter for simulating stdin
const stdinEmitter = new EventEmitter();
let rawModeEnabled = false;

// Connected WebSocket for input
let inputWs: WebSocket | null = null;

/**
 * Set the WebSocket connection for receiving user input
 */
export function setInputWebSocket(ws: WebSocket | null) {
  inputWs = ws;
}

/**
 * Emit data to stdin emitter (called when WebSocket receives input)
 */
export function emitStdinData(data: string | Buffer) {
  stdinEmitter.emit('data', Buffer.from(data));
}

/**
 * Emit a keypress event (for special keys)
 */
export function emitKeypress(key: string, ctrl = false, meta = false, shift = false) {
  // Convert key name to appropriate escape sequence or character
  const keyMap: Record<string, string> = {
    return: '\r',
    enter: '\r',
    escape: '\x1b',
    tab: '\t',
    backspace: '\x7f',
    delete: '\x1b[3~',
    up: '\x1b[A',
    down: '\x1b[B',
    right: '\x1b[C',
    left: '\x1b[D',
    home: '\x1b[H',
    end: '\x1b[F',
    pageup: '\x1b[5~',
    pagedown: '\x1b[6~',
    y: 'y',
    n: 'n',
  };

  let data = keyMap[key.toLowerCase()] || key;

  // Handle ctrl modifier
  if (ctrl && data.length === 1) {
    const code = data.toUpperCase().charCodeAt(0);
    if (code >= 65 && code <= 90) {
      data = String.fromCharCode(code - 64);
    }
  }

  emitStdinData(data);
}

/**
 * Mock stdin object that mimics Node's ReadStream
 */
class MockStdin extends EventEmitter {
  isTTY = true;
  isRaw = false;

  setRawMode(mode: boolean) {
    this.isRaw = mode;
    rawModeEnabled = mode;
    return this;
  }

  read() {
    return null;
  }

  resume() {
    return this;
  }

  pause() {
    return this;
  }
}

const mockStdin = new MockStdin();

// Forward events from stdinEmitter to mockStdin
stdinEmitter.on('data', (data) => {
  mockStdin.emit('data', data);
});

/**
 * Mock stdout object that captures ANSI codes
 */
class MockStdout extends EventEmitter {
  isTTY = true;
  columns = 120;
  rows = 40;

  private buffer: string[] = [];

  write(data: string | Buffer) {
    const str = typeof data === 'string' ? data : data.toString();
    this.buffer.push(str);
    // Could broadcast ANSI codes to clients if needed
    return true;
  }

  getBuffer() {
    return this.buffer;
  }

  clearBuffer() {
    this.buffer = [];
  }

  // Update dimensions (called when browser sends viewport size)
  setDimensions(columns: number, rows: number) {
    const changed = this.columns !== columns || this.rows !== rows;
    this.columns = columns;
    this.rows = rows;
    if (changed) {
      this.emit('resize');
    }
  }
}

const mockStdout = new MockStdout();

/**
 * useStdin adapter
 * Returns mock stdin and setRawMode function
 */
export function useStdin() {
  return {
    stdin: mockStdin,
    setRawMode: (mode: boolean) => {
      mockStdin.setRawMode(mode);
    },
    isRawModeSupported: true,
  };
}

/**
 * useStdout adapter
 * Returns mock stdout
 */
export function useStdout() {
  return {
    stdout: mockStdout,
    write: (data: string) => mockStdout.write(data),
  };
}

/**
 * App instance for useApp
 */
let rerenderCallback: (() => void) | null = null;

export function setRerenderCallback(cb: () => void) {
  rerenderCallback = cb;
}

/**
 * useApp adapter
 * Provides exit and rerender functionality
 */
export function useApp() {
  return {
    exit: (error?: Error) => {
      console.log('[InkAdapter] App exit called', error?.message);
      // Could broadcast exit event to clients
    },
    rerender: () => {
      if (rerenderCallback) {
        rerenderCallback();
      }
    },
  };
}

/**
 * useIsScreenReaderEnabled adapter
 * Always returns false for web (no screen reader detection in browser)
 */
export function useIsScreenReaderEnabled() {
  return false;
}

/**
 * measureElement adapter
 * Returns mock dimensions - actual measurements happen on client
 */
export function measureElement(_element: unknown): {
  width: number;
  height: number;
  x: number;
  y: number;
} {
  // Return reasonable defaults - actual layout happens on client
  return {
    width: mockStdout.columns,
    height: 1,
    x: 0,
    y: 0,
  };
}

/**
 * Get the mock stdout for external access
 */
export function getMockStdout() {
  return mockStdout;
}

/**
 * Get the mock stdin for external access
 */
export function getMockStdin() {
  return mockStdin;
}

/**
 * useTerminalSize adapter
 * Returns current viewport dimensions
 */
export function useTerminalSize() {
  return {
    columns: mockStdout.columns,
    rows: mockStdout.rows,
  };
}

/**
 * Box component adapter (just passes through to reconciler)
 */
export const Box = 'ink-box';

/**
 * Text component adapter (just passes through to reconciler)
 */
export const Text = 'ink-text';

/**
 * Static component adapter
 */
export const Static = 'ink-static';

/**
 * Newline component adapter
 */
export const Newline = 'ink-newline';

/**
 * Transform component adapter
 */
export const Transform = 'ink-transform';

/**
 * Spacer component adapter
 */
export const Spacer = 'ink-spacer';
