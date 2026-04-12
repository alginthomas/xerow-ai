/**
 * Thread Component using Assistant-UI Primitives
 * Main chat interface component
 */

import {
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ActionBarPrimitive,
  ErrorPrimitive,
  useThread,
  useComposerRuntime,
  useThreadRuntime,
} from "@assistant-ui/react";
import { ArrowUpIcon, CopyIcon, CheckIcon, RefreshCwIcon, ArrowRight, PencilIcon, SearchIcon } from "lucide-react";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { MarkdownText } from "./markdown-text";
import { ToolFallback } from "./tool-fallback";
import Group427320662 from '../../../imports/Group427320662';
import { ShiftBriefing } from '../ShiftBriefing';
import { useState, useEffect, useRef } from "react";
import { useChatContext } from "./ChatContext";
import { LazyMotion, MotionConfig, domAnimation } from "motion/react";
import * as m from "motion/react-m";

export interface SuggestedPrompt {
  title: string;
  label: string;
  action: string;
}

// Default suggested prompts — industrial monitoring
const defaultSuggestedPrompts: SuggestedPrompt[] = [
  {
    title: "Check All Turbines",
    label: "Asset status overview",
    action: "Show me the status of all turbines",
  },
  {
    title: "Open Red Tickets",
    label: "Urgent SLA items",
    action: "Show me all open red severity tickets",
  },
  {
    title: "Today's Anomalies",
    label: "Recent detections",
    action: "What anomalies were detected today?",
  },
  {
    title: "Pipeline Health",
    label: "Pressure & flow check",
    action: "Show me pipeline status across all regions",
  },
];

interface ThreadProps {
  suggestedPrompts?: SuggestedPrompt[];
}

export function Thread({ suggestedPrompts }: ThreadProps) {
  const messages = useThread((t) => t.messages);
  const [hasStartedChat, setHasStartedChat] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const { user } = useChatContext();
  const threadRuntime = useThreadRuntime();

  // Track when the first message is sent
  useEffect(() => {
    if (messages.length > 0 && !hasStartedChat) {
      setHasStartedChat(true);
    }
  }, [messages.length, hasStartedChat]);

  const thread = useThread();
  const isRunning = thread.isRunning;

  // Track user scroll position to show/hide scroll-to-bottom button
  useEffect(() => {
    const viewport = document.querySelector('[data-viewport-ref="true"]') as HTMLElement;
    if (!viewport) return;

    const handleScroll = () => {
      const threshold = 100; // pixels from bottom
      const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      const isNearBottom = distanceFromBottom < threshold;
      setShowScrollToBottom(!isNearBottom && distanceFromBottom > 50);
    };

    viewport.addEventListener('scroll', handleScroll, { passive: true });
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user">
        <ThreadPrimitive.Root
          className="h-full w-full flex flex-col bg-background border-l border-border/40"
          style={{
            ["--thread-max-width" as string]: "44rem",
          }}
        >
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        <ThreadPrimitive.Viewport
          className="relative flex flex-1 flex-col items-center overflow-x-auto overflow-y-auto px-4"
          data-viewport-ref="true"
        >
          {/* Scroll to bottom button - shown when user scrolls up */}
          {showScrollToBottom && (
            <m.div
              className="fixed bottom-20 right-4 z-30"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
            >
              <Button
                size="icon"
                className="h-10 w-10 rounded-full shadow-lg"
                onClick={() => {
                  const viewport = document.querySelector('[data-viewport-ref="true"]') as HTMLElement;
                  if (viewport) {
                    viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
                    setShowScrollToBottom(false);
                  }
                }}
                aria-label="Scroll to bottom"
              >
                <ArrowUpIcon className="h-5 w-5" />
              </Button>
            </m.div>
          )}
          {/* Empty State — vertically + horizontally centered like Claude.ai */}
          <ThreadPrimitive.If empty>
            <m.div
              className="flex flex-1 flex-col items-center justify-center w-full min-h-0 px-4"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="w-full max-w-[40rem] space-y-6">
                {/* Shift Briefing — proactive summary */}
                <ShiftBriefing />

                <div className="text-center space-y-3">
                  <div className="inline-flex items-center justify-center w-14 h-14 mb-2">
                    <Group427320662 />
                  </div>
                  <h1 className="text-foreground text-2xl font-medium">Xerow AI</h1>
                </div>

                {/* Centered Composer — placed before chips like Claude.ai */}
                <CenteredComposer />

                {/* Suggested Prompts */}
                <ThreadSuggestions suggestedPrompts={suggestedPrompts || defaultSuggestedPrompts} />
              </div>
            </m.div>
          </ThreadPrimitive.If>

          {/* With Messages */}
          <ThreadPrimitive.If empty={false}>
            <ThreadPrimitive.Messages
              components={{
                UserMessage,
                EditComposer,
                AssistantMessage,
              }}
            />
            <div className="aui-thread-viewport-spacer min-h-8 grow" />
          </ThreadPrimitive.If>
        </ThreadPrimitive.Viewport>

        {/* Composer pinned outside viewport so it sticks at bottom */}
        <ThreadPrimitive.If empty={false}>
          <Composer />
        </ThreadPrimitive.If>
      </div>
    </ThreadPrimitive.Root>
      </MotionConfig>
    </LazyMotion>
  );
}

// Scroll to Bottom Component
const ThreadScrollToBottom = () => {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <div className="hidden" />
    </ThreadPrimitive.ScrollToBottom>
  );
};

