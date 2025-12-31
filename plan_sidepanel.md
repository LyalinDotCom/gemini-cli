# Side Panel Implementation Plan

## Feature Overview

Add a toggleable side panel to Gemini CLI that displays model
"thinking/reasoning" content. The panel appears on the right side, taking 1/3 of
terminal width, with a fixed height. Users toggle it with `Ctrl+\`.

---

## Key Discovery: Thinking Infrastructure Already Exists

The most important finding from code exploration: **thinking/reasoning support
is already fully implemented** in the codebase. The model sends thinking
content, it's parsed, streamed, and captured in React state. It's just not
prominently displayed.

### Current Thinking Data Flow

```
Model Response (with thought parts)
    ↓
turn.ts: Extracts thought parts, yields Thought events (lines 276-285)
    ↓
useGeminiStream.ts: Captures in `thought` state (line 119)
    ↓
LoadingIndicator.tsx: Shows only thought.subject briefly
```

### ThoughtSummary Type (from thoughtUtils.ts)

```typescript
interface ThoughtSummary {
  subject: string; // Content between **...** markers (bold header)
  description: string; // Remaining text (body)
}
```

### Relevant Code in turn.ts (lines 276-285)

```typescript
const thoughtPart = resp.candidates?.[0]?.content?.parts?.[0];
if (thoughtPart?.thought) {
  const thought = parseThought(thoughtPart.text ?? '');
  yield {
    type: GeminiEventType.Thought,
    value: thought,
    traceId,
  };
  continue;
}
```

### Relevant Code in useGeminiStream.ts

```typescript
// Line 119: State declaration
const [thought, setThought] = useState<ThoughtSummary | null>(null);

// Lines 805-807: Event handling
case ServerGeminiEventType.Thought:
  setThought(event.value);
  break;

// Line 944: Reset on new prompt
setThought(null);

// Lines 619, 643: Reset on cancel/error
setThought(null);
```

---

## UI Architecture Insights

### Current Layout Structure

```
DefaultAppLayout.tsx
├── Box (flexDirection="column", full width)
│   ├── MainContent (scrollable, flex-grow)
│   └── Controls (fixed height)
│       ├── Notifications
│       ├── CopyModeWarning
│       ├── DialogManager OR Composer
│       └── ExitWarning
```

### Key Layout Code (DefaultAppLayout.tsx)

```typescript
const width = isAlternateBuffer
  ? uiState.terminalWidth
  : uiState.mainAreaWidth;

return (
  <Box
    flexDirection="column"
    width={width}
    height={isAlternateBuffer ? terminalHeight - 1 : undefined}
    // ...
  >
    <MainContent />
    <Box flexDirection="column">{/* Controls */}</Box>
  </Box>
);
```

### Provider Hierarchy (gemini.tsx)

```
<SettingsContext.Provider>
  <KeypressProvider>
    <MouseProvider>
      <ScrollProvider>
        <SessionStatsProvider>
          <VimModeProvider>
            <AppContainer />   ← ThinkingPanelProvider goes here
          </VimModeProvider>
        </SessionStatsProvider>
      </ScrollProvider>
    </MouseProvider>
  </KeypressProvider>
</SettingsContext.Provider>
```

---

## Keyboard System Insights

### How Bindings Work (keyBindings.ts)

```typescript
// 1. Command enum defines all commands
export enum Command {
  TOGGLE_MARKDOWN = 'toggleMarkdown',
  // ...
}

// 2. defaultKeyBindings maps commands to key combinations
export const defaultKeyBindings: KeyBindingConfig = {
  [Command.TOGGLE_MARKDOWN]: [{ key: 'm', command: true }],
  // ...
};

