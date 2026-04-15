/**
 * Assistant-UI Adapter for Python MCP Agent
 * Connects to Python FastAPI server at http://localhost:8000/api/chat/stream
 * Uses SSE streaming for real-time responses with Supabase vector search
 */

import type { ChatModelAdapter, ThreadMessage } from "@assistant-ui/react";

// In production, always use '' (relative) so Netlify proxies /api/chat/* → Railway agent.
// Never point the browser directly at localhost in production — that causes CORS failures.
// VITE_PYTHON_AGENT_URL is only honoured when it is a non-localhost URL (useful for staging).
const _agentEnv = import.meta.env.VITE_PYTHON_AGENT_URL ?? '';
const _isLocalhost = _agentEnv.includes('localhost') || _agentEnv.includes('127.0.0.1');
const PYTHON_AGENT_URL = import.meta.env.DEV
  ? (_agentEnv || 'http://localhost:8000')   // dev: env var or default to local
  : (_agentEnv && !_isLocalhost ? _agentEnv : ''); // prod: env var only if non-local, else proxy
const API_ENDPOINT = `${PYTHON_AGENT_URL}/api/chat`;

export interface ToolCallData {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  args: Record<string, any>;
  result?: any;
  state?: 'running' | 'complete' | 'error';
}

/**
 * Generate a unique session ID (client-side)
 * In a production app, this would call an API endpoint like brackett does
 * Brackett uses: uuid.uuid4().hex[:12] (12 character hex string)
 */
function generateSessionId(): string {
  // Generate a unique session ID similar to brackett's format
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 14);
  return `${timestamp}${random}`.substring(0, 12);
}

export interface AssistantUIAdapterOptions {
  initialSessionId?: string;
  sessionIdRef?: { current: string | undefined };
  /** Called when session is initialized */
  onSessionInitialized?: (sessionId: string, messages: ThreadMessage[]) => void;
}

/**
 * Create Assistant-UI compatible adapter for Python Agent
 * Creates a new session_id for each new chat (following brackett's pattern)
 */
