/**
 * Chat Component with Assistant-UI Runtime
 * Wraps Thread component with AssistantRuntimeProvider
 */

import { AssistantRuntimeProvider, useLocalRuntime, WebSpeechSynthesisAdapter } from "@assistant-ui/react";
import { Thread } from "./thread";
import { createAssistantUIAdapter } from "../../../lib/assistant-ui-adapter";
import { createThreadHistoryAdapter } from "../../../lib/history-adapter";
import { threadStorage } from "../../../lib/thread-storage";
import { notifyChatUpdated } from "../../../hooks/useChatList";
import { useEffect, useMemo, useRef, useState } from "react";
import { registerToolWidgets } from "../../../lib/register-tool-widgets";
import { ChatContextProvider } from "./ChatContext";
import { ToolUIComponents } from "../../../components/tool-ui/tool-ui-registry";

import type { SuggestedPrompt } from "./thread";
import type { ThreadMessage } from "@assistant-ui/react";

interface ChatProps {
  user?: any;
  suggestedPrompts?: SuggestedPrompt[];
  chatId?: string;
}

function Chat({
  user,
  suggestedPrompts,
  chatId,
}: ChatProps) {
  // Configure tool widgets on mount - defer to avoid blocking initial render
  useEffect(() => {
    // Use requestIdleCallback if available, otherwise setTimeout
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      requestIdleCallback(() => {
        registerToolWidgets();
      }, { timeout: 1000 });
    } else {
      setTimeout(() => {
        registerToolWidgets();
      }, 0);
    }
  }, []);

  // Create a shared chatId reference that adapters can access
  // This allows session to persist even when chatId changes dynamically
  const chatIdRef = useRef<string | undefined>(chatId);

  // Track the current session ID in state
  const [currentChatId, setCurrentChatId] = useState<string | undefined>(chatId);

  // Update ref and state when chatId prop changes
  // This must happen before adapters are created so they can use the correct chatId
  useEffect(() => {
    chatIdRef.current = chatId;
    setCurrentChatId(chatId);
    console.log('[Chat] chatId updated:', chatId);
  }, [chatId]);

  // Create history adapter for message persistence
  // Recreate when chatId changes to ensure it loads the correct chat's messages
  // Use lazy initialization to avoid blocking render
  const historyAdapter = useMemo(() => {
    console.log('[Chat] Creating history adapter for chatId:', chatId);
    return createThreadHistoryAdapter(chatIdRef);
  }, [chatId]);

  // Create adapter with session management (following brackett's pattern)
  // Recreate when chatId changes to ensure it uses the correct session ID
  const adapter = useMemo(() => {
    console.log('[Chat] Creating adapter with chatId:', chatId);
    return createAssistantUIAdapter({
      initialSessionId: chatId, // Use provided chatId for existing chats
      sessionIdRef: chatIdRef,
      onSessionInitialized: (newChatId: string, messages: ThreadMessage[]) => {
        // Update state so components can access the session ID
        setCurrentChatId(newChatId);
        console.log('[Chat] Session initialized:', newChatId);

        // Update the shared chatId ref immediately
        chatIdRef.current = newChatId;

        // Retroactively save any messages that were sent before chatId was available
        if (messages && messages.length > 0) {
          console.log(`[Chat] Retroactively saving ${messages.length} messages to localStorage`);
          threadStorage.saveMessagesForChat(newChatId, messages);
        }

        // Notify that a new chat was created/updated
        notifyChatUpdated(newChatId);
      },
    });
  }, [chatId]);

  // Create runtime with adapter and history adapter in options
  // Recreate runtime when chatId or adapters change to load correct chat history
  const runtime = useLocalRuntime(adapter, {
    adapters: {
      history: historyAdapter,
      speech: new WebSpeechSynthesisAdapter(),
    },
  });

  // Navigation callbacks for tool widgets — uses window.location for simplicity
  // (widgets don't have access to React Router directly)
  const onNavigateToAsset = (assetId: string) => { window.location.href = `/assets/${assetId}`; };
  const onNavigateToTicket = (ticketId: string) => { window.location.href = `/tickets/${ticketId}`; };
  const onNavigateToAnomaly = (anomalyId: string) => { window.location.href = `/anomalies?id=${anomalyId}`; };

  return (
    <ChatContextProvider
      value={{
        user,
        onNavigateToAsset,
        onNavigateToTicket,
        onNavigateToAnomaly,
      }}
    >
      <AssistantRuntimeProvider runtime={runtime}>
        {/* Register Tool UI components - lazy load to improve initial render */}
        {ToolUIComponents.map((Component, index) => (
          <Component key={`tool-ui-${index}`} />
        ))}
        <Thread suggestedPrompts={suggestedPrompts} />
      </AssistantRuntimeProvider>
    </ChatContextProvider>
  );
}

export { Chat };
