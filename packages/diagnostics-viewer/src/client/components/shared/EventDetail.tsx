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
  if (typeof o.text === 'string') return o.text;
  if (Array.isArray(o.parts))
    return o.parts
      .map((p: { text?: string }) => p.text || '')
      .filter(Boolean)
      .join('\n');
  if (o.content) return extractTextFromParts(o.content);
  return '';
}

function findSystemInstruction(
  data: Record<string, unknown>,
): { text: string; raw: unknown } | null {
  for (const key of [
    'systemInstruction',
    'config.systemInstruction',
    'generate_content_config.systemInstruction',
  ]) {
    const parts = key.split('.');
    let val: unknown = data;
    for (const p of parts) {
      if (val && typeof val === 'object')
        val = (val as Record<string, unknown>)[p];
      else val = undefined;
    }
    if (val) {
      const text = extractTextFromParts(val);
      if (text) return { text, raw: val };
    }
  }
  if (Array.isArray(data.contents)) {
    for (const c of data.contents) {
      if (c?.role === 'system' || c?.role === 'SYSTEM') {
        const text = extractTextFromParts(c);
        if (text) return { text, raw: c };
      }
    }
  }
  return null;
}

function ApiEventView({ event }: { event: DiagnosticEvent }) {
  const [section, setSection] = useState<
    'system' | 'prompt' | 'response' | 'full' | 'raw'
  >('prompt');
  const { data } = event;
  const systemInfo = findSystemInstruction(data);
  const promptText = extractPromptText(data.contents);
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
        {systemInfo && <Tab id="system" label="System" />}
        <Tab id="prompt" label="Prompt" />
        {isResponse && <Tab id="response" label="Response" />}
        <Tab id="full" label="Full Data" />
        <Tab id="raw" label="Raw JSON" />
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {section === 'system' && systemInfo && (
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
                System Instruction
              </span>
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
                maxHeight: '400px',
                overflow: 'auto',
              }}
            >
              {systemInfo.text}
            </pre>
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

export function EventDetail({ event, onClose }: EventDetailProps) {
  const [activeTab, setActiveTab] = useState<'data' | 'meta' | 'error'>('data');
  const [copied, setCopied] = useState(false);
  const isApiEvent = event.meta.category === 'api';

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
