/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { useWebSocket, WebSocketMessage } from '../hooks/useWebSocket';

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: 'pending' | 'executing' | 'success' | 'error';
  result?: string;
}

export interface Message {
  id: string;
  type: 'user' | 'assistant' | 'error' | 'info';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
  isStreaming?: boolean;
}

export interface PendingConfirmation {
  correlationId: string;
  toolName: string;
  args: Record<string, unknown>;
}

interface SessionInfo {
  sessionId: string;
  workspacePath: string;
  model: string;
}

interface ChatContextValue {
  messages: Message[];
  isConnected: boolean;
  isStreaming: boolean;
  pendingConfirmation: PendingConfirmation | null;
  sessionInfo: SessionInfo | null;
  sendMessage: (text: string) => void;
  confirmTool: () => void;
  rejectTool: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}

interface ChatProviderProps {
  children: ReactNode;
}

export function ChatProvider({ children }: ChatProviderProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] =
    useState<PendingConfirmation | null>(null);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const currentMessageRef = useRef<string>('');
  const messageIdRef = useRef<number>(0);

  const generateId = () => `msg-${++messageIdRef.current}`;

  const handleMessage = useCallback((msg: WebSocketMessage) => {
    switch (msg.type) {
      case 'connected': {
        // Server sent session info on connection
        setSessionInfo({
          sessionId: msg.sessionId as string,
          workspacePath: msg.workspacePath as string,
          model: msg.model as string,
        });
        break;
      }

      case 'content': {
        // Streaming text content
        currentMessageRef.current += msg.text;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.type === 'assistant' && last.isStreaming) {
            return [
              ...prev.slice(0, -1),
              { ...last, content: currentMessageRef.current },
            ];
          }
          return prev;
        });
        break;
      }

      case 'stream_start': {
        setIsStreaming(true);
        currentMessageRef.current = '';
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            type: 'assistant',
            content: '',
            timestamp: Date.now(),
            isStreaming: true,
            toolCalls: [],
          },
        ]);
        break;
      }

      case 'stream_end': {
        setIsStreaming(false);
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.isStreaming) {
            return [...prev.slice(0, -1), { ...last, isStreaming: false }];
          }
          return prev;
        });
        break;
      }

      case 'tool_call': {
        const toolCall: ToolCall = {
          id: msg.toolId as string,
          name: msg.toolName as string,
          args: (msg.args as Record<string, unknown>) || {},
          status: 'pending',
        };
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.type === 'assistant') {
            return [
              ...prev.slice(0, -1),
              { ...last, toolCalls: [...(last.toolCalls || []), toolCall] },
            ];
          }
          return prev;
        });
        break;
      }

      case 'tool_status': {
        const toolId = msg.toolId as string;
        const status = msg.status as ToolCall['status'];
        const result = msg.result as string | undefined;
        setMessages((prev) => {
          return prev.map((m) => {
            if (m.toolCalls) {
              return {
                ...m,
                toolCalls: m.toolCalls.map((tc) =>
                  tc.id === toolId ? { ...tc, status, result } : tc,
                ),
              };
            }
            return m;
          });
        });
        break;
      }

      case 'confirmation_request': {
        setPendingConfirmation({
          correlationId: msg.correlationId as string,
          toolName: msg.toolName as string,
          args: (msg.args as Record<string, unknown>) || {},
        });
        break;
      }

      case 'error': {
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            type: 'error' as const,
            content: (msg.message as string) || 'Unknown error',
            timestamp: Date.now(),
          },
        ]);
        setIsStreaming(false);
        break;
      }
    }
  }, []);

  const { isConnected, send } = useWebSocket({
    url: `ws://${window.location.hostname}:3001/ws`,
    onMessage: handleMessage,
  });

  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim() || !isConnected) return;

      // Add user message to history
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          type: 'user',
          content: text,
          timestamp: Date.now(),
        },
      ]);

      // Send to server
      send({ type: 'chat', message: text });
    },
    [isConnected, send],
  );

  const confirmTool = useCallback(() => {
    if (!pendingConfirmation) return;
    send({
      type: 'confirmation_response',
      correlationId: pendingConfirmation.correlationId,
      confirmed: true,
    });
    setPendingConfirmation(null);
  }, [pendingConfirmation, send]);

  const rejectTool = useCallback(() => {
    if (!pendingConfirmation) return;
    send({
      type: 'confirmation_response',
      correlationId: pendingConfirmation.correlationId,
      confirmed: false,
    });
    setPendingConfirmation(null);
  }, [pendingConfirmation, send]);

  const value: ChatContextValue = {
    messages,
    isConnected,
    isStreaming,
    pendingConfirmation,
    sessionInfo,
    sendMessage,
    confirmTool,
    rejectTool,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
