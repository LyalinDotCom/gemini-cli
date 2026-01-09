/**
 * Register ESM Loader
 *
 * This file is used with --import to register our custom loader
 * that intercepts 'ink' imports.
 */

import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('./ink-loader.mjs', pathToFileURL(import.meta.url));
