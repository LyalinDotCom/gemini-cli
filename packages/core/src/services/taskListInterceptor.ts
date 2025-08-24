/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Config } from '../config/config.js';
import { TaskListService } from './taskListService.js';
import {
  createContentGenerator,
  createContentGeneratorConfig,
} from '../core/contentGenerator.js';
import { GeminiChat } from '../core/geminiChat.js';
import { DEFAULT_GEMINI_FLASH_MODEL } from '../config/models.js';
import { PartListUnion } from '@google/genai';

export class TaskListInterceptor {
  constructor(
    private config: Config,
    private taskListService: TaskListService,
  ) {}

  /**
   * Analyzes a user prompt to determine if it should be broken into tasks
   */
  async shouldCreateTaskList(userPrompt: string): Promise<boolean> {
    console.log(
      '[TaskListInterceptor] Analyzing prompt for task list creation:',
      userPrompt.substring(0, 100),
    );

    // Quick heuristics to avoid unnecessary API calls
    const prompt = userPrompt.toLowerCase();

    // Skip if it's a simple question
    if (
      prompt.startsWith('what') ||
      prompt.startsWith('why') ||
      prompt.startsWith('explain') ||
      prompt.startsWith('describe') ||
      (prompt.includes('?') && !prompt.includes(' and '))
    ) {
      console.log(
        '[TaskListInterceptor] Skipping - detected as simple question',
      );
      return false;
    }

    // Skip if it's a single very simple command
    const singleCommandPatterns = [
      /^run\s+\w+$/,
      /^execute\s+\w+$/,
      /^test$/,
      /^build$/,
      /^install\s+\w+$/,
      /^read\s+\w+$/,
      /^open\s+\w+$/,
      /^show\s+\w+$/,
      /^list\s+\w+$/,
    ];

    if (singleCommandPatterns.some((pattern) => pattern.test(prompt))) {
      console.log(
        '[TaskListInterceptor] Skipping - detected as single command',
      );
      return false;
    }

    // Check for multi-step indicators - be more aggressive
    const multiStepIndicators = [
      ' and ', // Any "and" suggests multiple steps
      'then',
      'after',
      'next',
      'finally',
      'first',
      'second',
      'step',
      'create',
      'build',
      'implement',
      'add',
      'write',
      'test',
      'with',
      'include',
      'refactor',
      'migrate',
      'set up',
      'setup',
      'configure',
      'integrate',
      'develop',
      'make',
    ];

    const hasMultiStepIndicator = multiStepIndicators.some((indicator) =>
      prompt.includes(indicator),
    );

    // If we have indicators OR the prompt is reasonably complex, create a task list
    if (hasMultiStepIndicator || prompt.split(' ').length > 8) {
      console.log(
        '[TaskListInterceptor] Creating task list - detected multi-step indicators or complex request',
      );
      return true;
    }

    // For ambiguous cases, use Flash to decide
    console.log(
      '[TaskListInterceptor] Checking with Flash model for ambiguous case',
    );
    return await this.askFlashToDecide(userPrompt);
  }

  /**
   * Uses Flash model to determine if a prompt needs task decomposition
   */
  private async askFlashToDecide(userPrompt: string): Promise<boolean> {
    const originalModel = this.config.getModel();

    try {
      this.config.setModel(DEFAULT_GEMINI_FLASH_MODEL);
      // Use the existing auth from the config
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

      const analysisPrompt = `Analyze this user request and determine if it should be broken down into multiple tasks.

User Request: ${userPrompt}

Answer with just "YES" if this request:
- Involves multiple distinct steps or actions
- Requires implementing a feature with multiple components
- Involves creating or modifying multiple files
- Is a complex task that benefits from step-by-step execution

Answer with just "NO" if this request:
- Is a simple, single action
- Is asking a question
- Is requesting information or explanation
- Can be completed in one straightforward step

Your answer (YES or NO):`;

      const response = await chat.sendMessage(
        {
          message: analysisPrompt,
          config: {},
        },
        'task-analysis',
      );

      const responseText =
        response.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return responseText.trim().toUpperCase() === 'YES';
    } catch (error) {
      // If there's an error, default to not creating a task list
      console.error('Error analyzing prompt for task list:', error);
      return false;
    } finally {
      this.config.setModel(originalModel);
    }
  }

