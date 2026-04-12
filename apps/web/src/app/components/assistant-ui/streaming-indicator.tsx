/**
 * Streaming Indicator Component
 * Smart indicator that shows when assistant is thinking/generating
 * - Shows when waiting for first chunk
 * - Hides when content is actively streaming
 * - Shows again during pauses (no new content for 1000ms)
 * - Hides when generation completes
 * - Only shows for the last message in the thread
 */

import { useState, useEffect, useRef } from "react";
import { useThread, useMessage } from "@assistant-ui/react";
import { ThinkingIndicator } from "./thinking-indicator";

export function StreamingIndicator() {
  const thread = useThread();
  const message = useMessage();
  const [showIndicator, setShowIndicator] = useState(true);
  const lastContentRef = useRef("");
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Get the last message (assistant's message)
  const messages = thread.messages || [];
  const lastMessage = messages[messages.length - 1];
  const isRunning = thread.isRunning;

  // Extract text content from message
  const currentContent = lastMessage?.content
    ?.filter((part: any) => part.type === "text")
    .map((part: any) => part.text)
    .join("") || "";

  // Only show indicator for the last message
  const isLastMessage = message.id === lastMessage?.id;

  useEffect(() => {
    // If not the last message, do nothing
    if (!isLastMessage) {
      return;
    }

    // If not running, hide indicator
    if (!isRunning) {
      setShowIndicator(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      return;
    }

    // If no content yet, show indicator
    if (!currentContent) {
      setShowIndicator(true);
      return;
    }

    // If content changed (actively streaming)
    if (currentContent !== lastContentRef.current) {
      lastContentRef.current = currentContent;
      setShowIndicator(false); // Hide while streaming

      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new timeout - show indicator if no updates for 1000ms
      timeoutRef.current = setTimeout(() => {
        if (isRunning) {
          setShowIndicator(true); // Show during pause
        }
      }, 1000);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [currentContent, isRunning, isLastMessage]);

  // Only show if this is the last message, running, and indicator flag is true
  if (!isLastMessage || !isRunning || !showIndicator) {
    return null;
  }

  return <ThinkingIndicator className="pt-3" />;
}
