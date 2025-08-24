# Gemini CLI Task List Implementation

## Overview
This document details the implementation of a comprehensive task list feature for Gemini CLI that mimics Claude Code's task management approach. The feature automatically breaks down complex user requests into manageable tasks, tracks progress, and executes them sequentially.

## Latest Updates (Critical for Future Implementation)

### Visual Feedback System
1. **Task List Display**: Shows immediately after Flash generates it with clear formatting:
   - Header: `📋 TASK LIST GENERATED (X tasks)`
   - Tasks shown as checkboxes: `1. [ ] Task name`
   - Visual separators using `═` characters
   - Starting message: `🚀 Starting execution...`

2. **Progress Tracking** (Enhanced):
   - Task completion shows full updated task list with checkmarks
   - Visual separator bars (`═══`) between task transitions
   - Shows all tasks with status: `[✓]` completed, `[ ]` pending, `▶` in progress
   - Progress: `📊 Progress: X/Y complete (Z%)`
   - Next task preview: `🚀 Next up: Task X - [task name]`
   - Final completion: `🎉 ALL TASKS COMPLETED SUCCESSFULLY!`

3. **Task Transition Display**:
   - Each task completion shows the full task list state
   - Clear visual separation between tasks with separator lines
   - Task completion messages use `MessageType.GEMINI` for better formatting
   - First task shows "Starting" message, subsequent tasks shown in completion messages

4. **Error Handling**:
   - Shows `❌ Failed to generate task list` if generation fails
   - Provides feedback when proceeding without task list
   - Try-catch blocks around interceptor calls

### Task Detection Logic (Improved)
- **Aggressive Detection**: Any prompt with " and ", "create", "build", "implement", "add", "write", "test"
- **Complexity Check**: Prompts > 8 words trigger consideration
- **Skip Patterns**: Simple questions (what/why/how) and single commands
- **Flash Fallback**: Uses Flash model for ambiguous cases

### Implementation Details

## Architecture Design

### Core Components

