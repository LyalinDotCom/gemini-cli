/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import { promises as fs } from 'node:fs';
import yaml from 'js-yaml';
import { GEMINI_DIR } from '../utils/paths.js';

export type PlanStatus = 'draft' | 'saved' | 'executed';

export interface PlanMetadata {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  status: PlanStatus;
  originalPrompt: string;
  lastViewed?: string;
}

export interface PlanData {
  metadata: PlanMetadata;
  content: string;
}

export interface PlanListItem {
  id: string;
  title: string;
  updatedAt: string;
  status: PlanStatus;
  lastViewed?: string;
}

const FRONTMATTER_BOUNDARY = '---';

function buildPlanId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `plan-${timestamp}-${random}`;
}

export class PlanService {
  private readonly projectRoot: string;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot ?? process.cwd();
  }

  private getPlansDir(): string {
    return path.join(this.projectRoot, GEMINI_DIR, 'plans');
  }

  private getPlanPath(id: string): string {
    return path.join(this.getPlansDir(), `${id}.md`);
  }

  private async ensurePlansDir(): Promise<void> {
    await fs.mkdir(this.getPlansDir(), { recursive: true });
  }

  private serializePlan(metadata: PlanMetadata, content: string): string {
    const frontmatter = yaml.dump(metadata, { lineWidth: 120 }).trimEnd();
    return `${FRONTMATTER_BOUNDARY}\n${frontmatter}\n${FRONTMATTER_BOUNDARY}\n\n${content.trim()}\n`;
  }

  private parsePlanFile(raw: string): PlanData | null {
    const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) {
      return null;
    }

    const frontmatter = match[1];
    const body = match[2];
    const metadata = yaml.load(frontmatter) as PlanMetadata | undefined;
    if (!metadata || !metadata.id || !metadata.title) {
      return null;
    }
    return {
      metadata,
      content: body.trim(),
    };
  }

  async savePlan(
    content: string,
    title: string,
    originalPrompt: string,
    status: PlanStatus = 'draft',
  ): Promise<string> {
    await this.ensurePlansDir();
    const id = buildPlanId();
    const now = new Date().toISOString();
    const metadata: PlanMetadata = {
      id,
      title,
      createdAt: now,
      updatedAt: now,
      status,
      originalPrompt,
    };

    const serialized = this.serializePlan(metadata, content);
    await fs.writeFile(this.getPlanPath(id), serialized, 'utf8');
    return id;
  }

  async loadPlan(id: string): Promise<PlanData | null> {
    try {
      const raw = await fs.readFile(this.getPlanPath(id), 'utf8');
      return this.parsePlanFile(raw);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async listPlans(includeDrafts: boolean = true): Promise<PlanListItem[]> {
    try {
      const files = await fs.readdir(this.getPlansDir());
      const plans: PlanListItem[] = [];
      for (const file of files) {
        if (!file.endsWith('.md')) continue;
        const raw = await fs.readFile(
          path.join(this.getPlansDir(), file),
          'utf8',
        );
        const parsed = this.parsePlanFile(raw);
        if (!parsed) continue;
        if (!includeDrafts && parsed.metadata.status === 'draft') {
          continue;
        }
        plans.push({
          id: parsed.metadata.id,
          title: parsed.metadata.title,
          updatedAt: parsed.metadata.updatedAt,
          status: parsed.metadata.status,
          lastViewed: parsed.metadata.lastViewed,
        });
      }
      return plans.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async updatePlanStatus(id: string, status: PlanStatus): Promise<boolean> {
    const plan = await this.loadPlan(id);
    if (!plan) return false;
    const now = new Date().toISOString();
    const updatedMeta: PlanMetadata = {
      ...plan.metadata,
      status,
      updatedAt: now,
    };
    const serialized = this.serializePlan(updatedMeta, plan.content);
    await fs.writeFile(this.getPlanPath(id), serialized, 'utf8');
    return true;
  }

  async updateLastViewed(id: string): Promise<boolean> {
    const plan = await this.loadPlan(id);
    if (!plan) return false;
    const now = new Date().toISOString();
    const updatedMeta: PlanMetadata = {
      ...plan.metadata,
      lastViewed: now,
      updatedAt: now,
    };
    const serialized = this.serializePlan(updatedMeta, plan.content);
    await fs.writeFile(this.getPlanPath(id), serialized, 'utf8');
    return true;
  }

  async exportPlan(id: string, targetPath: string): Promise<boolean> {
    const plan = await this.loadPlan(id);
    if (!plan) return false;
    await fs.writeFile(targetPath, `${plan.content.trim()}\n`, 'utf8');
    return true;
  }

  async deletePlan(id: string): Promise<boolean> {
    try {
      await fs.unlink(this.getPlanPath(id));
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }
}
