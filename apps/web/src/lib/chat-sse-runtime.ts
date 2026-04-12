/**
 * Simple Fetch Adapter for Python Agent
 * Replaces SSE streaming with standard POST to Python backend
 * Simulates stream events to keep UI compatible
 */

const PURE_PYTHON_API = 'http://localhost:8000/api/chat';

export interface ToolCallData {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  args: Record<string, any>;
  result?: any;
  state?: 'running' | 'complete' | 'error';
}

export interface ChatSSEAdapter {
  run(options: {
    messages: Array<{ role: string; content: string }>;
    context?: Record<string, any>;
    abortSignal?: AbortSignal;
  }): AsyncGenerator<{ content: Array<{ type: string; text?: string } | ToolCallData> }>;
}

/**
 * Create Adapter for Python Agent
 */
export function createChatSSEAdapter(): ChatSSEAdapter {
  return {
    async *run({ messages, context, abortSignal }) {
      // Get the last user message
      const lastMessage = messages[messages.length - 1];
      const userText = lastMessage?.content || '';

      // Simple session ID (in a real app, manage this via context or local storage)
      const sessionId = localStorage.getItem('chat_session_id') || 'session-' + Date.now();
      localStorage.setItem('chat_session_id', sessionId);

      try {
        const response = await fetch(PURE_PYTHON_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userText,
            session_id: sessionId,
            context: context || {}
          }),
          signal: abortSignal
        });

        if (!response.ok) {
          throw new Error(`Agent Error: ${response.statusText}`);
        }

        const data = await response.json();
        const contentParts: any[] = [];

        // 1. Collect Tool Calls (Widgets)
        if (data.steps && Array.isArray(data.steps)) {
          for (const step of data.steps) {
            contentParts.push({
              type: 'tool-call',
              toolCallId: step.id,
              toolName: step.name,
              args: step.args || {},
              result: step.result,
              state: 'complete'
            });
          }
        }

        // 2. Collect Final Text Response
        contentParts.push({ type: 'text', text: data.content });

        // Yield EVERYTHING in one go so ChatInterface doesn't wipe previous state
        yield { content: contentParts };

      } catch (error) {
        console.error("Agent API Error", error);
        yield {
          content: [{ type: 'text', text: "Error connecting to Agent API. Make sure `server.py` is running." }]
        };
      }
    },
  };
}
