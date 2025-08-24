/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

export interface TaskList {
  id: string;
  prompt: string;
  tasks: Task[];
  createdAt: number;
  currentTaskIndex: number;
  status: 'active' | 'completed' | 'interrupted';
}

export class TaskListService extends EventEmitter {
  private currentTaskList: TaskList | null = null;
  private taskHistory: TaskList[] = [];

  constructor() {
    super();
  }

  /**
   * Creates a new task list from the given tasks
   */
  createTaskList(prompt: string, taskTitles: string[]): TaskList {
    // Clear any existing task list
    if (this.currentTaskList) {
      this.currentTaskList.status = 'interrupted';
      this.taskHistory.push(this.currentTaskList);
    }

    const tasks: Task[] = taskTitles.map((title, index) => ({
      id: `task-${Date.now()}-${index}`,
      title,
      status: 'pending',
      createdAt: Date.now(),
    }));

    this.currentTaskList = {
      id: `tasklist-${Date.now()}`,
      prompt,
      tasks,
      createdAt: Date.now(),
      currentTaskIndex: 0,
      status: 'active',
    };

    this.emit('taskListCreated', this.currentTaskList);
    return this.currentTaskList;
  }

  /**
   * Gets the current task list
   */
  getCurrentTaskList(): TaskList | null {
    return this.currentTaskList;
  }

  /**
   * Gets the current active task
   */
  getCurrentTask(): Task | null {
    if (!this.currentTaskList || this.currentTaskList.status !== 'active') {
      return null;
    }

    const { tasks, currentTaskIndex } = this.currentTaskList;
    if (currentTaskIndex >= 0 && currentTaskIndex < tasks.length) {
      return tasks[currentTaskIndex];
    }

    return null;
  }

  /**
   * Starts the current task
   */
  startCurrentTask(): boolean {
    const currentTask = this.getCurrentTask();
    if (!currentTask || currentTask.status !== 'pending') {
      return false;
    }

    currentTask.status = 'in_progress';
    currentTask.startedAt = Date.now();
    this.emit('taskStarted', currentTask, this.currentTaskList);
    return true;
  }

  /**
   * Completes the current task and moves to the next one
   */
  completeCurrentTask(): Task | null {
    const currentTask = this.getCurrentTask();
    if (!currentTask || currentTask.status !== 'in_progress') {
      return null;
    }

    currentTask.status = 'completed';
    currentTask.completedAt = Date.now();
    console.log(
      '[TaskListService] Emitting taskCompleted event for:',
      currentTask.title,
    );
    this.emit('taskCompleted', currentTask, this.currentTaskList);

    // Move to next task
    if (this.currentTaskList) {
      this.currentTaskList.currentTaskIndex++;

      // Check if all tasks are completed
      if (
        this.currentTaskList.currentTaskIndex >=
        this.currentTaskList.tasks.length
      ) {
        this.currentTaskList.status = 'completed';
        console.log(
          '[TaskListService] All tasks completed, emitting taskListCompleted event',
        );
        this.emit('taskListCompleted', this.currentTaskList);
      }
    }

    return currentTask;
  }

  /**
   * Marks the current task as failed
   */
  failCurrentTask(error: string): Task | null {
    const currentTask = this.getCurrentTask();
    if (!currentTask || currentTask.status !== 'in_progress') {
      return null;
    }

    currentTask.status = 'failed';
    currentTask.completedAt = Date.now();
    currentTask.error = error;
    this.emit('taskFailed', currentTask, this.currentTaskList);

    // Move to next task even if failed
    if (this.currentTaskList) {
      this.currentTaskList.currentTaskIndex++;

      if (
        this.currentTaskList.currentTaskIndex >=
        this.currentTaskList.tasks.length
      ) {
        this.currentTaskList.status = 'completed';
        this.emit('taskListCompleted', this.currentTaskList);
      }
    }

    return currentTask;
  }

  /**
   * Clears the current task list
   */
  clearTaskList(): void {
    if (this.currentTaskList) {
      this.currentTaskList.status = 'interrupted';
      this.taskHistory.push(this.currentTaskList);
      this.currentTaskList = null;
      this.emit('taskListCleared');
    }
  }

  /**
   * Gets task list history
   */
  getTaskHistory(): TaskList[] {
    return this.taskHistory;
  }

