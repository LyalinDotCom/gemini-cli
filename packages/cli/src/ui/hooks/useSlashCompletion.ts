/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { AsyncFzf } from 'fzf';
import type {
  Suggestion,
  SuggestionGroup,
} from '../components/SuggestionsDisplay.js';
import {
  CommandKind,
  type CommandContext,
  type SlashCommand,
} from '../commands/types.js';
import { debugLogger } from '@google/gemini-cli-core';

const BUILT_IN_GROUP_NAME = 'Built-in';

/**
 * Groups suggestions by their source (Built-in first, then others alphabetically).
 * Filters out empty groups.
 */
export function groupSuggestions(suggestions: Suggestion[]): SuggestionGroup[] {
  const groups: Map<string, Suggestion[]> = new Map();
  groups.set(BUILT_IN_GROUP_NAME, []);

  for (const suggestion of suggestions) {
    if (
      !suggestion.sourceName ||
      suggestion.commandKind === CommandKind.BUILT_IN
    ) {
      groups.get(BUILT_IN_GROUP_NAME)!.push(suggestion);
    } else {
      const groupName = suggestion.sourceName;
      if (!groups.has(groupName)) {
        groups.set(groupName, []);
      }
      groups.get(groupName)!.push(suggestion);
    }
  }

  // Return Built-in first (if non-empty), then others alphabetically (if non-empty)
  const result: SuggestionGroup[] = [];

  const builtInSuggestions = groups.get(BUILT_IN_GROUP_NAME) || [];
  if (builtInSuggestions.length > 0) {
    result.push({ name: BUILT_IN_GROUP_NAME, suggestions: builtInSuggestions });
  }

  const otherGroups = Array.from(groups.entries())
    .filter(([name, sug]) => name !== BUILT_IN_GROUP_NAME && sug.length > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, sug]) => ({ name, suggestions: sug }));

  result.push(...otherGroups);

  return result;
}

/**
 * Groups and flattens suggestions, returning both the groups and the sorted flat array.
 * This ensures the suggestions array matches the group structure.
 */
export function groupAndFlattenSuggestions(suggestions: Suggestion[]): {
  groups: SuggestionGroup[];
  sortedSuggestions: Suggestion[];
} {
  const groups = groupSuggestions(suggestions);
  const sortedSuggestions = groups.flatMap((group) => group.suggestions);
  return { groups, sortedSuggestions };
}

// Type alias for improved type safety based on actual fzf result structure
type FzfCommandResult = {
  item: string;
  start: number;
  end: number;
  score: number;
  positions?: number[]; // Optional - fzf doesn't always provide match positions depending on algorithm/options used
};

// Interface for FZF command cache entry
interface FzfCommandCacheEntry {
  fzf: AsyncFzf<string[]>;
  commandMap: Map<string, SlashCommand>;
}

// Utility function to safely handle errors without information disclosure
function logErrorSafely(error: unknown, context: string): void {
  if (error instanceof Error) {
    // Log full error details securely for debugging
    debugLogger.warn(`[${context}]`, error);
  } else {
    debugLogger.warn(`[${context}] Non-error thrown:`, error);
  }
}

// Shared utility function for command matching logic
function matchesCommand(cmd: SlashCommand, query: string): boolean {
  return (
    cmd.name.toLowerCase() === query.toLowerCase() ||
    cmd.altNames?.some((alt) => alt.toLowerCase() === query.toLowerCase()) ||
    false
  );
}

interface CommandParserResult {
  hasTrailingSpace: boolean;
  commandPathParts: string[];
  partial: string;
  currentLevel: readonly SlashCommand[] | undefined;
  leafCommand: SlashCommand | null;
  exactMatchAsParent: SlashCommand | undefined;
  isArgumentCompletion: boolean;
}

