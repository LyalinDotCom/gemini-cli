/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { ExpandableText, MAX_WIDTH } from './shared/ExpandableText.js';
import type { CommandKind } from '../commands/types.js';
import { Colors } from '../colors.js';
import { sanitizeForListDisplay } from '../utils/textUtils.js';

export interface Suggestion {
  label: string;
  value: string;
  description?: string;
  matchedIndex?: number;
  commandKind?: CommandKind;
  sourceName?: string;
}

export interface SuggestionGroup {
  name: string;
  suggestions: Suggestion[];
}
interface SuggestionsDisplayProps {
  suggestions: Suggestion[];
  activeIndex: number;
  isLoading: boolean;
  width: number;
  scrollOffset: number;
  userInput: string;
  mode: 'reverse' | 'slash';
  expandedIndex?: number;
  groups?: SuggestionGroup[];
}

export const MAX_SUGGESTIONS_TO_SHOW = 8;
export { MAX_WIDTH };

/**
 * Renders a group header line.
 */
function GroupHeader({ name, width }: { name: string; width: number }) {
  // Format: "── GroupName ──────────────..."
  const prefix = '── ';
  const suffix = ' ';
  const usedWidth = prefix.length + name.length + suffix.length;
  const remainingWidth = Math.max(0, width - usedWidth - 4); // -4 for padding
  const dashes = '─'.repeat(remainingWidth);

  return (
    <Box>
      <Text color={theme.text.secondary}>
        {prefix}
        {name}
        {suffix}
        {dashes}
      </Text>
    </Box>
  );
}

export function SuggestionsDisplay({
  suggestions,
  activeIndex,
  isLoading,
  width,
  scrollOffset,
  userInput,
  mode,
  expandedIndex,
  groups,
}: SuggestionsDisplayProps) {
  if (isLoading) {
    return (
      <Box paddingX={1} width={width}>
        <Text color="gray">Loading suggestions...</Text>
      </Box>
    );
  }

  if (suggestions.length === 0) {
    return null; // Don't render anything if there are no suggestions
  }

  // Calculate the visible slice based on scrollOffset
  const startIndex = scrollOffset;
  const endIndex = Math.min(
    scrollOffset + MAX_SUGGESTIONS_TO_SHOW,
    suggestions.length,
  );
  const visibleSuggestions = suggestions.slice(startIndex, endIndex);

  // Build a map from suggestion index to group name for group headers
  // Only used in slash mode with groups
  const indexToGroupMap = new Map<number, string>();
  if (mode === 'slash' && groups && groups.length > 0) {
    let currentIndex = 0;
    for (const group of groups) {
      if (group.suggestions.length > 0) {
        indexToGroupMap.set(currentIndex, group.name);
        currentIndex += group.suggestions.length;
      }
    }
  }

  // Determine which group headers should be shown in the visible range
  const visibleGroupHeaders = new Map<number, string>();
  if (mode === 'slash' && groups && groups.length > 0) {
    for (const [groupStartIdx, groupName] of indexToGroupMap) {
      // Show header if the first item of the group is visible
      if (groupStartIdx >= startIndex && groupStartIdx < endIndex) {
        visibleGroupHeaders.set(groupStartIdx, groupName);
      }
    }
  }

  const maxLabelLength = Math.max(...suggestions.map((s) => s.label.length));
  const commandColumnWidth =
    mode === 'slash' ? Math.min(maxLabelLength, Math.floor(width * 0.5)) : 0;

  // Build the visible items array with group headers interleaved
  const renderItems: React.ReactNode[] = [];

  if (scrollOffset > 0) {
    renderItems.push(
      <Text key="scroll-up" color={theme.text.primary}>
        ▲
      </Text>,
    );
  }

  visibleSuggestions.forEach((suggestion, index) => {
    const originalIndex = startIndex + index;

    // Check if we need to render a group header before this item
    const groupName = visibleGroupHeaders.get(originalIndex);
    if (groupName) {
      renderItems.push(
        <GroupHeader
          key={`header-${groupName}`}
          name={groupName}
          width={width - 2}
        />,
      );
    }

    const isActive = originalIndex === activeIndex;
    const isExpanded = originalIndex === expandedIndex;
    const textColor = isActive ? theme.text.accent : theme.text.secondary;
    const isLong = suggestion.value.length >= MAX_WIDTH;
    const labelElement = (
      <ExpandableText
        label={suggestion.value}
        matchedIndex={suggestion.matchedIndex}
        userInput={userInput}
        textColor={textColor}
        isExpanded={isExpanded}
      />
    );

    renderItems.push(
      <Box key={`${suggestion.value}-${originalIndex}`} flexDirection="row">
        <Box
          {...(mode === 'slash'
            ? { width: commandColumnWidth, flexShrink: 0 as const }
            : { flexShrink: 1 as const })}
        >
          <Box>{labelElement}</Box>
        </Box>

        {suggestion.description && (
          <Box flexGrow={1} paddingLeft={3}>
            <Text color={textColor} wrap="truncate">
              {sanitizeForListDisplay(suggestion.description, 100)}
            </Text>
          </Box>
        )}
        {isActive && isLong && (
          <Box width={3} flexShrink={0}>
            <Text color={Colors.Gray}>{isExpanded ? ' ← ' : ' → '}</Text>
          </Box>
        )}
      </Box>,
    );
  });

  if (endIndex < suggestions.length) {
    renderItems.push(
      <Text key="scroll-down" color="gray">
        ▼
      </Text>,
    );
  }

  if (suggestions.length > MAX_SUGGESTIONS_TO_SHOW) {
    renderItems.push(
      <Text key="counter" color="gray">
        ({activeIndex + 1}/{suggestions.length})
      </Text>,
    );
  }

  return (
    <Box flexDirection="column" paddingX={1} width={width}>
      {renderItems}
    </Box>
  );
}
