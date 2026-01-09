/**
 * Ink Shim Module
 *
 * This module completely replaces 'ink' when bundled with esbuild aliasing.
 * It provides Ink-compatible exports that use our WebSocket-based implementations.
 *
 * IMPORTANT: This file must NOT import from 'ink' as it would cause a circular
 * dependency when 'ink' is aliased to this file.
 */

import React, { createContext, useContext, forwardRef, type ReactNode, type Ref, type ReactElement } from 'react';
import { EventEmitter } from 'events';

// ============================================
// Type Definitions (matching Ink's types)
// ============================================

export interface DOMElement {
  nodeName: string;
  attributes: Record<string, unknown>;
  childNodes: DOMElement[];
  parentNode: DOMElement | null;
  textContent?: string;
  style?: Record<string, unknown>;
  yogaNode?: unknown;
  internal_staticRecords?: unknown;
}

export interface BoxProps {
  children?: ReactNode;
  flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: number | string;
  flexWrap?: 'wrap' | 'nowrap' | 'wrap-reverse';
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
  alignSelf?: 'flex-start' | 'center' | 'flex-end' | 'auto';
  justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly';
  padding?: number;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingX?: number;
  paddingY?: number;
  margin?: number;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  marginX?: number;
  marginY?: number;
  width?: number | string;
  height?: number | string;
  minWidth?: number | string;
  minHeight?: number | string;
  maxWidth?: number | string;
  maxHeight?: number | string;
  gap?: number;
  columnGap?: number;
  rowGap?: number;
  borderStyle?: 'single' | 'double' | 'round' | 'bold' | 'singleDouble' | 'doubleSingle' | 'classic';
  borderColor?: string;
  borderTop?: boolean;
  borderBottom?: boolean;
  borderLeft?: boolean;
  borderRight?: boolean;
  overflow?: 'visible' | 'hidden';
  overflowX?: 'visible' | 'hidden';
  overflowY?: 'visible' | 'hidden';
}

export interface TextProps {
  children?: ReactNode;
  color?: string;
  backgroundColor?: string;
  dimColor?: boolean;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  inverse?: boolean;
  wrap?: 'wrap' | 'truncate' | 'truncate-start' | 'truncate-middle' | 'truncate-end';
}

export interface Key {
  upArrow: boolean;
  downArrow: boolean;
  leftArrow: boolean;
  rightArrow: boolean;
  pageDown: boolean;
  pageUp: boolean;
  return: boolean;
  escape: boolean;
  ctrl: boolean;
  shift: boolean;
  tab: boolean;
  backspace: boolean;
  delete: boolean;
  meta: boolean;
}

// ============================================
// Components (render as element types our reconciler handles)
// ============================================

/**
 * Box component - renders as 'ink-box'
 */
export const Box = forwardRef<DOMElement, BoxProps>(function Box(props, ref) {
  return React.createElement('ink-box', { ...props, ref }, props.children);
});

/**
 * Text component - renders as 'ink-text'
 */
export const Text = forwardRef<DOMElement, TextProps>(function Text(props, ref) {
  return React.createElement('ink-text', { ...props, ref }, props.children);
});

/**
 * Newline component - renders a newline
 */
export function Newline({ count = 1 }: { count?: number }) {
  return React.createElement('ink-text', {}, '\n'.repeat(count));
}

/**
 * Static component - renders children that won't update
 */
export function Static<T>({ items, children, style }: {
  items: T[];
  children: (item: T, index: number) => ReactNode;
  style?: Record<string, unknown>;
}) {
  return React.createElement('ink-static', { style },
    items.map((item, index) => children(item, index))
  );
}

/**
 * Transform component - transforms text content
 */
export function Transform({ children, transform }: {
  children: ReactNode;
  transform: (text: string) => string;
}) {
  // In web context, we just pass through - transform is applied on render
  return React.createElement('ink-transform', { transform }, children);
}

/**
 * Spacer component - flexible space
 */
export function Spacer() {
  return React.createElement('ink-box', { flexGrow: 1 });
}

