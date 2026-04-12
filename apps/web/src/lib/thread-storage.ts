import type { ThreadMessage } from "@assistant-ui/react";

const STORAGE_KEYS = {
  MESSAGES_PREFIX: "xerow-chat-", // Will be suffixed with chat ID
  METADATA_PREFIX: "xerow-chat-meta-", // Will be suffixed with chat ID
} as const;

// Custom event name for chat updates
const CHAT_UPDATED_EVENT = 'xerow-chat-updated';

/**
 * Dispatch event when a chat is created or updated
 * This allows components to react to chat changes
 */
function notifyChatUpdated(chatId?: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CHAT_UPDATED_EVENT, { detail: { chatId } }));
  }
}

/**
 * Generate storage key for a specific chat's messages
 */
function getChatMessagesKey(chatId: string): string {
  return `${STORAGE_KEYS.MESSAGES_PREFIX}${chatId}-messages`;
}

/**
 * Generate storage key for a specific chat's metadata
 */
function getChatMetadataKey(chatId: string): string {
  return `${STORAGE_KEYS.METADATA_PREFIX}${chatId}`;
}

export interface ChatMetadata {
  id: string;
  title: string;
  createdAt: string; // ISO string
  lastUpdated: string; // ISO string
}

/**
 * Storage utilities for persisting chat data to localStorage
 */
