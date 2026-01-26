/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  CommandContext,
  SlashCommand,
  SlashCommandActionReturn,
} from './types.js';
import { CommandKind } from './types.js';
import {
  PlanService,
  ApprovalMode,
  type PlanListItem,
} from '@google/gemini-cli-core';
import type { HistoryItemPlanList, PlanDetail } from '../types.js';
import { MessageType } from '../types.js';
import path from 'node:path';

const getPlanService = (context: CommandContext): PlanService => {
  const projectRoot = context.services.config?.getProjectRoot();
  return new PlanService(projectRoot);
};

const listCommand: SlashCommand = {
  name: 'list',
  description: 'List saved implementation plans',
  kind: CommandKind.BUILT_IN,
  autoExecute: true,
  action: async (context): Promise<void> => {
    const planService = getPlanService(context);
    const plans: PlanListItem[] = await planService.listPlans(true);

    const planDetails: PlanDetail[] = plans.map((p) => ({
      id: p.id,
      title: p.title,
      updatedAt: p.updatedAt,
      status: p.status,
      lastViewed: p.lastViewed,
    }));

    const item: HistoryItemPlanList = {
      type: MessageType.PLAN_LIST,
      plans: planDetails,
    };

    context.ui.addItem(item, Date.now());
  },
};

const viewCommand: SlashCommand = {
  name: 'view',
  description: 'View a saved plan. Usage: /plan view <title>',
  kind: CommandKind.BUILT_IN,
  autoExecute: true,
  action: async (context, args): Promise<SlashCommandActionReturn | void> => {
    const searchTerm = args.trim();
    if (!searchTerm) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Missing plan title. Usage: /plan view <title>',
      };
    }

    const planService = getPlanService(context);
    const plans: PlanListItem[] = await planService.listPlans();

    const matchingPlan = plans.find((p) =>
      p.title.toLowerCase().includes(searchTerm.toLowerCase()),
    );

    if (!matchingPlan) {
      return {
        type: 'message',
        messageType: 'error',
        content: `No plan found matching "${searchTerm}".`,
      };
    }

    const planData = await planService.loadPlan(matchingPlan.id);
    if (!planData) {
      return {
        type: 'message',
        messageType: 'error',
        content: `Error loading plan "${matchingPlan.title}".`,
      };
    }

    await planService.updateLastViewed(matchingPlan.id);

    const header = `## Plan: ${planData.metadata.title}\n\n**Status:** ${planData.metadata.status}\n**Created:** ${planData.metadata.createdAt}\n**Original prompt:** ${planData.metadata.originalPrompt}\n\n---\n\n`;

    context.ui.addItem(
      {
        type: 'gemini',
        text: header + planData.content,
      },
      Date.now(),
    );
  },
  completion: async (context, partialArg) => {
    const planService = getPlanService(context);
    const plans: PlanListItem[] = await planService.listPlans();
    return plans
      .map((p) => p.title)
      .filter((title) =>
        title.toLowerCase().includes(partialArg.toLowerCase()),
      );
  },
};

const resumeCommand: SlashCommand = {
  name: 'resume',
  altNames: ['execute'],
  description: 'Resume/execute a saved plan. Usage: /plan resume <title>',
  kind: CommandKind.BUILT_IN,
  autoExecute: false,
  action: async (context, args): Promise<SlashCommandActionReturn | void> => {
    const searchTerm = args.trim();
    if (!searchTerm) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Missing plan title. Usage: /plan resume <title>',
      };
    }

    const planService = getPlanService(context);
    const plans: PlanListItem[] = await planService.listPlans();

    const matchingPlan = plans.find((p) =>
      p.title.toLowerCase().includes(searchTerm.toLowerCase()),
    );

    if (!matchingPlan) {
      return {
        type: 'message',
        messageType: 'error',
        content: `No plan found matching "${searchTerm}".`,
      };
    }

    const planData = await planService.loadPlan(matchingPlan.id);
    if (!planData) {
      return {
        type: 'message',
        messageType: 'error',
        content: `Error loading plan "${matchingPlan.title}".`,
      };
    }

    const config = context.services.config;
    if (config) {
      config.setApprovalMode(ApprovalMode.AUTO_EDIT);
    }

    await planService.updatePlanStatus(matchingPlan.id, 'executed');

    const prompt = `Execute the following implementation plan. The plan was created earlier and saved. Follow the steps in the plan carefully.\n\n---\n\n# Plan: ${planData.metadata.title}\n\n${planData.content}\n\n---\n\nOriginal request: ${planData.metadata.originalPrompt}`;

    return {
      type: 'submit_prompt',
      content: prompt,
    };
  },
  completion: async (context, partialArg) => {
    const planService = getPlanService(context);
    const plans: PlanListItem[] = await planService.listPlans();
    return plans
      .map((p) => p.title)
      .filter((title) =>
        title.toLowerCase().includes(partialArg.toLowerCase()),
      );
  },
};

