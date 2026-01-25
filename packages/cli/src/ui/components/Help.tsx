/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { type SlashCommand, CommandKind } from '../commands/types.js';
import { KEYBOARD_SHORTCUTS_URL } from '../constants.js';
import { sanitizeForListDisplay } from '../utils/textUtils.js';
import type { HelpMode } from '../types.js';

interface HelpProps {
  commands: readonly SlashCommand[];
  mode?: HelpMode;
}

interface CommandGroup {
  name: string;
  label: string;
  commands: SlashCommand[];
}

const isMac = process.platform === 'darwin';
const modKey = isMac ? 'Cmd' : 'Ctrl';

/**
 * Renders a section header with visual emphasis
 */
const SectionHeader = ({ title }: { title: string }) => (
  <Box marginTop={1}>
    <Text bold color={theme.text.accent}>
      ━━ {title} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    </Text>
  </Box>
);

/**
 * Groups commands by their source (Built-in first, then others alphabetically by source name).
 */
function groupCommands(commands: readonly SlashCommand[]): CommandGroup[] {
  const groups: Map<string, SlashCommand[]> = new Map();
  const builtInKey = 'Built-in';
  groups.set(builtInKey, []);

  for (const cmd of commands) {
    if (!cmd.description || cmd.hidden) {
      continue;
    }

    if (cmd.kind === CommandKind.BUILT_IN || !cmd.sourceName) {
      groups.get(builtInKey)!.push(cmd);
    } else {
      const groupName = cmd.sourceName;
      if (!groups.has(groupName)) {
        groups.set(groupName, []);
      }
      groups.get(groupName)!.push(cmd);
    }
  }

  const result: CommandGroup[] = [];

  const builtInCommands = groups.get(builtInKey) || [];
  if (builtInCommands.length > 0) {
    result.push({
      name: builtInKey,
      label: 'Built-in',
      commands: builtInCommands,
    });
  }

  const otherGroups = Array.from(groups.entries())
    .filter(([name, cmds]) => name !== builtInKey && cmds.length > 0)
    .sort(([a], [b]) => a.localeCompare(b));

  for (const [name, cmds] of otherGroups) {
    const firstCmd = cmds[0];
    let suffix = '';
    if (firstCmd?.kind === CommandKind.MCP_PROMPT) {
      suffix = ' (MCP)';
    } else if (firstCmd?.kind === CommandKind.FILE && firstCmd.extensionName) {
      suffix = ' (Extension)';
    }

    result.push({
      name,
      label: `${name}${suffix}`,
      commands: cmds,
    });
  }

  return result;
}

/**
 * Renders a single command with its subcommands using tree-style formatting
 */
const CommandItem = ({ command }: { command: SlashCommand }) => {
  const visibleSubCommands = command.subCommands?.filter((sub) => !sub.hidden);
  const hasSubCommands = visibleSubCommands && visibleSubCommands.length > 0;

  return (
    <Box flexDirection="column">
      <Text color={theme.text.primary}>
        <Text bold color={theme.text.accent}>
          /{command.name}
        </Text>
        {command.description &&
          ` — ${sanitizeForListDisplay(command.description, 80)}`}
      </Text>
      {hasSubCommands &&
        visibleSubCommands.map((subCommand, index) => {
          const isLast = index === visibleSubCommands.length - 1;
          const prefix = isLast ? '└─' : '├─';
          return (
            <Text key={subCommand.name} color={theme.text.secondary}>
              {'  '}
              {prefix} <Text color={theme.text.primary}>{subCommand.name}</Text>
              {subCommand.description &&
                ` — ${sanitizeForListDisplay(subCommand.description, 70)}`}
            </Text>
          );
        })}
    </Box>
  );
};

/**
 * Renders the Basics section
 */
const BasicsSection = () => (
  <>
    <SectionHeader title="Basics" />
    <Box flexDirection="column" paddingLeft={1}>
      <Text color={theme.text.primary}>
        <Text bold color={theme.text.accent}>
          @
        </Text>{' '}
        Add files/folders as context — e.g.,{' '}
        <Text color={theme.text.accent}>@src/file.ts</Text>
      </Text>
      <Text color={theme.text.primary}>
        <Text bold color={theme.text.accent}>
          !
        </Text>{' '}
        Execute shell commands — e.g.,{' '}
        <Text color={theme.text.accent}>!npm run start</Text>
      </Text>
      <Text color={theme.text.primary}>
        <Text bold color={theme.text.accent}>
          /
        </Text>{' '}
        Run slash commands — e.g., <Text color={theme.text.accent}>/help</Text>
      </Text>
    </Box>
  </>
);

