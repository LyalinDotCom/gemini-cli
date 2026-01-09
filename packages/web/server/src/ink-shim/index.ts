/**
 * Ink Shim Module
 *
 * This module provides Ink-compatible exports that use our WebSocket-based
 * implementations. It's designed to be used via tsconfig paths or bundler
 * aliasing to intercept imports from 'ink'.
 */

import React, { createContext, useContext } from 'react';
import { EventEmitter } from 'events';

// Re-export all types from real ink
export * from 'ink';

// ============================================
// Context Types
// ============================================

interface StdinContextValue {
  stdin: NodeJS.ReadStream | EventEmitter;
  internal_eventEmitter: EventEmitter;
  setRawMode: (mode: boolean) => void;
  isRawModeSupported: boolean;
  internal_exitOnCtrlC: boolean;
}

interface StdoutContextValue {
  stdout: NodeJS.WriteStream | { write: (data: string) => boolean; columns: number; rows: number };
  write: (data: string) => void;
}

interface AppContextValue {
  exit: (error?: Error) => void;
  rerender: () => void;
}

// ============================================
// Mock Implementations
// ============================================

class MockStdin extends EventEmitter {
  isTTY = true;
  isRaw = false;

  setRawMode(mode: boolean) {
    this.isRaw = mode;
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

class MockStdout extends EventEmitter {
  isTTY = true;
  columns = 120;
  rows = 40;

  write(data: string | Buffer) {
    return true;
  }

  setDimensions(columns: number, rows: number) {
    const changed = this.columns !== columns || this.rows !== rows;
    this.columns = columns;
    this.rows = rows;
    if (changed) {
      this.emit('resize');
    }
  }
}

// Singleton instances
const mockStdin = new MockStdin();
const mockStdout = new MockStdout();
const internalEventEmitter = new EventEmitter();

// Exit/rerender callbacks
let exitCallback: ((error?: Error) => void) | null = null;
let rerenderCallback: (() => void) | null = null;

/**
 * Set the exit callback
 */
export function setExitCallback(cb: (error?: Error) => void) {
  exitCallback = cb;
}

/**
 * Set the rerender callback
 */
export function setRerenderCallback(cb: () => void) {
  rerenderCallback = cb;
}

/**
 * Emit data to stdin (called from WebSocket input)
 */
export function emitStdinData(data: string | Buffer) {
  mockStdin.emit('data', Buffer.from(data));
}

/**
 * Get mock stdout for setting dimensions
 */
export function getMockStdout() {
  return mockStdout;
}

// ============================================
// Contexts
// ============================================

const StdinContext = createContext<StdinContextValue>({
  stdin: mockStdin as unknown as NodeJS.ReadStream,
  internal_eventEmitter: internalEventEmitter,
  setRawMode: (mode: boolean) => {
    mockStdin.setRawMode(mode);
  },
  isRawModeSupported: true,
  internal_exitOnCtrlC: false,
});

const StdoutContext = createContext<StdoutContextValue>({
  stdout: mockStdout as unknown as NodeJS.WriteStream,
  write: (data: string) => {
    mockStdout.write(data);
  },
});

const AppContext = createContext<AppContextValue>({
  exit: (error?: Error) => {
    exitCallback?.(error);
  },
  rerender: () => {
    rerenderCallback?.();
  },
});

const AccessibilityContext = createContext({
  isScreenReaderEnabled: false,
});

// ============================================
// Hooks (Override Ink's hooks)
// ============================================

/**
 * useStdin - Returns mock stdin
 */
export function useStdin() {
  return useContext(StdinContext);
}

/**
 * useStdout - Returns mock stdout
 */
export function useStdout() {
  return useContext(StdoutContext);
}

/**
 * useApp - Returns app controls
 */
export function useApp() {
  return useContext(AppContext);
}

/**
 * useIsScreenReaderEnabled - Always false for web
 */
export function useIsScreenReaderEnabled() {
  return useContext(AccessibilityContext).isScreenReaderEnabled;
}

/**
 * useInput - Keyboard input handler
 */
export function useInput(
  inputHandler: (input: string, key: { escape: boolean; return: boolean; tab: boolean; backspace: boolean; delete: boolean; upArrow: boolean; downArrow: boolean; leftArrow: boolean; rightArrow: boolean; pageDown: boolean; pageUp: boolean; meta: boolean; ctrl: boolean; shift: boolean }) => void,
  options?: { isActive?: boolean }
) {
  const { stdin } = useStdin();
  const isActive = options?.isActive ?? true;

  React.useEffect(() => {
    if (!isActive) return;

    const handleData = (data: Buffer) => {
      const input = data.toString();
      const key = {
        escape: input === '\x1b',
        return: input === '\r',
        tab: input === '\t',
        backspace: input === '\x7f',
        delete: input === '\x1b[3~',
        upArrow: input === '\x1b[A',
        downArrow: input === '\x1b[B',
        leftArrow: input === '\x1b[D',
        rightArrow: input === '\x1b[C',
        pageDown: input === '\x1b[6~',
        pageUp: input === '\x1b[5~',
        meta: false,
        ctrl: data[0] !== undefined && data[0] < 32,
        shift: false,
      };
      inputHandler(input, key);
    };

    stdin.on('data', handleData);
    return () => {
      stdin.off('data', handleData);
    };
  }, [stdin, inputHandler, isActive]);
}

/**
 * useFocus - Focus management (stub)
 */
export function useFocus(options?: { autoFocus?: boolean; isActive?: boolean; id?: string }) {
  return {
    isFocused: options?.autoFocus ?? false,
    focus: () => {},
  };
}

/**
 * useFocusManager - Focus manager (stub)
 */
export function useFocusManager() {
  return {
    focusNext: () => {},
    focusPrevious: () => {},
    enableFocus: () => {},
    disableFocus: () => {},
    focus: (_id: string) => {},
  };
}

/**
 * measureElement - Measure component dimensions
 * Returns mock values - actual measurement happens on client
 */
export function measureElement(_element: unknown): { width: number; height: number; x: number; y: number } {
  return {
    width: mockStdout.columns,
    height: 1,
    x: 0,
    y: 0,
  };
}

// ============================================
// Export contexts for provider use
// ============================================

export {
  StdinContext,
  StdoutContext,
  AppContext,
  AccessibilityContext,
};
