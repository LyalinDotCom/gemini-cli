/**
 * Types for WebSocket Reconciler
 */

export interface WSElement {
  id: string;
  type: string;
  // Use 'inkProps' to avoid collision with React's internal 'props' property
  inkProps: Record<string, unknown>;
  children: (WSElement | WSTextNode)[];
  parentId: string | null;
}

export interface WSTextNode {
  id: string;
  type: 'text';
  value: string;
  parentId: string | null;
}

export type WSNode = WSElement | WSTextNode;

export interface SerializedTree {
  root: WSElement | null;
  timestamp: number;
}

export interface RenderUpdate {
  type: 'render';
  tree: SerializedTree;
}

export interface PatchUpdate {
  type: 'patch';
  patches: Array<{
    op: 'add' | 'remove' | 'replace';
    path: string[];
    value?: unknown;
  }>;
}

export type WSMessage = RenderUpdate | PatchUpdate;
