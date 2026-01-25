/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Content } from '@google/genai';
import type { GeminiClient } from '../core/client.js';
import { getResponseText } from './partUtils.js';
import { debugLogger } from './debugLogger.js';
import type { Config } from '../config/config.js';

/**
 * Prompt for summarizing model thoughts when considering/planning.
 */
const SUMMARIZE_CONSIDERING_PROMPT = `Summarize this thought into a very brief phrase (2-5 words) describing what the model is considering. Use present progressive tense (e.g., "analyzing code structure", "evaluating options", "planning approach").

Thought to summarize:
"{thought}"

Return only the brief phrase, nothing else.`;

/**
 * Prompt for summarizing model thoughts when taking action (tool calls follow).
 */
const SUMMARIZE_ACTION_PROMPT = `Summarize this thought into a very brief phrase (2-5 words) explaining the action being taken. Focus on the tool/operation (e.g., "reading config file", "installing dependencies", "running tests").

Thought to summarize:
"{thought}"

Return only the brief phrase, nothing else.`;

/**
 * Minimum length of thought text to trigger summarization.
 * Shorter thoughts are already concise enough.
 */
export const MIN_THOUGHT_LENGTH_FOR_SUMMARIZATION = 100;

/**
 * Rate limit interval for thought summarization in milliseconds.
 * Prevents excessive API calls during rapid thought updates.
 */
export const THOUGHT_SUMMARIZATION_RATE_LIMIT_MS = 3000;

/**
 * Summarizes a model thought into a brief status message.
 *
 * This function uses the Flash Lite model (via summarizer-default config)
 * to generate a concise description of what the model is thinking about.
 *
 * @param config - The application configuration
 * @param thoughtDescription - The full thought description from the model
 * @param geminiClient - The Gemini client for API calls
 * @param abortSignal - Signal to abort the request
 * @param isAction - Whether tool calls follow this thought (action tone vs considering tone)
 * @returns A brief summary suitable for display in a status indicator
 */
export async function summarizeThought(
  config: Config,
  thoughtDescription: string,
  geminiClient: GeminiClient,
  abortSignal: AbortSignal,
  isAction?: boolean,
): Promise<string> {
  // Skip summarization for short thoughts
  if (
    !thoughtDescription ||
    thoughtDescription.length < MIN_THOUGHT_LENGTH_FOR_SUMMARIZATION
  ) {
    return thoughtDescription;
  }

  const promptTemplate = isAction
    ? SUMMARIZE_ACTION_PROMPT
    : SUMMARIZE_CONSIDERING_PROMPT;
  const prompt = promptTemplate.replace('{thought}', thoughtDescription);

  const contents: Content[] = [{ role: 'user', parts: [{ text: prompt }] }];

  try {
    const parsedResponse = await geminiClient.generateContent(
      { model: 'summarizer-default' },
      contents,
      abortSignal,
    );
    const summary = getResponseText(parsedResponse);

    // Return the summary if valid, otherwise fall back to original
    if (summary && summary.trim().length > 0) {
      // Clean up the response - remove quotes and extra whitespace
      return summary
        .trim()
        .replace(/^["']|["']$/g, '')
        .toLowerCase();
    }
    return thoughtDescription;
  } catch (error) {
    debugLogger.debug('Failed to summarize thought:', error);
    // On error, just return the original thought description
    return thoughtDescription;
  }
}
