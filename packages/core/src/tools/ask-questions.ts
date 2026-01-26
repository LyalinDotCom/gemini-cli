/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ToolResult } from './tools.js';
import { BaseDeclarativeTool, BaseToolInvocation, Kind } from './tools.js';
import type { MessageBus } from '../confirmation-bus/message-bus.js';
import { ASK_QUESTIONS_TOOL_NAME } from './tool-names.js';

export const ASK_QUESTIONS_DESCRIPTION = `Ask 1-5 clarifying questions before finalizing an implementation plan.
Use this tool in Plan Mode when real decisions or missing requirements exist.
The UI will prompt the user to answer each question before planning continues.
Parameters:
- title: Optional dialog title (defaults to "Clarify before planning")
- questions: An array of 1-5 concise questions
`;

export interface AskQuestionsParams {
  /**
   * Dialog title for the questions UI.
   */
  title?: string;

  /**
   * List of 1-5 concise questions.
   */
  questions: string[];
}

class AskQuestionsInvocation extends BaseToolInvocation<
  AskQuestionsParams,
  ToolResult
> {
  getDescription(): string {
    const count = this.params.questions?.length ?? 0;
    return `Ask ${count} clarification question${count === 1 ? '' : 's'}`;
  }

  async execute(
    _signal: AbortSignal,
    _updateOutput?: (output: string) => void,
  ): Promise<ToolResult> {
    const title = this.params.title?.trim() || 'Clarify before planning';
    const questions = this.params.questions ?? [];

    return {
      llmContent: JSON.stringify({
        success: true,
        askedQuestions: { title, questions },
      }),
      returnDisplay: {
        askedQuestions: {
          title,
          questions,
        },
      },
    };
  }
}

export class AskQuestionsTool extends BaseDeclarativeTool<
  AskQuestionsParams,
  ToolResult
> {
  static readonly Name = ASK_QUESTIONS_TOOL_NAME;

  constructor(messageBus: MessageBus) {
    super(
      AskQuestionsTool.Name,
      'AskQuestions',
      ASK_QUESTIONS_DESCRIPTION,
      Kind.Think,
      {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Dialog title for the questions UI.',
          },
          questions: {
            type: 'array',
            minItems: 1,
            maxItems: 5,
            items: {
              type: 'string',
              description: 'A concise clarifying question.',
            },
          },
        },
        required: ['questions'],
        additionalProperties: false,
      },
      messageBus,
      true,
      false,
    );
  }

  protected override validateToolParamValues(
    params: AskQuestionsParams,
  ): string | null {
    const questions = params.questions ?? [];
    if (questions.length < 1 || questions.length > 5) {
      return 'Parameter "questions" must include between 1 and 5 questions.';
    }
    const hasEmpty = questions.some((q) => !q || q.trim().length === 0);
    if (hasEmpty) {
      return 'All questions must be non-empty strings.';
    }
    return null;
  }

  protected createInvocation(
    params: AskQuestionsParams,
    messageBus: MessageBus,
    _toolName?: string,
    _toolDisplayName?: string,
  ): AskQuestionsInvocation {
    return new AskQuestionsInvocation(
      params,
      messageBus,
      _toolName,
      _toolDisplayName,
    );
  }
}
