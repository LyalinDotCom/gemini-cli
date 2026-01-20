/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from 'vitest';
import {
  getEnvironmentContext,
  getDirectoryContextString,
} from './environmentContext.js';
import type { Config } from '../config/config.js';
import type { Storage } from '../config/storage.js';

vi.mock('../config/config.js');
vi.mock('../tools/read-many-files.js');

describe('getDirectoryContextString', () => {
  let mockConfig: Partial<Config>;

  beforeEach(() => {
    mockConfig = {
      getWorkspaceContext: vi.fn().mockReturnValue({
        getDirectories: vi.fn().mockReturnValue(['/test/dir']),
      }),
      getFileService: vi.fn(),
      storage: {
        getProjectTempDir: vi.fn().mockReturnValue('/tmp/project-temp'),
      } as unknown as Storage,
    };
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should return context string for a single directory', async () => {
    const contextString = await getDirectoryContextString(mockConfig as Config);
    expect(contextString).toContain('Current working directory: /test/dir');
    expect(contextString).toContain(
      "Use 'glob', 'grep', and 'list_directory' tools to explore the codebase structure.",
    );
  });

  it('should return context string for multiple directories', async () => {
    (
      vi.mocked(mockConfig.getWorkspaceContext!)().getDirectories as Mock
    ).mockReturnValue(['/test/dir1', '/test/dir2']);

    const contextString = await getDirectoryContextString(mockConfig as Config);
    expect(contextString).toContain(
      'Current working directories:\n  - /test/dir1\n  - /test/dir2',
    );
    expect(contextString).toContain(
      "Use 'glob', 'grep', and 'list_directory' tools to explore the codebase structure.",
    );
  });
});

describe('getEnvironmentContext', () => {
  let mockConfig: Partial<Config>;
  let mockToolRegistry: { getTool: Mock };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-08-05T12:00:00Z'));

    mockToolRegistry = {
      getTool: vi.fn(),
    };

    mockConfig = {
      getWorkspaceContext: vi.fn().mockReturnValue({
        getDirectories: vi.fn().mockReturnValue(['/test/dir']),
      }),
      getFileService: vi.fn(),
      getEnvironmentMemory: vi.fn().mockReturnValue('Mock Environment Memory'),

      getToolRegistry: vi.fn().mockReturnValue(mockToolRegistry),
      storage: {
        getProjectTempDir: vi.fn().mockReturnValue('/tmp/project-temp'),
      } as unknown as Storage,
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  it('should return basic environment context for a single directory', async () => {
    const parts = await getEnvironmentContext(mockConfig as Config);

    expect(parts.length).toBe(1);
    const context = parts[0].text;

    expect(context).toContain('**Date**:');
    expect(context).toContain(`**OS**: ${process.platform}`);
    expect(context).toContain('Current working directory: /test/dir');
    expect(context).toContain(
      "Use 'glob', 'grep', and 'list_directory' tools to explore the codebase structure.",
    );
    expect(context).toContain('Mock Environment Memory');
  });

  it('should return basic environment context for multiple directories', async () => {
    (
      vi.mocked(mockConfig.getWorkspaceContext!)().getDirectories as Mock
    ).mockReturnValue(['/test/dir1', '/test/dir2']);

    const parts = await getEnvironmentContext(mockConfig as Config);

    expect(parts.length).toBe(1);
    const context = parts[0].text;

    expect(context).toContain(
      'Current working directories:\n  - /test/dir1\n  - /test/dir2',
    );
    expect(context).toContain(
      "Use 'glob', 'grep', and 'list_directory' tools to explore the codebase structure.",
    );
  });

  it('should handle read_many_files returning no content', async () => {
    const mockReadManyFilesTool = {
      build: vi.fn().mockReturnValue({
        execute: vi.fn().mockResolvedValue({ llmContent: '' }),
      }),
    };
    mockToolRegistry.getTool.mockReturnValue(mockReadManyFilesTool);

    const parts = await getEnvironmentContext(mockConfig as Config);

    expect(parts.length).toBe(1); // No extra part added
  });

  it('should handle read_many_files tool not being found', async () => {
    mockToolRegistry.getTool.mockReturnValue(null);

    const parts = await getEnvironmentContext(mockConfig as Config);

    expect(parts.length).toBe(1); // No extra part added
  });
});
