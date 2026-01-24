/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  getToolFriendlyMessage,
  getToolStatusMessage,
  getToolConfirmationMessage,
  type ToolCallInfo,
} from './toolFriendlyNames.js';

describe('toolFriendlyNames', () => {
  describe('getToolFriendlyMessage', () => {
    it('should generate friendly message for read_file', () => {
      expect(
        getToolFriendlyMessage('read_file', { file_path: '/path/to/file.ts' }),
      ).toBe('reading file.ts');
    });

    it('should handle empty file path for read_file', () => {
      expect(getToolFriendlyMessage('read_file', {})).toBe('reading file');
    });

    it('should generate friendly message for write_file', () => {
      expect(
        getToolFriendlyMessage('write_file', {
          file_path: '/path/to/output.ts',
        }),
      ).toBe('writing output.ts');
    });

    it('should generate friendly message for replace/edit', () => {
      expect(
        getToolFriendlyMessage('replace', { file_path: '/path/to/file.ts' }),
      ).toBe('editing file.ts');
      expect(
        getToolFriendlyMessage('edit', { file_path: '/path/to/file.ts' }),
      ).toBe('editing file.ts');
    });

    it('should generate friendly message for read_many_files', () => {
      expect(
        getToolFriendlyMessage('read_many_files', {
          paths: ['/a.ts', '/b.ts', '/c.ts'],
        }),
      ).toBe('reading 3 files');
    });

    it('should handle single file for read_many_files', () => {
      expect(
        getToolFriendlyMessage('read_many_files', { paths: ['/a.ts'] }),
      ).toBe('reading 1 file');
    });

    it('should generate friendly message for list_directory', () => {
      expect(
        getToolFriendlyMessage('list_directory', {
          dir_path: '/src/components',
        }),
      ).toBe('listing components');
    });

    it('should handle missing dir_path for list_directory', () => {
      expect(getToolFriendlyMessage('list_directory', {})).toBe(
        'listing directory',
      );
    });

    it('should generate friendly message for glob', () => {
      expect(getToolFriendlyMessage('glob', { pattern: '**/*.ts' })).toBe(
        'finding files matching **/*.ts',
      );
    });

    it('should truncate long patterns for glob', () => {
      const result = getToolFriendlyMessage('glob', {
        pattern: 'this-is-a-very-long-pattern-that-should-be-truncated',
      });
      expect(result.length).toBeLessThan(60);
      expect(result).toContain('…');
    });

    it('should generate friendly message for search_file_content', () => {
      expect(
        getToolFriendlyMessage('search_file_content', { pattern: 'TODO' }),
      ).toBe('searching for "TODO"');
    });

    it('should generate friendly message for grep', () => {
      expect(getToolFriendlyMessage('grep', { pattern: 'import.*React' })).toBe(
        'searching for "import.*React"',
      );
    });

    it('should generate friendly message for run_shell_command', () => {
      expect(
        getToolFriendlyMessage('run_shell_command', {
          command: 'npm run build',
        }),
      ).toBe('running npm');
    });

    it('should generate friendly message for google_web_search', () => {
      expect(
        getToolFriendlyMessage('google_web_search', {
          query: 'typescript generics',
        }),
      ).toBe('searching web for "typescript generics"');
    });

    it('should generate friendly message for web_fetch', () => {
      expect(
        getToolFriendlyMessage('web_fetch', {
          url: 'https://example.com/api/data',
        }),
      ).toBe('fetching example.com');
    });

    it('should generate friendly message for save_memory', () => {
      expect(getToolFriendlyMessage('save_memory', {})).toBe(
        'saving to memory',
      );
    });

    it('should generate friendly message for write_todos', () => {
      expect(getToolFriendlyMessage('write_todos', {})).toBe('updating tasks');
    });

    it('should generate friendly message for ask_user', () => {
      expect(getToolFriendlyMessage('ask_user', {})).toBe('waiting for input');
    });

    it('should generate friendly message for activate_skill', () => {
      expect(
        getToolFriendlyMessage('activate_skill', { skill_name: 'code_review' }),
      ).toBe('activating code_review');
    });

    it('should generate generic message for unknown tools', () => {
      expect(getToolFriendlyMessage('my_custom_tool', {})).toBe(
        'using my custom tool',
      );
    });

    it('should strip MCP server prefix from tool names', () => {
      expect(getToolFriendlyMessage('server__custom_action', {})).toBe(
        'using custom action',
      );
    });
  });

  describe('getToolStatusMessage', () => {
    it('should return undefined for empty tool calls', () => {
      expect(getToolStatusMessage([])).toBeUndefined();
    });

    it('should return undefined when no tools are executing', () => {
      const tools: ToolCallInfo[] = [
        { name: 'read_file', args: { file_path: '/a.ts' }, status: 'success' },
      ];
      expect(getToolStatusMessage(tools)).toBeUndefined();
    });

    it('should return message for single executing tool', () => {
      const tools: ToolCallInfo[] = [
        {
          name: 'read_file',
          args: { file_path: '/a.ts' },
          status: 'executing',
        },
      ];
      expect(getToolStatusMessage(tools)).toBe('reading a.ts');
    });

    it('should return message for scheduled tool', () => {
      const tools: ToolCallInfo[] = [
        {
          name: 'write_file',
          args: { file_path: '/b.ts' },
          status: 'scheduled',
        },
      ];
      expect(getToolStatusMessage(tools)).toBe('writing b.ts');
    });

    it('should return combined message for 2-3 tools', () => {
      const tools: ToolCallInfo[] = [
        {
          name: 'read_file',
          args: { file_path: '/a.ts' },
          status: 'executing',
        },
        {
          name: 'read_file',
          args: { file_path: '/b.ts' },
          status: 'executing',
        },
      ];
      expect(getToolStatusMessage(tools)).toBe('reading a.ts (+1 more)');
    });

    it('should return count message for 4+ tools', () => {
      const tools: ToolCallInfo[] = [
        {
          name: 'read_file',
          args: { file_path: '/a.ts' },
          status: 'executing',
        },
        {
          name: 'read_file',
          args: { file_path: '/b.ts' },
          status: 'executing',
        },
        {
          name: 'read_file',
          args: { file_path: '/c.ts' },
          status: 'executing',
        },
        {
          name: 'read_file',
          args: { file_path: '/d.ts' },
          status: 'executing',
        },
      ];
      expect(getToolStatusMessage(tools)).toBe('executing 4 tools…');
    });
  });

  describe('getToolConfirmationMessage', () => {
    it('should return undefined for empty tool calls', () => {
      expect(getToolConfirmationMessage([])).toBeUndefined();
    });

    it('should return undefined when no tools awaiting approval', () => {
      const tools: ToolCallInfo[] = [
        {
          name: 'read_file',
          args: { file_path: '/a.ts' },
          status: 'executing',
        },
      ];
      expect(getToolConfirmationMessage(tools)).toBeUndefined();
    });

    it('should return confirmation message for single tool', () => {
      const tools: ToolCallInfo[] = [
        {
          name: 'write_file',
          args: { file_path: '/output.ts' },
          status: 'awaiting_approval',
        },
      ];
      expect(getToolConfirmationMessage(tools)).toBe(
        'confirm: writing output.ts',
      );
    });

    it('should return count message for multiple tools awaiting approval', () => {
      const tools: ToolCallInfo[] = [
        {
          name: 'write_file',
          args: { file_path: '/a.ts' },
          status: 'awaiting_approval',
        },
        {
          name: 'write_file',
          args: { file_path: '/b.ts' },
          status: 'awaiting_approval',
        },
      ];
      expect(getToolConfirmationMessage(tools)).toBe('confirm: 2 tools');
    });
  });
});
