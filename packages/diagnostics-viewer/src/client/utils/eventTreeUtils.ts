/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Diagnostic event interface matching the schema
 */
export interface DiagnosticEvent {
  meta: {
    sessionId: string;
    sequence: number;
    timestamp: string;
    category: string;
    eventType: string;
    version: number;
    // Agent hierarchy fields
    agentId?: string;
    parentAgentId?: string;
    depth?: number;
    turnNumber?: number;
    // Parallel execution fields
    parallelGroupId?: string;
    parallelIndex?: number;
  };
  timing?: {
    startedAt: string;
    endedAt?: string;
    durationMs?: number;
  };
  data: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Tree node for hierarchical event display
 */
export interface EventTreeNode {
  event: DiagnosticEvent;
  children: EventTreeNode[];
  agentId?: string;
  depth: number;
}

/**
 * Agent info for tracking agent lifecycle
 */
export interface AgentInfo {
  agentId: string;
  agentName: string;
  parentAgentId?: string;
  depth: number;
  startEvent?: DiagnosticEvent;
  endEvent?: DiagnosticEvent;
  events: DiagnosticEvent[];
  turns: TurnInfo[];
}

/**
 * Turn info for tracking agent turns
 */
export interface TurnInfo {
  turnNumber: number;
  startEvent?: DiagnosticEvent;
  endEvent?: DiagnosticEvent;
  events: DiagnosticEvent[];
}

/**
 * Parallel group info for concurrent execution tracking
 */
export interface ParallelGroupInfo {
  groupId: string;
  events: DiagnosticEvent[];
  startTime: Date;
  endTime?: Date;
}

/**
 * Extracts all unique agents from events
 */
export function extractAgents(
  events: DiagnosticEvent[],
): Map<string, AgentInfo> {
  const agents = new Map<string, AgentInfo>();

  for (const event of events) {
    const agentId = event.meta.agentId;
    if (!agentId) continue;

    if (!agents.has(agentId)) {
      const agentName =
        (event.data.agentName as string) || extractAgentName(agentId);
      agents.set(agentId, {
        agentId,
        agentName,
        parentAgentId: event.meta.parentAgentId,
        depth: event.meta.depth ?? 0,
        events: [],
        turns: [],
      });
    }

    const agentInfo = agents.get(agentId)!;
    agentInfo.events.push(event);

    // Track agent lifecycle events
    if (event.meta.category === 'agent') {
      if (event.meta.eventType === 'start') {
        agentInfo.startEvent = event;
      } else if (event.meta.eventType === 'end') {
        agentInfo.endEvent = event;
      } else if (event.meta.eventType === 'turn-start') {
        const turnNumber =
          event.meta.turnNumber ?? (event.data.turnNumber as number) ?? 0;
        let turnInfo = agentInfo.turns.find((t) => t.turnNumber === turnNumber);
        if (!turnInfo) {
          turnInfo = { turnNumber, events: [] };
          agentInfo.turns.push(turnInfo);
        }
        turnInfo.startEvent = event;
      } else if (event.meta.eventType === 'turn-end') {
        const turnNumber =
          event.meta.turnNumber ?? (event.data.turnNumber as number) ?? 0;
        let turnInfo = agentInfo.turns.find((t) => t.turnNumber === turnNumber);
        if (!turnInfo) {
          turnInfo = { turnNumber, events: [] };
          agentInfo.turns.push(turnInfo);
        }
        turnInfo.endEvent = event;
      }
    }

    // Add events to their respective turns
    const turnNumber = event.meta.turnNumber;
    if (turnNumber !== undefined) {
      let turnInfo = agentInfo.turns.find((t) => t.turnNumber === turnNumber);
      if (!turnInfo) {
        turnInfo = { turnNumber, events: [] };
        agentInfo.turns.push(turnInfo);
      }
      if (event.meta.category !== 'agent') {
        turnInfo.events.push(event);
      }
    }
  }

  // Sort turns by turn number
  for (const agentInfo of agents.values()) {
    agentInfo.turns.sort((a, b) => a.turnNumber - b.turnNumber);
  }

  return agents;
}

/**
 * Extract agent name from agentId
 */
export function extractAgentName(agentId: string): string {
  const parts = agentId.split('-');
  if (parts.length >= 2) {
    return parts[parts.length - 2];
  }
  return agentId;
}

/**
 * Extracts parallel execution groups from events
 */
export function extractParallelGroups(
  events: DiagnosticEvent[],
): Map<string, ParallelGroupInfo> {
  const groups = new Map<string, ParallelGroupInfo>();

  for (const event of events) {
    const groupId = event.meta.parallelGroupId;
    if (!groupId) continue;

    if (!groups.has(groupId)) {
      groups.set(groupId, {
        groupId,
        events: [],
        startTime: new Date(event.meta.timestamp),
      });
    }

    const groupInfo = groups.get(groupId)!;
    groupInfo.events.push(event);

    // Update end time
    const eventTime = new Date(event.meta.timestamp);
    if (!groupInfo.endTime || eventTime > groupInfo.endTime) {
      groupInfo.endTime = eventTime;
    }
  }

  // Sort events within each group by parallelIndex
  for (const group of groups.values()) {
    group.events.sort((a, b) => {
      const indexA = a.meta.parallelIndex ?? 0;
      const indexB = b.meta.parallelIndex ?? 0;
      return indexA - indexB;
    });
  }

  return groups;
}

/**
 * Builds a tree structure from flat events based on agent hierarchy
 */
export function buildEventTree(events: DiagnosticEvent[]): EventTreeNode[] {
  const agents = extractAgents(events);
  const rootNodes: EventTreeNode[] = [];

  // First, build nodes for top-level agents
  for (const agentInfo of agents.values()) {
    if (!agentInfo.parentAgentId) {
      const agentNode = buildAgentNode(agentInfo, agents);
      rootNodes.push(agentNode);
    }
  }

  // Handle events without agentId
  const orphanEvents = events.filter((e) => !e.meta.agentId);
  for (const event of orphanEvents) {
    rootNodes.push({
      event,
      children: [],
      depth: 0,
    });
  }

  // Sort root nodes by timestamp
  rootNodes.sort(
    (a, b) =>
      new Date(a.event.meta.timestamp).getTime() -
      new Date(b.event.meta.timestamp).getTime(),
  );

  return rootNodes;
}

/**
 * Builds a tree node for an agent and its children
 */
function buildAgentNode(
  agentInfo: AgentInfo,
  allAgents: Map<string, AgentInfo>,
): EventTreeNode {
  const rootEvent = agentInfo.startEvent || agentInfo.events[0];
  const children: EventTreeNode[] = [];

  // Add child agents
  for (const childAgent of allAgents.values()) {
    if (childAgent.parentAgentId === agentInfo.agentId) {
      children.push(buildAgentNode(childAgent, allAgents));
    }
  }

  // Add non-agent events as children (grouped by turn if available)
  const eventsByTurn = new Map<number, DiagnosticEvent[]>();
  const eventsWithoutTurn: DiagnosticEvent[] = [];

  for (const event of agentInfo.events) {
    if (event.meta.category === 'agent') continue;
    const turnNumber = event.meta.turnNumber;
    if (turnNumber !== undefined) {
      if (!eventsByTurn.has(turnNumber)) {
        eventsByTurn.set(turnNumber, []);
      }
      eventsByTurn.get(turnNumber)!.push(event);
    } else {
      eventsWithoutTurn.push(event);
    }
  }

  // Add events without turn
  for (const event of eventsWithoutTurn) {
    children.push({
      event,
      children: [],
      agentId: agentInfo.agentId,
      depth: agentInfo.depth + 1,
    });
  }

  // Sort children by timestamp
  children.sort(
    (a, b) =>
      new Date(a.event.meta.timestamp).getTime() -
      new Date(b.event.meta.timestamp).getTime(),
  );

  return {
    event: rootEvent,
    children,
    agentId: agentInfo.agentId,
    depth: agentInfo.depth,
  };
}

/**
 * Filters events by agent
 */
export function filterEventsByAgent(
  events: DiagnosticEvent[],
  agentId: string | null,
): DiagnosticEvent[] {
  if (!agentId) return events;
  return events.filter((e) => e.meta.agentId === agentId);
}

/**
 * Gets all unique agent IDs from events
 */
export function getUniqueAgentIds(events: DiagnosticEvent[]): string[] {
  const agentIds = new Set<string>();
  for (const event of events) {
    if (event.meta.agentId) {
      agentIds.add(event.meta.agentId);
    }
  }
  return Array.from(agentIds);
}

/**
 * Calculates agent metrics from events
 */
export interface AgentMetrics {
  agentId: string;
  agentName: string;
  totalEvents: number;
  totalTurns: number;
  apiRequests: number;
  toolCalls: number;
  errors: number;
  durationMs?: number;
}

export function calculateAgentMetrics(
  events: DiagnosticEvent[],
): AgentMetrics[] {
  const agents = extractAgents(events);
  const metrics: AgentMetrics[] = [];

  for (const agentInfo of agents.values()) {
    let durationMs: number | undefined;
    if (agentInfo.startEvent && agentInfo.endEvent) {
      const startTime = new Date(agentInfo.startEvent.meta.timestamp).getTime();
      const endTime = new Date(agentInfo.endEvent.meta.timestamp).getTime();
      durationMs = endTime - startTime;
    }

    metrics.push({
      agentId: agentInfo.agentId,
      agentName: agentInfo.agentName,
      totalEvents: agentInfo.events.length,
      totalTurns: agentInfo.turns.length,
      apiRequests: agentInfo.events.filter((e) => e.meta.category === 'api')
        .length,
      toolCalls: agentInfo.events.filter((e) => e.meta.category === 'tool')
        .length,
      errors: agentInfo.events.filter((e) => e.error).length,
      durationMs,
    });
  }

  return metrics;
}
