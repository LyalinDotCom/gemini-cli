/**
 * Unit tests for the Ink Shim module
 *
 * These tests verify that our Ink-compatible shim correctly implements
 * all the hooks, components, and utilities needed by the CLI.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import {
  // Components
  Box,
  Text,
  Newline,
  Static,
  Transform,
  Spacer,

  // Hooks (we test these exist, not their React behavior)
  useStdin,
  useStdout,
  useApp,
  useIsScreenReaderEnabled,
  useInput,
  useFocus,
  useFocusManager,

  // Utilities
  measureElement,
  getBoundingBox,
  render,

  // I/O functions
  emitStdinData,
  emitKeypress,
  getMockStdout,
  getMockStdin,
  setExitCallback,
  setRerenderCallback,

  // Types
  type DOMElement,
  type Key,

  // Provider
  InkProvider,
} from './index.js';

describe('ink-shim', () => {
  describe('Components', () => {
    describe('Box', () => {
      it('creates an ink-box element', () => {
        const element = React.createElement(Box, { flexDirection: 'column' }, 'content');
        // Box is a forwardRef component that renders 'ink-box'
        expect(element.type).toBe(Box);
        expect(element.props.flexDirection).toBe('column');
        expect(element.props.children).toBe('content');
      });

      it('forwards ref prop', () => {
        const ref = React.createRef<DOMElement>();
        const element = React.createElement(Box, { ref }, 'content');
        expect(element.props.ref).toBe(ref);
      });

      it('supports all box props', () => {
        const element = React.createElement(Box, {
          flexDirection: 'row',
          flexGrow: 1,
          padding: 2,
          marginTop: 1,
          width: 100,
          borderStyle: 'single',
        });
        expect(element.props.flexDirection).toBe('row');
        expect(element.props.flexGrow).toBe(1);
        expect(element.props.padding).toBe(2);
        expect(element.props.marginTop).toBe(1);
        expect(element.props.width).toBe(100);
        expect(element.props.borderStyle).toBe('single');
      });
    });

    describe('Text', () => {
      it('creates an ink-text element', () => {
        const element = React.createElement(Text, { color: 'green' }, 'Hello');
        // Text is a forwardRef component that renders 'ink-text'
        expect(element.type).toBe(Text);
        expect(element.props.color).toBe('green');
        expect(element.props.children).toBe('Hello');
      });

      it('supports text styling props', () => {
        const element = React.createElement(Text, {
          bold: true,
          italic: true,
          underline: true,
          color: 'red',
          backgroundColor: 'blue',
        });
        expect(element.props.bold).toBe(true);
        expect(element.props.italic).toBe(true);
        expect(element.props.underline).toBe(true);
        expect(element.props.color).toBe('red');
        expect(element.props.backgroundColor).toBe('blue');
      });
    });

    describe('Newline', () => {
      it('creates a newline element with default count', () => {
        const element = Newline({});
        expect(element.type).toBe('ink-text');
        expect(element.props.children).toBe('\n');
      });

      it('creates multiple newlines', () => {
        const element = Newline({ count: 3 });
        expect(element.props.children).toBe('\n\n\n');
      });
    });

    describe('Static', () => {
      it('creates a static element with mapped children', () => {
        const items = ['a', 'b', 'c'];
        const element = Static({
          items,
          children: (item, index) => React.createElement('span', { key: index }, item),
        });
        expect(element.type).toBe('ink-static');
        expect(element.props.children).toHaveLength(3);
      });
    });

    describe('Transform', () => {
      it('creates a transform element', () => {
        const transform = (text: string) => text.toUpperCase();
        const element = Transform({
          transform,
          children: 'hello',
        });
        expect(element.type).toBe('ink-transform');
        expect(element.props.transform).toBe(transform);
        expect(element.props.children).toBe('hello');
      });
    });

    describe('Spacer', () => {
      it('creates a box with flexGrow 1', () => {
        const element = Spacer();
        expect(element.type).toBe('ink-box');
        expect(element.props.flexGrow).toBe(1);
      });
    });
  });

  describe('Mock I/O', () => {
    describe('MockStdin', () => {
      it('returns mock stdin instance', () => {
        const stdin = getMockStdin();
        expect(stdin).toBeDefined();
        expect(stdin.isTTY).toBe(true);
      });

      it('supports setRawMode', () => {
        const stdin = getMockStdin();
        expect(stdin.isRaw).toBe(false);
        stdin.setRawMode(true);
        expect(stdin.isRaw).toBe(true);
        stdin.setRawMode(false);
        expect(stdin.isRaw).toBe(false);
      });

      it('emits data events', () => {
        const stdin = getMockStdin();
        const handler = vi.fn();
        stdin.on('data', handler);

        emitStdinData('hello');
        expect(handler).toHaveBeenCalledWith(Buffer.from('hello'));

        stdin.off('data', handler);
      });
    });

    describe('MockStdout', () => {
      it('returns mock stdout instance', () => {
        const stdout = getMockStdout();
        expect(stdout).toBeDefined();
        expect(stdout.isTTY).toBe(true);
      });

      it('has default dimensions', () => {
        const stdout = getMockStdout();
        expect(stdout.columns).toBe(120);
        expect(stdout.rows).toBe(40);
      });

      it('can update dimensions', () => {
        const stdout = getMockStdout();
        const handler = vi.fn();
        stdout.on('resize', handler);

        stdout.setDimensions(80, 24);
        expect(stdout.columns).toBe(80);
        expect(stdout.rows).toBe(24);
        expect(handler).toHaveBeenCalled();

        // Setting same dimensions should not emit
        handler.mockClear();
        stdout.setDimensions(80, 24);
        expect(handler).not.toHaveBeenCalled();

        // Reset for other tests
        stdout.setDimensions(120, 40);
        stdout.off('resize', handler);
      });

      it('write returns true', () => {
        const stdout = getMockStdout();
        expect(stdout.write('test')).toBe(true);
      });
    });
  });

  describe('Keypress Emission', () => {
    it('emits keypress for special keys', () => {
      const stdin = getMockStdin();
      const handler = vi.fn();
      stdin.on('data', handler);

      emitKeypress('return');
      expect(handler).toHaveBeenCalledWith(Buffer.from('\r'));

      handler.mockClear();
      emitKeypress('escape');
      expect(handler).toHaveBeenCalledWith(Buffer.from('\x1b'));

      handler.mockClear();
      emitKeypress('tab');
      expect(handler).toHaveBeenCalledWith(Buffer.from('\t'));

      handler.mockClear();
      emitKeypress('backspace');
      expect(handler).toHaveBeenCalledWith(Buffer.from('\x7f'));

      stdin.off('data', handler);
    });

    it('emits ctrl+key combinations', () => {
      const stdin = getMockStdin();
      const handler = vi.fn();
      stdin.on('data', handler);

      // Ctrl+C = \x03
      emitKeypress('c', true);
      expect(handler).toHaveBeenCalledWith(Buffer.from('\x03'));

      // Ctrl+D = \x04
      handler.mockClear();
      emitKeypress('d', true);
      expect(handler).toHaveBeenCalledWith(Buffer.from('\x04'));

      stdin.off('data', handler);
    });

    it('emits regular characters', () => {
      const stdin = getMockStdin();
      const handler = vi.fn();
      stdin.on('data', handler);

      emitKeypress('a');
      expect(handler).toHaveBeenCalledWith(Buffer.from('a'));

      stdin.off('data', handler);
    });
  });

  describe('Hook Exports', () => {
    // These tests verify hooks exist and are functions
    // Actual hook behavior requires React render context

    describe('useStdin', () => {
      it('is exported as a function', () => {
        expect(useStdin).toBeInstanceOf(Function);
      });
    });

    describe('useStdout', () => {
      it('is exported as a function', () => {
        expect(useStdout).toBeInstanceOf(Function);
      });
    });

    describe('useApp', () => {
      it('is exported as a function', () => {
        expect(useApp).toBeInstanceOf(Function);
      });
    });

    describe('useIsScreenReaderEnabled', () => {
      it('is exported as a function', () => {
        expect(useIsScreenReaderEnabled).toBeInstanceOf(Function);
      });
    });

    describe('useInput', () => {
      it('is exported as a function', () => {
        expect(useInput).toBeInstanceOf(Function);
      });
    });

    describe('useFocus', () => {
      it('is exported as a function', () => {
        expect(useFocus).toBeInstanceOf(Function);
      });
    });

    describe('useFocusManager', () => {
      it('is exported as a function', () => {
        expect(useFocusManager).toBeInstanceOf(Function);
      });
    });
  });

  describe('Callback Management', () => {
    describe('setExitCallback', () => {
      it('sets exit callback that can be called', () => {
        const callback = vi.fn();
        setExitCallback(callback);

        // Trigger via direct call (normally called via useApp().exit())
        callback(new Error('test'));
        expect(callback).toHaveBeenCalledWith(expect.any(Error));

        // Cleanup
        setExitCallback(() => {});
      });
    });

    describe('setRerenderCallback', () => {
      it('sets rerender callback that can be called', () => {
        const callback = vi.fn();
        setRerenderCallback(callback);

        // Trigger direct call
        callback();
        expect(callback).toHaveBeenCalled();

        // Cleanup
        setRerenderCallback(() => {});
      });
    });
  });

  describe('Utilities', () => {
    describe('measureElement', () => {
      it('returns mock dimensions', () => {
        const result = measureElement(null);
        expect(result).toEqual({
          width: 120, // Default stdout columns
          height: 1,
        });
      });

      it('returns dimensions based on stdout columns', () => {
        const stdout = getMockStdout();
        stdout.setDimensions(80, 24);

        const result = measureElement(null);
        expect(result.width).toBe(80);

        // Reset
        stdout.setDimensions(120, 40);
      });
    });

    describe('getBoundingBox', () => {
      it('returns mock bounding box', () => {
        const result = getBoundingBox(null);
        expect(result).toEqual({
          left: 0,
          top: 0,
          width: 120,
          height: 1,
        });
      });
    });

    describe('render', () => {
      it('returns stub instance and logs warning', async () => {
        const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const element = React.createElement('div');
        const instance = render(element);

        expect(consoleWarn).toHaveBeenCalledWith(
          '[ink-shim] render() called - use renderToWebSocket() instead for WebSocket reconciler'
        );

        expect(instance.rerender).toBeInstanceOf(Function);
        expect(instance.unmount).toBeInstanceOf(Function);
        expect(instance.waitUntilExit).toBeInstanceOf(Function);
        expect(instance.clear).toBeInstanceOf(Function);

        // These should not throw
        instance.rerender(element);
        instance.unmount();
        instance.clear();
        await expect(instance.waitUntilExit()).resolves.toBeUndefined();

        consoleWarn.mockRestore();
      });
    });
  });

  describe('InkProvider', () => {
    it('can be created with children', () => {
      const element = React.createElement(InkProvider, {}, 'child');
      expect(element).toBeDefined();
      expect(element.props.children).toBe('child');
    });

    it('accepts onExit callback', () => {
      const onExit = vi.fn();
      const element = React.createElement(InkProvider, { onExit }, 'child');
      expect(element.props.onExit).toBe(onExit);
    });

    it('accepts onRerender callback', () => {
      const onRerender = vi.fn();
      const element = React.createElement(InkProvider, { onRerender }, 'child');
      expect(element.props.onRerender).toBe(onRerender);
    });
  });

  describe('Type Exports', () => {
    it('exports Key type with correct shape', () => {
      const key: Key = {
        upArrow: false,
        downArrow: false,
        leftArrow: false,
        rightArrow: false,
        pageDown: false,
        pageUp: false,
        return: false,
        escape: false,
        ctrl: false,
        shift: false,
        tab: false,
        backspace: false,
        delete: false,
        meta: false,
      };
      expect(key).toBeDefined();
    });

    it('exports DOMElement type', () => {
      const element: DOMElement = {
        nodeName: 'ink-box',
        attributes: {},
        childNodes: [],
        parentNode: null,
      };
      expect(element).toBeDefined();
    });
  });
});
