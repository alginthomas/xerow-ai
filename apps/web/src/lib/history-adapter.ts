import type { ThreadHistoryAdapter, ThreadMessage } from "@assistant-ui/react";
import { threadStorage } from "./thread-storage";

/**
 * History adapter for persisting chat messages to localStorage
 * Implements assistant-ui's ThreadHistoryAdapter interface
 *
 * @param chatIdRef - Reference to the current chat ID. Can be updated dynamically.
 */
export function createThreadHistoryAdapter(chatIdRef: { current: string | undefined }): ThreadHistoryAdapter {
  return {
    /**
     * Load persisted messages when the runtime initializes
     * Called once on mount to restore conversation history
     */
    async load() {
      const chatId = chatIdRef.current;

      // If no chatId, return empty messages (new chat)
      if (!chatId) {
        console.log('[History Adapter] No chatId provided, starting with empty messages');
        return {
          messages: [],
          unstable_resume: false,
        };
      }

      // Defer localStorage operations to avoid blocking initial render
      // Use requestIdleCallback if available for better performance
      const messages = await new Promise<ThreadMessage[]>((resolve) => {
        const loadMessages = () => {
          try {
            const loaded = threadStorage.loadMessagesForChat(chatId);
            resolve(loaded);
          } catch (error) {
            console.error('[History Adapter] Error loading messages:', error);
            resolve([]);
          }
        };

        // Use requestIdleCallback if available (better for performance)
        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
          requestIdleCallback(loadMessages, { timeout: 100 });
        } else {
          // Fallback to setTimeout
          setTimeout(loadMessages, 0);
        }
      });

      console.log(`[History Adapter] Loaded ${messages.length} messages for chat ${chatId}`);

      // Convert to ExportedMessageRepository format
      // Build proper parent chain: first message has null parent, rest reference previous message
      return {
        messages: messages.map((msg, index) => ({
          message: msg,
          parentId: index === 0 ? null : messages[index - 1].id,
        })),
        // Don't try to resume incomplete conversations on restore
        unstable_resume: false,
      };
    },

    /**
     * Append a new message to localStorage
     * Called whenever a message is added to the conversation
     */
    async append(item) {
      // Get current chatId from ref (may have been updated since adapter creation)
      const chatId = chatIdRef.current;

      // If no chatId, skip persistence (will persist after session is initialized)
      if (!chatId) {
        console.log('[History Adapter] Skipping append - chatId not yet available (will persist after initialization)');
        return;
      }

      try {
        // Extract the message from the ExportedMessageRepositoryItem
        const message = item.message;

        // Load existing messages
        const existingMessages = threadStorage.loadMessagesForChat(chatId);

        // Check if message already exists (avoid duplicates)
        const messageExists = existingMessages.some((m) => m.id === message.id);
        if (messageExists) {
          console.log(`[History Adapter] Message ${message.id} already exists for chat ${chatId}, skipping`);
          return;
        }

        // Add the new message
        const updatedMessages = [...existingMessages, message];

        // Save back to localStorage
        // This will automatically create/update metadata and trigger notification
        threadStorage.saveMessagesForChat(chatId, updatedMessages);

        console.log(`[History Adapter] Saved message ${message.id} for chat ${chatId}`, {
          role: message.role,
          contentLength: message.content.length,
        });
      } catch (error) {
        console.error(`[History Adapter] Failed to append message for chat ${chatId}:`, error);
        // Don't throw - allow conversation to continue even if persistence fails
      }
    },
  };
}