export function createAssistantUIAdapter(options?: AssistantUIAdapterOptions): ChatModelAdapter {
  // Store session ID per adapter instance (new session for each new chat)
  // This ensures each Chat component instance gets its own session
  // If initialSessionId is provided, use it (existing chat)
  // Otherwise, will be set lazily on first message
  let sessionId: string | null = options?.initialSessionId || null;

  console.log('[Assistant-UI Adapter] Created with initialSessionId:', options?.initialSessionId);

  // If we have an initialSessionId, update the ref immediately
  if (options?.initialSessionId && options?.sessionIdRef) {
    options.sessionIdRef.current = options.initialSessionId;
  }

  return {
    async *run({ messages, abortSignal }) {
      console.log('[Assistant-UI Adapter] run() called, current sessionId:', sessionId, 'messages:', messages.length);

      // Check if this is the first message (for onSessionInitialized callback)
      const isFirstMessage = !sessionId;

      // Priority order for setting sessionId:
      // 1. Use existing sessionId if already set (from initialSessionId)
      // 2. Use sessionIdRef.current if available (preloaded session)
      // 3. Create new session (new chat)

      if (!sessionId) {
        if (options?.sessionIdRef?.current) {
          // Use preloaded session from ref
          sessionId = options.sessionIdRef.current;
          console.log('[Assistant-UI Adapter] Using preloaded session from ref:', sessionId);
        } else {
          // Lazy initialization - create new session on first message
          sessionId = generateSessionId();
          console.log('[Assistant-UI Adapter] Initialized new session:', sessionId);

          // Update ref if provided
          if (options?.sessionIdRef) {
            options.sessionIdRef.current = sessionId;
          }
        }
      } else {
        // SessionId already set (from initialSessionId - existing chat)
        console.log('[Assistant-UI Adapter] Using existing sessionId:', sessionId);
      }

      // Get the last user message
      const lastMessage = messages[messages.length - 1];

      // Extract text content from message
      const userText = lastMessage.content
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n");

      // Notify parent component on first message send (like brackett)
      if (isFirstMessage && sessionId && options?.onSessionInitialized) {
        options.onSessionInitialized(sessionId, Array.from(messages) as ThreadMessage[]);
      }

      try {
        // Use Python MCP Agent - SSE streaming endpoint
        const STREAM_ENDPOINT = `${PYTHON_AGENT_URL}/api/chat/stream`;

        const response = await fetch(STREAM_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: userText,
            session_id: sessionId,
            context: {} // Can pass selected_ids or other context here
          }),
          signal: abortSignal
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API Error: ${response.status} - ${errorText}`);
        }

        // Parse SSE stream
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('No response body reader available');
        }

        let buffer = '';
        let accumulatedText = '';
        let currentEventType: string | null = null;
        const toolCalls: Map<string, any> = new Map();

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEventType = line.substring(7).trim();
            } else if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6));

                if (currentEventType === 'session') {
                  // Session initialization - update sessionId if provided by server
                  if (data.session_id && options?.sessionIdRef) {
                    options.sessionIdRef.current = data.session_id;
                  }
                } else if (currentEventType === 'text') {
                  // Incremental text - accumulate and yield
                  if (data.text) {
                    accumulatedText += data.text;
                    yield {
                      content: [{
                        type: 'text' as const,
                        text: accumulatedText
                      }]
                    };
                  }
                } else if (currentEventType === 'tool') {
                  // Tool call or result
                  if (data.type === 'tool-call') {
                    // Tool is being called
                    const toolCall = {
                      type: 'tool-call' as const,
                      toolCallId: data.toolCallId,
                      toolName: data.toolName,
                      args: data.args || {},
                    };
                    toolCalls.set(data.toolCallId, toolCall);

                    // Yield current state with tool call
                    const contentParts: any[] = [];
                    toolCalls.forEach(tc => contentParts.push(tc));
                    if (accumulatedText) {
                      contentParts.push({ type: 'text' as const, text: accumulatedText });
                    }
                    yield { content: contentParts };

                  } else if (data.type === 'tool-result') {
                    // Tool completed with result
                    const existingCall = toolCalls.get(data.toolCallId);
                    if (existingCall) {
                      existingCall.result = data.result;
                      toolCalls.set(data.toolCallId, existingCall);
                    }

                    // Yield updated state with result
                    const contentParts: any[] = [];
                    toolCalls.forEach(tc => contentParts.push(tc));
                    if (accumulatedText) {
                      contentParts.push({ type: 'text' as const, text: accumulatedText });
                    }
                    yield { content: contentParts };

                  } else if (data.type === 'tool-error') {
                    // Tool failed
                    const existingCall = toolCalls.get(data.toolCallId);
                    if (existingCall) {
                      existingCall.result = { error: data.error };
                      toolCalls.set(data.toolCallId, existingCall);
                    }
                  }
                } else if (currentEventType === 'done') {
                  // Stream complete - yield final state
                  const contentParts: any[] = [];
                  toolCalls.forEach(tc => contentParts.push(tc));
                  if (accumulatedText) {
                    contentParts.push({ type: 'text' as const, text: accumulatedText });
                  }
                  if (contentParts.length > 0) {
                    yield { content: contentParts };
                  }
                  break;
                } else if (currentEventType === 'error') {
                  throw new Error(data.error || 'Stream error occurred');
                }

                currentEventType = null;
              } catch (parseError) {
                if (parseError instanceof SyntaxError) {
                  console.warn('[SSE] Failed to parse line:', line);
                } else {
                  throw parseError;
                }
                currentEventType = null;
              }
            } else if (line.trim() === '') {
              currentEventType = null;
            }
          }
        }

      } catch (error) {
        console.error("Python MCP Agent Streaming Error", error);

        // Handle abort gracefully
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }

        // Provide more detailed error message
        let errorMessage = "Xerow AI agent is not reachable. ";

        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
          errorMessage += "The agent server appears to be offline.\n\n";
          errorMessage += "To start it, run: `python3 apps/mcp-agent/server.py`\n";
          errorMessage += "The agent should be running at http://localhost:8000";
        } else if (error instanceof Error) {
          errorMessage += error.message;
        } else {
          errorMessage += "An unexpected error occurred. Please try again.";
        }

        yield {
          content: [{
            type: 'text' as const,
            text: errorMessage
          }]
        };
      }
    },
  };
}