/**
 * Renders the Commands section (full list)
 */
const CommandsSection = ({
  commandGroups,
}: {
  commandGroups: CommandGroup[];
}) => {
  const builtInGroup = commandGroups.find((g) => g.name === 'Built-in');
  const externalGroups = commandGroups.filter((g) => g.name !== 'Built-in');

  return (
    <>
      <SectionHeader title="Built-in Commands" />
      {builtInGroup && (
        <Box flexDirection="column" paddingLeft={1}>
          {builtInGroup.commands.map((cmd) => (
            <CommandItem key={cmd.name} command={cmd} />
          ))}
        </Box>
      )}

      {externalGroups.length > 0 && (
        <>
          <SectionHeader title="Extensions & MCP" />
          {externalGroups.map((group) => (
            <Box key={group.name} flexDirection="column" marginTop={1}>
              <Text bold color={theme.text.secondary}>
                {' '}
                {group.label}:
              </Text>
              <Box flexDirection="column" paddingLeft={1}>
                {group.commands.map((cmd) => (
                  <CommandItem key={cmd.name} command={cmd} />
                ))}
              </Box>
            </Box>
          ))}
        </>
      )}
    </>
  );
};

/**
 * Renders a shortcut item
 */
const ShortcutItem = ({
  keys,
  description,
}: {
  keys: string;
  description: string;
}) => (
  <Text color={theme.text.primary}>
    <Text bold color={theme.text.accent}>
      {keys}
    </Text>{' '}
    — {description}
  </Text>
);

/**
 * Renders the Keyboard Shortcuts section
 */
const ShortcutsSection = () => (
  <>
    <SectionHeader title="Input & Submission" />
    <Box flexDirection="column" paddingLeft={1}>
      <ShortcutItem keys="Enter" description="Send message" />
      <ShortcutItem
        keys={process.platform === 'win32' ? 'Ctrl+Enter' : `${modKey}+J`}
        description="New line"
      />
      <ShortcutItem keys="Tab" description="Accept suggestion" />
      <ShortcutItem keys="Esc" description="Cancel / Clear input (2x)" />
      <ShortcutItem keys="↑/↓" description="Navigate prompt history" />
      <ShortcutItem keys="Ctrl+R" description="Search commands/history" />
    </Box>

    <SectionHeader title="Cursor Movement" />
    <Box flexDirection="column" paddingLeft={1}>
      <ShortcutItem
        keys={`${isMac ? 'Option' : 'Alt'}+←/→`}
        description="Jump through words"
      />
      <ShortcutItem keys="Ctrl+A / Home" description="Start of line" />
      <ShortcutItem keys="Ctrl+E / End" description="End of line" />
    </Box>

    <SectionHeader title="Editing" />
    <Box flexDirection="column" paddingLeft={1}>
      <ShortcutItem keys="Ctrl+K" description="Delete to end of line" />
      <ShortcutItem keys="Ctrl+U" description="Delete to start of line" />
      <ShortcutItem
        keys={`${isMac ? 'Option' : 'Alt'}+Backspace`}
        description="Delete word"
      />
      <ShortcutItem keys="Ctrl+Z" description="Undo" />
      <ShortcutItem keys="Ctrl+Shift+Z" description="Redo" />
      <ShortcutItem keys={`${modKey}+X`} description="Open external editor" />
    </Box>

    <SectionHeader title="App Controls" />
    <Box flexDirection="column" paddingLeft={1}>
      <ShortcutItem keys={`${modKey}+C`} description="Cancel / Quit" />
      <ShortcutItem keys={`${modKey}+L`} description="Clear the screen" />
      <ShortcutItem keys={`${modKey}+S`} description="Selection mode (copy)" />
      <ShortcutItem keys={`${modKey}+Y`} description="Toggle YOLO mode" />
      <ShortcutItem keys="Shift+Tab" description="Cycle approval modes" />
      <ShortcutItem
        keys={`${isMac ? 'Option' : 'Alt'}+M`}
        description="Toggle Markdown"
      />
      <ShortcutItem keys="Ctrl+T" description="Toggle TODO list" />
      <ShortcutItem keys="F12" description="Show error details" />
    </Box>

    <SectionHeader title="Scrolling" />
    <Box flexDirection="column" paddingLeft={1}>
      <ShortcutItem keys="Page Up/Down" description="Scroll page" />
      <ShortcutItem keys="Shift+↑/↓" description="Scroll line by line" />
      <ShortcutItem
        keys={`${modKey}+Home/End`}
        description="Scroll to top/bottom"
      />
    </Box>

    <Box marginTop={1} paddingLeft={1}>
      <Text color={theme.text.secondary}>
        Full list:{' '}
        <Text color={theme.text.accent}>{KEYBOARD_SHORTCUTS_URL}</Text>
      </Text>
    </Box>
  </>
);

