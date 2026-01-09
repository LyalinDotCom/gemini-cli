/**
 * Unit tests for the Input Handler module
 *
 * Tests WebSocket message parsing and routing to stdin emitters.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

// Create a shared mock stdout instance
const mockSetDimensions = vi.fn();
const mockStdoutInstance = {
  setDimensions: mockSetDimensions,
  columns: 120,
  rows: 40,
};

// Mock the ink module before importing input-handler
vi.mock('ink', () => ({
  emitStdinData: vi.fn(),
  emitKeypress: vi.fn(),
  getMockStdout: vi.fn(() => mockStdoutInstance),
}));

import {
  setupInputHandler,
  setInputWebSocket,
  getInputWebSocket,
  simulateEnter,
  simulateConfirm,
  simulateCancel,
  type InputMessage,
} from './input-handler.js';
import { emitStdinData, emitKeypress, getMockStdout } from 'ink';

// Create a mock WebSocket
function createMockWebSocket() {
  const emitter = new EventEmitter();
  return {
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter),
    emit: emitter.emit.bind(emitter),
    send: vi.fn(),
    close: vi.fn(),
    readyState: 1, // OPEN
  };
}

describe('input-handler', () => {
  let mockWs: ReturnType<typeof createMockWebSocket>;

  beforeEach(() => {
    mockWs = createMockWebSocket();
    vi.clearAllMocks();
    setInputWebSocket(null);
  });

  afterEach(() => {
    setInputWebSocket(null);
  });

  describe('setInputWebSocket', () => {
    it('sets and gets the WebSocket', () => {
      expect(getInputWebSocket()).toBeNull();
      setInputWebSocket(mockWs as any);
      expect(getInputWebSocket()).toBe(mockWs);
    });

    it('clears the WebSocket when set to null', () => {
      setInputWebSocket(mockWs as any);
      expect(getInputWebSocket()).toBe(mockWs);
      setInputWebSocket(null);
      expect(getInputWebSocket()).toBeNull();
    });
  });

  describe('setupInputHandler', () => {
    it('sets up message handler on WebSocket', () => {
      setupInputHandler(mockWs as any);
      expect(getInputWebSocket()).toBe(mockWs);
    });

    it('clears WebSocket on close', () => {
      setupInputHandler(mockWs as any);
      expect(getInputWebSocket()).toBe(mockWs);
      mockWs.emit('close');
      expect(getInputWebSocket()).toBeNull();
    });

    it('handles input message type', () => {
      setupInputHandler(mockWs as any);

      const message: InputMessage = {
        type: 'input',
        value: 'hello world',
      };
      mockWs.emit('message', JSON.stringify(message));

      expect(emitStdinData).toHaveBeenCalledWith('hello world');
    });

    it('handles keypress message type', () => {
      setupInputHandler(mockWs as any);

      const message: InputMessage = {
        type: 'keypress',
        key: 'return',
        ctrl: false,
        meta: false,
        shift: false,
      };
      mockWs.emit('message', JSON.stringify(message));

      expect(emitKeypress).toHaveBeenCalledWith('return', false, false, false);
    });

    it('handles keypress with modifiers', () => {
      setupInputHandler(mockWs as any);

      const message: InputMessage = {
        type: 'keypress',
        key: 'c',
        ctrl: true,
        meta: false,
        shift: false,
      };
      mockWs.emit('message', JSON.stringify(message));

      expect(emitKeypress).toHaveBeenCalledWith('c', true, false, false);
    });

    it('handles resize message type', () => {
      setupInputHandler(mockWs as any);

      const message: InputMessage = {
        type: 'resize',
        columns: 80,
        rows: 24,
      };
      mockWs.emit('message', JSON.stringify(message));

      expect(mockSetDimensions).toHaveBeenCalledWith(80, 24);
    });

    it('handles paste message type', () => {
      setupInputHandler(mockWs as any);

      const message: InputMessage = {
        type: 'paste',
        value: 'pasted text',
      };
      mockWs.emit('message', JSON.stringify(message));

      expect(emitStdinData).toHaveBeenCalledWith('pasted text');
    });

    it('logs warning for unknown message type', () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      setupInputHandler(mockWs as any);

      const message = {
        type: 'unknown',
      };
      mockWs.emit('message', JSON.stringify(message));

      expect(consoleWarn).toHaveBeenCalledWith(
        '[InputHandler] Unknown message type:',
        'unknown'
      );

      consoleWarn.mockRestore();
    });

    it('handles JSON parse errors gracefully', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      setupInputHandler(mockWs as any);

      mockWs.emit('message', 'invalid json');

      expect(consoleError).toHaveBeenCalledWith(
        '[InputHandler] Failed to parse message:',
        expect.any(Error)
      );

      consoleError.mockRestore();
    });

    it('ignores input with undefined value', () => {
      setupInputHandler(mockWs as any);

      const message: InputMessage = {
        type: 'input',
      };
      mockWs.emit('message', JSON.stringify(message));

      expect(emitStdinData).not.toHaveBeenCalled();
    });

    it('ignores keypress with undefined key', () => {
      setupInputHandler(mockWs as any);

      const message: InputMessage = {
        type: 'keypress',
      };
      mockWs.emit('message', JSON.stringify(message));

      expect(emitKeypress).not.toHaveBeenCalled();
    });

    it('defaults ctrl/meta/shift to false when not provided', () => {
      setupInputHandler(mockWs as any);

      const message = {
        type: 'keypress',
        key: 'a',
      };
      mockWs.emit('message', JSON.stringify(message));

      expect(emitKeypress).toHaveBeenCalledWith('a', false, false, false);
    });
  });

  describe('Simulation Functions', () => {
    describe('simulateEnter', () => {
      it('emits return keypress', () => {
        simulateEnter();
        expect(emitKeypress).toHaveBeenCalledWith('return');
      });
    });

    describe('simulateConfirm', () => {
      it('emits y key when confirmed', () => {
        simulateConfirm(true);
        expect(emitKeypress).toHaveBeenCalledWith('y');
      });

      it('emits n key when not confirmed', () => {
        simulateConfirm(false);
        expect(emitKeypress).toHaveBeenCalledWith('n');
      });
    });

    describe('simulateCancel', () => {
      it('emits Ctrl+C', () => {
        simulateCancel();
        expect(emitKeypress).toHaveBeenCalledWith('c', true);
      });
    });
  });
});