function useCommandParser(
  query: string | null,
  slashCommands: readonly SlashCommand[],
): CommandParserResult {
  return useMemo(() => {
    if (!query) {
      return {
        hasTrailingSpace: false,
        commandPathParts: [],
        partial: '',
        currentLevel: slashCommands,
        leafCommand: null,
        exactMatchAsParent: undefined,
        isArgumentCompletion: false,
      };
    }

    const fullPath = query.substring(1) || '';
    const hasTrailingSpace = !!query.endsWith(' ');
    const rawParts = fullPath.split(/\s+/).filter((p) => p);
    let commandPathParts = rawParts;
    let partial = '';

    if (!hasTrailingSpace && rawParts.length > 0) {
      partial = rawParts[rawParts.length - 1];
      commandPathParts = rawParts.slice(0, -1);
    }

    let currentLevel: readonly SlashCommand[] | undefined = slashCommands;
    let leafCommand: SlashCommand | null = null;

    for (const part of commandPathParts) {
      if (!currentLevel) {
        leafCommand = null;
        currentLevel = [];
        break;
      }
      const found: SlashCommand | undefined = currentLevel.find((cmd) =>
        matchesCommand(cmd, part),
      );

      if (found) {
        leafCommand = found;
        currentLevel = found.subCommands as readonly SlashCommand[] | undefined;
        if (found.kind === CommandKind.MCP_PROMPT) {
          break;
        }
      } else {
        leafCommand = null;
        currentLevel = [];
        break;
      }
    }

    let exactMatchAsParent: SlashCommand | undefined;
    if (!hasTrailingSpace && currentLevel) {
      exactMatchAsParent = currentLevel.find(
        (cmd) => matchesCommand(cmd, partial) && cmd.subCommands,
      );

      if (exactMatchAsParent) {
        // Only descend if there are NO other matches for the partial at this level.
        // This ensures that typing "/memory" still shows "/memory-leak" if it exists.
        const otherMatches = currentLevel.filter(
          (cmd) =>
            cmd !== exactMatchAsParent &&
            (cmd.name.toLowerCase().startsWith(partial.toLowerCase()) ||
              cmd.altNames?.some((alt) =>
                alt.toLowerCase().startsWith(partial.toLowerCase()),
              )),
        );

        if (otherMatches.length === 0) {
          leafCommand = exactMatchAsParent;
          currentLevel = exactMatchAsParent.subCommands as
            | readonly SlashCommand[]
            | undefined;
          partial = '';
        }
      }
    }

    const depth = commandPathParts.length;
    const isArgumentCompletion = !!(
      leafCommand?.completion &&
      (hasTrailingSpace ||
        (rawParts.length > depth && depth > 0 && partial !== ''))
    );

    return {
      hasTrailingSpace,
      commandPathParts,
      partial,
      currentLevel,
      leafCommand,
      exactMatchAsParent,
      isArgumentCompletion,
    };
  }, [query, slashCommands]);
}

interface SuggestionsResult {
  suggestions: Suggestion[];
  isLoading: boolean;
}

interface CompletionPositions {
  start: number;
  end: number;
}

interface PerfectMatchResult {
  isPerfectMatch: boolean;
}

/**
 * Finds commands that match by group name (sourceName).
 * Returns all commands from groups whose name starts with the partial query.
 * Uses startsWith for precise matching - user must type the beginning of a group name.
 */
function getGroupMatchingCommands(
  commands: readonly SlashCommand[],
  partial: string,
): { commands: SlashCommand[]; matchedGroupNames: Set<string> } {
  const lowerPartial = partial.toLowerCase();
  const matchedGroupNames = new Set<string>();

  // First, find all group names that start with the partial
  for (const cmd of commands) {
    if (
      cmd.sourceName &&
      cmd.sourceName.toLowerCase().startsWith(lowerPartial)
    ) {
      matchedGroupNames.add(cmd.sourceName);
    }
  }

  // Then, get all commands from those matching groups
  const groupMatchingCommands = commands.filter(
    (cmd) =>
      cmd.sourceName &&
      matchedGroupNames.has(cmd.sourceName) &&
      cmd.description &&
      !cmd.hidden,
  );

  return { commands: groupMatchingCommands, matchedGroupNames };
}

