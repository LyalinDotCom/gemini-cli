/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PlanService } from './planService.js';

describe('PlanService', () => {
  let tempDir: string;
  let planService: PlanService;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'plan-service-test-'));
    planService = new PlanService(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('saves and loads plans', async () => {
    const id = await planService.savePlan(
      '## Plan Content',
      'My Plan',
      'Original prompt',
    );

    const plan = await planService.loadPlan(id);
    expect(plan).not.toBeNull();
    expect(plan?.metadata.id).toBe(id);
    expect(plan?.metadata.title).toBe('My Plan');
    expect(plan?.metadata.status).toBe('draft');
    expect(plan?.metadata.originalPrompt).toBe('Original prompt');
    expect(plan?.content).toBe('## Plan Content');
  });

  it('updates status and last viewed', async () => {
    const id = await planService.savePlan('Plan body', 'Status Plan', 'Prompt');

    const updated = await planService.updatePlanStatus(id, 'saved');
    expect(updated).toBe(true);

    const viewUpdated = await planService.updateLastViewed(id);
    expect(viewUpdated).toBe(true);

    const plan = await planService.loadPlan(id);
    expect(plan?.metadata.status).toBe('saved');
    expect(plan?.metadata.lastViewed).toBeTruthy();
  });

  it('lists plans and excludes drafts when requested', async () => {
    const draftId = await planService.savePlan('Draft', 'Draft Plan', 'Prompt');
    const savedId = await planService.savePlan(
      'Saved',
      'Saved Plan',
      'Prompt',
      'saved',
    );

    const allPlans = await planService.listPlans(true);
    expect(allPlans.find((p) => p.id === draftId)).toBeTruthy();
    expect(allPlans.find((p) => p.id === savedId)).toBeTruthy();

    const nonDrafts = await planService.listPlans(false);
    expect(nonDrafts.find((p) => p.id === draftId)).toBeUndefined();
    expect(nonDrafts.find((p) => p.id === savedId)).toBeTruthy();
  });

  it('exports and deletes a plan', async () => {
    const id = await planService.savePlan(
      'Export content',
      'Export Plan',
      'Prompt',
    );

    const exportPath = path.join(tempDir, 'plan-export.md');
    const exported = await planService.exportPlan(id, exportPath);
    expect(exported).toBe(true);

    const exportedContent = await fs.readFile(exportPath, 'utf8');
    expect(exportedContent.trim()).toBe('Export content');

    const deleted = await planService.deletePlan(id);
    expect(deleted).toBe(true);

    const missing = await planService.loadPlan(id);
    expect(missing).toBeNull();
  });
});