// User Message Component
const UserMessage = () => {
  return (
    <MessagePrimitive.Root asChild>
      <div className="mx-auto grid w-full max-w-[var(--thread-max-width)] grid-cols-[minmax(72px,1fr)_auto] gap-y-2 px-2 py-4 animate-in fade-in slide-in-from-bottom-1 group">
        <div className="col-start-2 min-w-0 relative">
          <div className="rounded-3xl bg-muted px-5 py-2.5 break-words text-foreground">
            <MessagePrimitive.Parts
              components={{
                Text: ({ text }) => (
                  <div className="whitespace-pre-wrap">{text}</div>
                ),
              }}
            />
          </div>
          {/* Action Bar - positioned to the left of the message */}
          <div className="absolute top-1/2 -left-12 -translate-y-1/2 opacity-100 group-hover:opacity-100 transition-opacity z-10">
            <UserActionBar />
          </div>
        </div>
      </div>
    </MessagePrimitive.Root>
  );
};

// User Action Bar Component
const UserActionBar = () => {
  const handleEdit = () => {
    console.log('[UserActionBar] Edit button clicked');
  };

  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="flex flex-col items-end gap-1"
    >
      <ActionBarPrimitive.Edit asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          type="button"
          onClick={handleEdit}
        >
          <PencilIcon className="h-4 w-4" />
        </Button>
      </ActionBarPrimitive.Edit>
    </ActionBarPrimitive.Root>
  );
};

// Assistant Message Component
const AssistantMessage = () => {
  return (
    <MessagePrimitive.Root asChild>
      <div className="relative mx-auto w-full max-w-[var(--thread-max-width)] py-4 animate-in fade-in slide-in-from-bottom-1 last:mb-24">
        <div className="mx-2 leading-7 break-words text-foreground">
          <MessagePrimitive.Parts
            components={{
              Text: MarkdownText,
              tools: { Fallback: ToolFallback },
            }}
          />
          
          <MessageError />
        </div>

        <div className="mt-2 ml-2 flex gap-1">
          <AssistantActionBar />
        </div>
      </div>
    </MessagePrimitive.Root>
  );
};

// Floating Compare Button Component
// CompareButton removed — e-commerce feature no longer needed

