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

function IconButton({
  onClick,
  tooltip,
  active,
  activeColor = '#3fb950',
  children,
}: {
  onClick: () => void;
  tooltip: string;
  active?: boolean;
  activeColor?: string;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '32px',
          height: '32px',
          border: `1px solid ${active ? activeColor : hovered ? '#8b949e' : '#30363d'}`,
          borderRadius: '6px',
          background: active
            ? `${activeColor}20`
            : hovered
              ? '#30363d'
              : '#21262d',
          color: active ? activeColor : hovered ? '#f0f6fc' : '#8b949e',
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
      >
        {children}
      </button>
      {hovered && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: '6px',
            padding: '4px 8px',
            background: '#1c2128',
            border: '1px solid #30363d',
            borderRadius: '6px',
            fontSize: '12px',
            color: '#f0f6fc',
            whiteSpace: 'nowrap',
            zIndex: 1000,
            pointerEvents: 'none',
          }}
        >
          {tooltip}
        </div>
      )}
    </div>
  );
}

function CopyButton({ text, tooltip }: { text: string; tooltip?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Clipboard API may fail silently */
    }
  };

  return (
    <IconButton
      onClick={handleCopy}
      tooltip={copied ? 'Copied!' : tooltip || 'Copy'}
      active={copied}
      activeColor="#3fb950"
    >
      {copied ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z" />
          <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z" />
        </svg>
      )}
    </IconButton>
  );
}

function FormatToggle({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <IconButton
      onClick={onToggle}
      tooltip={enabled ? 'Show raw' : 'Show formatted'}
      active={enabled}
      activeColor="#a371f7"
    >
      {enabled ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M14.85 3H1.15C.52 3 0 3.52 0 4.15v7.69C0 12.48.52 13 1.15 13h13.69c.64 0 1.15-.52 1.15-1.15V4.15C16 3.52 15.48 3 14.85 3zM9 11H2V9h7v2zm5-4H2V5h12v2z" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4.72 3.22a.75.75 0 011.06 1.06L2.06 8l3.72 3.72a.75.75 0 11-1.06 1.06L.47 8.53a.75.75 0 010-1.06l4.25-4.25zm6.56 0a.75.75 0 10-1.06 1.06L13.94 8l-3.72 3.72a.75.75 0 101.06 1.06l4.25-4.25a.75.75 0 000-1.06l-4.25-4.25z" />
        </svg>
      )}
    </IconButton>
  );
}

