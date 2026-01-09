/**
 * CLI WebSocket Reconciler Server
 *
 * This server renders the actual Gemini CLI's React components
 * using our WebSocket reconciler, allowing the CLI to run in a web browser.
 *
 * Key flow:
 * 1. Load CLI config and settings (same as CLI)
 * 2. Initialize the app (auth, extensions, etc.)
 * 3. Render AppContainer with our WebSocket reconciler
 * 4. Broadcast component tree to connected browsers
 * 5. Forward browser input back to CLI components
 */

import React from 'react';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, type WebSocket } from 'ws';

// Our reconciler and adapters
import { renderToWebSocket } from './reconciler/render.js';
import { setupInputHandler } from './reconciler/input-handler.js';
import { InkProvider, getMockStdout } from 'ink'; // This will resolve to our shim!

// CLI imports - these are the ACTUAL CLI components
import { AppContainer } from '@google/gemini-cli/dist/src/ui/AppContainer.js';
import { loadCliConfig } from '@google/gemini-cli/dist/src/config/config.js';
import { loadSettings } from '@google/gemini-cli/dist/src/config/settings.js';
import { initializeApp, type InitializationResult } from '@google/gemini-cli/dist/src/core/initializer.js';
import { SettingsContext } from '@google/gemini-cli/dist/src/ui/contexts/SettingsContext.js';
import { MouseProvider } from '@google/gemini-cli/dist/src/ui/contexts/MouseContext.js';
import { SessionStatsProvider } from '@google/gemini-cli/dist/src/ui/contexts/SessionContext.js';
import { VimModeProvider } from '@google/gemini-cli/dist/src/ui/contexts/VimModeContext.js';
import { KeypressProvider } from '@google/gemini-cli/dist/src/ui/contexts/KeypressContext.js';
import { ScrollProvider } from '@google/gemini-cli/dist/src/ui/contexts/ScrollProvider.js';
import { getVersion } from '@google/gemini-cli-core';
import type { LoadedSettings } from '@google/gemini-cli/dist/src/config/settings.js';
import type { Config } from '@google/gemini-cli-core';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

// ============================================
// Express Server Setup
// ============================================

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    mode: 'cli-reconciler',
    message: 'CLI WebSocket Reconciler Server',
  });
});

// ============================================
// App Wrapper Component
// ============================================

interface AppWrapperProps {
  config: Config;
  settings: LoadedSettings;
  version: string;
  initializationResult: InitializationResult;
}

/**
 * AppWrapper - Wraps AppContainer with all required context providers
 * This matches the structure from gemini.tsx
 */
function AppWrapper({ config, settings, version, initializationResult }: AppWrapperProps) {
  return (
    <InkProvider
      onExit={(error) => {
        console.log('[AppWrapper] Exit requested:', error?.message);
      }}
      onRerender={() => {
        console.log('[AppWrapper] Rerender requested');
      }}
    >
      <SettingsContext.Provider value={settings}>
        <KeypressProvider
          config={config}
          debugKeystrokeLogging={settings.merged.general?.debugKeystrokeLogging}
        >
          <MouseProvider
            mouseEventsEnabled={false} // Disable mouse events for web
            debugKeystrokeLogging={settings.merged.general?.debugKeystrokeLogging}
          >
            <ScrollProvider>
              <SessionStatsProvider>
                <VimModeProvider settings={settings}>
                  <AppContainer
                    config={config}
                    version={version}
                    initializationResult={initializationResult}
                  />
                </VimModeProvider>
              </SessionStatsProvider>
            </ScrollProvider>
          </MouseProvider>
        </KeypressProvider>
      </SettingsContext.Provider>
    </InkProvider>
  );
}

// ============================================
// Initialization and Startup
// ============================================

interface RenderInstance {
  update: (element: React.ReactElement) => void;
  unmount: () => void;
}

let renderInstance: RenderInstance | null = null;

async function startCLIReconciler(): Promise<RenderInstance> {
  console.log('[Server] Initializing CLI components...');

  // 1. Load config (same as CLI does)
  const workspaceRoot = process.cwd();
  console.log('[Server] Workspace root:', workspaceRoot);

  const config = await loadCliConfig(workspaceRoot);
  console.log('[Server] Config loaded');

  // 2. Load settings
  const settings = await loadSettings(config);
  console.log('[Server] Settings loaded');

  // 3. Initialize the app (auth, extensions, etc.)
  console.log('[Server] Initializing app...');
  const initializationResult = await initializeApp(config, settings);
  console.log('[Server] App initialized:', {
    authState: initializationResult.authState,
    hasExtensions: !!initializationResult.extensionManager,
  });

  // 4. Get version
  const version = await getVersion();
  console.log('[Server] Version:', version);

  // 5. Create the app wrapper element
  const appElement = React.createElement(AppWrapper, {
    config,
    settings,
    version,
    initializationResult,
  });

  // 6. Render with our WebSocket reconciler
  console.log('[Server] Starting WebSocket reconciler...');
  return renderToWebSocket(appElement, wss);
}

// ============================================
// WebSocket Connection Handling
// ============================================

wss.on('connection', (ws: WebSocket) => {
  console.log('[Server] Client connected');

  // Set up input handling for this connection
  setupInputHandler(ws);

  // Set initial terminal dimensions (browser will send actual size)
  const stdout = getMockStdout();
  stdout.setDimensions(120, 40);

  ws.on('close', () => {
    console.log('[Server] Client disconnected');
  });

  ws.on('error', (err) => {
    console.error('[Server] WebSocket error:', err);
  });
});

// ============================================
// Server Startup
// ============================================

async function main() {
  try {
    // Start the CLI reconciler
    renderInstance = await startCLIReconciler();
    console.log('[Server] CLI reconciler started');

    // Start the HTTP server
    server.listen(PORT, () => {
      console.log(`[Server] CLI Reconciler server listening on port ${PORT}`);
      console.log(`[Server] WebSocket available at ws://localhost:${PORT}/ws`);
      console.log('[Server] Open the web client to see the CLI');
    });
  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
}

// Handle shutdown
process.on('SIGINT', () => {
  console.log('[Server] Shutting down...');
  if (renderInstance) {
    renderInstance.unmount();
  }
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[Server] Received SIGTERM...');
  if (renderInstance) {
    renderInstance.unmount();
  }
  server.close();
  process.exit(0);
});

// Start the server
main();
