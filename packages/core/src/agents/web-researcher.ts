/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';
import type { Config } from '../config/config.js';
import { PREVIEW_GEMINI_FLASH_MODEL } from '../config/models.js';
import type { LocalAgentDefinition } from './types.js';
import { WebFetchTool } from '../tools/web-fetch.js';
import { WebSearchTool } from '../tools/web-search.js';

const WebResearcherOutputSchema = z.object({
  status: z.enum(['answer', 'no_answer']),
  answer: z.string(),
  confidence: z.enum(['low', 'medium', 'high']),
  sources: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
    }),
  ),
  queries: z.array(z.string()),
});

/**
 * A specialized subagent for web research and evidence-based answers.
 */
export const WebResearcherAgent = (
  config: Config,
): LocalAgentDefinition<typeof WebResearcherOutputSchema> => ({
  kind: 'local',
  name: 'web_researcher',
  displayName: 'Web Research Agent',
  description:
    'Performs multi-query web research, compares sources, and returns grounded answers or no_answer.',
  inputConfig: {
    inputSchema: {
      type: 'object',
      properties: {
        problem_context: {
          type: 'string',
          description:
            'Why web research is needed and the broader task context.',
        },
        question: {
          type: 'string',
          description:
            'The exact question to answer using web research (include any constraints if relevant).',
        },
        constraints: {
          type: 'string',
          description:
            'Optional constraints such as recency, jurisdiction, or format.',
        },
      },
      required: ['problem_context', 'question'],
    },
  },
  outputConfig: {
    outputName: 'report',
    description: 'The final research result as a JSON object.',
    schema: WebResearcherOutputSchema,
  },
  processOutput: (output) => JSON.stringify(output, null, 2),
  modelConfig: {
    model: PREVIEW_GEMINI_FLASH_MODEL,
    generateContentConfig: {
      temperature: 0.2,
      topP: 0.95,
    },
  },
  runConfig: {
    maxTimeMinutes: 3,
    maxTurns: 8,
  },
  toolConfig: {
    tools: [
      new WebSearchTool(config, config.getMessageBus()),
      new WebFetchTool(config, config.getMessageBus()),
    ],
  },
  promptConfig: {
    query: `Answer the following question using web research.
<problem_context>
\${problem_context}
</problem_context>
<question>
\${question}
</question>
`,
    systemPrompt: `You are Web Researcher, a specialized subagent that answers questions using the public internet.
You operate in a non-interactive loop and MUST call the complete_task tool with a "report" argument when finished.

Core rules:
- Never make up answers. If evidence is insufficient or contradictory, return status "no_answer".
- Prefer multiple, independent sources. Compare results and resolve inconsistencies.
- Use web_fetch to download pages for maximum content when a source looks promising.
- Keep queries concise and varied. Favor official docs, primary sources, or reputable references.

Workflow:
1) Generate 2-4 search queries based on the question and problem context.
2) Run google_web_search for these queries in parallel.
3) Review results, pick the most relevant sources, and use web_fetch to retrieve pages.
4) If evidence is weak or conflicting, run a second search batch (max 2 total).
5) Synthesize a grounded answer or return no_answer.

Output requirements:
- Return a JSON object with fields:
  - status: "answer" | "no_answer"
  - answer: string (empty if no_answer)
  - confidence: "low" | "medium" | "high"
  - sources: [{ title, url }]
  - queries: [string]`,
  },
});
