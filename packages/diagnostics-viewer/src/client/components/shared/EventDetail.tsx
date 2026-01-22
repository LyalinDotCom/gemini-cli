/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';

interface DiagnosticEvent {
  meta: {
    sessionId: string;
    sequence: number;
    timestamp: string;
    category: string;
    eventType: string;
    version: number;
  };
  timing?: { startedAt: string; endedAt?: string; durationMs?: number };
  data: Record<string, unknown>;
  error?: { name: string; message: string; stack?: string };
}
interface EventDetailProps {
  event: DiagnosticEvent;
  onClose: () => void;
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* Clipboard API may fail silently */
        }
      }}
      style={{
        padding: '6px 12px',
        border: `1px solid ${copied ? '#3fb950' : '#58a6ff'}`,
        borderRadius: '6px',
        background: copied ? '#3fb95020' : '#58a6ff20',
        color: copied ? '#3fb950' : '#58a6ff',
        fontSize: '12px',
        cursor: 'pointer',
      }}
    >
      {copied ? 'Copied!' : label || 'Copy'}
    </button>
  );
}

function extractPromptText(contents: unknown): string {
  if (!Array.isArray(contents)) return '';
  return contents
    .flatMap(
      (c: { parts?: Array<{ text?: string }> }) =>
        c.parts?.map((p) => p.text).filter(Boolean) || [],
    )
    .join('\n\n---\n\n');
}

function extractTextFromParts(obj: unknown): string {
  if (!obj || typeof obj !== 'object') return '';
  const o = obj as Record<string, unknown>;

  // Direct text property
  if (typeof o.text === 'string') return o.text;

  // Parts array (Gemini API format)
  if (Array.isArray(o.parts)) {
    return o.parts
      .map((p: { text?: string }) => p.text || '')
      .filter(Boolean)
      .join('\n');
  }

  // If it's an array directly (e.g., systemInstruction could be an array of parts)
  if (Array.isArray(obj)) {
    return obj
      .map((item) => extractTextFromParts(item))
      .filter(Boolean)
      .join('\n');
  }

  // Nested content
  if (o.content) return extractTextFromParts(o.content);

  // Role-based content (e.g., { role: "system", parts: [...] })
  if (o.role && o.parts) {
    return extractTextFromParts({ parts: o.parts });
  }

  return '';
}

interface SystemInstructionInfo {
  text: string;
  raw: unknown;
  sources: Array<{ name: string; type: string; content?: string }>;
}

function findSystemInstruction(
  data: Record<string, unknown>,
): SystemInstructionInfo | null {
  let text = '';
  let raw: unknown = null;

  // Check various locations for system instruction
  const paths = [
    'systemInstruction',
    'config.systemInstruction',
    'generate_content_config.systemInstruction',
    'system_instruction',
    'generationConfig.systemInstruction',
  ];

  for (const key of paths) {
    const parts = key.split('.');
    let val: unknown = data;
    for (const p of parts) {
      if (val && typeof val === 'object')
        val = (val as Record<string, unknown>)[p];
      else val = undefined;
    }
    if (val) {
      const extractedText = extractTextFromParts(val);
      if (extractedText) {
        text = extractedText;
        raw = val;
        break;
      }
      // If extractTextFromParts returns empty but val exists, try to get raw text
      if (!text && val) {
        // Try to stringify and extract if it's an object with content
        const valObj = val as Record<string, unknown>;
        if (valObj.parts && Array.isArray(valObj.parts)) {
          const partsText = valObj.parts
            .map((p: Record<string, unknown>) => {
              if (typeof p.text === 'string') return p.text;
              return '';
            })
            .filter(Boolean)
            .join('\n');
          if (partsText) {
            text = partsText;
            raw = val;
            break;
          }
        }
      }
    }
  }

  // Also check contents for system role
  if (!text && Array.isArray(data.contents)) {
    for (const c of data.contents) {
      if (c?.role === 'system' || c?.role === 'SYSTEM') {
        const extractedText = extractTextFromParts(c);
        if (extractedText) {
          text = extractedText;
          raw = c;
          break;
        }
      }
    }
  }

  // Last resort: if systemInstruction exists but we couldn't parse it, show raw
  if (!text) {
    for (const key of paths) {
      const parts = key.split('.');
      let val: unknown = data;
      for (const p of parts) {
        if (val && typeof val === 'object')
          val = (val as Record<string, unknown>)[p];
        else val = undefined;
      }
      if (val) {
        // Just stringify it as a fallback
        raw = val;
        text = typeof val === 'string' ? val : JSON.stringify(val, null, 2);
        break;
      }
    }
  }

  if (!text) return null;

  // Parse sources from the system instruction text
  // Look for common markers like "From GEMINI.md:", file paths, or source annotations
  const sources: Array<{ name: string; type: string; content?: string }> = [];

  // Try to extract individual sources from common patterns
  const sourcePatterns = [
    // Look for GEMINI.md file markers
    /(?:^|\n)(?:#+\s*)?(?:From\s+)?([^\n]*GEMINI\.md[^\n]*)/gi,
    // Look for file paths
    /(?:^|\n)(?:Source|File|From):\s*([^\n]+)/gi,
    // Look for MCP server markers
    /(?:^|\n)(?:MCP Server|MCP|Extension):\s*([^\n]+)/gi,
  ];

  for (const pattern of sourcePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const sourceName = match[1].trim();
      if (sourceName && !sources.find((s) => s.name === sourceName)) {
        const isGeminiMd = /gemini\.md/i.test(sourceName);
        const isMcp = /mcp/i.test(sourceName);
        sources.push({
          name: sourceName,
          type: isMcp ? 'mcp' : isGeminiMd ? 'gemini.md' : 'file',
        });
      }
    }
  }

  // Also check for structured sources in the data
  const dataSourcesLocations = [
    'sources',
    'config.sources',
    'systemInstructionSources',
    'geminiMdSources',
  ];
  for (const loc of dataSourcesLocations) {
    const parts = loc.split('.');
    let val: unknown = data;
    for (const p of parts) {
      if (val && typeof val === 'object')
        val = (val as Record<string, unknown>)[p];
      else val = undefined;
    }
    if (Array.isArray(val)) {
      for (const item of val) {
        if (typeof item === 'string') {
          if (!sources.find((s) => s.name === item)) {
            sources.push({ name: item, type: 'file' });
          }
        } else if (item && typeof item === 'object') {
          const name =
            (item as Record<string, unknown>).name ||
            (item as Record<string, unknown>).path ||
            (item as Record<string, unknown>).source;
          if (name && typeof name === 'string') {
            if (!sources.find((s) => s.name === name)) {
              sources.push({
                name,
                type: String((item as Record<string, unknown>).type || 'file'),
                content: (item as Record<string, unknown>).content as
                  | string
                  | undefined,
              });
            }
          }
        }
      }
    }
  }

  return { text, raw, sources };
}

