/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from 'react';
import type { ThoughtSummary } from '@google/gemini-cli-core';
import { useSettings } from './SettingsContext.js';

const MAX_STORED_THOUGHTS = 50;

interface ThinkingPanelState {
  panelVisible: boolean;
  thoughtsHistory: readonly ThoughtSummary[];
  inlineExpanded: boolean;
  inlineEnabled: boolean;
}

interface ThinkingPanelActions {
  togglePanel: () => void;
  addThought: (thought: ThoughtSummary) => void;
  clearThoughts: () => void;
  toggleInlineExpanded: () => void;
}

const ThinkingPanelStateContext = createContext<ThinkingPanelState | undefined>(
  undefined,
);

const ThinkingPanelActionsContext = createContext<
  ThinkingPanelActions | undefined
>(undefined);

// Default state for when used outside provider (e.g., in tests)
const defaultState: ThinkingPanelState = {
  panelVisible: false,
  thoughtsHistory: [],
  inlineExpanded: false,
  inlineEnabled: false,
};

export const useThinkingPanel = (): ThinkingPanelState => {
  const context = useContext(ThinkingPanelStateContext);
  // Return safe defaults when outside provider (e.g., in tests)
  return context ?? defaultState;
};

export const useThinkingPanelActions = (): ThinkingPanelActions => {
  const context = useContext(ThinkingPanelActionsContext);
  if (!context) {
    throw new Error(
      'useThinkingPanelActions must be used within a ThinkingPanelProvider',
    );
  }
  return context;
};

export const ThinkingPanelProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const settings = useSettings();
  const inlineEnabled = settings.merged.ui?.showInlineThinking === true;

  const [panelVisible, setPanelVisible] = useState(false);
  const [thoughtsHistory, setThoughtsHistory] = useState<ThoughtSummary[]>([]);
  const [inlineExpanded, setInlineExpanded] = useState(false);

  const togglePanel = useCallback(() => {
    setPanelVisible((prev) => !prev);
  }, []);

  const addThought = useCallback((thought: ThoughtSummary) => {
    setThoughtsHistory((prev) => {
      const updated = [...prev, thought];
      // Keep only the last MAX_STORED_THOUGHTS for performance
      return updated.slice(-MAX_STORED_THOUGHTS);
    });
  }, []);

  const clearThoughts = useCallback(() => {
    setThoughtsHistory([]);
  }, []);

  const toggleInlineExpanded = useCallback(() => {
    setInlineExpanded((prev) => !prev);
  }, []);

  const stateValue = useMemo(
    () => ({
      panelVisible,
      thoughtsHistory,
      inlineExpanded,
      inlineEnabled,
    }),
    [panelVisible, thoughtsHistory, inlineExpanded, inlineEnabled],
  );

  const actionsValue = useMemo(
    () => ({
      togglePanel,
      addThought,
      clearThoughts,
      toggleInlineExpanded,
    }),
    [togglePanel, addThought, clearThoughts, toggleInlineExpanded],
  );

  return (
    <ThinkingPanelStateContext.Provider value={stateValue}>
      <ThinkingPanelActionsContext.Provider value={actionsValue}>
        {children}
      </ThinkingPanelActionsContext.Provider>
    </ThinkingPanelStateContext.Provider>
  );
};