// Assistant Action Bar
const AssistantActionBar = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="flex gap-1 text-muted-foreground"
    >
      <ActionBarPrimitive.Copy asChild>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MessagePrimitive.If copied>
                <CheckIcon className="h-4 w-4" />
              </MessagePrimitive.If>
              <MessagePrimitive.If copied={false}>
                <CopyIcon className="h-4 w-4" />
              </MessagePrimitive.If>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Copy</TooltipContent>
        </Tooltip>
      </ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Reload asChild>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <RefreshCwIcon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh</TooltipContent>
        </Tooltip>
      </ActionBarPrimitive.Reload>
    </ActionBarPrimitive.Root>
  );
};

// Message Error Component
const MessageError = () => {
  return (
    <MessagePrimitive.Error>
      <ErrorPrimitive.Root className="mt-2 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
        <ErrorPrimitive.Message className="line-clamp-2" />
      </ErrorPrimitive.Root>
    </MessagePrimitive.Error>
  );
};

// Edit Composer Component
const EditComposer = () => {
  return (
    <div className="mx-auto flex w-full max-w-[var(--thread-max-width)] flex-col gap-4 px-2 first:mt-4">
      <ComposerPrimitive.Root className="ml-auto flex w-full max-w-7/8 flex-col rounded-xl bg-muted border border-border">
        <ComposerPrimitive.Input
          className="flex min-h-[60px] w-full resize-none bg-transparent p-4 text-foreground outline-none placeholder:text-muted-foreground"
          autoFocus
          placeholder="Edit your message..."
        />
        <div className="mx-3 mb-3 flex items-center justify-center gap-2 self-end">
          <ComposerPrimitive.Cancel asChild>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm">
                  Cancel
                </Button>
              </TooltipTrigger>
              <TooltipContent>Cancel editing</TooltipContent>
            </Tooltip>
          </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send asChild>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" className="bg-primary hover:bg-primary/90">
                  Update
                </Button>
              </TooltipTrigger>
              <TooltipContent>Send updated message</TooltipContent>
            </Tooltip>
          </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
    </div>
  );
};

// Thread Suggestions Component
interface ThreadSuggestionsProps {
  suggestedPrompts?: SuggestedPrompt[];
}

