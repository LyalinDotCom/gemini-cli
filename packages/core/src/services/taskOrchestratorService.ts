/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  Config,
  GeminiChat,
  createContentGenerator,
  createContentGeneratorConfig,
  executeToolCall,
  ToolCallRequestInfo,
} from '../index.js';

export type OrchestratorEvent =
  | { type: 'info'; message: string }
  | { type: 'plan'; message: string; plan: ActionPlan }
  | { type: 'step_start'; message: string }
  | { type: 'step_result'; message: string }
  | { type: 'verify'; message: string }
  | { type: 'verify_result'; message: string; success: boolean }
  | { type: 'complete'; message: string }
  | { type: 'error'; message: string };

export type ActionPlan = {
  steps: Array<{
    tool:
      | 'shell'
      | 'edit'
      | 'write_file'
      | 'read_file'
      | 'ls'
      | 'glob'
      | 'grep'
      | 'read_many_files'
      | 'web_fetch';
    args: Record<string, unknown>;
    description?: string;
  }>;
  rationale?: string;
};

export class TaskOrchestratorService {
  constructor(private config: Config) {}

  async runTask(
    userRequest: string,
    currentTaskTitle: string,
    onEvent: (e: OrchestratorEvent) => void,
    abortSignal: AbortSignal,
    maxRepairs: number = 2,
  ): Promise<boolean> {
    onEvent({ type: 'info', message: `Orchestrator enabled. Executing: ${currentTaskTitle}` });
    const plan = await this.proposeActionPlan(userRequest, currentTaskTitle);
    if (!plan || plan.steps.length === 0) {
      onEvent({ type: 'error', message: 'Planner returned no steps.' });
      return false;
    }
    onEvent({
      type: 'plan',
      message: `Planned ${plan.steps.length} step(s).`,
      plan,
    });

    // Execute planned steps
    const observations: string[] = [];
    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      const callId = `${step.tool}-${Date.now()}-${i}`;
      const request: ToolCallRequestInfo = {
        callId,
        name: step.tool,
        args: step.args,
        isClientInitiated: true,
        prompt_id: this.config.getSessionId(),
      };
      onEvent({
        type: 'step_start',
        message: `Step ${i + 1}/${plan.steps.length}: ${step.tool}`,
      });
      try {
        const response = await executeToolCall(this.config, request, abortSignal);
        const output = JSON.stringify(response.responseParts ?? [], null, 2);
        observations.push(`step:${i + 1}, tool:${step.tool}, result:${output}`);
        onEvent({ type: 'step_result', message: `✓ ${step.tool} complete` });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        observations.push(`step:${i + 1}, tool:${step.tool}, error:${msg}`);
        onEvent({ type: 'step_result', message: `✗ ${step.tool} failed: ${msg}` });
      }
    }