// 3. Special characters use 'sequence' instead of 'key'
[Command.OPEN_EXTERNAL_EDITOR]: [
  { key: 'x', ctrl: true },
  { sequence: '\x18', ctrl: true },  // Ctrl+X = ASCII 24
],
```

### Ctrl+\ Binding

- ASCII value: 28 (0x1c)
- Sequence: `'\x1c'`
- Not currently used in Gemini CLI or common terminal apps

### Using Key Matchers (keyMatchers.ts)

```typescript
import { keyMatchers, Command } from '../keyMatchers.js';

// In component/hook:
if (keyMatchers[Command.MY_COMMAND](key)) {
  doSomething();
}
```

---

## Context Pattern (from OverflowContext.tsx)

```typescript
// State context
const ThinkingPanelStateContext = createContext<ThinkingPanelState | undefined>(undefined);

// Actions context (separate for performance)
const ThinkingPanelActionsContext = createContext<ThinkingPanelActions | undefined>(undefined);

// Provider component
export const ThinkingPanelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ThinkingPanelState>({
    panelVisible: false,
    thoughtsHistory: [],
  });

  const actions = useMemo(() => ({
    togglePanel: () => setState(s => ({ ...s, panelVisible: !s.panelVisible })),
    addThought: (thought) => setState(s => ({
      ...s,
      thoughtsHistory: [...s.thoughtsHistory, thought]
    })),
    clearThoughts: () => setState(s => ({ ...s, thoughtsHistory: [] })),
  }), []);

  return (
    <ThinkingPanelStateContext.Provider value={state}>
      <ThinkingPanelActionsContext.Provider value={actions}>
        {children}
      </ThinkingPanelActionsContext.Provider>
    </ThinkingPanelStateContext.Provider>
  );
};

// Hooks
export const useThinkingPanel = () => {
  const context = useContext(ThinkingPanelStateContext);
  if (!context) throw new Error('useThinkingPanel must be used within ThinkingPanelProvider');
  return context;
};

export const useThinkingPanelActions = () => {
  const context = useContext(ThinkingPanelActionsContext);
  if (!context) throw new Error('useThinkingPanelActions must be used within ThinkingPanelProvider');
  return context;
};
```

---

## Implementation Steps

### Step 1: Add Keyboard Binding

**File**: `packages/cli/src/config/keyBindings.ts`

```typescript
// Add to Command enum (around line 78)
TOGGLE_THINKING_PANEL = 'toggleThinkingPanel',

// Add to defaultKeyBindings (around line 220)
[Command.TOGGLE_THINKING_PANEL]: [{ sequence: '\x1c' }], // Ctrl+\

// Add to commandCategories "App Controls" section
Command.TOGGLE_THINKING_PANEL,

// Add to commandDescriptions
[Command.TOGGLE_THINKING_PANEL]: 'Toggle the thinking panel sidebar.',
```

---

### Step 2: Create ThinkingPanelContext

**New file**: `packages/cli/src/ui/contexts/ThinkingPanelContext.tsx`

```typescript
import { createContext, useContext, useState, useMemo, useCallback } from 'react';
import type { ThoughtSummary } from '@google/gemini-cli-core';

interface ThinkingPanelState {
  panelVisible: boolean;
  thoughtsHistory: ThoughtSummary[];
}

interface ThinkingPanelActions {
  togglePanel: () => void;
  addThought: (thought: ThoughtSummary) => void;
  clearThoughts: () => void;
}

const ThinkingPanelStateContext = createContext<ThinkingPanelState | undefined>(undefined);
const ThinkingPanelActionsContext = createContext<ThinkingPanelActions | undefined>(undefined);

export const ThinkingPanelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [panelVisible, setPanelVisible] = useState(false);
  const [thoughtsHistory, setThoughtsHistory] = useState<ThoughtSummary[]>([]);

  const togglePanel = useCallback(() => setPanelVisible(v => !v), []);
  const addThought = useCallback((thought: ThoughtSummary) => {
    setThoughtsHistory(prev => [...prev, thought]);
  }, []);
  const clearThoughts = useCallback(() => setThoughtsHistory([]), []);

  const state = useMemo(() => ({ panelVisible, thoughtsHistory }), [panelVisible, thoughtsHistory]);
  const actions = useMemo(() => ({ togglePanel, addThought, clearThoughts }), [togglePanel, addThought, clearThoughts]);

  return (
    <ThinkingPanelStateContext.Provider value={state}>
      <ThinkingPanelActionsContext.Provider value={actions}>
        {children}
      </ThinkingPanelActionsContext.Provider>
    </ThinkingPanelStateContext.Provider>
  );
};

