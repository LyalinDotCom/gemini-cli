/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';

const FIRST_RUN_FILE = '.gemini-firstrun';

export function isFirstRun(workspaceRoot: string): boolean {
  return !existsSync(join(workspaceRoot, FIRST_RUN_FILE));
}

export function setFirstRunFinished(workspaceRoot: string): void {
  writeFileSync(join(workspaceRoot, FIRST_RUN_FILE), '');
}
