/**
 * WebSocket Reconciler Host Config
 *
 * A custom React reconciler that serializes the component tree to JSON
 * and broadcasts it over WebSocket, instead of rendering ANSI to terminal.
 */

import createReconciler from 'react-reconciler';
import { DefaultEventPriority } from 'react-reconciler/constants.js';
import { v4 as uuidv4 } from 'uuid';
import type { WSElement, WSTextNode, WSNode } from './types.js';

// Track current update priority for React 19 reconciler
let currentUpdatePriority = DefaultEventPriority;

// Global state for broadcasting
let rootNode: WSElement | null = null;
let broadcastCallback: ((root: WSElement | null) => void) | null = null;
let updateScheduled = false;

export function setBroadcastCallback(cb: (root: WSElement | null) => void) {
  broadcastCallback = cb;
}

function scheduleUpdate() {
  if (updateScheduled) return;
  updateScheduled = true;

  // Batch updates into single frame
  setImmediate(() => {
    updateScheduled = false;
    if (broadcastCallback && rootNode) {
      broadcastCallback(rootNode);
    }
  });
}

function createWSElement(type: string, props: Record<string, unknown>): WSElement {
  return {
    id: uuidv4(),
    type,
    inkProps: filterSerializableProps(props),
    children: [],
    parentId: null,
  };
}

function createWSTextNode(text: string): WSTextNode {
  return {
    id: uuidv4(),
    type: 'text',
    value: text,
    parentId: null,
  };
}

function filterSerializableProps(props: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    // Skip React internals and functions
    if (key === 'children' || key === 'ref' || key === 'key') continue;
    if (typeof value === 'function') continue;

    // Handle special Ink props
    if (key === 'style' && typeof value === 'object' && value !== null) {
      result[key] = value;
      continue;
    }

    // Only include serializable values
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null ||
      Array.isArray(value) ||
      (typeof value === 'object' && value !== null)
    ) {
      result[key] = value;
    }
  }
  return result;
}

function appendChild(parent: WSElement, child: WSNode) {
  child.parentId = parent.id;
  parent.children.push(child);
  scheduleUpdate();
}

function removeChild(parent: WSElement, child: WSNode) {
  const index = parent.children.findIndex(c => c.id === child.id);
  if (index !== -1) {
    parent.children.splice(index, 1);
  }
  scheduleUpdate();
}

function insertBefore(parent: WSElement, child: WSNode, beforeChild: WSNode) {
  child.parentId = parent.id;
  const index = parent.children.findIndex(c => c.id === beforeChild.id);
  if (index !== -1) {
    parent.children.splice(index, 0, child);
  } else {
    parent.children.push(child);
  }
  scheduleUpdate();
}

interface HostContext {
  isInsideText: boolean;
}