    // Verify success with deterministic checks or a small verify plan
    for (let attempt = 0; attempt <= maxRepairs; attempt++) {
      onEvent({ type: 'verify', message: `Verifying task completion (attempt ${attempt + 1})...` });
      const verifySuccess = await this.verify(userRequest, currentTaskTitle, abortSignal);
      onEvent({
        type: 'verify_result',
        message: verifySuccess ? 'Verification passed.' : 'Verification failed.',
        success: verifySuccess,
      });
      if (verifySuccess) return true;
      // Ask for a minimal repair plan and execute
      const repair = await this.proposeRepairPlan(
        userRequest,
        currentTaskTitle,
        observations.join('\n'),
      );
      if (!repair || repair.steps.length === 0) {
        onEvent({ type: 'error', message: 'No repair plan proposed; stopping.' });
        return false;
      }
      onEvent({ type: 'plan', message: `Applying repair plan (${repair.steps.length} steps).`, plan: repair });
      for (let i = 0; i < repair.steps.length; i++) {
        const step = repair.steps[i];
        const callId = `${step.tool}-${randomUUID()}`;
        const request: ToolCallRequestInfo = {
          callId,
          name: step.tool,
          args: step.args,
          isClientInitiated: true,
          prompt_id: this.config.getSessionId(),
        };
        onEvent({ type: 'step_start', message: `Repair step ${i + 1}: ${step.tool}` });
        try {
          const response = await executeToolCall(this.config, request, abortSignal);
          const output = JSON.stringify(response.responseParts ?? [], null, 2);
          observations.push(`repair:${i + 1}, tool:${step.tool}, result:${output}`);
          onEvent({ type: 'step_result', message: `✓ repair ${step.tool} complete` });
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          observations.push(`repair:${i + 1}, tool:${step.tool}, error:${msg}`);
          onEvent({ type: 'step_result', message: `✗ repair ${step.tool} failed: ${msg}` });
        }
      }
    }
    return false;
  }

  private async proposeActionPlan(
    userRequest: string,
    currentTaskTitle: string,
  ): Promise<ActionPlan | null> {
    const chat = await this.createEphemeralChat();
    const prompt = `You are an orchestrator planner. Given a user request and the CURRENT TASK, propose a short JSON plan of non-interactive steps using only the allowed tools.

Return ONLY a JSON object with this schema:
{
  "steps": [
    { "tool": "shell|edit|write_file|read_file|ls|glob|grep|read_many_files|web_fetch", "args": { ... }, "description": "optional" }
  ],
  "rationale": "optional brief string"
}

Rules:
- Non-interactive only. Add flags like --yes/--no-input if needed.
- Work inside the current workspace path only.
- Do NOT run servers or open browsers.
- Keep steps <= 5.
- Prefer atomic edits and builds over global mutations.

User request: ${userRequest}
CURRENT TASK: ${currentTaskTitle}`;

    const response = await chat.sendMessage({ message: prompt, config: {} }, 'orchestrator-plan');
    const text = this.getFirstText(response);
    const plan = this.safeParseJson<ActionPlan>(text);
    if (!plan) return null;
    plan.steps = (plan.steps || []).filter((s) => this.isAllowedTool(s.tool)).slice(0, 5);
    return plan;
  }

  private async proposeRepairPlan(
    userRequest: string,
    currentTaskTitle: string,
    observations: string,
  ): Promise<ActionPlan | null> {
    const chat = await this.createEphemeralChat();
    const prompt = `Task verification failed. Provide a minimal JSON repair plan (<=3 steps) using allowed tools to fix issues, based on observations.

Schema is the same as before (steps[], rationale). Rules: non-interactive only; workspace only; keep safe.

User request: ${userRequest}
CURRENT TASK: ${currentTaskTitle}
OBSERVATIONS:
${observations}`;
    const response = await chat.sendMessage({ message: prompt, config: {} }, 'orchestrator-repair');
    const text = this.getFirstText(response);
    const plan = this.safeParseJson<ActionPlan>(text);
    if (!plan) return null;
    plan.steps = (plan.steps || []).filter((s) => this.isAllowedTool(s.tool)).slice(0, 3);
    return plan;
  }

  private async verify(
    userRequest: string,
    currentTaskTitle: string,
    abortSignal: AbortSignal,
  ): Promise<boolean> {
    // Heuristic: if package.json exists, run available scripts in this order
    try {
      const root = this.config.getTargetDir();
      const pkgPath = join(root, 'package.json');
      if (existsSync(pkgPath)) {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as {
          scripts?: Record<string, string>;
        };
        const scripts = pkg.scripts || {};
        const toRun: string[] = [];
        if (scripts['preflight']) toRun.push('npm run preflight');
        else {
          if (scripts['build']) toRun.push('npm run build');
          if (scripts['typecheck']) toRun.push('npm run typecheck');
          if (scripts['lint:ci']) toRun.push('npm run lint:ci');
          else if (scripts['lint']) toRun.push('npm run lint');
          if (scripts['test:ci']) toRun.push('npm run test:ci');
          else if (scripts['test']) toRun.push('npm run test');
        }
        for (const cmd of toRun) {
          const req: ToolCallRequestInfo = {
            callId: `verify-${randomUUID()}`,
            name: 'shell',
            args: { command: cmd },
            isClientInitiated: true,
            prompt_id: this.config.getSessionId(),
          };
          const res = await executeToolCall(this.config, req, abortSignal);
          if (res.error) return false;
        }
        return toRun.length > 0;
      }
    } catch {
      // ignore and fall back
    }

    // Fallback: ask for 1-2 non-destructive verify commands
    const chat = await this.createEphemeralChat();
    const prompt = `Propose 1-2 simple non-destructive VERIFY commands to check if CURRENT TASK is successful. Output JSON: { "steps": [{"tool": "shell", "args": {"command": "..."}}] }.
Avoid servers/browsers. Work in workspace only.
User request: ${userRequest}
CURRENT TASK: ${currentTaskTitle}`;
    const response = await chat.sendMessage({ message: prompt, config: {} }, 'orchestrator-verify');
    const text = this.getFirstText(response);
    const plan = this.safeParseJson<ActionPlan>(text);
    if (!plan) return false;
    const steps = (plan.steps || []).filter((s) => s.tool === 'shell').slice(0, 2);
    if (steps.length === 0) return false;
    for (const step of steps) {
      const cmd = String(step.args?.['command'] ?? '').trim();
      if (!cmd) continue;
      const req: ToolCallRequestInfo = {
        callId: `verify-${randomUUID()}`,
        name: 'shell',
        args: { command: cmd },
        isClientInitiated: true,
        prompt_id: this.config.getSessionId(),
      };
      const res = await executeToolCall(this.config, req, abortSignal);
      if (res.error) return false;
    }
    return true;
  }

  private async createEphemeralChat(): Promise<GeminiChat> {
    const cfg = createContentGeneratorConfig(
      this.config,
      this.config.getContentGeneratorConfig()?.authType,
    );
    const generator = await createContentGenerator(
      cfg,
      this.config,
      `${this.config.getSessionId()}-orchestrator`,
    );
    return new GeminiChat(this.config, generator);
  }

  private isAllowedTool(tool: string): boolean {
    const allowed = new Set([
      'shell',
      'edit',
      'write_file',
      'read_file',
      'ls',
      'glob',
      'grep',
      'read_many_files',
      'web_fetch',
    ]);
    return allowed.has(tool as any);
  }

  private getFirstText(response: any): string {
    return response?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }

  private safeParseJson<T>(text: string): T | null {
    const match = text.match(/```json[\s\S]*?```/i);
    const jsonString = match
      ? match[0].replace(/```json/i, '').replace(/```$/, '')
      : text;
    try {
      return JSON.parse(jsonString) as T;
    } catch {
      return null;
    }
  }
}
