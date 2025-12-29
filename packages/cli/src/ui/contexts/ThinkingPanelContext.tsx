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

interface ThinkingPanelState {
  panelVisible: boolean;
  thoughtsHistory: readonly ThoughtSummary[];
}

interface ThinkingPanelActions {
  togglePanel: () => void;
  addThought: (thought: ThoughtSummary) => void;
  clearThoughts: () => void;
}

const ThinkingPanelStateContext = createContext<ThinkingPanelState | undefined>(
  undefined,
);

const ThinkingPanelActionsContext = createContext<
  ThinkingPanelActions | undefined
>(undefined);

export const useThinkingPanel = (): ThinkingPanelState => {
  const context = useContext(ThinkingPanelStateContext);
  if (!context) {
    throw new Error(
      'useThinkingPanel must be used within a ThinkingPanelProvider',
    );
  }
  return context;
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
  const [panelVisible, setPanelVisible] = useState(false);
  const [thoughtsHistory, setThoughtsHistory] = useState<ThoughtSummary[]>([]);

  const togglePanel = useCallback(() => {
    setPanelVisible((prev) => !prev);
  }, []);

  const addThought = useCallback((thought: ThoughtSummary) => {
    setThoughtsHistory((prev) => [...prev, thought]);
  }, []);

  const clearThoughts = useCallback(() => {
    setThoughtsHistory([]);
  }, []);

  const stateValue = useMemo(
    () => ({
      panelVisible,
      thoughtsHistory,
    }),
    [panelVisible, thoughtsHistory],
  );

  const actionsValue = useMemo(
    () => ({
      togglePanel,
      addThought,
      clearThoughts,
    }),
    [togglePanel, addThought, clearThoughts],
  );

  return (
    <ThinkingPanelStateContext.Provider value={stateValue}>
      <ThinkingPanelActionsContext.Provider value={actionsValue}>
        {children}
      </ThinkingPanelActionsContext.Provider>
    </ThinkingPanelStateContext.Provider>
  );
};