const ThreadSuggestions = ({ suggestedPrompts }: ThreadSuggestionsProps) => {
  const prompts = suggestedPrompts || defaultSuggestedPrompts;

  return (
    <div className="grid w-full gap-3 pt-4 pb-4 grid-cols-1 sm:grid-cols-2">
      {prompts.map((suggestedAction, index) => (
        <m.div
          key={`suggested-action-${suggestedAction.title}-${index}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ delay: 0.05 * index }}
          className="suggestion-display h-full"
        >
          <ThreadPrimitive.Suggestion
            prompt={suggestedAction.action}
            send
            asChild
          >
            <Button
              variant="ghost"
              className="h-full w-full min-h-[90px] flex flex-col items-start justify-center gap-1.5 rounded-3xl border px-5 pt-4 pb-3 text-left text-sm hover:bg-accent/60 transition-all"
              aria-label={suggestedAction.action}
            >
              <span className="font-medium whitespace-normal break-words text-base leading-tight">
                {suggestedAction.title}
              </span>
              <span className="text-muted-foreground whitespace-normal break-words text-sm leading-relaxed">
                {suggestedAction.label}
              </span>
            </Button>
          </ThreadPrimitive.Suggestion>
        </m.div>
      ))}
    </div>
  );
};

// Centered Composer (for empty state)
const CenteredComposer = () => {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div className="mx-auto flex w-full flex-col gap-4 overflow-visible mt-4">
      <ComposerPrimitive.Root className="relative flex w-full flex-col rounded-3xl bg-sidebar border border-border/60 px-1 pt-2 shadow-sm">
        <div className="relative flex items-center gap-2 mb-1">
          <ComposerPrimitive.Input
            ref={inputRef}
            placeholder="Ask about assets, anomalies, tickets, or operations..."
            className="flex-1 max-h-32 min-h-16 resize-none bg-transparent px-3.5 pt-1.5 pb-3 text-base outline-none placeholder:text-muted-foreground focus:outline-sidebar-ring text-sidebar-foreground"
            rows={1}
            autoFocus
            aria-label="Message input"
            data-composer-input
          />
        </div>
        <ComposerAction />
      </ComposerPrimitive.Root>
    </div>
  );
};

// Web Search Button Component
const WebSearchButton = () => {
  const threadRuntime = useThreadRuntime();
  const composerRuntime = useComposerRuntime();
  const thread = useThread();
  const isRunning = thread.isRunning;

  const handleWebSearch = () => {
    if (!threadRuntime || isRunning) {
      return;
    }

    // Get current input value from composer state
    const composerState = composerRuntime?.getState();
    const inputValue = composerState?.text || '';
    const query = inputValue.trim();

    // If there's text in the input, use it as the search query
    // Otherwise, prompt user to enter a search query
    if (query) {
      // Send message that will trigger web search
      threadRuntime.append({
        role: 'user',
        content: [{ type: 'text', text: `Search the web for: ${query}` }],
      });
      
      // Clear the composer input
      if (composerRuntime) {
        composerRuntime.setValue('');
      }
    } else {
      // Prompt user to enter a search query
      threadRuntime.append({
        role: 'user',
        content: [{ type: 'text', text: 'Search the web for current information' }],
      });
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full hover:bg-accent border border-border/50"
          onClick={handleWebSearch}
          disabled={isRunning}
          aria-label="Search the web"
        >
          <SearchIcon className="h-5 w-5 text-muted-foreground" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">Search the web</TooltipContent>
    </Tooltip>
  );
};

// Composer Component (Bottom Input - for when there are messages)
const Composer = () => {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  return (
    <m.div
      className="sticky bottom-0 z-20 mx-auto flex w-full max-w-[var(--thread-max-width)] flex-col gap-4 overflow-visible rounded-t-3xl bg-background pb-4 md:pb-6 pt-0"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <div className="relative flex justify-end" />
      <ComposerPrimitive.Root className="relative flex w-full flex-col rounded-3xl bg-sidebar border border-border/60 px-1 pt-2 shadow-sm">
        <div className="relative flex items-center gap-2 mb-1">
          <ComposerPrimitive.Input
            ref={inputRef}
            placeholder="Ask about assets, anomalies, tickets, or operations..."
            className="flex-1 max-h-32 min-h-16 resize-none bg-transparent px-3.5 pt-1.5 pb-3 text-base outline-none placeholder:text-muted-foreground focus:outline-sidebar-ring text-sidebar-foreground"
            rows={1}
            autoFocus
            aria-label="Message input"
            data-composer-input
          />
        </div>
        <ComposerAction />
      </ComposerPrimitive.Root>
    </m.div>
  );
};

// Composer Action (Send Button)
const ComposerAction = () => {
  const thread = useThread();

  return (
    <div className="relative mx-1 mt-2 mb-2 flex items-center justify-end">
      <ThreadPrimitive.If running={false}>
        <ComposerPrimitive.Send asChild>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="submit"
                size="icon"
                className="h-8 w-8 rounded-full bg-primary hover:bg-primary/90"
              >
                <ArrowUpIcon className="h-4 w-4 text-background" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Send message</TooltipContent>
          </Tooltip>
        </ComposerPrimitive.Send>
      </ThreadPrimitive.If>

      <ThreadPrimitive.If running>
        <ComposerPrimitive.Cancel asChild>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                className="h-8 w-8 rounded-full bg-primary hover:bg-primary/90"
              >
                <div className="h-4 w-4 rounded-sm bg-background" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Stop generating</TooltipContent>
          </Tooltip>
        </ComposerPrimitive.Cancel>
      </ThreadPrimitive.If>
    </div>
  );
};