// Simple markdown renderer - converts markdown to styled HTML
function renderMarkdown(text: string): string {
  const html = text
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Code blocks (``` ... ```)
    .replace(
      /```(\w*)\n([\s\S]*?)```/g,
      '<pre style="background:#0d1117;padding:12px;border-radius:6px;overflow-x:auto;border:1px solid #30363d"><code>$2</code></pre>',
    )
    // Inline code
    .replace(
      /`([^`]+)`/g,
      '<code style="background:#21262d;padding:2px 6px;border-radius:4px;font-size:0.9em">$1</code>',
    )
    // Headers
    .replace(
      /^### (.+)$/gm,
      '<h3 style="font-size:16px;font-weight:600;color:#f0f6fc;margin:16px 0 8px 0;border-bottom:1px solid #21262d;padding-bottom:4px">$1</h3>',
    )
    .replace(
      /^## (.+)$/gm,
      '<h2 style="font-size:18px;font-weight:600;color:#f0f6fc;margin:20px 0 10px 0;border-bottom:1px solid #30363d;padding-bottom:6px">$1</h2>',
    )
    .replace(
      /^# (.+)$/gm,
      '<h1 style="font-size:22px;font-weight:700;color:#f0f6fc;margin:24px 0 12px 0;border-bottom:1px solid #30363d;padding-bottom:8px">$1</h1>',
    )
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#f0f6fc">$1</strong>')
    // Italic
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li style="margin:4px 0;margin-left:20px">$1</li>')
    .replace(
      /^ {2}- (.+)$/gm,
      '<li style="margin:4px 0;margin-left:40px">$1</li>',
    )
    // Ordered lists
    .replace(
      /^\d+\. (.+)$/gm,
      '<li style="margin:4px 0;margin-left:20px;list-style-type:decimal">$1</li>',
    )
    // Blockquotes
    .replace(
      /^> (.+)$/gm,
      '<blockquote style="border-left:3px solid #58a6ff;padding-left:12px;margin:8px 0;color:#8b949e">$1</blockquote>',
    )
    // Horizontal rules
    .replace(
      /^---$/gm,
      '<hr style="border:none;border-top:1px solid #30363d;margin:16px 0">',
    )
    // Links
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" style="color:#58a6ff;text-decoration:none" target="_blank">$1</a>',
    )
    // Line breaks - convert double newlines to paragraph breaks
    .replace(/\n\n/g, '</p><p style="margin:12px 0">')
    // Single newlines to <br> (but not after block elements)
    .replace(/\n(?!<)/g, '<br>');

  return `<div style="line-height:1.6"><p style="margin:12px 0">${html}</p></div>`;
}

// JSON syntax highlighter
function highlightJson(json: string): string {
  return (
    json
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Strings (property values)
      .replace(
        /("(?:[^"\\]|\\.)*")\s*:/g,
        '<span style="color:#79c0ff">$1</span>:',
      )
      // String values
      .replace(
        /:\s*("(?:[^"\\]|\\.)*")/g,
        ': <span style="color:#a5d6ff">$1</span>',
      )
      // Numbers
      .replace(/:\s*(-?\d+\.?\d*)/g, ': <span style="color:#f0883e">$1</span>')
      // Booleans and null
      .replace(
        /:\s*(true|false|null)/g,
        ': <span style="color:#ff7b72">$1</span>',
      )
      // Standalone strings in arrays
      .replace(
        /\[\s*("(?:[^"\\]|\\.)*")/g,
        '[ <span style="color:#a5d6ff">$1</span>',
      )
      .replace(
        /,\s*("(?:[^"\\]|\\.)*")\s*([,\]])/g,
        ', <span style="color:#a5d6ff">$1</span>$2',
      )
  );
}

function FormattedTextView({
  text,
  isFormatted,
}: {
  text: string;
  isFormatted: boolean;
}) {
  if (!isFormatted) {
    return (
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
        {text}
      </pre>
    );
  }

  return (
    <div
      style={{
        padding: '16px',
        background: '#0d1117',
        borderRadius: '6px',
        fontSize: '14px',
        color: '#c9d1d9',
        overflow: 'auto',
      }}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
    />
  );
}

function FormattedJsonView({
  data,
  isFormatted,
}: {
  data: unknown;
  isFormatted: boolean;
}) {
  const jsonStr = JSON.stringify(data, null, 2);

  if (!isFormatted) {
    return (
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
        {jsonStr}
      </pre>
    );
  }

  return (
    <pre
      style={{
        margin: 0,
        padding: '12px',
        background: '#0d1117',
        borderRadius: '6px',
        fontSize: '12px',
        fontFamily: 'monospace',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        lineHeight: 1.5,
      }}
      dangerouslySetInnerHTML={{ __html: highlightJson(jsonStr) }}
    />
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
  const sources: Array<{ name: string; type: string; content?: string }> = [];
  const seenPaths = new Set<string>();

  // Primary pattern: Extract content between "--- Context from: PATH ---" and "--- End of Context from: PATH ---"
  const contextBlockPattern =
    /---\s*Context from:\s*([^\n-]+)\s*---\n([\s\S]*?)---\s*End of Context from:\s*[^\n-]+\s*---/gi;
  let match;
  while ((match = contextBlockPattern.exec(text)) !== null) {
    const path = match[1]?.trim();
    const content = match[2]?.trim() || '';
    if (path && !seenPaths.has(path)) {
      seenPaths.add(path);
      sources.push({
        name: path,
        type: path.toLowerCase().includes('gemini.md') ? 'gemini.md' : 'file',
        content, // Store full content
      });
    }
  }

  // MCP server instruction blocks
  const mcpServerPattern =
    /The following are instructions provided by the tool server '([^']+)':\s*\n---\[start of server instructions\]---\n([\s\S]*?)\n---\[end of server instructions\]---/gi;
  while ((match = mcpServerPattern.exec(text)) !== null) {
    const serverName = match[1];
    const content = match[2]?.trim() || '';
    if (!seenPaths.has(serverName)) {
      seenPaths.add(serverName);
      sources.push({
        name: `MCP: ${serverName}`,
        type: 'mcp',
        content,
      });
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
  const seenPaths = new Set<string>();

  // Pattern 1: Extract content between "--- Context from: PATH ---" and "--- End of Context from: PATH ---"
  // This is the primary format used by Gemini CLI
  const contextBlockPattern =
    /---\s*Context from:\s*([^\n-]+)\s*---\n([\s\S]*?)---\s*End of Context from:\s*[^\n-]+\s*---/gi;
  let match;
  while ((match = contextBlockPattern.exec(text)) !== null) {
    const path = match[1]?.trim();
    const content = match[2]?.trim() || '';
    if (path && !seenPaths.has(path)) {
      seenPaths.add(path);
      sources.push({
        name: path,
        type: path.toLowerCase().includes('gemini.md') ? 'gemini-md' : 'other',
        chars: content.length,
        content, // Store full content, not truncated
      });
    }
  }

  // Pattern 2: Fallback for paths without the block format
  const filePathPatterns = [
    // Just path references for GEMINI.md
    /(?:^|\n)([^\s\n]*\/(?:GEMINI|gemini)\.md)/gi,
  ];

  for (const pattern of filePathPatterns) {
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text)) !== null) {
      const path = match[1]?.trim();
      if (path && !seenPaths.has(path)) {
        seenPaths.add(path);
        sources.push({
          name: path,
          type: 'gemini-md',
          chars: 0, // Unknown size
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
    'overview' | 'system' | 'sources' | 'messages' | 'response' | 'full' | 'raw'
  >('overview');
  const [expandedSource, setExpandedSource] = useState<number | null>(null);
  const [showAllTools, setShowAllTools] = useState(false);
  const [isFormatted, setIsFormatted] = useState(true);
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
  const hasMessages = !!promptText || !!data.contents;
  const hasResponse = isResponse && (!!responseText || !!candidates);

  const Tab = ({
    id,
    label,
    disabled,
  }: {
    id: typeof section;
    label: string;
    disabled?: boolean;
  }) => (
    <button
      onClick={() => !disabled && setSection(id)}
      disabled={disabled}
      style={{
        padding: '8px 16px',
        border: 'none',
        borderRadius: '6px',
        background: section === id ? '#21262d' : 'transparent',
        color: disabled ? '#484f58' : section === id ? '#f0f6fc' : '#8b949e',
        fontSize: '13px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontWeight: 500,
        opacity: disabled ? 0.5 : 1,
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
          flexWrap: 'wrap',
        }}
      >
        <Tab id="overview" label="Overview" />
        <Tab id="system" label="System" disabled={!systemInfo} />
        <Tab
          id="sources"
          label={`Sources${systemInfo?.sources.length ? ` (${systemInfo.sources.length})` : ''}`}
          disabled={!systemInfo?.sources.length}
        />
        <Tab id="messages" label="Messages" disabled={!hasMessages} />
        <Tab id="response" label="Response" disabled={!hasResponse} />
        <Tab id="full" label="Full Data" />
        <Tab id="raw" label="Raw JSON" />
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {section === 'overview' && (
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
                                Full Content (
                                {source.content.length.toLocaleString()} chars):
                              </span>
                              <CopyButton
                                text={source.content}
                                tooltip="Copy content"
                              />
                            </div>
                            <pre
                              style={{
                                margin: 0,
                                padding: '12px',
                                background: '#161b22',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontFamily: 'monospace',
                                color: '#c9d1d9',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                maxHeight: '400px',
                                overflow: 'auto',
                                lineHeight: 1.5,
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
                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'center',
                    }}
                  >
                    <FormatToggle
                      enabled={isFormatted}
                      onToggle={() => setIsFormatted(!isFormatted)}
                    />
                    <CopyButton text={systemInfo.text} tooltip="Copy text" />
                    <CopyButton
                      text={JSON.stringify(systemInfo.raw, null, 2)}
                      tooltip="Copy JSON"
                    />
                  </div>
                </div>
                <FormattedTextView
                  text={systemInfo.text}
                  isFormatted={isFormatted}
                />
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
                  tooltip="Copy all"
                />
              </div>
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
              >
                {systemInfo.sources.map((source, idx) => {
                  const isExpanded = expandedSource === idx;
                  const hasContent = !!source.content;
                  const typeColor =
                    source.type === 'mcp'
                      ? '#a371f7'
                      : source.type === 'gemini.md'
                        ? '#3fb950'
                        : '#58a6ff';

                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '12px 16px',
                        background: '#0d1117',
                        borderRadius: '6px',
                        border: `1px solid ${isExpanded ? typeColor : '#30363d'}`,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: hasContent ? 'pointer' : 'default',
                        }}
                        onClick={() =>
                          hasContent &&
                          setExpandedSource(isExpanded ? null : idx)
                        }
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
                              background: typeColor + '20',
                              color: typeColor,
                              textTransform: 'uppercase',
                              fontWeight: 600,
                              flexShrink: 0,
                            }}
                          >
                            {source.type}
                          </span>
                          <span
                            style={{
                              fontSize: '13px',
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
                            gap: '8px',
                            flexShrink: 0,
                          }}
                        >
                          {hasContent && (
                            <span
                              style={{
                                fontSize: '11px',
                                color: '#8b949e',
                                fontFamily: 'monospace',
                              }}
                            >
                              {source.content!.length.toLocaleString()} chars
                            </span>
                          )}
                          {hasContent ? (
                            <span
                              style={{
                                fontSize: '12px',
                                color: typeColor,
                                fontWeight: 500,
                              }}
                            >
                              {isExpanded ? '▼ Hide' : '▶ View'}
                            </span>
                          ) : (
                            <span
                              style={{ fontSize: '11px', color: '#6e7681' }}
                            >
                              (no content)
                            </span>
                          )}
                        </div>
                      </div>
                      {isExpanded && hasContent && (
                        <div style={{ marginTop: '12px' }}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'flex-end',
                              marginBottom: '8px',
                            }}
                          >
                            <CopyButton
                              text={source.content!}
                              tooltip="Copy content"
                            />
                          </div>
                          <pre
                            style={{
                              margin: 0,
                              padding: '12px',
                              background: '#161b22',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontFamily: 'monospace',
                              color: '#c9d1d9',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              maxHeight: '400px',
                              overflow: 'auto',
                              lineHeight: 1.5,
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
            </>
          )}
        {section === 'messages' && (
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
                Conversation Messages
              </span>
              <div
                style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
              >
                <FormatToggle
                  enabled={isFormatted}
                  onToggle={() => setIsFormatted(!isFormatted)}
                />
                <CopyButton text={promptText} tooltip="Copy text" />
                <CopyButton
                  text={JSON.stringify(data.contents, null, 2)}
                  tooltip="Copy JSON"
                />
              </div>
            </div>
            {promptText ? (
              <FormattedTextView text={promptText} isFormatted={isFormatted} />
            ) : (
              <FormattedJsonView
                data={data.contents}
                isFormatted={isFormatted}
              />
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
              <div
                style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
              >
                <FormatToggle
                  enabled={isFormatted}
                  onToggle={() => setIsFormatted(!isFormatted)}
                />
                {responseText && (
                  <CopyButton text={responseText} tooltip="Copy text" />
                )}
                <CopyButton
                  text={JSON.stringify(candidates, null, 2)}
                  tooltip="Copy JSON"
                />
              </div>
            </div>
            {responseText ? (
              <FormattedTextView
                text={responseText}
                isFormatted={isFormatted}
              />
            ) : (
              <FormattedJsonView data={candidates} isFormatted={isFormatted} />
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
              <div
                style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
              >
                <FormatToggle
                  enabled={isFormatted}
                  onToggle={() => setIsFormatted(!isFormatted)}
                />
                <CopyButton text={JSON.stringify(data, null, 2)} />
              </div>
            </div>
            <FormattedJsonView data={data} isFormatted={isFormatted} />
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
              <div
                style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
              >
                <FormatToggle
                  enabled={isFormatted}
                  onToggle={() => setIsFormatted(!isFormatted)}
                />
                <CopyButton
                  text={JSON.stringify(event, null, 2)}
                  tooltip="Copy all"
                />
              </div>
            </div>
            <FormattedJsonView data={event} isFormatted={isFormatted} />
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
          <CopyButton text={content} tooltip="Copy content" />
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
