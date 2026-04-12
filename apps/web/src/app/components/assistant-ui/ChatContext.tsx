/**
 * Chat Context
 * Provides navigation callbacks and shared state to tool widgets
 */

import { createContext, useContext, ReactNode } from 'react';

interface ChatContextValue {
  user?: any;
  onNavigateToAsset?: (assetId: string) => void;
  onNavigateToTicket?: (ticketId: string) => void;
  onNavigateToAnomaly?: (anomalyId: string) => void;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export function ChatContextProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: ChatContextValue;
}) {
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within ChatContextProvider');
  }
  return context;
}
