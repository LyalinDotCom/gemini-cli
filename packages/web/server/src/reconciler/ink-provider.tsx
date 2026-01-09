/**
 * Ink Provider for WebSocket Reconciler
 *
 * Provides Ink contexts with our mock implementations,
 * allowing CLI components to work with our reconciler.
 */

import React, { useMemo, useCallback, createContext } from 'react';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// We can't import Ink's contexts directly due to package.json exports.
// Instead, we'll create our own matching contexts.
// The CLI components use useStdin(), useStdout(), useApp() which internally
// call useContext(InkContext). We need to provide a wrapper that intercepts these.

// For now, create our own contexts that match Ink's interface.
// The CLI will need to use these instead of Ink's built-in hooks.

/**
 * Custom context types matching Ink's interface
 */
interface StdinContextType {
  stdin: NodeJS.ReadStream | EventEmitter;
  internal_eventEmitter: EventEmitter;
  setRawMode: (mode: boolean) => void;
  isRawModeSupported: boolean;
  internal_exitOnCtrlC: boolean;
}

interface StdoutContextType {
  stdout: NodeJS.WriteStream | { write: (data: string) => boolean; columns: number; rows: number };
  write: (data: string) => void;
}

interface AppContextType {
  exit: (error?: Error) => void;
  rerender: () => void;
}

interface AccessibilityContextType {
  isScreenReaderEnabled: boolean;
}

interface FocusContextType {
  activeId?: string;
  add: (id: string) => void;
  remove: (id: string) => void;
  activate: (id: string) => void;
  deactivate: (id: string) => void;
  enableFocus: () => void;
  disableFocus: () => void;
  focusNext: () => void;
  focusPrevious: () => void;
  focus: (id: string) => void;
  isEnabled: boolean;
}

// Create our own contexts
export const WebStdinContext = createContext<StdinContextType>({
  stdin: process.stdin,
  internal_eventEmitter: new EventEmitter(),
  setRawMode: () => {},
  isRawModeSupported: false,
  internal_exitOnCtrlC: true,
});

export const WebStdoutContext = createContext<StdoutContextType>({
  stdout: process.stdout,
  write: () => {},
});

export const WebAppContext = createContext<AppContextType>({
  exit: () => {},
  rerender: () => {},
});

export const WebAccessibilityContext = createContext<AccessibilityContextType>({
  isScreenReaderEnabled: false,
});

export const WebFocusContext = createContext<FocusContextType>({
  activeId: undefined,
  add: () => {},
  remove: () => {},
  activate: () => {},
  deactivate: () => {},
  enableFocus: () => {},
  disableFocus: () => {},
  focusNext: () => {},
  focusPrevious: () => {},
  focus: () => {},
  isEnabled: true,
});

// Our mock implementations
import { getMockStdin, getMockStdout, emitStdinData } from './ink-adapters.js';

interface InkProviderProps {
  children: React.ReactNode;
  onExit?: (error?: Error) => void;
  onRerender?: () => void;
}

/**
 * Provides Ink contexts with WebSocket-based implementations
 */
export function InkProvider({ children, onExit, onRerender }: InkProviderProps) {
  const mockStdin = getMockStdin();
  const mockStdout = getMockStdout();

  // Create event emitter for internal Ink events
  const internalEventEmitter = useMemo(() => new EventEmitter(), []);

  // Stdin context value
  const stdinValue = useMemo(() => ({
    stdin: mockStdin,
    internal_eventEmitter: internalEventEmitter,
    setRawMode: (mode: boolean) => {
      mockStdin.setRawMode(mode);
    },
    isRawModeSupported: true,
    internal_exitOnCtrlC: false, // We handle Ctrl+C ourselves
  }), [mockStdin, internalEventEmitter]);

  // Stdout context value
  const stdoutValue = useMemo(() => ({
    stdout: mockStdout,
    write: (data: string) => {
      mockStdout.write(data);
    },
  }), [mockStdout]);

  // App context value
  const exit = useCallback((error?: Error) => {
    console.log('[InkProvider] Exit called', error?.message);
    onExit?.(error);
  }, [onExit]);

  const rerender = useCallback(() => {
    console.log('[InkProvider] Rerender called');
    onRerender?.();
  }, [onRerender]);

  const appValue = useMemo(() => ({
    exit,
    rerender,
  }), [exit, rerender]);

  // Accessibility context value (always disabled for web)
  const accessibilityValue = useMemo(() => ({
    isScreenReaderEnabled: false,
  }), []);

  // Focus context value
  const focusValue = useMemo(() => ({
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
  }), []);

  return (
    <WebStdinContext.Provider value={stdinValue}>
      <WebStdoutContext.Provider value={stdoutValue}>
        <WebAppContext.Provider value={appValue}>
          <WebAccessibilityContext.Provider value={accessibilityValue}>
            <WebFocusContext.Provider value={focusValue}>
              {children}
            </WebFocusContext.Provider>
          </WebAccessibilityContext.Provider>
        </WebAppContext.Provider>
      </WebStdoutContext.Provider>
    </WebStdinContext.Provider>
  );
}

/**
 * Hooks that use our Web contexts
 * These can be used by wrapper components that need Ink-like functionality
 */
export function useWebStdin() {
  return React.useContext(WebStdinContext);
}

export function useWebStdout() {
  return React.useContext(WebStdoutContext);
}

export function useWebApp() {
  return React.useContext(WebAppContext);
}

export function useWebIsScreenReaderEnabled() {
  return React.useContext(WebAccessibilityContext).isScreenReaderEnabled;
}

export function useWebFocus() {
  return React.useContext(WebFocusContext);
}

export default InkProvider;