function useCommandSuggestions(
  query: string | null,
  parserResult: CommandParserResult,
  commandContext: CommandContext,
  getFzfForCommands: (
    commands: readonly SlashCommand[],
  ) => FzfCommandCacheEntry | null,
  getPrefixSuggestions: (
    commands: readonly SlashCommand[],
    partial: string,
  ) => SlashCommand[],
): SuggestionsResult {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const abortController = new AbortController();
    const { signal } = abortController;

    const {
      isArgumentCompletion,
      leafCommand,
      commandPathParts,
      partial,
      currentLevel,
    } = parserResult;

    if (isArgumentCompletion) {
      const fetchAndSetSuggestions = async () => {
        if (signal.aborted) return;

        // Safety check: ensure leafCommand and completion exist
        if (!leafCommand?.completion) {
          debugLogger.warn(
            'Attempted argument completion without completion function',
          );
          return;
        }

        const showLoading = leafCommand.showCompletionLoading !== false;
        if (showLoading) {
          setIsLoading(true);
        }
        try {
          const rawParts = [...commandPathParts];
          if (partial) rawParts.push(partial);
          const depth = commandPathParts.length;
          const argString = rawParts.slice(depth).join(' ');
          const results =
            (await leafCommand.completion(
              {
                ...commandContext,
                invocation: {
                  raw: query || `/${rawParts.join(' ')}`,
                  name: leafCommand.name,
                  args: argString,
                },
              },
              argString,
            )) || [];

          if (!signal.aborted) {
            const finalSuggestions = results.map((s) => ({
              label: s,
              value: s,
            }));
            setSuggestions(finalSuggestions);
            setIsLoading(false);
          }
        } catch (error) {
          if (!signal.aborted) {
            logErrorSafely(error, 'Argument completion');
            setSuggestions([]);
            setIsLoading(false);
          }
        }
      };
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      fetchAndSetSuggestions();
      return () => abortController.abort();
    }

    const commandsToSearch = currentLevel || [];
    if (commandsToSearch.length > 0) {
      const performFuzzySearch = async () => {
        if (signal.aborted) return;
        let potentialSuggestions: SlashCommand[] = [];
        let matchedGroupNames = new Set<string>();

        if (partial === '') {
          // If no partial query, show all available commands
          potentialSuggestions = commandsToSearch.filter(
            (cmd) => cmd.description && !cmd.hidden,
          );
        } else {
          // First, check for group name matches
          const groupMatches = getGroupMatchingCommands(
            commandsToSearch,
            partial,
          );
          matchedGroupNames = groupMatches.matchedGroupNames;

          // Then, do fuzzy search on command names
          const fzfInstance = getFzfForCommands(commandsToSearch);
          let commandNameMatches: SlashCommand[] = [];

          if (fzfInstance) {
            try {
              const fzfResults = await fzfInstance.fzf.find(partial);
              if (signal.aborted) return;
              const uniqueCommands = new Set<SlashCommand>();

              // Filter fzf results to require reasonable match quality
              // Either the item starts with the search term, or has a good fzf score
              const lowerPartial = partial.toLowerCase();
              fzfResults.forEach((result: FzfCommandResult) => {
                const cmd = fzfInstance.commandMap.get(result.item);
                if (cmd && cmd.description) {
                  // Accept if: starts with partial, contains partial, or has high fzf score
                  const itemLower = result.item.toLowerCase();
                  const startsWithMatch = itemLower.startsWith(lowerPartial);
                  const containsMatch = itemLower.includes(lowerPartial);
                  // Score threshold: fzf scores are typically negative, closer to 0 is better
                  // A score > -50 indicates a reasonably good match
                  const hasGoodScore = result.score > -50;

                  if (startsWithMatch || containsMatch || hasGoodScore) {
                    uniqueCommands.add(cmd);
                  }
                }
              });
              commandNameMatches = Array.from(uniqueCommands);
            } catch (error) {
              logErrorSafely(
                error,
                'Fuzzy search - falling back to prefix matching',
              );
              commandNameMatches = getPrefixSuggestions(
                commandsToSearch,
                partial,
              );
            }
          } else {
            commandNameMatches = getPrefixSuggestions(
              commandsToSearch,
              partial,
            );
          }

          // Merge group matches and command name matches, prioritizing group matches
          // but avoiding duplicates
          const seen = new Set<string>();
          potentialSuggestions = [];

          // Add group-matched commands first
          for (const cmd of groupMatches.commands) {
            if (!seen.has(cmd.name)) {
              seen.add(cmd.name);
              potentialSuggestions.push(cmd);
            }
          }

          // Then add command name matches that aren't already included
          for (const cmd of commandNameMatches) {
            if (!seen.has(cmd.name)) {
              seen.add(cmd.name);
              potentialSuggestions.push(cmd);
            }
          }
        }

        if (!signal.aborted) {
          // Sort suggestions:
          // 1. Commands from matching groups come first (grouped by their sourceName)
          // 2. Within each group, exact command name matches come first
          // 3. Then other commands
          const sortedSuggestions = [...potentialSuggestions].sort((a, b) => {
            const aGroupMatch =
              a.sourceName && matchedGroupNames.has(a.sourceName);
            const bGroupMatch =
              b.sourceName && matchedGroupNames.has(b.sourceName);

            // Group matches come first
            if (aGroupMatch && !bGroupMatch) return -1;
            if (!aGroupMatch && bGroupMatch) return 1;

            // Within same group priority, sort by exact command name match
            const aIsExact = matchesCommand(a, partial);
            const bIsExact = matchesCommand(b, partial);
            if (aIsExact && !bIsExact) return -1;
            if (!aIsExact && bIsExact) return 1;

            return 0;
          });

          const finalSuggestions = sortedSuggestions.map((cmd) => ({
            label: cmd.name,
            value: cmd.name,
            description: cmd.description,
            commandKind: cmd.kind,
            sourceName: cmd.sourceName,
          }));

          setSuggestions(finalSuggestions);
        }
      };

      performFuzzySearch().catch((error) => {
        logErrorSafely(error, 'Unexpected fuzzy search error');
        if (!signal.aborted) {
          // Ultimate fallback: show no suggestions rather than confusing the user
          // with all available commands when their query clearly doesn't match anything
          setSuggestions([]);
        }
      });
      return () => abortController.abort();
    }

    setSuggestions([]);
    return () => abortController.abort();
  }, [
    query,
    parserResult,
    commandContext,
    getFzfForCommands,
    getPrefixSuggestions,
  ]);

  return { suggestions, isLoading };
}