/**
 * Renders the Overview mode with navigation hints
 */
const OverviewSection = ({
  commandGroups,
}: {
  commandGroups: CommandGroup[];
}) => {
  const builtInCount =
    commandGroups.find((g) => g.name === 'Built-in')?.commands.length || 0;
  const externalCount = commandGroups
    .filter((g) => g.name !== 'Built-in')
    .reduce((sum, g) => sum + g.commands.length, 0);

  return (
    <>
      <BasicsSection />

      <SectionHeader title="More Help" />
      <Box flexDirection="column" paddingLeft={1}>
        <Text color={theme.text.primary}>
          <Text bold color={theme.text.accent}>
            /help commands
          </Text>{' '}
          — View all {builtInCount} built-in
          {externalCount > 0 ? ` + ${externalCount} extension` : ''} commands
        </Text>
        <Text color={theme.text.primary}>
          <Text bold color={theme.text.accent}>
            /help shortcuts
          </Text>{' '}
          — View keyboard shortcuts
        </Text>
      </Box>

      <SectionHeader title="Essential Commands" />
      <Box flexDirection="column" paddingLeft={1}>
        <Text color={theme.text.primary}>
          <Text bold color={theme.text.accent}>
            /chat
          </Text>{' '}
          — Save, resume, and share conversations
        </Text>
        <Text color={theme.text.primary}>
          <Text bold color={theme.text.accent}>
            /resume
          </Text>{' '}
          — Browse and resume auto-saved conversations
        </Text>
        <Text color={theme.text.primary}>
          <Text bold color={theme.text.accent}>
            /memory
          </Text>{' '}
          — Manage project context (GEMINI.md)
        </Text>
        <Text color={theme.text.primary}>
          <Text bold color={theme.text.accent}>
            /model
          </Text>{' '}
          — Change the AI model
        </Text>
        <Text color={theme.text.primary}>
          <Text bold color={theme.text.accent}>
            /clear
          </Text>{' '}
          — Clear screen and history
        </Text>
        <Text color={theme.text.primary}>
          <Text bold color={theme.text.accent}>
            /settings
          </Text>{' '}
          — Configure preferences
        </Text>
      </Box>

      <SectionHeader title="Quick Shortcuts" />
      <Box flexDirection="column" paddingLeft={1}>
        <Text color={theme.text.primary}>
          <Text bold color={theme.text.accent}>
            {modKey}+L
          </Text>{' '}
          Clear {'  '}
          <Text bold color={theme.text.accent}>
            {modKey}+C
          </Text>{' '}
          Quit {'  '}
          <Text bold color={theme.text.accent}>
            Esc
          </Text>{' '}
          Cancel/Rewind
        </Text>
      </Box>
    </>
  );
};

export const Help: React.FC<HelpProps> = ({ commands, mode = 'overview' }) => {
  const commandGroups = groupCommands(commands);

  return (
    <Box flexDirection="column" marginBottom={1} paddingX={1}>
      {mode === 'overview' && <OverviewSection commandGroups={commandGroups} />}
      {mode === 'commands' && <CommandsSection commandGroups={commandGroups} />}
      {mode === 'shortcuts' && <ShortcutsSection />}
    </Box>
  );
};
