/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { ChatProvider, useChat } from './contexts/ChatContext';
import Banner from './components/Banner';
import ChatHistory from './components/ChatHistory';
import InputBox from './components/InputBox';
import StatusBar from './components/StatusBar';
import ToolConfirmation from './components/ToolConfirmation';

function AppContent() {
  const {
    messages,
    isConnected,
    isStreaming,
    pendingConfirmation,
    sessionInfo,
    sendMessage,
    confirmTool,
    rejectTool,
  } = useChat();

  const [showBanner, setShowBanner] = useState(true);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = useCallback(
    (text: string) => {
      if (showBanner) setShowBanner(false);
      sendMessage(text);
    },
    [sendMessage, showBanner],
  );

  return (
    <div className="app-container">
      <div className="chat-container" ref={chatContainerRef}>
        {showBanner && <Banner />}
        <ChatHistory messages={messages} isStreaming={isStreaming} />
      </div>

      <InputBox
        onSubmit={handleSubmit}
        disabled={isStreaming || !isConnected}
      />

      <StatusBar
        isConnected={isConnected}
        isStreaming={isStreaming}
        model={sessionInfo?.model || 'connecting...'}
        directory={sessionInfo?.workspacePath || 'connecting...'}
      />

      {pendingConfirmation && (
        <ToolConfirmation
          toolName={pendingConfirmation.toolName}
          toolArgs={pendingConfirmation.args}
          onConfirm={confirmTool}
          onReject={rejectTool}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ChatProvider>
      <AppContent />
    </ChatProvider>
  );
}
