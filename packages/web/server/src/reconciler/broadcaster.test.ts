/**
 * Unit tests for the Broadcaster module
 *
 * Tests WebSocket client management and tree serialization/broadcasting.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  addClient,
  removeClient,
  getClientCount,
  broadcast,
  sendToClient,
} from './broadcaster.js';
import type { WSElement, WSTextNode } from './types.js';

// Create a mock WebSocket
function createMockWebSocket(options: { readyState?: number } = {}) {
  return {
    send: vi.fn(),
    close: vi.fn(),
    readyState: options.readyState ?? 1, // OPEN
    OPEN: 1,
    CLOSED: 3,
  };
}

describe('broadcaster', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Clear all clients between tests
    while (getClientCount() > 0) {
      // Create a mock to remove (we need to track added ones)
    }
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    vi.clearAllMocks();
  });

  describe('Client Management', () => {
    describe('addClient', () => {
      it('adds a client to the set', () => {
        const initialCount = getClientCount();
        const ws = createMockWebSocket();
        addClient(ws as any);
        expect(getClientCount()).toBe(initialCount + 1);
        removeClient(ws as any);
      });

      it('logs the addition', () => {
        const ws = createMockWebSocket();
        addClient(ws as any);
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('[Broadcaster] Client added')
        );
        removeClient(ws as any);
      });
    });

    describe('removeClient', () => {
      it('removes a client from the set', () => {
        const ws = createMockWebSocket();
        addClient(ws as any);
        const countAfterAdd = getClientCount();

        removeClient(ws as any);
        expect(getClientCount()).toBe(countAfterAdd - 1);
      });

      it('logs the removal', () => {
        const ws = createMockWebSocket();
        addClient(ws as any);
        consoleLogSpy.mockClear();

        removeClient(ws as any);
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('[Broadcaster] Client removed')
        );
      });

      it('handles removing non-existent client gracefully', () => {
        const ws = createMockWebSocket();
        const initialCount = getClientCount();

        // Should not throw
        expect(() => removeClient(ws as any)).not.toThrow();
        expect(getClientCount()).toBe(initialCount);
      });
    });

    describe('getClientCount', () => {
      it('returns correct count', () => {
        const initialCount = getClientCount();
        const ws1 = createMockWebSocket();
        const ws2 = createMockWebSocket();

        addClient(ws1 as any);
        expect(getClientCount()).toBe(initialCount + 1);

        addClient(ws2 as any);
        expect(getClientCount()).toBe(initialCount + 2);

        removeClient(ws1 as any);
        expect(getClientCount()).toBe(initialCount + 1);

        removeClient(ws2 as any);
        expect(getClientCount()).toBe(initialCount);
      });
    });
  });

  describe('Broadcasting', () => {
    describe('broadcast', () => {
      it('does nothing with no clients', () => {
        // Make sure no clients
        const initialCount = getClientCount();
        if (initialCount > 0) {
          return; // Skip test if there are lingering clients
        }

        const root: WSElement = {
          id: 'root',
          type: 'ws-root',
          inkProps: {},
          children: [],
          parentId: null,
        };

        // Should not throw
        expect(() => broadcast(root)).not.toThrow();
      });

      it('sends serialized tree to all connected clients', () => {
        const ws1 = createMockWebSocket();
        const ws2 = createMockWebSocket();
        addClient(ws1 as any);
        addClient(ws2 as any);

        const root: WSElement = {
          id: 'root',
          type: 'ws-root',
          inkProps: {},
          children: [],
          parentId: null,
        };

        broadcast(root);

        expect(ws1.send).toHaveBeenCalled();
        expect(ws2.send).toHaveBeenCalled();

        // Cleanup
        removeClient(ws1 as any);
        removeClient(ws2 as any);
      });

      it('skips clients with closed connections', () => {
        const wsOpen = createMockWebSocket({ readyState: 1 }); // OPEN
        const wsClosed = createMockWebSocket({ readyState: 3 }); // CLOSED

        addClient(wsOpen as any);
        addClient(wsClosed as any);

        const root: WSElement = {
          id: 'root',
          type: 'ws-root',
          inkProps: {},
          children: [],
          parentId: null,
        };

        broadcast(root);

        expect(wsOpen.send).toHaveBeenCalled();
        expect(wsClosed.send).not.toHaveBeenCalled();

        // Cleanup
        removeClient(wsOpen as any);
        removeClient(wsClosed as any);
      });

      it('sends correct message format', () => {
        const ws = createMockWebSocket();
        addClient(ws as any);

        const root: WSElement = {
          id: 'root',
          type: 'ws-root',
          inkProps: { color: 'red' },
          children: [],
          parentId: null,
        };

        broadcast(root);

        expect(ws.send).toHaveBeenCalledTimes(1);
        const sentData = JSON.parse(ws.send.mock.calls[0][0]);

        expect(sentData.type).toBe('render');
        expect(sentData.tree).toBeDefined();
        expect(sentData.tree.root).toBeDefined();
        expect(sentData.tree.root.id).toBe('root');
        expect(sentData.tree.root.type).toBe('ws-root');
        expect(sentData.tree.root.props).toEqual({ color: 'red' });
        expect(sentData.tree.timestamp).toBeTypeOf('number');

        // Cleanup
        removeClient(ws as any);
      });

      it('handles null root', () => {
        const ws = createMockWebSocket();
        addClient(ws as any);

        broadcast(null);

        expect(ws.send).toHaveBeenCalled();
        const sentData = JSON.parse(ws.send.mock.calls[0][0]);

        expect(sentData.type).toBe('render');
        expect(sentData.tree.root).toBeNull();

        // Cleanup
        removeClient(ws as any);
      });

      it('serializes nested children', () => {
        const ws = createMockWebSocket();
        addClient(ws as any);

        const textNode: WSTextNode = {
          id: 'text-1',
          type: 'text',
          value: 'Hello',
          parentId: 'child-1',
        };

        const child: WSElement = {
          id: 'child-1',
          type: 'ink-box',
          inkProps: { flexDirection: 'column' },
          children: [textNode],
          parentId: 'root',
        };

        const root: WSElement = {
          id: 'root',
          type: 'ws-root',
          inkProps: {},
          children: [child],
          parentId: null,
        };

        broadcast(root);

        const sentData = JSON.parse(ws.send.mock.calls[0][0]);
        expect(sentData.tree.root.children).toHaveLength(1);
        expect(sentData.tree.root.children[0].type).toBe('ink-box');
        expect(sentData.tree.root.children[0].props).toEqual({ flexDirection: 'column' });
        expect(sentData.tree.root.children[0].children).toHaveLength(1);
        expect(sentData.tree.root.children[0].children[0].type).toBe('text');
        expect(sentData.tree.root.children[0].children[0].value).toBe('Hello');

        // Cleanup
        removeClient(ws as any);
      });

      it('logs broadcast information', () => {
        const ws = createMockWebSocket();
        addClient(ws as any);
        consoleLogSpy.mockClear();

        const root: WSElement = {
          id: 'root',
          type: 'ws-root',
          inkProps: {},
          children: [],
          parentId: null,
        };

        broadcast(root);

        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('[Broadcaster] Sent tree update')
        );

        // Cleanup
        removeClient(ws as any);
      });
    });

    describe('sendToClient', () => {
      it('sends message to specific client', () => {
        const ws = createMockWebSocket();

        sendToClient(ws as any, { type: 'test', data: 'hello' });

        expect(ws.send).toHaveBeenCalledTimes(1);
        const sentData = JSON.parse(ws.send.mock.calls[0][0]);
        expect(sentData).toEqual({ type: 'test', data: 'hello' });
      });

      it('skips closed connections', () => {
        const ws = createMockWebSocket({ readyState: 3 }); // CLOSED

        sendToClient(ws as any, { type: 'test' });

        expect(ws.send).not.toHaveBeenCalled();
      });

      it('handles complex message objects', () => {
        const ws = createMockWebSocket();

        const message = {
          type: 'update',
          data: {
            nested: {
              value: 123,
              array: [1, 2, 3],
            },
          },
        };

        sendToClient(ws as any, message);

        const sentData = JSON.parse(ws.send.mock.calls[0][0]);
        expect(sentData).toEqual(message);
      });
    });
  });

  describe('Serialization', () => {
    it('filters out functions from props', () => {
      const ws = createMockWebSocket();
      addClient(ws as any);

      const root: WSElement = {
        id: 'root',
        type: 'ws-root',
        inkProps: {
          onClick: () => {}, // Should be filtered
          color: 'red', // Should remain
        },
        children: [],
        parentId: null,
      };

      broadcast(root);

      const sentData = JSON.parse(ws.send.mock.calls[0][0]);
      expect(sentData.tree.root.props.onClick).toBeUndefined();
      expect(sentData.tree.root.props.color).toBe('red');

      // Cleanup
      removeClient(ws as any);
    });

    it('handles text nodes correctly', () => {
      const ws = createMockWebSocket();
      addClient(ws as any);

      const textNode: WSTextNode = {
        id: 'text-1',
        type: 'text',
        value: 'Test content',
        parentId: 'root',
      };

      const root: WSElement = {
        id: 'root',
        type: 'ws-root',
        inkProps: {},
        children: [textNode],
        parentId: null,
      };

      broadcast(root);

      const sentData = JSON.parse(ws.send.mock.calls[0][0]);
      expect(sentData.tree.root.children[0]).toEqual(textNode);

      // Cleanup
      removeClient(ws as any);
    });

    it('preserves primitive prop values', () => {
      const ws = createMockWebSocket();
      addClient(ws as any);

      const root: WSElement = {
        id: 'root',
        type: 'ws-root',
        inkProps: {
          stringProp: 'hello',
          numberProp: 42,
          boolProp: true,
          nullProp: null,
        },
        children: [],
        parentId: null,
      };

      broadcast(root);

      const sentData = JSON.parse(ws.send.mock.calls[0][0]);
      expect(sentData.tree.root.props.stringProp).toBe('hello');
      expect(sentData.tree.root.props.numberProp).toBe(42);
      expect(sentData.tree.root.props.boolProp).toBe(true);
      expect(sentData.tree.root.props.nullProp).toBeNull();

      // Cleanup
      removeClient(ws as any);
    });

    it('handles nested objects', () => {
      const ws = createMockWebSocket();
      addClient(ws as any);

      const root: WSElement = {
        id: 'root',
        type: 'ws-root',
        inkProps: {
          style: {
            color: 'red',
            margin: 10,
          },
        },
        children: [],
        parentId: null,
      };

      broadcast(root);

      const sentData = JSON.parse(ws.send.mock.calls[0][0]);
      expect(sentData.tree.root.props.style).toEqual({
        color: 'red',
        margin: 10,
      });

      // Cleanup
      removeClient(ws as any);
    });

    it('handles arrays in props', () => {
      const ws = createMockWebSocket();
      addClient(ws as any);

      const root: WSElement = {
        id: 'root',
        type: 'ws-root',
        inkProps: {
          items: ['a', 'b', 'c'],
          numbers: [1, 2, 3],
        },
        children: [],
        parentId: null,
      };

      broadcast(root);

      const sentData = JSON.parse(ws.send.mock.calls[0][0]);
      expect(sentData.tree.root.props.items).toEqual(['a', 'b', 'c']);
      expect(sentData.tree.root.props.numbers).toEqual([1, 2, 3]);

      // Cleanup
      removeClient(ws as any);
    });
  });
});