const hostConfig = {
  // Modes
  isPrimaryRenderer: true,
  supportsMutation: true,
  supportsPersistence: false,
  supportsHydration: false,

  // Scheduling
  scheduleTimeout: setTimeout,
  cancelTimeout: clearTimeout,
  noTimeout: -1,
  getCurrentEventPriority: () => currentUpdatePriority,
  setCurrentUpdatePriority: (priority: number) => {
    currentUpdatePriority = priority;
  },
  getCurrentUpdatePriority: () => currentUpdatePriority,
  resolveUpdatePriority: () => currentUpdatePriority || DefaultEventPriority,
  getInstanceFromNode: () => null,
  prepareScopeUpdate: () => {},
  getInstanceFromScope: () => null,
  beforeActiveInstanceBlur: () => {},
  afterActiveInstanceBlur: () => {},
  detachDeletedInstance: () => {},
  maySuspendCommit: () => false,
  preloadInstance: () => true,
  startSuspendingCommit: () => {},
  suspendInstance: () => {},
  waitForCommitToBeReady: () => null,
  NotPendingTransition: null,

  // React 19 timing methods
  resolveEventTimeStamp: () => Date.now(),
  resolveEventType: () => null,

  // Microtask scheduling
  scheduleMicrotask: (fn: () => void) => queueMicrotask(fn),

  // Transition tracing
  shouldAttemptEagerTransition: () => false,
  trackSchedulerEvent: () => {},
  resolveEventInfo: () => null,

  // Resource management
  requestPostPaintCallback: () => {},

  // Additional React 19 requirements
  resetFormInstance: () => {},

  // Context
  getRootHostContext: (): HostContext => ({
    isInsideText: false,
  }),

  getChildHostContext(parentContext: HostContext, type: string): HostContext {
    // Track if we're inside a text component (ink-text)
    const isInsideText = type === 'ink-text' || type === 'ink-virtual-text' || parentContext.isInsideText;
    if (parentContext.isInsideText === isInsideText) {
      return parentContext;
    }
    return { isInsideText };
  },

  // Instance creation
  createInstance(
    type: string,
    props: Record<string, unknown>,
    _rootContainer: unknown,
    _hostContext: HostContext
  ): WSElement {
    return createWSElement(type, props);
  },

  createTextInstance(
    text: string,
    _rootContainer: unknown,
    _hostContext: HostContext
  ): WSTextNode {
    return createWSTextNode(text);
  },

  shouldSetTextContent: () => false,

  // Tree mutations
  appendInitialChild: appendChild,
  appendChild,
  insertBefore,

  appendChildToContainer(container: WSElement, child: WSNode) {
    appendChild(container, child);
  },

  insertInContainerBefore(container: WSElement, child: WSNode, beforeChild: WSNode) {
    insertBefore(container, child, beforeChild);
  },

  removeChild,

  removeChildFromContainer(container: WSElement, child: WSNode) {
    removeChild(container, child);
  },

  // Updates
  prepareUpdate(
    _instance: WSElement,
    _type: string,
    oldProps: Record<string, unknown>,
    newProps: Record<string, unknown>
  ): Record<string, unknown> | null {
    // Return changed props
    const filteredOld = filterSerializableProps(oldProps);
    const filteredNew = filterSerializableProps(newProps);

    let hasChanges = false;
    const changes: Record<string, unknown> = {};

    for (const key of Object.keys(filteredNew)) {
      if (JSON.stringify(filteredNew[key]) !== JSON.stringify(filteredOld[key])) {
        hasChanges = true;
        changes[key] = filteredNew[key];
      }
    }

    for (const key of Object.keys(filteredOld)) {
      if (!(key in filteredNew)) {
        hasChanges = true;
        changes[key] = undefined;
      }
    }

    return hasChanges ? changes : null;
  },

  commitUpdate(
    instance: WSElement,
    updatePayload: Record<string, unknown>,
    _type: string,
    _oldProps: Record<string, unknown>,
    newProps: Record<string, unknown>
  ) {
    instance.props = filterSerializableProps(newProps);
    scheduleUpdate();
  },

  commitTextUpdate(textInstance: WSTextNode, _oldText: string, newText: string) {
    textInstance.value = newText;
    scheduleUpdate();
  },

  // Visibility
  hideInstance(instance: WSElement) {
    instance.inkProps['hidden'] = true;
    scheduleUpdate();
  },

  unhideInstance(instance: WSElement) {
    delete instance.inkProps['hidden'];
    scheduleUpdate();
  },

  hideTextInstance(instance: WSTextNode) {
    instance.value = '';
    scheduleUpdate();
  },

  unhideTextInstance(instance: WSTextNode, text: string) {
    instance.value = text;
    scheduleUpdate();
  },

  // Other required methods
  resetTextContent: () => {},
  finalizeInitialChildren: () => false,
  prepareForCommit: () => null,
  resetAfterCommit: () => {
    scheduleUpdate();
  },
  preparePortalMount: () => {},
  clearContainer: () => false,
  getPublicInstance: (instance: WSNode) => instance,
};

export const reconciler = createReconciler(hostConfig);

// Create and track root
export function createRoot(): WSElement {
  rootNode = createWSElement('ws-root', {});
  return rootNode;
}

export function getRoot(): WSElement | null {
  return rootNode;
}
