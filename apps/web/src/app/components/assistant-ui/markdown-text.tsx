/**
 * Markdown Text Component
 * Renders markdown text in assistant messages with proper formatting
 * Similar to Notion's markdown rendering
 */

import { useMessage } from "@assistant-ui/react";
import ReactMarkdown from "react-markdown";
import { useMemo } from "react";

export function MarkdownText() {
  const text = useMessage((message) => {
    const textParts = message.content
      .filter((part) => part.type === "text")
      .map((part) => part.text);
    return textParts.join("\n");
  });

  const hasQuestionnaireTool = useMessage((message) => {
    return message.content.some(
      (part: any) => part.type === "tool-call" && part.toolName === "show_questionnaire"
    );
  });

  // Hide text content if questionnaire tool is present
  if (hasQuestionnaireTool && text.trim()) {
    return null;
  }

  return (
    <div className="markdown-content leading-relaxed text-[15px]">
      <ReactMarkdown
        components={{
          // Bold text
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          // Italic text
          em: ({ children }) => (
            <em className="italic text-foreground">{children}</em>
          ),
          // Paragraphs
          p: ({ children }) => (
            <p className="mb-2 last:mb-0 text-foreground">{children}</p>
          ),
          // Unordered lists
          ul: ({ children }) => (
            <ul className="list-disc mb-2 space-y-1 text-foreground ml-6">
              {children}
            </ul>
          ),
          // Ordered lists
          ol: ({ children }) => (
            <ol className="list-decimal mb-2 space-y-1 text-foreground ml-6">
              {children}
            </ol>
          ),
          // List items
          li: ({ children }) => (
            <li className="text-foreground pl-2">{children}</li>
          ),
          // Headings
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold mb-2 mt-4 first:mt-0 text-foreground">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-bold mb-2 mt-4 first:mt-0 text-foreground">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold mb-2 mt-4 first:mt-0 text-foreground">
              {children}
            </h3>
          ),
          // Code blocks - react-markdown wraps code blocks in <pre>
          code: ({ children, className, ...props }) => {
            // If className exists, it's a code block (react-markdown adds language classes)
            // If no className, it's inline code
            const isInline = !className;
            if (isInline) {
              return (
                <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground">
                  {children}
                </code>
              );
            }
            // For code blocks, return plain code (pre will handle styling)
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          // Pre blocks (code blocks with triple backticks)
          pre: ({ children }) => (
            <pre className="bg-muted p-3 rounded-lg text-sm font-mono text-foreground overflow-x-auto mb-2 whitespace-pre">
              {children}
            </pre>
          ),
          // Links
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:text-primary/80"
            >
              {children}
            </a>
          ),
          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-border pl-4 italic my-2 text-muted-foreground">
              {children}
            </blockquote>
          ),
          // Horizontal rule
          hr: () => <hr className="my-4 border-border" />,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