  /**
   * Intercepts a user prompt and potentially creates a task list
   */
  async interceptPrompt(
    userPrompt: PartListUnion,
    signal?: AbortSignal,
  ): Promise<{
    shouldProceedWithTaskList: boolean;
    modifiedPrompt?: PartListUnion;
    attemptedToCreate?: boolean;
  }> {
    console.log('[TaskListInterceptor] interceptPrompt called');

    // Extract text from the prompt
    let promptText = '';
    if (typeof userPrompt === 'string') {
      promptText = userPrompt;
    } else if (Array.isArray(userPrompt)) {
      promptText = userPrompt
        .map((part) => (typeof part === 'string' ? part : part.text || ''))
        .join(' ');
    } else if (
      userPrompt &&
      typeof userPrompt === 'object' &&
      'text' in userPrompt
    ) {
      promptText = userPrompt.text || '';
    }

    console.log(
      '[TaskListInterceptor] Extracted prompt text:',
      promptText.substring(0, 100),
    );

    if (!promptText) {
      console.log('[TaskListInterceptor] No prompt text found, skipping');
      return { shouldProceedWithTaskList: false };
    }

    // Check if we should create a task list
    const shouldCreate = await this.shouldCreateTaskList(promptText);
    if (!shouldCreate) {
      console.log('[TaskListInterceptor] Decision: No task list needed');
      return { shouldProceedWithTaskList: false };
    }

    console.log('[TaskListInterceptor] Decision: Creating task list');

    // Generate the task list
    let taskTitles: string[] = [];
    try {
      taskTitles = await this.generateTaskList(promptText, signal);
      console.log('[TaskListInterceptor] Generated tasks:', taskTitles);
    } catch (error) {
      console.error('[TaskListInterceptor] Error generating tasks:', error);
      return {
        shouldProceedWithTaskList: false,
        attemptedToCreate: true,
      };
    }

    if (taskTitles.length === 0) {
      console.log('[TaskListInterceptor] No tasks generated, skipping');
      return {
        shouldProceedWithTaskList: false,
        attemptedToCreate: true,
      };
    }

    // Create the task list
    this.taskListService.createTaskList(promptText, taskTitles);

    // Start the first task
    this.taskListService.startCurrentTask();

    // Return the modified prompt with task context
    const currentTask = this.taskListService.getCurrentTask();
    if (!currentTask) {
      console.log('[TaskListInterceptor] No current task found');
      return { shouldProceedWithTaskList: false };
    }

    const taskContext = this.taskListService.getTaskContext();
    const modifiedPromptText =
      `Original request: ${promptText}\n\n` +
      `I've broken this down into ${taskTitles.length} tasks that I'll execute ONE AT A TIME.\n` +
      `After each task, I will run a short verification pass to ensure success before advancing.\n` +
      `Do not ask the user for any input; if something like a folder/app name is required and not specified, choose a reasonable default (e.g., "app").\n\n` +
      `${taskContext}\n\n` +
      `🛑 **EXECUTE ONLY TASK 1: ${currentTask.title}**\n\n` +
      `After completing this ONE task, STOP. A verification step will run next.\n` +
      `DO NOT continue to other tasks on your own.`;

    console.log(
      '[TaskListInterceptor] Returning modified prompt with task context',
    );
    return {
      shouldProceedWithTaskList: true,
      modifiedPrompt: modifiedPromptText,
    };
  }

  /**
   * Generates a task list using the Flash model
   */
  private async generateTaskList(
    userRequest: string,
    signal?: AbortSignal,
  ): Promise<string[]> {
    console.log('[TaskListInterceptor] Generating task list with Flash model');
    const originalModel = this.config.getModel();
    console.log(
      '[TaskListInterceptor] Original model:',
      originalModel,
      '-> Switching to:',
      DEFAULT_GEMINI_FLASH_MODEL,
    );

    try {
      this.config.setModel(DEFAULT_GEMINI_FLASH_MODEL);
      // Use the existing auth from the config
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

      const prompt = `Break down the following user request into a clear, sequential list of tasks.

User Request: ${userRequest}

Generate a numbered list of specific, actionable tasks that need to be completed to fulfill this request.
Each task should be:
- Clear and specific
- A single action or closely related set of actions
- In logical order of execution

Format your response as a simple numbered list with just the task descriptions.
Keep each task title concise (under 10 words).

Example format:
1. Read the configuration file
2. Parse the JSON data
3. Update the database schema`;

      const response = await chat.sendMessage(
        {
          message: prompt,
          config: signal ? { abortSignal: signal } : {},
        },
        'task-generation',
      );

      const responseText =
        response.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return this.parseTaskList(responseText);
    } catch (error) {
      console.error('Error generating task list:', error);
      return [];
    } finally {
      this.config.setModel(originalModel);
    }
  }

  /**
   * Parses a task list from response text
   */
  private parseTaskList(responseText: string): string[] {
    const lines = responseText.split('\n');
    const tasks: string[] = [];

    for (const line of lines) {
      const match = line.match(/^\d+\.\s+(.+)$/);
      if (match) {
        tasks.push(match[1].trim());
      }
    }

    return tasks;
  }

  /**
   * Handles task completion and advances to the next task
   */
  async handleTaskCompletion(): Promise<PartListUnion | null> {
    const completedTask = this.taskListService.completeCurrentTask();
    if (!completedTask) {
      return null;
    }

    const currentTask = this.taskListService.getCurrentTask();
    if (!currentTask) {
      // All tasks completed - return null to stop continuation
      return null;
    }

    // Start the next task
    this.taskListService.startCurrentTask();

    const taskContext = this.taskListService.getTaskContext();
    const taskList = this.taskListService.getCurrentTaskList();
    const currentIndex = taskList?.currentTaskIndex || 0;
    const totalTasks = taskList?.tasks.length || 0;

    const completedIndex = taskList?.tasks.findIndex(t => t.id === completedTask.id) || 0;
    
    return (
      `✅ Task ${completedIndex + 1}/${totalTasks} "${completedTask.title}" completed!\n\n` +
      `${taskContext}\n\n` +
      `🛑 **NOW EXECUTE ONLY TASK ${currentIndex + 1}: ${currentTask.title}**\n\n` +
      `STOP after completing this ONE task. Do NOT continue to other tasks.`
    );
  }
}