// ============================================
// Mock I/O Classes
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

  write(_data: string | Buffer) {
    // Output is handled by reconciler broadcasting
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

// ============================================
// Singleton Instances
// ============================================

const mockStdin = new MockStdin();
const mockStdout = new MockStdout();
const internalEventEmitter = new EventEmitter();

// Callbacks for app control
let exitCallback: ((error?: Error) => void) | null = null;
let rerenderCallback: (() => void) | null = null;

/**
 * Set the exit callback (called by reconciler server)
 */
export function setExitCallback(cb: (error?: Error) => void) {
  exitCallback = cb;
}

/**
 * Set the rerender callback (called by reconciler server)
 */
export function setRerenderCallback(cb: () => void) {
  rerenderCallback = cb;
}

/**
 * Emit data to stdin (called from WebSocket input handler)
 */
export function emitStdinData(data: string | Buffer) {
  mockStdin.emit('data', Buffer.from(data));
}

/**
 * Emit keypress event
 */
export function emitKeypress(key: string, ctrl = false, meta = false, shift = false) {
  const keyObj: Key = {
    upArrow: key === 'up',
    downArrow: key === 'down',
    leftArrow: key === 'left',
    rightArrow: key === 'right',
    pageDown: key === 'pagedown',
    pageUp: key === 'pageup',
    return: key === 'return' || key === 'enter',
    escape: key === 'escape',
    ctrl,
    shift,
    tab: key === 'tab',
    backspace: key === 'backspace',
    delete: key === 'delete',
    meta,
  };

  // Emit on internal event emitter for Ink compatibility
  internalEventEmitter.emit('input', key, keyObj);

  // Also emit as raw data for stdin handlers
  let charCode = key;
  if (key === 'return' || key === 'enter') charCode = '\r';
  else if (key === 'escape') charCode = '\x1b';
  else if (key === 'tab') charCode = '\t';
  else if (key === 'backspace') charCode = '\x7f';
  else if (ctrl && key.length === 1) charCode = String.fromCharCode(key.charCodeAt(0) - 96);

  mockStdin.emit('data', Buffer.from(charCode));
}

/**
 * Get mock stdout for setting dimensions
 */
export function getMockStdout() {
  return mockStdout;
}

/**
 * Get mock stdin
 */
export function getMockStdin() {
  return mockStdin;
}

// ============================================
// Context Definitions
// ============================================

interface StdinContextValue {
  stdin: NodeJS.ReadStream | EventEmitter;
  internal_eventEmitter: EventEmitter;
  setRawMode: (mode: boolean) => void;
  isRawModeSupported: boolean;
  internal_exitOnCtrlC: boolean;
}

interface StdoutContextValue {
  stdout: NodeJS.WriteStream | MockStdout;
  write: (data: string) => void;
}

interface AppContextValue {
  exit: (error?: Error) => void;
  rerender: () => void;
}

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

const FocusContext = createContext({
  activeId: undefined as string | undefined,
  add: (_id: string) => {},
  remove: (_id: string) => {},
  activate: (_id: string) => {},
  deactivate: (_id: string) => {},
  enableFocus: () => {},
  disableFocus: () => {},
  focusNext: () => {},
  focusPrevious: () => {},
  focus: (_id: string) => {},
  isEnabled: true,
});

// ============================================
// Hooks
// ============================================

/**
 * useStdin - Returns mock stdin context
 */
export function useStdin() {
  return useContext(StdinContext);
}

/**
 * useStdout - Returns mock stdout context
 */
export function useStdout() {
  return useContext(StdoutContext);
}

/**
 * useApp - Returns app controls (exit, rerender)
 */
export function useApp() {
  return useContext(AppContext);
}

/**
 * useIsScreenReaderEnabled - Always false for web
 */
export function useIsScreenReaderEnabled() {
  return false;
}

/**
 * useInput - Keyboard input handler
 */
export function useInput(
  inputHandler: (input: string, key: Key) => void,
  options?: { isActive?: boolean }
) {
  const { stdin, internal_eventEmitter } = useStdin();
  const isActive = options?.isActive ?? true;

  React.useEffect(() => {
    if (!isActive) return;

    const handleInput = (input: string, key: Key) => {
      inputHandler(input, key);
    };

    internal_eventEmitter.on('input', handleInput);
    return () => {
      internal_eventEmitter.off('input', handleInput);
    };
  }, [stdin, internal_eventEmitter, inputHandler, isActive]);
}

/**
 * useFocus - Focus management
 */
export function useFocus(options?: { autoFocus?: boolean; isActive?: boolean; id?: string }) {
  const focusContext = useContext(FocusContext);
  const id = options?.id ?? React.useId();

  React.useEffect(() => {
    focusContext.add(id);
    if (options?.autoFocus) {
      focusContext.activate(id);
    }
    return () => {
      focusContext.remove(id);
    };
  }, [id, options?.autoFocus]);

  return {
    isFocused: focusContext.activeId === id,
    focus: () => focusContext.focus(id),
  };
}

/**
 * useFocusManager - Focus manager
 */
export function useFocusManager() {
  const focusContext = useContext(FocusContext);
  return {
    focusNext: focusContext.focusNext,
    focusPrevious: focusContext.focusPrevious,
    enableFocus: focusContext.enableFocus,
    disableFocus: focusContext.disableFocus,
    focus: focusContext.focus,
  };
}

// ============================================
// Utilities
// ============================================

/**
 * measureElement - Measure component dimensions
 * Returns mock values - actual measurement happens on client
 */
export function measureElement(_element: DOMElement | null): { width: number; height: number } {
  return {
    width: mockStdout.columns,
    height: 1,
  };
}

/**
 * getBoundingBox - Get element bounding box
 * Returns mock values - actual measurement happens on client
 */
export function getBoundingBox(
  _node: DOMElement | null
): { left: number; top: number; width: number; height: number } | undefined {
  return {
    left: 0,
    top: 0,
    width: mockStdout.columns,
    height: 1,
  };
}

// ============================================
// render function (not used with our reconciler, but exported for compatibility)
// ============================================

export interface RenderOptions {
  stdout?: NodeJS.WriteStream;
  stdin?: NodeJS.ReadStream;
  stderr?: NodeJS.WriteStream;
  debug?: boolean;
  exitOnCtrlC?: boolean;
  patchConsole?: boolean;
  isScreenReaderEnabled?: boolean;
}

export interface Instance {
  rerender: (tree: ReactElement) => void;
  unmount: () => void;
  waitUntilExit: () => Promise<void>;
  clear: () => void;
}

/**
 * render - Main Ink render function
 * This is a stub - our reconciler uses renderToWebSocket instead
 */
export function render(_tree: ReactElement, _options?: RenderOptions): Instance {
  console.warn('[ink-shim] render() called - use renderToWebSocket() instead for WebSocket reconciler');
  return {
    rerender: () => {},
    unmount: () => {},
    waitUntilExit: () => Promise.resolve(),
    clear: () => {},
  };
}

// ============================================
// Context Providers (for wrapping components)
// ============================================

interface InkProviderProps {
  children: ReactNode;
  onExit?: (error?: Error) => void;
  onRerender?: () => void;
}

/**
 * InkProvider - Provides all Ink contexts with WebSocket-based implementations
 */
export function InkProvider({ children, onExit, onRerender }: InkProviderProps) {
  // Set callbacks
  React.useEffect(() => {
    if (onExit) setExitCallback(onExit);
    if (onRerender) setRerenderCallback(onRerender);
    return () => {
      setExitCallback(() => {});
      setRerenderCallback(() => {});
    };
  }, [onExit, onRerender]);

  const stdinValue = React.useMemo(() => ({
    stdin: mockStdin as unknown as NodeJS.ReadStream,
    internal_eventEmitter: internalEventEmitter,
    setRawMode: (mode: boolean) => {
      mockStdin.setRawMode(mode);
    },
    isRawModeSupported: true,
    internal_exitOnCtrlC: false,
  }), []);

  const stdoutValue = React.useMemo(() => ({
    stdout: mockStdout as unknown as NodeJS.WriteStream,
    write: (data: string) => {
      mockStdout.write(data);
    },
  }), []);

  const appValue = React.useMemo(() => ({
    exit: (error?: Error) => {
      onExit?.(error);
    },
    rerender: () => {
      onRerender?.();
    },
  }), [onExit, onRerender]);

  return React.createElement(StdinContext.Provider, { value: stdinValue },
    React.createElement(StdoutContext.Provider, { value: stdoutValue },
      React.createElement(AppContext.Provider, { value: appValue },
        children
      )
    )
  );
}

// Export contexts for advanced usage
export { StdinContext, StdoutContext, AppContext, FocusContext };