export const threadStorage = {
  /**
   * Load persisted messages for a specific chat
   */
  loadMessagesForChat(chatId: string): ThreadMessage[] {
    try {
      const key = getChatMessagesKey(chatId);
      const stored = localStorage.getItem(key);
      if (!stored) return [];

      const parsed = JSON.parse(stored);

      // Validate that it's an array
      if (!Array.isArray(parsed)) {
        console.warn(`Invalid messages format in localStorage for chat ${chatId}, clearing`);
        this.clearMessagesForChat(chatId);
        return [];
      }

      // Restore Date objects for createdAt fields
      return parsed.map((msg: any) => ({
        ...msg,
        createdAt: msg.createdAt ? new Date(msg.createdAt) : new Date(),
      }));
    } catch (error) {
      console.error(`Failed to load messages for chat ${chatId} from localStorage:`, error);
      this.clearMessagesForChat(chatId); // Clear corrupted data
      return [];
    }
  },

  /**
   * Save messages for a specific chat to localStorage
   */
  saveMessagesForChat(chatId: string, messages: readonly ThreadMessage[]): void {
    try {
      const key = getChatMessagesKey(chatId);

      // Serialize messages, converting Date objects to ISO strings
      const serialized = messages.map((msg) => ({
        ...msg,
        createdAt: msg.createdAt instanceof Date ? msg.createdAt.toISOString() : msg.createdAt,
      }));

      localStorage.setItem(key, JSON.stringify(serialized));

      // Update metadata
      this.updateChatMetadata(chatId, messages);
    } catch (error) {
      console.error(`Failed to save messages for chat ${chatId} to localStorage:`, error);

      // Check if quota exceeded
      if (error instanceof DOMException && error.name === "QuotaExceededError") {
        console.warn("LocalStorage quota exceeded. Consider implementing message pruning.");
      }
    }
  },

  /**
   * Update chat metadata (title, timestamps)
   */
  updateChatMetadata(chatId: string, messages: readonly ThreadMessage[]): void {
    try {
      const key = getChatMetadataKey(chatId);
      
      // Get or create metadata
      const existing = localStorage.getItem(key);
      const isNewChat = !existing;
      
      // Find first user and assistant messages
      const firstUserMessage = messages.find(msg => msg.role === 'user');
      const firstAssistantMessage = messages.find(msg => msg.role === 'assistant');
      
      // Generate title based on conversation
      // For the first exchange (user + assistant), generate a condensed 3-word title
      // Otherwise, use the first user message as fallback
      let title = 'New Chat';
      if (firstUserMessage && firstAssistantMessage) {
        title = this.generateCondensedTitle(firstUserMessage, firstAssistantMessage);
      } else if (firstUserMessage) {
        // If no assistant response yet, use the original method (fallback)
        title = this.extractTitleFromMessage(firstUserMessage);
      }

      const metadata: ChatMetadata = existing 
        ? { ...JSON.parse(existing), lastUpdated: new Date().toISOString() }
        : {
            id: chatId,
            title,
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
          };

      // Update title if we have both user and assistant messages (first exchange completed)
      // or if this is a new chat with at least a user message
      const previousTitle = existing ? JSON.parse(existing).title : null;
      if (firstUserMessage && firstAssistantMessage) {
        // First exchange completed - use condensed title
        metadata.title = this.generateCondensedTitle(firstUserMessage, firstAssistantMessage);
      } else if (firstUserMessage && isNewChat) {
        // New chat with only user message - use fallback until assistant responds
        metadata.title = this.extractTitleFromMessage(firstUserMessage);
      }

      localStorage.setItem(key, JSON.stringify(metadata));

      // Notify that chat metadata was created/updated (triggers chat list refresh)
      // Notify when: 1) metadata is first created (new chat), or 2) title changed (assistant responded)
      if (!existing || (previousTitle !== metadata.title && firstUserMessage && firstAssistantMessage)) {
        notifyChatUpdated(chatId);
      }
    } catch (error) {
      console.error(`Failed to update metadata for chat ${chatId}:`, error);
    }
  },

  /**
   * Extract a title from a message (first 50 chars of text content)
   */
  extractTitleFromMessage(message: ThreadMessage): string {
    const textContent = message.content
      .filter((part: any) => part.type === 'text')
      .map((part: any) => part.text || '')
      .join(' ')
      .trim();

    if (!textContent) return 'New Chat';
    
    // Take first 50 characters
    const title = textContent.substring(0, 50);
    return title.length < textContent.length ? `${title}...` : title;
  },

  /**
   * Generate a condensed 3-word-or-less title from the first conversation exchange
   * This creates a descriptive summary of what the chat is about
   */
  generateCondensedTitle(userMessage: ThreadMessage, assistantMessage: ThreadMessage): string {
    // Extract text content from both messages
    const extractText = (message: ThreadMessage): string => {
      return message.content
        .filter((part: any) => part.type === 'text')
        .map((part: any) => part.text || '')
        .join(' ')
        .trim()
        .toLowerCase();
    };

    const userText = extractText(userMessage);
    const assistantText = extractText(assistantMessage);

    if (!userText && !assistantText) return 'New Chat';

    // Combine both texts for context
    const combinedText = `${userText} ${assistantText}`;

    // Common stop words to filter out
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
      'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had',
      'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can',
      'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
      'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'her', 'its', 'our', 'their',
      'what', 'which', 'who', 'whom', 'whose', 'where', 'when', 'why', 'how',
      'show', 'me', 'please', 'thanks', 'thank', 'you', 'hi', 'hello', 'hey'
    ]);

    // Extract meaningful words (3+ characters, not stop words)
    const words = combinedText
      .split(/\s+/)
      .map(word => word.replace(/[^\w]/g, '')) // Remove punctuation
      .filter(word => word.length >= 3 && !stopWords.has(word));

    // Remove duplicates while preserving order
    const uniqueWords = Array.from(new Set(words));

    // Take up to 3 most relevant words
    // Prioritize words from user message first, then assistant
    const userWords = userText
      .split(/\s+/)
      .map(word => word.replace(/[^\w]/g, ''))
      .filter(word => word.length >= 3 && !stopWords.has(word));

    const titleWords: string[] = [];
    
    // First, add unique words from user message (up to 3)
    for (const word of userWords) {
      if (titleWords.length >= 3) break;
      if (!titleWords.includes(word)) {
        titleWords.push(word);
      }
    }

    // If we need more words, add from assistant response
    if (titleWords.length < 3) {
      const assistantWords = assistantText
        .split(/\s+/)
        .map(word => word.replace(/[^\w]/g, ''))
        .filter(word => word.length >= 3 && !stopWords.has(word));
      
      for (const word of assistantWords) {
        if (titleWords.length >= 3) break;
        if (!titleWords.includes(word)) {
          titleWords.push(word);
        }
      }
    }

    // If we still don't have enough, use any unique words from combined text
    if (titleWords.length < 3) {
      for (const word of uniqueWords) {
        if (titleWords.length >= 3) break;
        if (!titleWords.includes(word)) {
          titleWords.push(word);
        }
      }
    }

    // Capitalize first letter of each word and join
    const title = titleWords
      .slice(0, 3)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    return title || 'New Chat';
  },

  /**
   * Get metadata for a specific chat
   */
  getChatMetadata(chatId: string): ChatMetadata | null {
    try {
      const key = getChatMetadataKey(chatId);
      const stored = localStorage.getItem(key);
      if (!stored) return null;
      return JSON.parse(stored);
    } catch (error) {
      console.error(`Failed to load metadata for chat ${chatId}:`, error);
      return null;
    }
  },

  /**
   * Get all chat IDs from localStorage
   */
  getAllChatIds(): string[] {
    const chatIds: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_KEYS.METADATA_PREFIX)) {
          const chatId = key.replace(STORAGE_KEYS.METADATA_PREFIX, '');
          chatIds.push(chatId);
        }
      }
    } catch (error) {
      console.error('Failed to get all chat IDs:', error);
    }
    return chatIds;
  },

  /**
   * Clear messages for a specific chat
   */
  clearMessagesForChat(chatId: string): void {
    try {
      const key = getChatMessagesKey(chatId);
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Failed to clear messages for chat ${chatId}:`, error);
    }
  },

  /**
   * Clear all chat data for a specific chat
   */
  clearChat(chatId: string): void {
    this.clearMessagesForChat(chatId);
    try {
      const metadataKey = getChatMetadataKey(chatId);
      localStorage.removeItem(metadataKey);
    } catch (error) {
      console.error(`Failed to clear metadata for chat ${chatId}:`, error);
    }
  },

  /**
   * Clear all persisted chat data (all chats)
   */
  clearAll(): void {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith(STORAGE_KEYS.MESSAGES_PREFIX) || key.startsWith(STORAGE_KEYS.METADATA_PREFIX))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch (error) {
      console.error("Failed to clear all chat data:", error);
    }
  },
};