function useCompletionPositions(
  query: string | null,
  parserResult: CommandParserResult,
): CompletionPositions {
  return useMemo(() => {
    if (!query) {
      return { start: -1, end: -1 };
    }

    const { hasTrailingSpace, partial, exactMatchAsParent } = parserResult;

    // Set completion start/end positions
    if (hasTrailingSpace || exactMatchAsParent) {
      return { start: query.length, end: query.length };
    } else if (partial) {
      if (parserResult.isArgumentCompletion) {
        const commandSoFar = `/${parserResult.commandPathParts.join(' ')}`;
        const argStartIndex =
          commandSoFar.length +
          (parserResult.commandPathParts.length > 0 ? 1 : 0);
        return { start: argStartIndex, end: query.length };
      } else {
        return { start: query.length - partial.length, end: query.length };
      }
    } else {
      return { start: 1, end: query.length };
    }
  }, [query, parserResult]);
}

function usePerfectMatch(
  parserResult: CommandParserResult,
): PerfectMatchResult {
  return useMemo(() => {
    const { hasTrailingSpace, partial, leafCommand, currentLevel } =
      parserResult;

    if (hasTrailingSpace) {
      return { isPerfectMatch: false };
    }

    if (leafCommand && partial === '' && leafCommand.action) {
      return { isPerfectMatch: true };
    }

    if (currentLevel) {
      const perfectMatch = currentLevel.find(
        (cmd) => matchesCommand(cmd, partial) && cmd.action,
      );
      if (perfectMatch) {
        return { isPerfectMatch: true };
      }
    }

    return { isPerfectMatch: false };
  }, [parserResult]);
}

/**
 * Gets the SlashCommand object for a given suggestion by navigating the command hierarchy
 * based on the current parser state.
 * @param suggestion The suggestion object
 * @param parserResult The current parser result with hierarchy information
 * @returns The matching SlashCommand or undefined
 */
function getCommandFromSuggestion(
  suggestion: Suggestion,
  parserResult: CommandParserResult,
): SlashCommand | undefined {
  const { currentLevel } = parserResult;

  if (!currentLevel) {
    return undefined;
  }

  // suggestion.value is just the command name at the current level (e.g., "list")
  // Find it in the current level's commands
  const command = currentLevel.find((cmd) =>
    matchesCommand(cmd, suggestion.value),
  );

  return command;
}

export interface UseSlashCompletionProps {
  enabled: boolean;
  query: string | null;
  slashCommands: readonly SlashCommand[];
  commandContext: CommandContext;
  setSuggestions: (suggestions: Suggestion[]) => void;
  setIsLoadingSuggestions: (isLoading: boolean) => void;
  setIsPerfectMatch: (isMatch: boolean) => void;
}

