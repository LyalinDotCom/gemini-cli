/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Message, ToolCall } from '../contexts/ChatContext';
import MarkdownRenderer from './MarkdownRenderer';

interface ToolCallBoxProps {
  toolCall: ToolCall;
}

function ToolCallBox({ toolCall }: ToolCallBoxProps) {
  const statusIcon = {
    pending: '○',
    executing: '◐',
    success: '✓',
    error: '✗',
  }[toolCall.status];

  const statusClass = `tool-status tool-status-${toolCall.status}`;

  return (
    <div className="tool-box">
      <div className="tool-header">
        <span className={statusClass}>{statusIcon}</span>
        <span className="tool-name">{toolCall.name}</span>
        {toolCall.args && Object.keys(toolCall.args).length > 0 && (
          <span className="tool-args">
            {Object.entries(toolCall.args)
              .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
              .join(' ')}
          </span>
        )}
      </div>
      {toolCall.result && <div className="tool-result">{toolCall.result}</div>}
    </div>
  );
}

interface ChatHistoryProps {
  messages: Message[];
  isStreaming?: boolean;
}

export default function ChatHistory({ messages }: ChatHistoryProps) {
  return (
    <div className="chat-history">
      {messages.map((message) => {
        if (message.type === 'user') {
          return (
            <div key={message.id} className="message user-message">
              <span className="user-message-prefix">&gt;</span>
              <span className="user-message-content">{message.content}</span>
            </div>
          );
        }

        if (message.type === 'assistant') {
          return (
            <div key={message.id} className="message assistant-message">
              <span className="assistant-message-prefix">✦</span>
              <div className="assistant-message-content">
                {message.content && (
                  <MarkdownRenderer content={message.content} />
                )}
                {message.isStreaming && !message.content && (
                  <span className="responding-indicator">
                    <span className="spinner" /> Responding...
                  </span>
                )}
                {message.toolCalls && message.toolCalls.length > 0 && (
                  <div className="tool-group">
                    {message.toolCalls.map((tc) => (
                      <ToolCallBox key={tc.id} toolCall={tc} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        }

        if (message.type === 'error') {
          return (
            <div
              key={message.id}
              className="message"
              style={{ color: 'var(--accent-red)' }}
            >
              Error: {message.content}
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
