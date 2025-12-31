# Plan: Inline Thinking Indicator for Gemini CLI

## Summary

This PR adds inline thinking indicators to the Gemini CLI, allowing users to see
when the model is "thinking" during responses. When enabled via settings,
thinking summaries are displayed as compact boxes in the conversation flow,
providing visibility into the model's reasoning process.

## Details

### Feature Overview

- **New UI Setting**: `ui.showInlineThinking` (default: `false`)
- **Visual Indicator**: Compact box with magenta border showing thinking count
- **Non-intrusive**: Collapsed by default, showing only `◆ Thinking (N)` header
- **Integration**: Seamlessly fits with existing tool use boxes in history

### Scope Limitations (Intentionally NOT included)

- **NO** expand/collapse toggle (F3 functionality)
- **NO** side panel for detailed thinking history
- **NO** streaming thinking indicator (only finalized thoughts in history)

These features are reserved for future PRs to keep this change small and
focused.

---

## Implementation Plan

### Step 1: Verify Setting Already Exists

**File**: `packages/cli/src/config/settingsSchema.ts`

The setting already exists at lines 537-546:

```typescript
showInlineThinking: {
  type: 'boolean',
  label: 'Show Inline Thinking',
  category: 'UI',
  requiresRestart: false,
  default: false,
  description: 'Show model thinking inline as collapsible boxes.',
  showInDialog: true,
},
```

**Action**: Update description to remove "collapsible" since we're not
implementing expand/collapse:

```typescript
description: 'Show model thinking summaries inline in the conversation.',
```

---

### Step 2: Create ThinkingMessage Component

**File**: `packages/cli/src/ui/components/messages/ThinkingMessage.tsx` (NEW)

Create a simple, non-expandable thinking indicator:

```typescript
import type React from 'react';
import { Box, Text } from 'ink';
import type { ThoughtSummary } from '@google/gemini-cli-core';

interface ThinkingMessageProps {
  thoughts: ThoughtSummary[];
  terminalWidth: number;
}

export const ThinkingMessage: React.FC<ThinkingMessageProps> = ({
  thoughts,
  terminalWidth,
}) => (
  <Box
    borderStyle="round"
    borderColor="magenta"
    width={terminalWidth}
    paddingX={1}
  >
    <Text color="magenta">◆ </Text>
    <Text bold color="magenta">Thinking</Text>
    <Text dimColor> ({thoughts.length})</Text>
  </Box>
);
```

---

### Step 3: Define HistoryItemThinking Type

**File**: `packages/cli/src/ui/types.ts`

Add the thinking history item type:

```typescript
export interface HistoryItemThinking {
  type: 'thinking';
  thoughts: ThoughtSummary[];
}

// Update HistoryItemContent union to include 'thinking'
export type HistoryItemContent =
  | HistoryItemUser
  | HistoryItemGemini
  | HistoryItemThinking  // Add this
  | ... // existing types
```

---

### Step 4: Update HistoryItemDisplay to Render Thinking

**File**: `packages/cli/src/ui/components/HistoryItemDisplay.tsx`

Add case for thinking items in the switch/render logic:

```typescript
import { ThinkingMessage } from './messages/ThinkingMessage.js';

// In the render logic, add case for thinking type:
if (item.type === 'thinking') {
  if (!inlineEnabled) return null; // Respect setting
  return (
    <ThinkingMessage
      thoughts={item.thoughts}
      terminalWidth={terminalWidth}
    />
  );
}
```

Props to add:

- `inlineEnabled: boolean` - from settings

---

### Step 5: Pass Setting Through Component Tree

**Files**:

- `packages/cli/src/ui/contexts/ThinkingPanelContext.tsx` - Add `inlineEnabled`
  from settings
- `packages/cli/src/ui/components/MainContent.tsx` - Read and pass prop

The context already reads the setting:

```typescript
const inlineEnabled = settings.merged.ui?.showInlineThinking === true;
```

Ensure this is passed through to `HistoryItemDisplay` components.

---

### Step 6: Flush Thoughts to History

**File**: `packages/cli/src/ui/hooks/useGeminiStream.ts`

When a response completes and thinking is enabled, add thoughts to history:

```typescript
// When response finishes, if there were thoughts and setting is enabled:
if (thoughtsBufferRef.current.length > 0 && inlineEnabled) {
  dispatch({
    type: 'ADD_HISTORY_ITEM',
    payload: {
      type: 'thinking',
      thoughts: [...thoughtsBufferRef.current],
    },
  });
}
thoughtsBufferRef.current = []; // Clear buffer
```

This requires:

- A ref to buffer thoughts during streaming:
  `const thoughtsBufferRef = useRef<ThoughtSummary[]>([]);`
- Accumulating thoughts as they arrive
- Flushing to history when response ends

---

### Step 7: Add Unit Tests

#### Test 1: ThinkingMessage Component

**File**: `packages/cli/src/ui/components/messages/ThinkingMessage.test.tsx`
(NEW)

```typescript
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { ThinkingMessage } from './ThinkingMessage.js';

describe('ThinkingMessage', () => {
  it('renders thinking header with count', () => {
    const { lastFrame } = render(
      <ThinkingMessage
        thoughts={[
          { subject: 'Planning', description: 'test' },
          { subject: 'Analyzing', description: 'test' },
        ]}
        terminalWidth={80}
      />
    );

    expect(lastFrame()).toContain('Thinking');
    expect(lastFrame()).toContain('(2)');
  });

  it('renders with single thought', () => {
    const { lastFrame } = render(
      <ThinkingMessage
        thoughts={[{ subject: 'Processing', description: 'test' }]}
        terminalWidth={80}
      />
    );

    expect(lastFrame()).toContain('(1)');
  });

  it('renders empty state gracefully', () => {
    const { lastFrame } = render(
      <ThinkingMessage thoughts={[]} terminalWidth={80} />
    );

    expect(lastFrame()).toContain('(0)');
  });
});
```