#### 1. TaskListService (`packages/core/src/services/taskListService.ts`)
- **Purpose**: Central service managing task state during execution
- **Key Features**:
  - In-memory task list management (doesn't persist between sessions)
  - Task state tracking: `pending` → `in_progress` → `completed`/`failed`
  - Event-driven architecture using EventEmitter
  - Task context generation for system prompts
  - Progress tracking and summary generation

**Key Methods**:
- `createTaskList()`: Creates a new task list from user prompt
- `getCurrentTask()`: Returns the active task
- `startCurrentTask()`: Transitions task to in_progress
- `completeCurrentTask()`: Marks task complete and advances
- `getTaskContext()`: Generates context string for prompts
- `getTaskListSummary()`: Returns formatted task list display

#### 2. TaskListTool (`packages/core/src/tools/taskListTool.ts`)
- **Purpose**: Built-in tool for explicit task list creation
- **Key Features**:
  - Extends `BaseDeclarativeTool` following Gemini CLI patterns
  - Automatically switches to Flash model for efficiency
  - Integrates with tool registry
  - Can be called directly via tool invocation

**Implementation Details**:
- Registered as `task_list` tool
- Uses Flash model to generate task lists
- Returns structured task breakdown
- Supports both creation and status queries

#### 3. TaskListInterceptor (`packages/core/src/services/taskListInterceptor.ts`)
- **Purpose**: Automatically detects when to create task lists
- **Key Features**:
  - Analyzes user prompts using heuristics
  - Falls back to Flash model for ambiguous cases
  - Handles task completion and progression
  - Modifies prompts to include task context

**Detection Heuristics**:
- Skips simple questions (what, why, how, explain)
- Skips single commands (run, execute, test)
- Triggers on multi-step indicators (and then, after that, implement, refactor)
- Uses Flash model for final decision on ambiguous cases

#### 4. TaskListDisplay Component (`packages/cli/src/ui/components/TaskListDisplay.tsx`)
- **Purpose**: Visual representation of task progress
- **Features**:
  - Progress bar visualization
  - Status icons (✓ completed, ✗ failed, ▶ in progress, ○ pending)
  - Compact and full display modes
  - Real-time updates via React props

## Integration Points

### 1. Config Class Updates (`packages/core/src/config/config.ts`)
```typescript
// Added TaskListService as a core service
private taskListService: TaskListService;

// In constructor
this.taskListService = new TaskListService();

// Added getter method
getTaskListService(): TaskListService {
  return this.taskListService;
}

// Tool registration
registerCoreTool(TaskListTool, this, this.taskListService);
```

### 2. System Prompt Integration (`packages/core/src/core/client.ts`)
```typescript
// Modified startChat to include task context
const taskContext = this.config.getTaskListService().getTaskContext();
const systemInstruction = getCoreSystemPrompt(userMemory) + taskContext;
```

### 3. useGeminiStream Hook Integration (`packages/cli/src/ui/hooks/useGeminiStream.ts`)
- Added task list state management
- Integrated TaskListInterceptor for automatic detection
- Added event listeners for task lifecycle
- Modified submitQuery to intercept and process prompts
- Added automatic task progression on completion

### 4. Automatic Task Progression
```typescript
// In handleFinishedEvent
if (currentTaskList && finishReason === FinishReason.STOP) {
  const nextPrompt = await taskListInterceptor.handleTaskCompletion();
  if (nextPrompt && submitQueryRef.current) {
    setTimeout(() => {
      submitQueryRef.current(nextPrompt, { isContinuation: true });
    }, 1000);
  }
}
```

## Task List Generation Flow

### 1. User submits a request
```
User: "Create a REST API with authentication, database models, and tests"
```

### 2. Interceptor analyzes the request
- Checks heuristics for multi-step indicators
- If unclear, queries Flash model
- Decides whether to create task list

### 3. Task list generation (if needed)
- Switches to Flash model
- Generates structured task breakdown:
  ```
  1. Set up project structure
  2. Create database models
  3. Implement authentication middleware
  4. Create REST API endpoints
  5. Write unit tests
  6. Write integration tests
  ```

### 4. Task execution
- First task marked as `in_progress`
- Task context added to system prompt
- Gemini executes with task awareness
- On completion, automatically advances to next task

### 5. Progress tracking
- UI displays current progress
- Events emitted for state changes
- User sees real-time updates

## Key Implementation Decisions

### 1. In-Memory Only
- Task lists don't persist between sessions
- Cleared on interruption or new request
- Simpler implementation, matches Claude Code behavior

### 2. Flash Model for Task Generation
- Uses Flash (faster, cheaper) for task breakdown
- Pro model for actual task execution
- Optimal cost/performance balance

### 3. Automatic Detection
- Heuristics reduce unnecessary API calls
- Smart detection avoids task lists for simple requests
- Fallback to Flash for ambiguous cases

### 4. Event-Driven Architecture
- TaskListService extends EventEmitter
- UI components react to events
- Loose coupling between components

### 5. Automatic Progression
- Tasks advance without user intervention
- Small delay between tasks for UI updates
- Continuation flag preserves context

## Critical Implementation Patterns

### Event Flow for Task Execution
```javascript
// In useGeminiStream.ts
1. User submits prompt
2. taskListInterceptor.interceptPrompt() called
3. If multi-step detected → Flash generates tasks
4. taskListService.createTaskList() emits 'taskListCreated'
5. handleTaskListCreated displays full task list
6. taskListService.startCurrentTask() emits 'taskStarted'
7. Gemini executes with task context in system prompt
8. On completion → handleFinishedEvent checks for tasks
9. taskListInterceptor.handleTaskCompletion() advances
10. Automatic submitQuery() with continuation flag
```

### Key Code Locations
- **Interceptor Logic**: `packages/core/src/services/taskListInterceptor.ts`
  - `shouldCreateTaskList()`: Detection heuristics
  - `generateTaskList()`: Flash model call
  - `interceptPrompt()`: Main entry point with error handling

- **Event Handlers**: `packages/cli/src/ui/hooks/useGeminiStream.ts:117-220`
  - `handleTaskListCreated`: Shows task list
  - `handleTaskStarted`: Shows task beginning
  - `handleTaskCompleted`: Shows progress
  - `handleTaskListCompleted`: Final summary

- **Automatic Progression**: `packages/cli/src/ui/hooks/useGeminiStream.ts:556-565`
  - Uses `submitQueryRef.current()` to avoid circular dependency
  - 1 second delay for UI updates
  - `isContinuation: true` flag preserves context

### Flash Model Integration
```javascript
// Always switches to Flash for task generation
const originalModel = this.config.getModel();
this.config.setModel(DEFAULT_GEMINI_FLASH_MODEL);
// ... generate tasks ...
this.config.setModel(originalModel);
```

### Error Recovery Pattern
```javascript
// In interceptPrompt
try {
  taskTitles = await this.generateTaskList(promptText, signal);
} catch (error) {
  return { 
    shouldProceedWithTaskList: false,
    attemptedToCreate: true  // Flag for UI feedback
  };
}
```

## Testing the Implementation

### Test Command (Production Ready)
```bash
cd /Users/dmitrylyalin/Source/Misc/GeminiCLI-TaskList/gemini-cli
npm run build && node packages/cli/dist/index.js
```

### Debug Mode (See Console Logs)
```bash
node packages/cli/dist/index.js --debug
```

### Test Scenarios

1. **Complex multi-step request**:
```
"Build a todo app with React, add authentication, create a backend API, and write tests"
```
Expected: Should create task list automatically

2. **Simple question**:
```
"What is React?"
```
Expected: Should NOT create task list

3. **Explicit task list request**:
```
"Create a task list for migrating from Vue to React"
```
Expected: Should create task list via tool

## File Structure

```
gemini-cli/
├── packages/
│   ├── core/
│   │   ├── src/
│   │   │   ├── services/
│   │   │   │   ├── taskListService.ts      # Core task management
│   │   │   │   └── taskListInterceptor.ts  # Auto-detection logic
│   │   │   ├── tools/
│   │   │   │   └── taskListTool.ts         # Task list tool
│   │   │   └── config/
│   │   │       └── config.ts               # Updated with TaskListService
│   │   └── index.ts                        # Exports new services
│   └── cli/
│       └── src/
│           └── ui/
│               ├── components/
│               │   └── TaskListDisplay.tsx  # UI component
│               └── hooks/
│                   └── useGeminiStream.ts   # Integration hook
```

## TypeScript Fixes Applied

1. **ContentGenerator import**: Changed from class import to factory function
2. **AuthType enum**: Fixed from `API_KEY` to `USE_GEMINI`
3. **Override modifiers**: Added to inherited methods
4. **Return types**: Fixed `returnDisplay` to be string instead of object
5. **Unused imports**: Removed TaskListService from useGeminiStream

## Future Enhancements

1. **Parallel Task Execution**: Allow independent tasks to run concurrently
2. **Task Dependencies**: Define task relationships and prerequisites
3. **Task Persistence**: Optional saving of task lists for resume capability
4. **User Control**: Commands to skip, retry, or reorder tasks
5. **Task Templates**: Predefined task lists for common scenarios
6. **Progress Estimation**: Time estimates for task completion
7. **Task Metrics**: Track success rates and execution times

## Task Execution Improvements

### Better Task Guidance (Latest)
To prevent common execution errors like interactive prompts and workspace issues:

1. **Enhanced Task Context** (`taskListService.ts:181-215`):
   - Shows previous completed tasks for context
   - Provides CRITICAL EXECUTION RULES in system prompt
   - Explicitly states to use non-interactive commands
   - Shows upcoming tasks but marks them as "DO NOT EXECUTE"

2. **Validation Between Tasks** (`taskListInterceptor.ts:325-353`):
   - Prompts Gemini to verify previous task success before proceeding
   - Encourages fixing errors instead of skipping or cleaning up
   - Reminds to use non-interactive flags (--yes, --typescript, etc.)

3. **Clear Initial Instructions** (`taskListInterceptor.ts:235-239`):
   - States that tasks will be executed sequentially
   - Emphasizes using non-interactive commands
   - Sets expectation for verification at each step

### Example Task Context in System Prompt:
```
## Task Execution Context
You are executing a multi-step task list. Current progress: 1/3 tasks completed.

**Previous tasks completed:**
  1. [✓] Create a new directory named test

**CURRENT TASK (2/3):** Initialize a Next.js app in the test directory

**CRITICAL EXECUTION RULES:**
1. Focus ONLY on completing: "Initialize a Next.js app in the test directory"
2. Use non-interactive commands (add --yes, --typescript, --no-input flags)
3. If an error occurs, FIX it - do NOT skip or clean up
4. Verify success before considering the task complete
5. Do NOT execute future tasks yet

**Upcoming tasks (DO NOT EXECUTE):**
  3. [ ] Add a simple component to the app
```

## Common Issues & Solutions

### Task List Not Generating
1. **Check Detection**: Prompt needs multi-step indicators or be > 8 words
2. **Flash Model**: Ensure GEMINI_API_KEY is set for Flash model access
3. **Debug**: Run with `--debug` to see `[TaskListInterceptor]` logs

### Authentication Error When Switching to Flash Model
**Problem**: "Could not load the default credentials" error when generating task lists  
**Cause**: Hardcoded `AuthType.USE_GEMINI` when creating content generator for Flash  
**Solution**: Use existing authentication from config instead of hardcoding:
```typescript
// ❌ Old (broken) - hardcoded auth type
const contentGeneratorConfig = createContentGeneratorConfig(
  this.config,
  AuthType.USE_GEMINI,
);

// ✅ New (fixed) - preserves current auth method
const currentConfig = this.config.getContentGeneratorConfig();
const contentGeneratorConfig = createContentGeneratorConfig(
  this.config,
  currentConfig?.authType,  // Maintains OAuth or API key auth
);
```
**Files Fixed**:
- `taskListInterceptor.ts:112-114` - `askFlashToDecide` method
- `taskListInterceptor.ts:258-261` - `generateTaskList` method
- `taskListTool.ts:159-162` - `generateTaskList` method

### Tasks Not Progressing
1. **Finish Reason**: Tasks only advance on `FinishReason.STOP`
2. **Task State**: Check `taskListService.getCurrentTask()` state
3. **Continuation Flag**: Ensure `isContinuation: true` is set

### Visual Issues
1. **Message Types**: Use `MessageType.GEMINI` for task displays
2. **Formatting**: Markdown formatting with `**bold**` and `~~strikethrough~~`
3. **Timing**: 1-second delays between task transitions for UI updates

## Summary

The implementation successfully adds Claude Code-style task management to Gemini CLI with:
- **Automatic task detection** using aggressive heuristics
- **Flash model integration** for efficient task generation
- **Clear visual feedback** throughout execution
- **Error handling** with user-friendly messages
- **Event-driven architecture** for loose coupling

Key achievement: The system now automatically detects complex requests, generates task lists using Flash, displays them clearly, and executes them sequentially with visual progress tracking.