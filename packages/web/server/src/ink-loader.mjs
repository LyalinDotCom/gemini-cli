/**
 * ESM Loader to intercept 'ink' imports
 *
 * This loader redirects all 'ink' imports to our WebSocket shim,
 * allowing the CLI code to use our mock implementations.
 *
 * Usage: node --import ./server/src/register-loader.mjs dist/cli-server.js
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');
const distInkShim = path.join(projectRoot, 'dist/ink-shim/index.js');
const srcInkShim = path.join(__dirname, 'ink-shim/index.ts');
const inkShimPath = pathToFileURL(
  fs.existsSync(distInkShim) ? distInkShim : srcInkShim
).href;

/**
 * Resolve hook - intercepts module resolution
 */
export async function resolve(specifier, context, nextResolve) {
  // Intercept 'ink' imports and redirect to our shim
  if (specifier === 'ink') {
    return {
      shortCircuit: true,
      url: inkShimPath,
    };
  }

  // Let Node.js handle everything else
  return nextResolve(specifier, context);
}