#### Test 2: HistoryItemDisplay with Thinking

**File**: `packages/cli/src/ui/components/HistoryItemDisplay.test.tsx`

Add test cases for thinking items:

```typescript
describe('HistoryItemDisplay - thinking items', () => {
  it('renders thinking item when enabled', () => {
    const { lastFrame } = render(
      <HistoryItemDisplay
        item={{ type: 'thinking', thoughts: [...], id: 1 }}
        inlineEnabled={true}
        terminalWidth={80}
        // ... other required props
      />
    );

    expect(lastFrame()).toContain('Thinking');
  });

  it('does not render thinking item when disabled', () => {
    const { lastFrame } = render(
      <HistoryItemDisplay
        item={{ type: 'thinking', thoughts: [...], id: 1 }}
        inlineEnabled={false}
        terminalWidth={80}
        // ... other required props
      />
    );

    expect(lastFrame()).toBe(''); // or null rendering
  });
});
```

#### Test 3: Settings Integration

**File**: `packages/cli/src/ui/contexts/ThinkingPanelContext.test.tsx` (NEW or
existing)

```typescript
describe('ThinkingPanelContext', () => {
  it('reads inlineEnabled from settings', () => {
    // Mock settings with showInlineThinking: true
    // Render provider
    // Verify inlineEnabled is true in context
  });

  it('defaults to false when setting not configured', () => {
    // Mock settings without showInlineThinking
    // Verify inlineEnabled is false
  });
});
```

---

### Step 8: Run Preflight Checks

```bash
npm run preflight
```

Ensure:

- All tests pass
- Linting passes
- TypeScript compiles
- No new warnings

---

## Files Changed Summary

| File                                                               | Change                         |
| ------------------------------------------------------------------ | ------------------------------ |
| `packages/cli/src/config/settingsSchema.ts`                        | Update description             |
| `packages/cli/src/ui/types.ts`                                     | Add `HistoryItemThinking` type |
| `packages/cli/src/ui/components/messages/ThinkingMessage.tsx`      | NEW - Component                |
| `packages/cli/src/ui/components/messages/ThinkingMessage.test.tsx` | NEW - Tests                    |
| `packages/cli/src/ui/components/HistoryItemDisplay.tsx`            | Add thinking case              |
| `packages/cli/src/ui/components/HistoryItemDisplay.test.tsx`       | Add thinking tests             |
| `packages/cli/src/ui/components/MainContent.tsx`                   | Pass `inlineEnabled` prop      |
| `packages/cli/src/ui/hooks/useGeminiStream.ts`                     | Buffer and flush thoughts      |
| `packages/cli/src/ui/contexts/ThinkingPanelContext.tsx`            | Expose `inlineEnabled`         |

---

## How to Validate

1. **Verify Disabled State (Default)**:
   - Launch CLI without modifying settings
   - Send a prompt that triggers thinking
   - **Expectation**: No thinking boxes appear

2. **Verify Enabled State**:
   - Enable setting: `/config set ui.showInlineThinking true`
   - Send a prompt that triggers thinking
   - **Expectation**: Compact `◆ Thinking (N)` box appears in history after
     response

3. **Verify Count Accuracy**:
   - Send multiple prompts
   - **Expectation**: Each thinking box shows correct count of thoughts

4. **Verify Layout Integration**:
   - Thinking boxes should appear inline with other history items
   - Should respect terminal width
   - Should not interfere with scrolling or other UI elements

---

## Pre-Merge Checklist

- [ ] Updated relevant documentation (if needed for user-facing setting)
- [ ] Added/updated tests
- [ ] Noted breaking changes: None
- [ ] Validated on required platforms:
  - [ ] macOS
  - [ ] npm run preflight passes

---

## PR Template

```markdown
## Summary

This PR adds inline thinking indicators to the Gemini CLI, surfacing model
thinking summaries directly in the conversation flow. This provides users with
visibility into the model's reasoning process when enabled via settings.

## Details

- **New Setting Integration**: Added `ui.showInlineThinking` support (default:
  false) to control visibility of thinking indicators.
- **ThinkingMessage Component**: Created compact, non-expandable thinking box
  showing thought count with magenta styling.
- **History Integration**: Thinking summaries are flushed to history when
  responses complete, appearing inline with other content.
- **Visual Consistency**: Integrated thinking boxes using standard theme colors
  and border styling consistent with tool use boxes.
- **Testing**: Added comprehensive unit tests for ThinkingMessage component and
  HistoryItemDisplay thinking cases.

## Related Issues

Fixes #XXXX

## How to Validate

1. **Verify Disabled State**: Launch CLI, send a thinking prompt - no thinking
   boxes should appear.
2. **Verify Enabled State**: Run `/config set ui.showInlineThinking true`, send
   a prompt - thinking box should appear.
3. **Verify Layout**: Thinking boxes should integrate seamlessly with existing
   history items.

## Pre-Merge Checklist

- [ ] Updated relevant documentation and README (if needed)
- [ ] Added/updated tests (if needed)
- [ ] Noted breaking changes (if any)
- [ ] Validated on required platforms/methods:
  - [ ] macOS
  - [ ] npm run preflight
```