export const useThinkingPanel = () => {
  const context = useContext(ThinkingPanelStateContext);
  if (!context) throw new Error('useThinkingPanel must be used within ThinkingPanelProvider');
  return context;
};

export const useThinkingPanelActions = () => {
  const context = useContext(ThinkingPanelActionsContext);
  if (!context) throw new Error('useThinkingPanelActions must be used within ThinkingPanelProvider');
  return context;
};
```

---

### Step 3: Create ThinkingPanel Component

**New file**: `packages/cli/src/ui/components/ThinkingPanel.tsx`

```typescript
import React from 'react';
import { Box, Text } from 'ink';
import type { ThoughtSummary } from '@google/gemini-cli-core';
import { useThinkingPanel } from '../contexts/ThinkingPanelContext.js';
import { useTheme } from '../contexts/ThemeContext.js';

interface ThinkingPanelProps {
  width: number;
  height: number;
}

export const ThinkingPanel: React.FC<ThinkingPanelProps> = ({ width, height }) => {
  const { thoughtsHistory } = useThinkingPanel();
  const theme = useTheme();

  // Reverse to show latest first
  const reversedThoughts = [...thoughtsHistory].reverse();

  return (
    <Box
      flexDirection="column"
      width={width}
      height={height}
      borderStyle="single"
      borderColor={theme.border?.primary || 'gray'}
      overflow="hidden"
    >
      {/* Header */}
      <Box paddingX={1}>
        <Text bold color={theme.text?.accent || 'cyan'}>
          Thinking
        </Text>
      </Box>

      {/* Thoughts list */}
      <Box flexDirection="column" paddingX={1} overflow="hidden">
        {reversedThoughts.length === 0 ? (
          <Text dimColor>No thoughts yet...</Text>
        ) : (
          reversedThoughts.map((thought, index) => (
            <Box key={index} flexDirection="column" marginBottom={1}>
              <Text bold color={theme.text?.accent || 'cyan'}>
                {thought.subject}
              </Text>
              {thought.description && (
                <Text wrap="wrap">{thought.description}</Text>
              )}
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
};
```

---

### Step 4: Modify DefaultAppLayout

**File**: `packages/cli/src/ui/layouts/DefaultAppLayout.tsx`

```typescript
// Add imports
import { useThinkingPanel } from '../contexts/ThinkingPanelContext.js';
import { ThinkingPanel } from '../components/ThinkingPanel.js';

export const DefaultAppLayout: React.FC = () => {
  const uiState = useUIState();
  const isAlternateBuffer = useAlternateBuffer();
  const { panelVisible } = useThinkingPanel();

  const { rootUiRef, terminalHeight, terminalWidth } = uiState;
  useFlickerDetector(rootUiRef, terminalHeight);

  // Calculate widths for split layout
  const panelWidth = Math.floor(terminalWidth / 3);
  const baseWidth = isAlternateBuffer ? terminalWidth : uiState.mainAreaWidth;
  const mainWidth = panelVisible ? baseWidth - panelWidth - 1 : baseWidth;
  const effectiveHeight = isAlternateBuffer ? terminalHeight - 1 : undefined;

  return (
    <Box flexDirection="row">
      {/* Main content area */}
      <Box
        flexDirection="column"
        width={mainWidth}
        height={effectiveHeight}
        flexShrink={0}
        flexGrow={0}
        overflow="hidden"
        ref={rootUiRef}
      >
        <MainContent />
        <Box flexDirection="column" ref={uiState.mainControlsRef} flexShrink={0} flexGrow={0}>
          <Notifications />
          <CopyModeWarning />
          {uiState.customDialog ? (
            uiState.customDialog
          ) : uiState.dialogsVisible ? (
            <DialogManager terminalWidth={mainWidth} addItem={uiState.historyManager.addItem} />
          ) : (
            <Composer />
          )}
          <ExitWarning />
        </Box>
      </Box>

      {/* Side panel */}
      {panelVisible && (
        <ThinkingPanel
          width={panelWidth}
          height={effectiveHeight || terminalHeight}
        />
      )}
    </Box>
  );
};
```

---

### Step 5: Wire Thought Accumulation

**File**: `packages/cli/src/ui/hooks/useGeminiStream.ts`

```typescript
// Add import
import { useThinkingPanelActions } from '../contexts/ThinkingPanelContext.js';

// Inside useGeminiStream function, after line 119:
const { addThought, clearThoughts } = useThinkingPanelActions();

// Add effect after thought state declaration (after line 119):
useEffect(() => {
  if (thought) {
    addThought(thought);
  }
}, [thought, addThought]);

// In submitQuery, around line 944, add clearThoughts:
if (!options?.isContinuation) {
  clearThoughts(); // ADD THIS LINE
  setThought(null);
}
```

---

### Step 6: Add Provider to App

**File**: `packages/cli/src/gemini.tsx`

```typescript
// Add import
import { ThinkingPanelProvider } from './ui/contexts/ThinkingPanelContext.js';

// In AppWrapper, wrap AppContainer:
<VimModeProvider settings={settings}>
  <ThinkingPanelProvider>
    <AppContainer />
  </ThinkingPanelProvider>
</VimModeProvider>
```

---

### Step 7: Handle Keyboard Shortcut

**File**: `packages/cli/src/ui/AppContainer.tsx`

```typescript
// Add imports
import { useThinkingPanelActions } from './contexts/ThinkingPanelContext.js';
import { keyMatchers, Command } from '../config/keyBindings.js';

// Inside AppContainer, get the action:
const { togglePanel } = useThinkingPanelActions();

// Find the global useKeypress handler and add:
if (keyMatchers[Command.TOGGLE_THINKING_PANEL](key)) {
  togglePanel();
  return;
}
```

---

## Files Summary

### New Files

| File                                                    | Lines (est) | Purpose          |
| ------------------------------------------------------- | ----------- | ---------------- |
| `packages/cli/src/ui/contexts/ThinkingPanelContext.tsx` | ~60         | State management |
| `packages/cli/src/ui/components/ThinkingPanel.tsx`      | ~50         | Panel UI         |

### Modified Files

| File                                               | Changes                                                  |
| -------------------------------------------------- | -------------------------------------------------------- |
| `packages/cli/src/config/keyBindings.ts`           | Add command enum, binding, category, description         |
| `packages/cli/src/ui/layouts/DefaultAppLayout.tsx` | Horizontal split, conditional panel render               |
| `packages/cli/src/ui/hooks/useGeminiStream.ts`     | Add effect for thought accumulation, clear on new prompt |
| `packages/cli/src/gemini.tsx`                      | Add ThinkingPanelProvider                                |
| `packages/cli/src/ui/AppContainer.tsx`             | Handle Ctrl+\ shortcut                                   |

---

## Testing Notes

1. **Verify thinking is enabled**: Check `defaultModelConfigs.ts` - models
   should have `thinkingConfig` with `includeThoughts: true` or `thinkingBudget`

2. **Test scenarios**:
   - Toggle panel with Ctrl+\
   - Send prompt and watch thoughts appear
   - Verify latest thought shows at top
   - Verify thoughts clear on new prompt
   - Verify panel works in both alternate buffer and normal mode

3. **Edge cases**:
   - Very long thought descriptions (should wrap)
   - Many thoughts (should cut off at bottom, not scroll)
   - Toggle while streaming (should continue to work)