  /**
   * Inserts new tasks immediately after the current task index.
   * If there's no active list, this is a no-op.
   */
  insertTasksAfterCurrent(titles: string[]): void {
    if (!this.currentTaskList || titles.length === 0) {
      return;
    }
    const insertIndex = Math.min(
      this.currentTaskList.currentTaskIndex + 1,
      this.currentTaskList.tasks.length,
    );
    const now = Date.now();
    const newTasks: Task[] = titles.map((title, i) => ({
      id: `task-${now}-${i}`,
      title,
      status: 'pending',
      createdAt: now,
    }));
    this.currentTaskList.tasks.splice(insertIndex, 0, ...newTasks);
    this.emit('taskListUpdated', this.currentTaskList);
  }

  /**
   * Appends tasks to the end of the current task list.
   */
  appendTasks(titles: string[]): void {
    if (!this.currentTaskList || titles.length === 0) {
      return;
    }
    const now = Date.now();
    const newTasks: Task[] = titles.map((title, i) => ({
      id: `task-${now}-${i}`,
      title,
      status: 'pending',
      createdAt: now,
    }));
    this.currentTaskList.tasks.push(...newTasks);
    this.emit('taskListUpdated', this.currentTaskList);
  }

  /** Returns the index of the current task (0-based), or -1 if none. */
  getCurrentTaskIndex(): number {
    if (!this.currentTaskList || this.currentTaskList.status !== 'active') {
      return -1;
    }
    return this.currentTaskList.currentTaskIndex;
  }

  /**
   * Generates a context string for the current task
   */
  getTaskContext(): string {
    if (!this.currentTaskList || this.currentTaskList.status !== 'active') {
      return '';
    }

    const { tasks, currentTaskIndex } = this.currentTaskList;
    const currentTask = tasks[currentTaskIndex];

    if (!currentTask) {
      return '';
    }

    const completedCount = tasks.filter((t) => t.status === 'completed').length;
    const totalCount = tasks.length;

    // Get previous tasks to provide context
    const previousTasks = tasks
      .slice(0, currentTaskIndex)
      .map(
        (t, i) =>
          `  ${i + 1}. [${t.status === 'completed' ? '✓' : '✗'}] ${t.title}`,
      )
      .join('\n');

    return (
      `\n## Task Execution Context\n` +
      `You are executing a multi-step task list. Current progress: ${completedCount}/${totalCount} tasks completed.\n\n` +
      (previousTasks
        ? `**Previous tasks completed:**\n${previousTasks}\n\n`
        : '') +
      `**CURRENT TASK (${currentTaskIndex + 1}/${totalCount}):** ${currentTask.title}\n\n` +
      `**🛑 CRITICAL EXECUTION RULES - YOU MUST FOLLOW THESE:**\n` +
      `1. Complete ONLY this ONE task: "${currentTask.title}"\n` +
      `2. STOP immediately after completing "${currentTask.title}"\n` +
      `3. Do NOT proceed to any other tasks\n` +
      `4. NEVER ask the user questions or for input. If required info (like a project or folder name) is missing, choose a sensible default (e.g., "app") and proceed.\n` +
      `5. Use non-interactive commands (add --yes, --typescript, --no-input flags).\n` +
      `6. If an error occurs, FIX it — do NOT skip or clean up.\n\n` +
      `**⚠️ STOP AFTER THIS TASK! The system will prompt you for the next task.**\n\n` +
      (tasks.length > currentTaskIndex + 1
        ? `**Upcoming tasks (DO NOT EXECUTE - STOP AFTER CURRENT TASK):**\n` +
          tasks
            .slice(currentTaskIndex + 1)
            .map((t, i) => `  ${currentTaskIndex + i + 2}. [ ] ${t.title}`)
            .join('\n')
        : 'This is the final task.')
    );
  }

  /**
   * Gets a formatted summary of the task list
   */
  getTaskListSummary(): string {
    if (!this.currentTaskList) {
      return 'No active task list';
    }

    const { tasks } = this.currentTaskList;
    const lines: string[] = ['## Task List'];

    tasks.forEach((task, index) => {
      const status =
        task.status === 'completed'
          ? '✓'
          : task.status === 'in_progress'
            ? '▶'
            : task.status === 'failed'
              ? '✗'
              : '○';
      lines.push(`${status} ${index + 1}. ${task.title}`);
    });

    return lines.join('\n');
  }
}