export function useSlashCompletion(props: UseSlashCompletionProps): {
  completionStart: number;
  completionEnd: number;
  getCommandFromSuggestion: (
    suggestion: Suggestion,
  ) => SlashCommand | undefined;
  isArgumentCompletion: boolean;
  leafCommand: SlashCommand | null;
} {
  const {
    enabled,
    query,
    slashCommands,
    commandContext,
    setSuggestions,
    setIsLoadingSuggestions,
    setIsPerfectMatch,
  } = props;
  const [completionStart, setCompletionStart] = useState(-1);
  const [completionEnd, setCompletionEnd] = useState(-1);

  // Simplified cache for AsyncFzf instances - WeakMap handles automatic cleanup
  const fzfInstanceCache = useMemo(
    () => new WeakMap<readonly SlashCommand[], FzfCommandCacheEntry>(),
    [],
  );

  // Helper function to create or retrieve cached AsyncFzf instance for a command level
  const getFzfForCommands = useMemo(
    () => (commands: readonly SlashCommand[]) => {
      if (!commands || commands.length === 0) {
        return null;
      }

      // Check if we already have a cached instance
      const cached = fzfInstanceCache.get(commands);
      if (cached) {
        return cached;
      }

      // Create new fzf instance
      const commandItems: string[] = [];
      const commandMap = new Map<string, SlashCommand>();

      commands.forEach((cmd) => {
        if (cmd.description && !cmd.hidden) {
          commandItems.push(cmd.name);
          commandMap.set(cmd.name, cmd);

          if (cmd.altNames) {
            cmd.altNames.forEach((alt) => {
              commandItems.push(alt);
              commandMap.set(alt, cmd);
            });
          }
        }
      });

      if (commandItems.length === 0) {
        return null;
      }

      try {
        const instance: FzfCommandCacheEntry = {
          fzf: new AsyncFzf(commandItems, {
            fuzzy: 'v2',
            casing: 'case-insensitive', // Explicitly enforce case-insensitivity
          }),
          commandMap,
        };

        // Cache the instance - WeakMap will handle automatic cleanup
        fzfInstanceCache.set(commands, instance);

        return instance;
      } catch (error) {
        logErrorSafely(error, 'FZF instance creation');
        return null;
      }
    },
    [fzfInstanceCache],
  );

  // Memoized helper function for prefix-based filtering to improve performance
  const getPrefixSuggestions = useMemo(
    () => (commands: readonly SlashCommand[], partial: string) =>
      commands.filter(
        (cmd) =>
          cmd.description &&
          !cmd.hidden &&
          (cmd.name.toLowerCase().startsWith(partial.toLowerCase()) ||
            cmd.altNames?.some((alt) =>
              alt.toLowerCase().startsWith(partial.toLowerCase()),
            )),
      ),
    [],
  );

  // Use extracted hooks for better separation of concerns
  const parserResult = useCommandParser(query, slashCommands);
  const { suggestions: hookSuggestions, isLoading } = useCommandSuggestions(
    query,
    parserResult,
    commandContext,
    getFzfForCommands,
    getPrefixSuggestions,
  );
  const { start: calculatedStart, end: calculatedEnd } = useCompletionPositions(
    query,
    parserResult,
  );
  const { isPerfectMatch } = usePerfectMatch(parserResult);

  // Clear internal state when disabled
  useEffect(() => {
    if (!enabled) {
      setSuggestions([]);
      setIsLoadingSuggestions(false);
      setIsPerfectMatch(false);
      setCompletionStart(-1);
      setCompletionEnd(-1);
    }
  }, [enabled, setSuggestions, setIsLoadingSuggestions, setIsPerfectMatch]);

  // Update external state only when enabled
  useEffect(() => {
    if (!enabled || query === null) {
      return;
    }

    setSuggestions(hookSuggestions);
    setIsLoadingSuggestions(isLoading);
    setIsPerfectMatch(isPerfectMatch);
    setCompletionStart(calculatedStart);
    setCompletionEnd(calculatedEnd);
  }, [
    enabled,
    query,
    hookSuggestions,
    isLoading,
    isPerfectMatch,
    calculatedStart,
    calculatedEnd,
    setSuggestions,
    setIsLoadingSuggestions,
    setIsPerfectMatch,
  ]);

  return {
    completionStart,
    completionEnd,
    getCommandFromSuggestion: (suggestion: Suggestion) =>
      getCommandFromSuggestion(suggestion, parserResult),
    isArgumentCompletion: parserResult.isArgumentCompletion,
    leafCommand: parserResult.leafCommand,
  };
}
