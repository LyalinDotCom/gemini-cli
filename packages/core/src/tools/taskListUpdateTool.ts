/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BaseDeclarativeTool,
  BaseToolInvocation,
  Kind,
  ToolInvocation,
  ToolResult,
} from './tools.js';
import { Type } from '@google/genai';
import { TaskListService } from '../services/taskListService.js';
import { Config } from '../config/config.js';

export interface TaskListUpdateParams {
  operation: 'insert_after_current' | 'append';
  tasks: string[];
  reason?: string;
}

/**
 * Allows the model to update the task list during execution by inserting
 * or appending tasks. Useful when new subtasks are discovered mid-flight.
 */
export class TaskListUpdateTool extends BaseDeclarativeTool<
  TaskListUpdateParams,
  ToolResult
> {
  static readonly Name = 'task_list_update';
  constructor(
    _config: Config,
    private taskListService: TaskListService,
  ) {
    super(
      TaskListUpdateTool.Name,
      'TaskListUpdate',
      'Update the active task list by inserting or appending new tasks.',
      Kind.Think,
      {
        type: Type.OBJECT,
        properties: {
          operation: {
            type: Type.STRING,
            enum: ['insert_after_current', 'append'],
            description:
              'Where to place the tasks relative to the current task.',
          },
          tasks: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'New task titles to add in execution order.',
          },
          reason: {
            type: Type.STRING,
            description: 'Optional short reason for the update.',
          },
        },
        required: ['operation', 'tasks'],
      },
      true,
      false,
    );
  }

  override validateToolParams(params: TaskListUpdateParams): string | null {
    if (!params.tasks || params.tasks.length === 0) {
      return 'tasks must be a non-empty array of strings';
    }
    const hasNonEmpty = params.tasks.some((t) => t && t.trim().length > 0);
    if (!hasNonEmpty) {
      return 'tasks must include at least one non-empty string';
    }
    return null;
  }

  protected override createInvocation(
    params: TaskListUpdateParams,
  ): ToolInvocation<TaskListUpdateParams, ToolResult> {
    return new TaskListUpdateInvocation(this.taskListService, params);
  }
}

class TaskListUpdateInvocation extends BaseToolInvocation<
  TaskListUpdateParams,
  ToolResult
> {
  constructor(
    private taskListService: TaskListService,
    params: TaskListUpdateParams,
  ) {
    super(params);
  }

  getDescription(): string {
    return `Update task list: ${this.params.operation} (${this.params.tasks.length} task(s))`;
  }

  async execute(): Promise<ToolResult> {
    const currentList = this.taskListService.getCurrentTaskList();
    if (!currentList || currentList.status !== 'active') {
      return {
        llmContent: 'No active task list to update.',
        returnDisplay: 'No active task list to update.',
      };
    }

    const cleanTasks = this.params.tasks
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    if (cleanTasks.length === 0) {
      return {
        llmContent: 'No valid task titles provided.',
        returnDisplay: 'No valid task titles provided.',
      };
    }

    if (this.params.operation === 'insert_after_current') {
      this.taskListService.insertTasksAfterCurrent(cleanTasks);
    } else {
      this.taskListService.appendTasks(cleanTasks);
    }

    const index = this.taskListService.getCurrentTaskIndex();
    const summary = this.taskListService.getTaskListSummary();
    const headerReason = this.params.reason ? `Reason: ${this.params.reason}\n` : '';
    const display = [
      '## Task List Updated',
      headerReason.trim(),
      `Inserted ${cleanTasks.length} task(s) ${
        this.params.operation === 'insert_after_current'
          ? `after current task (${index + 1})`
          : 'at the end'
      }`,
      '',
      summary,
    ]
      .filter((l) => l.length > 0)
      .join('\n');

    return {
      llmContent: display,
      returnDisplay: display,
    };
  }
}
