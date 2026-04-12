import { useState, useEffect, useCallback } from 'react';
import { threadStorage, type ChatMetadata } from '../lib/thread-storage';

export interface Chat {
  id: string;
  title: string;
  created_at: string;
  lastUpdated: string;
}

interface UseChatListResult {
  chats: Chat[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// Custom event name for chat updates
const CHAT_UPDATED_EVENT = 'xerow-chat-updated';

/**
 * Dispatch event when a chat is created or updated
 * This allows components to react to chat changes
 */
export function notifyChatUpdated(chatId?: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CHAT_UPDATED_EVENT, { detail: { chatId } }));
  }
}

export function useChatList(): UseChatListResult {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  const fetchChats = useCallback(async () => {
    console.log('[useChatList] Fetching chats');
    setLoading(true);
    setError(null);

    try {
      // Get all chat IDs from localStorage
      const chatIds = threadStorage.getAllChatIds();

      // Load metadata for each chat
      const chatList: Chat[] = chatIds
        .map((chatId) => {
          const metadata = threadStorage.getChatMetadata(chatId);
          if (!metadata) return null;

          return {
            id: metadata.id,
            title: metadata.title,
            created_at: metadata.createdAt,
            lastUpdated: metadata.lastUpdated,
          };
        })
        .filter((chat): chat is Chat => chat !== null)
        .sort((a, b) => {
          // Sort by lastUpdated descending (newest first)
          return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
        });

      setChats(chatList);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch chats';
      setError(errorMessage);
      setChats([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChats();
  }, [fetchChats, refetchTrigger]);

  // Listen for chat update events (when new chats are created)
  useEffect(() => {
    const handleChatUpdated = () => {
      console.log('[useChatList] Chat updated event received, refetching...');
      setRefetchTrigger(prev => prev + 1);
    };

    window.addEventListener(CHAT_UPDATED_EVENT, handleChatUpdated);
    
    // Also listen to storage events (when localStorage changes)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key && (e.key.startsWith('xerow-chat-') || e.key.startsWith('xerow-chat-meta-'))) {
        console.log('[useChatList] Storage change detected, refetching...');
        setRefetchTrigger(prev => prev + 1);
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener(CHAT_UPDATED_EVENT, handleChatUpdated);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const refetch = useCallback(() => {
    setRefetchTrigger(prev => prev + 1);
  }, []);

  return {
    chats,
    loading,
    error,
    refetch
  };
}