const deleteCommand: SlashCommand = {
  name: 'delete',
  description: 'Delete a saved plan. Usage: /plan delete <title>',
  kind: CommandKind.BUILT_IN,
  autoExecute: true,
  action: async (context, args): Promise<SlashCommandActionReturn | void> => {
    const searchTerm = args.trim();
    if (!searchTerm) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Missing plan title. Usage: /plan delete <title>',
      };
    }

    const planService = getPlanService(context);
    const plans: PlanListItem[] = await planService.listPlans();

    const matchingPlan = plans.find((p) =>
      p.title.toLowerCase().includes(searchTerm.toLowerCase()),
    );

    if (!matchingPlan) {
      return {
        type: 'message',
        messageType: 'error',
        content: `No plan found matching "${searchTerm}".`,
      };
    }

    const deleted = await planService.deletePlan(matchingPlan.id);
    if (deleted) {
      return {
        type: 'message',
        messageType: 'info',
        content: `Plan "${matchingPlan.title}" has been deleted.`,
      };
    }
    return {
      type: 'message',
      messageType: 'error',
      content: `Error deleting plan "${matchingPlan.title}".`,
    };
  },
  completion: async (context, partialArg) => {
    const planService = getPlanService(context);
    const plans = await planService.listPlans();
    return plans
      .map((p) => p.title)
      .filter((title) =>
        title.toLowerCase().includes(partialArg.toLowerCase()),
      );
  },
};

const exportCommand: SlashCommand = {
  name: 'export',
  description:
    'Export a plan to a file. Usage: /plan export <title> [filename]',
  kind: CommandKind.BUILT_IN,
  autoExecute: true,
  action: async (context, args): Promise<SlashCommandActionReturn | void> => {
    const trimmedArgs = args.trim();
    if (!trimmedArgs) {
      return {
        type: 'message',
        messageType: 'error',
        content:
          'Missing plan title. Usage: /plan export <title> [filename]\nFilename is optional - defaults to plan title with .md extension.',
      };
    }

    const planService = getPlanService(context);
    const plans = await planService.listPlans();

    let matchingPlan = plans.find((p) =>
      p.title.toLowerCase().includes(trimmedArgs.toLowerCase()),
    );

    let filename: string;

    if (matchingPlan) {
      filename =
        matchingPlan.title
          .replace(/[^a-zA-Z0-9\\s-]/g, '')
          .replace(/\\s+/g, '-')
          .toLowerCase() + '.md';
    } else {
      const parts = trimmedArgs.split(/\\s+/);
      if (parts.length < 2) {
        return {
          type: 'message',
          messageType: 'error',
          content: `No plan found matching "${trimmedArgs}".`,
        };
      }

      filename = parts[parts.length - 1];
      const searchTerm = parts.slice(0, -1).join(' ');

      matchingPlan = plans.find((p) =>
        p.title.toLowerCase().includes(searchTerm.toLowerCase()),
      );

      if (!matchingPlan) {
        return {
          type: 'message',
          messageType: 'error',
          content: `No plan found matching "${searchTerm}" or "${trimmedArgs}".`,
        };
      }
    }

    if (!filename.endsWith('.md')) {
      filename += '.md';
    }

    const targetPath = path.isAbsolute(filename)
      ? filename
      : path.join(process.cwd(), filename);

    try {
      const exported = await planService.exportPlan(
        matchingPlan.id,
        targetPath,
      );
      if (exported) {
        return {
          type: 'message',
          messageType: 'info',
          content: `Plan "${matchingPlan.title}" exported to ${targetPath}`,
        };
      }
      return {
        type: 'message',
        messageType: 'error',
        content: `Error exporting plan "${matchingPlan.title}".`,
      };
    } catch (error) {
      return {
        type: 'message',
        messageType: 'error',
        content: `Error exporting plan: ${(error as Error).message}`,
      };
    }
  },
  completion: async (context, partialArg) => {
    const planService = getPlanService(context);
    const plans = await planService.listPlans();
    return plans
      .map((p) => p.title)
      .filter((title) =>
        title.toLowerCase().includes(partialArg.toLowerCase()),
      );
  },
};

export const planCommand: SlashCommand = {
  name: 'plan',
  description: 'Manage implementation plans',
  kind: CommandKind.BUILT_IN,
  autoExecute: false,
  subCommands: [
    listCommand,
    viewCommand,
    resumeCommand,
    deleteCommand,
    exportCommand,
  ],
};
