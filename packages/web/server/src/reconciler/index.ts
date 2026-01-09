/**
 * WebSocket Reconciler Module
 *
 * A custom React reconciler that serializes the component tree to JSON
 * and broadcasts it over WebSocket, enabling the same React components
 * to run on the server and be rendered in a web browser.
 */

export * from './types.js';
export * from './host-config.js';
export * from './broadcaster.js';
export * from './ink-adapters.js';
export * from './input-handler.js';
export { renderToWebSocket, startTestRender } from './render.js';
export { InkProvider } from './ink-provider.js';