interface ContextSource {
  name: string;
  type: 'core' | 'gemini-md' | 'mcp' | 'session' | 'other';
  chars: number;
  content?: string;
}

interface ContextMetrics {
  systemInstructionChars: number;
  contentsCount: number;
  contentsChars: number;
  toolsCount: number;
  toolsChars: number;
  totalChars: number;
  tools: Array<{ name: string; description?: string }>;
  sources: ContextSource[];
  promptTokens?: number;
  responseTokens?: number;
  totalTokens?: number;
}

function parseSystemInstructionSources(text: string): ContextSource[] {
  const sources: ContextSource[] = [];

  // Pattern 1: Look for file paths with GEMINI.md (various formats)
  // Matches: "../../../.gemini/GEMINI.md", "nanobanana/GEMINI.md", etc.
  const filePathPatterns = [
    // Path followed by content section
    /(?:^|\n)(?:#{1,4}\s*)?(?:From\s+|File:\s*|Source:\s*)?([^\n]*?(?:\/[^\n/]+)?\/(?:GEMINI|gemini)\.md)(?:\s*\n)([\s\S]*?)(?=(?:\n#{1,4}\s+(?:From|File|Source)|The following are instructions|$))/gi,
    // Just path references
    /(?:^|\n)([^\s\n]*\/(?:GEMINI|gemini)\.md)/gi,
    // Extension .md files
    /(?:^|\n)(?:#{1,4}\s*)?(?:From\s+)?([^\n]*?\/[^\n/]+\.md)(?:\s*\n)([\s\S]*?)(?=(?:\n#{1,4}\s+|The following are instructions|$))/gi,
  ];

  // Extract GEMINI.md and other .md files
  const seenPaths = new Set<string>();
  for (const pattern of filePathPatterns) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text)) !== null) {
      const path = match[1]?.trim();
      const content = match[2]?.trim() || '';
      if (path && !seenPaths.has(path)) {
        seenPaths.add(path);
        // Estimate content size if we captured it, otherwise estimate from position
        const charCount = content.length > 0 ? content.length : 500; // fallback estimate
        sources.push({
          name: path,
          type: path.toLowerCase().includes('gemini.md')
            ? 'gemini-md'
            : 'other',
          chars: charCount,
          content: content.slice(0, 500) + (content.length > 500 ? '...' : ''),
        });
      }
    }
  }

  // Pattern 2: MCP server instruction blocks
  const mcpServerPattern =
    /The following are instructions provided by the tool server '([^']+)':\s*\n---\[start of server instructions\]---\n([\s\S]*?)\n---\[end of server instructions\]---/gi;
  let mcpMatch;
  while ((mcpMatch = mcpServerPattern.exec(text)) !== null) {
    const serverName = mcpMatch[1];
    const content = mcpMatch[2]?.trim() || '';
    sources.push({
      name: `MCP: ${serverName}`,
      type: 'mcp',
      chars: content.length,
      content: content.slice(0, 500) + (content.length > 500 ? '...' : ''),
    });
  }

  // Pattern 3: Look for "Personal Context" or "User Summary" sections
  const personalContextPattern =
    /(?:Personal Context|User Summary|User Profile)[\s\S]*?(?=\n#{1,3}\s|The following are|$)/gi;
  let personalMatch;
  while ((personalMatch = personalContextPattern.exec(text)) !== null) {
    const content = personalMatch[0].trim();
    if (
      content.length > 50 &&
      !sources.find((s) => s.name.includes('Personal'))
    ) {
      sources.push({
        name: 'Personal Context',
        type: 'session',
        chars: content.length,
        content: content.slice(0, 500) + (content.length > 500 ? '...' : ''),
      });
    }
  }

  // Pattern 4: Core system instruction (if identifiable)
  const corePatterns = [
    /^(You are [^\n]+[\s\S]*?)(?=\n#{1,3}\s|The following are|Personal Context|$)/i,
    /^(# [^\n]+[\s\S]*?)(?=\n#{1,3}\s+From|The following are|$)/i,
  ];
  for (const pattern of corePatterns) {
    const coreMatch = pattern.exec(text);
    if (
      coreMatch &&
      coreMatch[1].length > 200 &&
      !sources.find((s) => s.type === 'core')
    ) {
      sources.push({
        name: 'Core System Instructions',
        type: 'core',
        chars: coreMatch[1].length,
      });
      break;
    }
  }

  // Sort by size descending
  sources.sort((a, b) => b.chars - a.chars);

  return sources;
}

function calculateContextMetrics(
  data: Record<string, unknown>,
): ContextMetrics {
  // System instruction size
  let systemInstructionChars = 0;
  let systemInstructionText = '';
  const systemInstruction =
    data.systemInstruction ||
    (data.config as Record<string, unknown> | undefined)?.systemInstruction ||
    (data.generate_content_config as Record<string, unknown> | undefined)
      ?.systemInstruction;
  if (systemInstruction) {
    systemInstructionChars = JSON.stringify(systemInstruction).length;
    systemInstructionText = extractTextFromParts(systemInstruction);
  }

  // Parse sources from system instruction
  const sources = parseSystemInstructionSources(systemInstructionText);

  // Contents (conversation history)
  let contentsCount = 0;
  let contentsChars = 0;
  const contents = data.contents as unknown[] | undefined;
  if (Array.isArray(contents)) {
    contentsCount = contents.length;
    contentsChars = JSON.stringify(contents).length;
  }

  // Tools
  let toolsCount = 0;
  let toolsChars = 0;
  const toolsList: Array<{ name: string; description?: string }> = [];
  const tools = data.tools as
    | Array<{
        functionDeclarations?: Array<{ name: string; description?: string }>;
      }>
    | undefined;
  if (Array.isArray(tools)) {
    for (const toolGroup of tools) {
      if (toolGroup.functionDeclarations) {
        for (const fn of toolGroup.functionDeclarations) {
          toolsList.push({ name: fn.name, description: fn.description });
          toolsCount++;
        }
      }
    }
    toolsChars = JSON.stringify(tools).length;
  }

  // Token usage
  const usage = data.usageMetadata as
    | {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      }
    | undefined;

  const totalChars = systemInstructionChars + contentsChars + toolsChars;

  return {
    systemInstructionChars,
    contentsCount,
    contentsChars,
    toolsCount,
    toolsChars,
    totalChars,
    tools: toolsList,
    sources,
    promptTokens: usage?.promptTokenCount,
    responseTokens: usage?.candidatesTokenCount,
    totalTokens: usage?.totalTokenCount,
  };
}

function ApiEventView({ event }: { event: DiagnosticEvent }) {
  const [section, setSection] = useState<
    'context' | 'system' | 'sources' | 'prompt' | 'response' | 'full' | 'raw'
  >('context');
  const [expandedSource, setExpandedSource] = useState<number | null>(null);
  const [showAllTools, setShowAllTools] = useState(false);
  const { data } = event;
  const systemInfo = findSystemInstruction(data);
  const promptText = extractPromptText(data.contents);
  const contextMetrics = calculateContextMetrics(data);
  const candidates = data.candidates as
    | Array<{ content?: { parts?: Array<{ text?: string }> } }>
    | undefined;
  const responseText =
    candidates
      ?.flatMap((c) => c.content?.parts?.map((p) => p.text) || [])
      .filter(Boolean)
      .join('\n') || '';
  const usage = data.usageMetadata as
    | {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      }
    | undefined;
  const isResponse = event.meta.eventType === 'response' || !!candidates;

  const Tab = ({ id, label }: { id: typeof section; label: string }) => (
    <button
      onClick={() => setSection(id)}
      style={{
        padding: '8px 16px',
        border: 'none',
        borderRadius: '6px',
        background: section === id ? '#21262d' : 'transparent',
        color: section === id ? '#f0f6fc' : '#8b949e',
        fontSize: '13px',
        cursor: 'pointer',
        fontWeight: 500,
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #30363d',
          background: '#0d1117',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '8px',
          }}
        >
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#58a6ff' }}>
            {String(data.modelVersion || data.model || 'Unknown Model')}
          </span>
          {data.promptId && (
            <span
              style={{
                fontSize: '11px',
                color: '#8b949e',
                fontFamily: 'monospace',
              }}
            >
              ID: {String(data.promptId)}
            </span>
          )}
          {event.timing?.durationMs && (
            <span
              style={{
                fontSize: '12px',
                color: '#3fb950',
                fontFamily: 'monospace',
              }}
            >
              {event.timing.durationMs}ms
            </span>
          )}
        </div>
        {usage && (
          <div
            style={{
              display: 'flex',
              gap: '16px',
              fontSize: '12px',
              color: '#8b949e',
            }}
          >
            {usage.promptTokenCount && (
              <span>Prompt: {usage.promptTokenCount}</span>
            )}
            {usage.candidatesTokenCount && (
              <span>Response: {usage.candidatesTokenCount}</span>
            )}
            {usage.totalTokenCount && (
              <span style={{ color: '#f0f6fc', fontWeight: 500 }}>
                Total: {usage.totalTokenCount}
              </span>
            )}
          </div>
        )}
      </div>
      <div
        style={{
          display: 'flex',
          gap: '4px',
          padding: '8px 16px',
          borderBottom: '1px solid #30363d',
        }}
      >
        <Tab id="context" label="Context" />
        <Tab id="system" label={systemInfo ? 'System' : 'System (none)'} />
        {systemInfo && systemInfo.sources.length > 0 && (
          <Tab id="sources" label={`Sources (${systemInfo.sources.length})`} />
        )}
        <Tab id="prompt" label="Prompt" />
        {isResponse && <Tab id="response" label="Response" />}
        <Tab id="full" label="Full Data" />
        <Tab id="raw" label="Raw JSON" />
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {section === 'context' && (
          <>
            <div style={{ marginBottom: '16px' }}>
              <span
                style={{ fontSize: '14px', fontWeight: 600, color: '#f0f6fc' }}
              >
                Context Size Breakdown
              </span>
            </div>

            {/* Token usage - shown if available */}
            {contextMetrics.promptTokens && (
              <div
                style={{
                  display: 'flex',
                  gap: '24px',
                  padding: '12px 16px',
                  background: '#0d1117',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  border: '1px solid #30363d',
                }}
              >
                <div>
                  <span style={{ fontSize: '11px', color: '#8b949e' }}>
                    PROMPT TOKENS
                  </span>
                  <div
                    style={{
                      fontSize: '20px',
                      fontWeight: 600,
                      color: '#58a6ff',
                    }}
                  >
                    {contextMetrics.promptTokens?.toLocaleString()}
                  </div>
                </div>
                {contextMetrics.responseTokens && (
                  <div>
                    <span style={{ fontSize: '11px', color: '#8b949e' }}>
                      RESPONSE TOKENS
                    </span>
                    <div
                      style={{
                        fontSize: '20px',
                        fontWeight: 600,
                        color: '#3fb950',
                      }}
                    >
                      {contextMetrics.responseTokens?.toLocaleString()}
                    </div>
                  </div>
                )}
                {contextMetrics.totalTokens && (
                  <div>
                    <span style={{ fontSize: '11px', color: '#8b949e' }}>
                      TOTAL TOKENS
                    </span>
                    <div
                      style={{
                        fontSize: '20px',
                        fontWeight: 600,
                        color: '#f0f6fc',
                      }}
                    >
                      {contextMetrics.totalTokens?.toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Summary stats */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: '12px',
                marginBottom: '24px',
              }}
            >
              <div
                style={{
                  padding: '16px',
                  background: '#0d1117',
                  borderRadius: '8px',
                  textAlign: 'center',
                  border: '1px solid #30363d',
                }}
              >
                <div
                  style={{
                    fontSize: '24px',
                    fontWeight: 700,
                    color: '#f0f6fc',
                  }}
                >
                  {(contextMetrics.totalChars / 1000).toFixed(1)}k
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: '#8b949e',
                    marginTop: '4px',
                  }}
                >
                  TOTAL CHARS
                </div>
              </div>
              <div
                style={{
                  padding: '16px',
                  background: '#0d1117',
                  borderRadius: '8px',
                  textAlign: 'center',
                  border: '1px solid #30363d',
                }}
              >
                <div
                  style={{
                    fontSize: '24px',
                    fontWeight: 700,
                    color: '#58a6ff',
                  }}
                >
                  {(contextMetrics.systemInstructionChars / 1000).toFixed(1)}k
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: '#8b949e',
                    marginTop: '4px',
                  }}
                >
                  SYSTEM INSTR
                </div>
              </div>
              <div
                style={{
                  padding: '16px',
                  background: '#0d1117',
                  borderRadius: '8px',
                  textAlign: 'center',
                  border: '1px solid #30363d',
                }}
              >
                <div
                  style={{
                    fontSize: '24px',
                    fontWeight: 700,
                    color: '#3fb950',
                  }}
                >
                  {
                    contextMetrics.sources.filter((s) => s.type === 'gemini-md')
                      .length
                  }
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: '#8b949e',
                    marginTop: '4px',
                  }}
                >
                  MD FILES
                </div>
              </div>
              <div
                style={{
                  padding: '16px',
                  background: '#0d1117',
                  borderRadius: '8px',
                  textAlign: 'center',
                  border: '1px solid #30363d',
                }}
              >
                <div
                  style={{
                    fontSize: '24px',
                    fontWeight: 700,
                    color: '#a371f7',
                  }}
                >
                  {
                    contextMetrics.sources.filter((s) => s.type === 'mcp')
                      .length
                  }
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: '#8b949e',
                    marginTop: '4px',
                  }}
                >
                  MCP SERVERS
                </div>
              </div>
              <div
                style={{
                  padding: '16px',
                  background: '#0d1117',
                  borderRadius: '8px',
                  textAlign: 'center',
                  border: '1px solid #30363d',
                }}
              >
                <div
                  style={{
                    fontSize: '24px',
                    fontWeight: 700,
                    color: '#f85149',
                  }}
                >
                  {contextMetrics.toolsCount}
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: '#8b949e',
                    marginTop: '4px',
                  }}
                >
                  TOOLS
                </div>
              </div>
            </div>

            {/* Bar chart visualization */}
            <div style={{ marginBottom: '24px' }}>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#c9d1d9',
                  marginBottom: '12px',
                }}
              >
                Context Composition
              </div>
              <div
                style={{
                  display: 'flex',
                  height: '32px',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  background: '#21262d',
                }}
              >
                {contextMetrics.systemInstructionChars > 0 && (
                  <div
                    style={{
                      width: `${(contextMetrics.systemInstructionChars / contextMetrics.totalChars) * 100}%`,
                      background: '#58a6ff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      color: '#fff',
                      fontWeight: 500,
                      minWidth: '40px',
                    }}
                    title={`System: ${contextMetrics.systemInstructionChars.toLocaleString()} chars`}
                  >
                    {Math.round(
                      (contextMetrics.systemInstructionChars /
                        contextMetrics.totalChars) *
                        100,
                    )}
                    %
                  </div>
                )}
                {contextMetrics.contentsChars > 0 && (
                  <div
                    style={{
                      width: `${(contextMetrics.contentsChars / contextMetrics.totalChars) * 100}%`,
                      background: '#3fb950',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      color: '#fff',
                      fontWeight: 500,
                      minWidth: '40px',
                    }}
                    title={`Contents: ${contextMetrics.contentsChars.toLocaleString()} chars`}
                  >
                    {Math.round(
                      (contextMetrics.contentsChars /
                        contextMetrics.totalChars) *
                        100,
                    )}
                    %
                  </div>
                )}
                {contextMetrics.toolsChars > 0 && (
                  <div
                    style={{
                      width: `${(contextMetrics.toolsChars / contextMetrics.totalChars) * 100}%`,
                      background: '#a371f7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      color: '#fff',
                      fontWeight: 500,
                      minWidth: '40px',
                    }}
                    title={`Tools: ${contextMetrics.toolsChars.toLocaleString()} chars`}
                  >
                    {Math.round(
                      (contextMetrics.toolsChars / contextMetrics.totalChars) *
                        100,
                    )}
                    %
                  </div>
                )}
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: '16px',
                  marginTop: '8px',
                  fontSize: '11px',
                }}
              >
                <span style={{ color: '#58a6ff' }}>● System Instruction</span>
                <span style={{ color: '#3fb950' }}>● Contents</span>
                <span style={{ color: '#a371f7' }}>● Tools</span>
              </div>
            </div>

            {/* Detailed breakdown */}
            <div style={{ marginBottom: '24px' }}>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#c9d1d9',
                  marginBottom: '12px',
                }}
              >
                Detailed Breakdown
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #30363d' }}>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '8px 0',
                        fontSize: '12px',
                        color: '#8b949e',
                        fontWeight: 500,
                      }}
                    >
                      Component
                    </th>
                    <th
                      style={{
                        textAlign: 'right',
                        padding: '8px 0',
                        fontSize: '12px',
                        color: '#8b949e',
                        fontWeight: 500,
                      }}
                    >
                      Size
                    </th>
                    <th
                      style={{
                        textAlign: 'right',
                        padding: '8px 0',
                        fontSize: '12px',
                        color: '#8b949e',
                        fontWeight: 500,
                      }}
                    >
                      %
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #21262d' }}>
                    <td
                      style={{
                        padding: '10px 0',
                        fontSize: '13px',
                        color: '#58a6ff',
                      }}
                    >
                      System Instruction
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        padding: '10px 0',
                        fontSize: '13px',
                        color: '#c9d1d9',
                        fontFamily: 'monospace',
                      }}
                    >
                      {contextMetrics.systemInstructionChars.toLocaleString()}{' '}
                      chars
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        padding: '10px 0',
                        fontSize: '13px',
                        color: '#8b949e',
                        fontFamily: 'monospace',
                      }}
                    >
                      {contextMetrics.totalChars > 0
                        ? Math.round(
                            (contextMetrics.systemInstructionChars /
                              contextMetrics.totalChars) *
                              100,
                          )
                        : 0}
                      %
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #21262d' }}>
                    <td
                      style={{
                        padding: '10px 0',
                        fontSize: '13px',
                        color: '#3fb950',
                      }}
                    >
                      Contents ({contextMetrics.contentsCount} messages)
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        padding: '10px 0',
                        fontSize: '13px',
                        color: '#c9d1d9',
                        fontFamily: 'monospace',
                      }}
                    >
                      {contextMetrics.contentsChars.toLocaleString()} chars
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        padding: '10px 0',
                        fontSize: '13px',
                        color: '#8b949e',
                        fontFamily: 'monospace',
                      }}
                    >
                      {contextMetrics.totalChars > 0
                        ? Math.round(
                            (contextMetrics.contentsChars /
                              contextMetrics.totalChars) *
                              100,
                          )
                        : 0}
                      %
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #21262d' }}>
                    <td
                      style={{
                        padding: '10px 0',
                        fontSize: '13px',
                        color: '#a371f7',
                      }}
                    >
                      Tools ({contextMetrics.toolsCount} functions)
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        padding: '10px 0',
                        fontSize: '13px',
                        color: '#c9d1d9',
                        fontFamily: 'monospace',
                      }}
                    >
                      {contextMetrics.toolsChars.toLocaleString()} chars
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        padding: '10px 0',
                        fontSize: '13px',
                        color: '#8b949e',
                        fontFamily: 'monospace',
                      }}
                    >
                      {contextMetrics.totalChars > 0
                        ? Math.round(
                            (contextMetrics.toolsChars /
                              contextMetrics.totalChars) *
                              100,
                          )
                        : 0}
                      %
                    </td>
                  </tr>
                  <tr>
                    <td
                      style={{
                        padding: '10px 0',
                        fontSize: '13px',
                        color: '#f0f6fc',
                        fontWeight: 600,
                      }}
                    >
                      Total
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        padding: '10px 0',
                        fontSize: '13px',
                        color: '#f0f6fc',
                        fontFamily: 'monospace',
                        fontWeight: 600,
                      }}
                    >
                      {contextMetrics.totalChars.toLocaleString()} chars
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        padding: '10px 0',
                        fontSize: '13px',
                        color: '#f0f6fc',
                        fontFamily: 'monospace',
                        fontWeight: 600,
                      }}
                    >
                      100%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Sources breakdown */}
            {contextMetrics.sources.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#c9d1d9',
                    marginBottom: '12px',
                  }}
                >
                  System Instruction Sources ({contextMetrics.sources.length}{' '}
                  files)
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  {contextMetrics.sources.map((source, idx) => {
                    const isExpanded = expandedSource === idx;
                    const pct =
                      contextMetrics.systemInstructionChars > 0
                        ? Math.round(
                            (source.chars /
                              contextMetrics.systemInstructionChars) *
                              100,
                          )
                        : 0;
                    const typeColors: Record<string, string> = {
                      'gemini-md': '#3fb950',
                      mcp: '#a371f7',
                      core: '#58a6ff',
                      session: '#f0883e',
                      other: '#8b949e',
                    };
                    const color = typeColors[source.type] || '#8b949e';

                    return (
                      <div
                        key={idx}
                        style={{
                          padding: '12px',
                          background: '#0d1117',
                          borderRadius: '6px',
                          border: `1px solid ${isExpanded ? color : '#30363d'}`,
                          cursor: source.content ? 'pointer' : 'default',
                        }}
                        onClick={() =>
                          source.content &&
                          setExpandedSource(isExpanded ? null : idx)
                        }
                        title={source.name}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '4px',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              flex: 1,
                              minWidth: 0,
                            }}
                          >
                            <span
                              style={{
                                fontSize: '10px',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: color + '20',
                                color,
                                textTransform: 'uppercase',
                                fontWeight: 600,
                                flexShrink: 0,
                              }}
                            >
                              {source.type}
                            </span>
                            <span
                              style={{
                                fontSize: '12px',
                                color: '#c9d1d9',
                                fontFamily: 'monospace',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={source.name}
                            >
                              {source.name}
                            </span>
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              flexShrink: 0,
                            }}
                          >
                            <span
                              style={{
                                fontSize: '12px',
                                color,
                                fontFamily: 'monospace',
                                fontWeight: 600,
                              }}
                            >
                              {pct}%
                            </span>
                            <span
                              style={{
                                fontSize: '11px',
                                color: '#8b949e',
                                fontFamily: 'monospace',
                              }}
                            >
                              {source.chars.toLocaleString()} chars
                            </span>
                            {source.content && (
                              <span
                                style={{ fontSize: '12px', color: '#8b949e' }}
                              >
                                {isExpanded ? '▼' : '▶'}
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Progress bar showing proportion of system instruction */}
                        <div
                          style={{
                            height: '6px',
                            background: '#21262d',
                            borderRadius: '3px',
                            overflow: 'hidden',
                            marginTop: '8px',
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(100, pct)}%`,
                              height: '100%',
                              background: color,
                              transition: 'width 0.3s',
                            }}
                          />
                        </div>
                        {/* Expanded content */}
                        {isExpanded && source.content && (
                          <div style={{ marginTop: '12px' }}>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '8px',
                              }}
                            >
                              <span
                                style={{ fontSize: '11px', color: '#8b949e' }}
                              >
                                Content Preview:
                              </span>
                              <CopyButton text={source.content} label="Copy" />
                            </div>
                            <pre
                              style={{
                                margin: 0,
                                padding: '12px',
                                background: '#161b22',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontFamily: 'monospace',
                                color: '#c9d1d9',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                maxHeight: '200px',
                                overflow: 'auto',
                              }}
                            >
                              {source.content}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tools list */}
            {contextMetrics.tools.length > 0 && (
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '12px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 500,
                      color: '#c9d1d9',
                    }}
                  >
                    Available Tools ({contextMetrics.tools.length})
                  </span>
                  {contextMetrics.tools.length > 10 && (
                    <button
                      onClick={() => setShowAllTools(!showAllTools)}
                      style={{
                        padding: '4px 8px',
                        border: '1px solid #30363d',
                        borderRadius: '4px',
                        background: 'transparent',
                        color: '#58a6ff',
                        fontSize: '11px',
                        cursor: 'pointer',
                      }}
                    >
                      {showAllTools
                        ? 'Show Less'
                        : `Show All (${contextMetrics.tools.length})`}
                    </button>
                  )}
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px',
                    maxHeight: showAllTools ? 'none' : '150px',
                    overflow: showAllTools ? 'visible' : 'hidden',
                  }}
                >
                  {contextMetrics.tools.map((tool, idx) => (
                    <span
                      key={idx}
                      title={tool.description || tool.name}
                      style={{
                        padding: '4px 8px',
                        background: '#21262d',
                        borderRadius: '4px',
                        fontSize: '11px',
                        color: '#c9d1d9',
                        fontFamily: 'monospace',
                        border: '1px solid #30363d',
                      }}
                    >
                      {tool.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        {section === 'system' && (
          <>
            {systemInfo ? (
              <>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '12px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#f0f6fc',
                      }}
                    >
                      System Instruction
                    </span>
                    {systemInfo.sources.length > 0 && (
                      <span
                        style={{
                          fontSize: '11px',
                          color: '#8b949e',
                          padding: '2px 8px',
                          background: '#21262d',
                          borderRadius: '10px',
                        }}
                      >
                        {systemInfo.sources.length} source
                        {systemInfo.sources.length !== 1 ? 's' : ''}
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: '11px',
                        color: '#8b949e',
                        fontFamily: 'monospace',
                      }}
                    >
                      {systemInfo.text.length.toLocaleString()} chars
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <CopyButton text={systemInfo.text} label="Copy Text" />
                    <CopyButton
                      text={JSON.stringify(systemInfo.raw, null, 2)}
                      label="Copy JSON"
                    />
                  </div>
                </div>
                <pre
                  style={{
                    margin: 0,
                    padding: '16px',
                    background: '#0d1117',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    color: '#c9d1d9',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    lineHeight: 1.6,
                    overflow: 'auto',
                  }}
                >
                  {systemInfo.text}
                </pre>
              </>
            ) : (
              <div
                style={{
                  padding: '24px',
                  textAlign: 'center',
                  color: '#8b949e',
                  fontSize: '14px',
                }}
              >
                No system instruction found in this event.
                <br />
                <span
                  style={{
                    fontSize: '12px',
                    marginTop: '8px',
                    display: 'block',
                  }}
                >
                  Check the &quot;Full Data&quot; or &quot;Raw JSON&quot; tabs
                  to inspect all event data.
                </span>
              </div>
            )}
          </>
        )}
        {section === 'sources' &&
          systemInfo &&
          systemInfo.sources.length > 0 && (
            <>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px',
                }}
              >
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#f0f6fc',
                  }}
                >
                  System Instruction Sources ({systemInfo.sources.length})
                </span>
                <CopyButton
                  text={JSON.stringify(systemInfo.sources, null, 2)}
                  label="Copy All"
                />
              </div>
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
              >
                {systemInfo.sources.map((source, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '12px 16px',
                      background: '#0d1117',
                      borderRadius: '6px',
                      border: '1px solid #30363d',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: source.content ? 'pointer' : 'default',
                      }}
                      onClick={() =>
                        source.content &&
                        setExpandedSource(expandedSource === idx ? null : idx)
                      }
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '10px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background:
                              source.type === 'mcp'
                                ? '#8957e520'
                                : source.type === 'gemini.md'
                                  ? '#58a6ff20'
                                  : '#3fb95020',
                            color:
                              source.type === 'mcp'
                                ? '#a371f7'
                                : source.type === 'gemini.md'
                                  ? '#58a6ff'
                                  : '#3fb950',
                            textTransform: 'uppercase',
                            fontWeight: 600,
                          }}
                        >
                          {source.type}
                        </span>
                        <span
                          style={{
                            fontSize: '13px',
                            color: '#c9d1d9',
                            fontFamily: 'monospace',
                          }}
                        >
                          {source.name}
                        </span>
                      </div>
                      {source.content && (
                        <span style={{ fontSize: '12px', color: '#8b949e' }}>
                          {expandedSource === idx ? '▼' : '▶'}
                        </span>
                      )}
                    </div>
                    {expandedSource === idx && source.content && (
                      <pre
                        style={{
                          margin: '12px 0 0 0',
                          padding: '12px',
                          background: '#161b22',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontFamily: 'monospace',
                          color: '#c9d1d9',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          maxHeight: '300px',
                          overflow: 'auto',
                        }}
                      >
                        {source.content}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        {section === 'prompt' && (
          <>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
              }}
            >
              <span
                style={{ fontSize: '14px', fontWeight: 600, color: '#f0f6fc' }}
              >
                Prompt Contents
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <CopyButton text={promptText} label="Copy Text" />
                <CopyButton
                  text={JSON.stringify(data.contents, null, 2)}
                  label="Copy JSON"
                />
              </div>
            </div>
            {promptText ? (
              <pre
                style={{
                  margin: 0,
                  padding: '16px',
                  background: '#0d1117',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  color: '#c9d1d9',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  lineHeight: 1.6,
                  maxHeight: '400px',
                  overflow: 'auto',
                }}
              >
                {promptText}
              </pre>
            ) : (
              <pre
                style={{
                  margin: 0,
                  padding: '12px',
                  background: '#0d1117',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  color: '#c9d1d9',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {JSON.stringify(data.contents, null, 2)}
              </pre>
            )}
          </>
        )}
        {section === 'response' && isResponse && (
          <>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
              }}
            >
              <span
                style={{ fontSize: '14px', fontWeight: 600, color: '#f0f6fc' }}
              >
                Response
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                {responseText && (
                  <CopyButton text={responseText} label="Copy Text" />
                )}
                <CopyButton
                  text={JSON.stringify(candidates, null, 2)}
                  label="Copy JSON"
                />
              </div>
            </div>
            {responseText ? (
              <pre
                style={{
                  margin: 0,
                  padding: '16px',
                  background: '#0d1117',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  color: '#c9d1d9',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  lineHeight: 1.6,
                  maxHeight: '400px',
                  overflow: 'auto',
                }}
              >
                {responseText}
              </pre>
            ) : (
              <pre
                style={{
                  margin: 0,
                  padding: '12px',
                  background: '#0d1117',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  color: '#c9d1d9',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {JSON.stringify(candidates, null, 2)}
              </pre>
            )}
          </>
        )}
        {section === 'full' && (
          <>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
              }}
            >
              <span
                style={{ fontSize: '14px', fontWeight: 600, color: '#f0f6fc' }}
              >
                Full Event Data
              </span>
              <CopyButton text={JSON.stringify(data, null, 2)} />
            </div>
            <pre
              style={{
                margin: 0,
                padding: '12px',
                background: '#0d1117',
                borderRadius: '6px',
                fontSize: '12px',
                fontFamily: 'monospace',
                color: '#c9d1d9',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {JSON.stringify(data, null, 2)}
            </pre>
          </>
        )}
        {section === 'raw' && (
          <>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
              }}
            >
              <span
                style={{ fontSize: '14px', fontWeight: 600, color: '#f0f6fc' }}
              >
                Raw Event
              </span>
              <CopyButton
                text={JSON.stringify(event, null, 2)}
                label="Copy All"
              />
            </div>
            <pre
              style={{
                margin: 0,
                padding: '12px',
                background: '#0d1117',
                borderRadius: '6px',
                fontSize: '12px',
                fontFamily: 'monospace',
                color: '#c9d1d9',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {JSON.stringify(event, null, 2)}
            </pre>
          </>
        )}
      </div>
    </div>
  );
}

function MemoryEventView({ event }: { event: DiagnosticEvent }) {
  const { data } = event;
  const isFileEvent = event.meta.eventType === 'file';
  const isRefreshEvent = event.meta.eventType === 'refresh';

  if (isFileEvent) {
    const filePath = String(data.filePath || '');
    const fileName = String(data.fileName || '');
    const content = String(data.content || '');
    const source = String(data.source || 'unknown');
    const contentLength = Number(data.contentLength || 0);

    return (
      <div style={{ padding: '16px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px',
          }}
        >
          <span
            style={{
              fontSize: '10px',
              padding: '4px 8px',
              borderRadius: '4px',
              background:
                source === 'global'
                  ? '#8957e520'
                  : source === 'mcp'
                    ? '#58a6ff20'
                    : '#3fb95020',
              color:
                source === 'global'
                  ? '#a371f7'
                  : source === 'mcp'
                    ? '#58a6ff'
                    : '#3fb950',
              textTransform: 'uppercase',
              fontWeight: 600,
            }}
          >
            {source}
          </span>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#f0f6fc' }}>
            {fileName}
          </span>
          <span style={{ fontSize: '12px', color: '#8b949e' }}>
            {contentLength.toLocaleString()} chars
          </span>
        </div>
        <div
          style={{
            fontSize: '12px',
            color: '#8b949e',
            marginBottom: '12px',
            fontFamily: 'monospace',
          }}
        >
          {filePath}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginBottom: '12px',
          }}
        >
          <CopyButton text={content} label="Copy Content" />
        </div>
        <pre
          style={{
            margin: 0,
            padding: '16px',
            background: '#0d1117',
            borderRadius: '6px',
            fontSize: '13px',
            fontFamily: 'monospace',
            color: '#c9d1d9',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            lineHeight: 1.6,
            maxHeight: '500px',
            overflow: 'auto',
          }}
        >
          {content}
        </pre>
      </div>
    );
  }

  if (isRefreshEvent) {
    const fileCount = Number(data.fileCount || 0);
    const filePaths = (data.filePaths as string[]) || [];
    const totalContentLength = Number(data.totalContentLength || 0);
    const hasMcpInstructions = Boolean(data.hasMcpInstructions);
    const mcpInstructionsLength = Number(data.mcpInstructionsLength || 0);
    const finalMemoryLength = Number(data.finalMemoryLength || 0);

    return (
      <div style={{ padding: '16px' }}>
        <div
          style={{
            display: 'flex',
            gap: '24px',
            marginBottom: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              background: '#0d1117',
              borderRadius: '6px',
              textAlign: 'center',
            }}
          >
            <div
              style={{ fontSize: '24px', fontWeight: 600, color: '#3fb950' }}
            >
              {fileCount}
            </div>
            <div style={{ fontSize: '12px', color: '#8b949e' }}>
              GEMINI.md Files
            </div>
          </div>
          <div
            style={{
              padding: '12px 16px',
              background: '#0d1117',
              borderRadius: '6px',
              textAlign: 'center',
            }}
          >
            <div
              style={{ fontSize: '24px', fontWeight: 600, color: '#58a6ff' }}
            >
              {totalContentLength.toLocaleString()}
            </div>
            <div style={{ fontSize: '12px', color: '#8b949e' }}>
              Total Chars
            </div>
          </div>
          {hasMcpInstructions && (
            <div
              style={{
                padding: '12px 16px',
                background: '#0d1117',
                borderRadius: '6px',
                textAlign: 'center',
              }}
            >
              <div
                style={{ fontSize: '24px', fontWeight: 600, color: '#a371f7' }}
              >
                {mcpInstructionsLength.toLocaleString()}
              </div>
              <div style={{ fontSize: '12px', color: '#8b949e' }}>
                MCP Instructions
              </div>
            </div>
          )}
          <div
            style={{
              padding: '12px 16px',
              background: '#0d1117',
              borderRadius: '6px',
              textAlign: 'center',
            }}
          >
            <div
              style={{ fontSize: '24px', fontWeight: 600, color: '#f0f6fc' }}
            >
              {finalMemoryLength.toLocaleString()}
            </div>
            <div style={{ fontSize: '12px', color: '#8b949e' }}>
              Final Memory
            </div>
          </div>
        </div>
        {event.timing?.durationMs && (
          <div
            style={{ fontSize: '12px', color: '#8b949e', marginBottom: '16px' }}
          >
            Loaded in {event.timing.durationMs}ms
          </div>
        )}
        <div style={{ marginBottom: '8px', fontWeight: 600, color: '#f0f6fc' }}>
          Files Loaded:
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            maxHeight: '300px',
            overflow: 'auto',
          }}
        >
          {filePaths.map((fp, idx) => (
            <div
              key={idx}
              style={{
                padding: '8px 12px',
                background: '#0d1117',
                borderRadius: '4px',
                fontSize: '12px',
                fontFamily: 'monospace',
                color: '#c9d1d9',
              }}
            >
              {fp}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Default: show raw data
  return (
    <div style={{ padding: '16px' }}>
      <pre
        style={{
          margin: 0,
          padding: '12px',
          background: '#0d1117',
          borderRadius: '6px',
          fontSize: '12px',
          fontFamily: 'monospace',
          color: '#c9d1d9',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

export function EventDetail({ event, onClose }: EventDetailProps) {
  const [activeTab, setActiveTab] = useState<'data' | 'meta' | 'error'>('data');
  const [copied, setCopied] = useState(false);
  const isApiEvent = event.meta.category === 'api';
  const isMemoryEvent = event.meta.category === 'memory';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(event, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Clipboard API may fail silently */
    }
  };

  if (isApiEvent) {
    return (
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: '50%',
          minWidth: '500px',
          background: 'rgba(0,0,0,0.5)',
        }}
        onClick={onClose}
      >
        <div
          style={{
            height: '100%',
            background: '#161b22',
            borderLeft: '1px solid #30363d',
            display: 'flex',
            flexDirection: 'column',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px',
              borderBottom: '1px solid #30363d',
            }}
          >
            <h3
              style={{
                fontSize: '16px',
                fontWeight: 600,
                color: '#f0f6fc',
                margin: 0,
              }}
            >
              API {event.meta.eventType}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={handleCopy}
                style={{
                  padding: '6px 12px',
                  border: `1px solid ${copied ? '#3fb950' : '#58a6ff'}`,
                  borderRadius: '6px',
                  background: copied ? '#3fb95020' : '#58a6ff20',
                  color: copied ? '#3fb950' : '#58a6ff',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                {copied ? 'Copied!' : 'Copy All'}
              </button>
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#8b949e',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '0 8px',
                }}
              >
                &times;
              </button>
            </div>
          </div>
          <ApiEventView event={event} />
        </div>
      </div>
    );
  }

  if (isMemoryEvent) {
    return (
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: '50%',
          minWidth: '500px',
          background: 'rgba(0,0,0,0.5)',
        }}
        onClick={onClose}
      >
        <div
          style={{
            height: '100%',
            background: '#161b22',
            borderLeft: '1px solid #30363d',
            display: 'flex',
            flexDirection: 'column',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px',
              borderBottom: '1px solid #30363d',
            }}
          >
            <h3
              style={{
                fontSize: '16px',
                fontWeight: 600,
                color: '#f0f6fc',
                margin: 0,
              }}
            >
              Memory {event.meta.eventType}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={handleCopy}
                style={{
                  padding: '6px 12px',
                  border: `1px solid ${copied ? '#3fb950' : '#58a6ff'}`,
                  borderRadius: '6px',
                  background: copied ? '#3fb95020' : '#58a6ff20',
                  color: copied ? '#3fb950' : '#58a6ff',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                {copied ? 'Copied!' : 'Copy All'}
              </button>
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#8b949e',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '0 8px',
                }}
              >
                &times;
              </button>
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            <MemoryEventView event={event} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: '50%',
        minWidth: '500px',
        background: 'rgba(0,0,0,0.5)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          height: '100%',
          background: '#161b22',
          borderLeft: '1px solid #30363d',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px',
            borderBottom: '1px solid #30363d',
          }}
        >
          <h3
            style={{
              fontSize: '16px',
              fontWeight: 600,
              color: '#f0f6fc',
              margin: 0,
            }}
          >
            {event.meta.category} / {event.meta.eventType}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleCopy}
              style={{
                padding: '6px 12px',
                border: `1px solid ${copied ? '#3fb950' : '#58a6ff'}`,
                borderRadius: '6px',
                background: copied ? '#3fb95020' : '#58a6ff20',
                color: copied ? '#3fb950' : '#58a6ff',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              {copied ? 'Copied!' : 'Copy All'}
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#8b949e',
                fontSize: '24px',
                cursor: 'pointer',
                padding: '0 8px',
              }}
            >
              &times;
            </button>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            gap: '4px',
            padding: '8px 16px',
            borderBottom: '1px solid #30363d',
          }}
        >
          {(['data', 'meta', ...(event.error ? ['error'] : [])] as const).map(
            (tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as typeof activeTab)}
                style={{
                  padding: '6px 12px',
                  border: 'none',
                  borderRadius: '4px',
                  background: activeTab === tab ? '#21262d' : 'transparent',
                  color:
                    tab === 'error'
                      ? '#da3633'
                      : activeTab === tab
                        ? '#f0f6fc'
                        : '#8b949e',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ),
          )}
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
          {activeTab === 'data' && (
            <pre
              style={{
                margin: 0,
                padding: '12px',
                background: '#0d1117',
                borderRadius: '6px',
                fontSize: '12px',
                fontFamily: 'monospace',
                color: '#c9d1d9',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {JSON.stringify(event.data, null, 2)}
            </pre>
          )}
          {activeTab === 'meta' && (
            <pre
              style={{
                margin: 0,
                padding: '12px',
                background: '#0d1117',
                borderRadius: '6px',
                fontSize: '12px',
                fontFamily: 'monospace',
                color: '#c9d1d9',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {JSON.stringify({ ...event.meta, timing: event.timing }, null, 2)}
            </pre>
          )}
          {activeTab === 'error' && event.error && (
            <>
              <div
                style={{
                  padding: '12px',
                  background: '#da363320',
                  borderRadius: '6px',
                  color: '#da3633',
                  marginBottom: '12px',
                }}
              >
                <strong>{event.error.name}</strong>: {event.error.message}
              </div>
              {event.error.stack && (
                <pre
                  style={{
                    margin: 0,
                    padding: '12px',
                    background: '#0d1117',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    color: '#8b949e',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {event.error.stack}
                </pre>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
