/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseDeclarativeTool, BaseToolInvocation, Icon } from './tools.js';
import { ToolInvocation, ToolResult } from './tools.js';
import { Config } from '../config/config.js';
import { DEFAULT_GEMINI_FLASH_MODEL } from '../config/models.js';
import { createContentGenerator, createContentGeneratorConfig } from '../core/contentGenerator.js';
import { GeminiChat } from '../core/geminiChat.js';
import { TaskListService } from '../services/taskListService.js';
import { Type } from '@google/genai';

export interface TaskListToolParams {
  user_request: string;
  create_tasks?: boolean;
}

/**
 * Tool for managing task lists in Gemini CLI
 */
export class TaskListTool extends BaseDeclarativeTool<TaskListToolParams, ToolResult> {
  static readonly Name = 'task_list';
  private taskListService: TaskListService;

  constructor(
    private config: Config,
    taskListService?: TaskListService,
  ) {
    super(
      TaskListTool.Name,
      'TaskList',
      'Creates and manages a task list for complex multi-step requests. This tool helps break down user requests into manageable tasks.',
      Icon.LightBulb,
      {
        properties: {
          user_request: {
            type: Type.STRING,
            description: 'The user request to break down into tasks',
          },
          create_tasks: {
            type: Type.BOOLEAN,
            description: 'Whether to create a new task list (true) or just get current status (false)',
            default: true,
          },
        },
        required: ['user_request'],
        type: Type.OBJECT,
      },
      true,
      false,
    );
    
    // Use provided service or create new one
    this.taskListService = taskListService || new TaskListService();
  }

  protected validateToolParams(params: TaskListToolParams): string | null {
    if (!params.user_request || params.user_request.trim().length === 0) {
      return 'user_request cannot be empty';
    }
    return null;
  }

  protected createInvocation(
    params: TaskListToolParams,
  ): ToolInvocation<TaskListToolParams, ToolResult> {
    return new TaskListToolInvocation(this.config, this.taskListService, params);
  }

  getTaskListService(): TaskListService {
    return this.taskListService;
  }
}

class TaskListToolInvocation extends BaseToolInvocation<TaskListToolParams, ToolResult> {
  constructor(
    private config: Config,
    private taskListService: TaskListService,
    params: TaskListToolParams,
  ) {
    super(params);
  }

  getDescription(): string {
    if (this.params.create_tasks === false) {
      return 'Getting current task list status';
    }
    return `Creating task list for: ${this.params.user_request.substring(0, 100)}${
      this.params.user_request.length > 100 ? '...' : ''
    }`;
  }

  async execute(signal: AbortSignal): Promise<ToolResult> {
    try {
      // If just getting status, return current task list
      if (this.params.create_tasks === false) {
        const summary = this.taskListService.getTaskListSummary();
        const context = this.taskListService.getTaskContext();
        
        return {
          llmContent: summary + '\n' + context,
          returnDisplay: summary,
        };
      }

      // Generate task list using Flash model
      const taskTitles = await this.generateTaskList(
        this.params.user_request,
        signal,
      );

      if (taskTitles.length === 0) {
        return {
          llmContent: 'No tasks were generated for this request.',
          returnDisplay: 'No tasks were generated for this request.',
        };
      }

      // Create the task list
      const taskList = this.taskListService.createTaskList(
        this.params.user_request,
        taskTitles,
      );

      const summary = this.taskListService.getTaskListSummary();

      return {
        llmContent: `Created task list with ${taskList.tasks.length} tasks:\n${summary}`,
        returnDisplay: `## Task List Created\n\n` +
                      `**Request:** ${this.params.user_request}\n\n` +
                      summary,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        llmContent: `Failed to create task list: ${errorMessage}`,
        returnDisplay: `Error: ${errorMessage}`,
        error: {
          message: errorMessage,
        },
      };
    }
  }

  private async generateTaskList(
    userRequest: string,
    signal: AbortSignal,
  ): Promise<string[]> {
    // Store current model to restore later
    const originalModel = this.config.getModel();
    
    try {
      // Switch to Flash model for task generation
      this.config.setModel(DEFAULT_GEMINI_FLASH_MODEL);

      // Create a new content generator config with Flash model, using existing auth
      const currentConfig = this.config.getContentGeneratorConfig();
      const contentGeneratorConfig = createContentGeneratorConfig(
        this.config,
        currentConfig?.authType,
      );
      const contentGenerator = await createContentGenerator(
        contentGeneratorConfig,
        this.config,
      );
      const chat = new GeminiChat(this.config, contentGenerator);

      const prompt = `You are a task planner. Break down the following user request into a clear, sequential list of tasks.

User Request: ${userRequest}

Generate a numbered list of specific, actionable tasks that need to be completed to fulfill this request.
Each task should be:
- Clear and specific
- A single action or closely related set of actions
- In logical order of execution

Format your response as a simple numbered list with just the task descriptions.
Do not include any preamble or explanation, just the numbered tasks.

Example format:
1. Read the configuration file
2. Parse the JSON data
3. Update the database schema
4. Run migration scripts`;

      const response = await chat.sendMessage(
        {
          message: prompt,
          config: { abortSignal: signal },
        },
        'task-generation',
      );

      // Parse the response to extract task titles
      const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const tasks = this.parseTaskList(responseText);

      return tasks;
    } finally {
      // Restore original model
      this.config.setModel(originalModel);
    }
  }

  private parseTaskList(responseText: string): string[] {
    const lines = responseText.split('\n');
    const tasks: string[] = [];
    
    for (const line of lines) {
      // Match numbered list items (e.g., "1. ", "2. ", etc.)
      const match = line.match(/^\d+\.\s+(.+)$/);
      if (match) {
        tasks.push(match[1].trim());
      } else if (line.trim().startsWith('- ')) {
        // Also support bullet points
        tasks.push(line.trim().substring(2).trim());
      }
    }

    return tasks;
  }
}