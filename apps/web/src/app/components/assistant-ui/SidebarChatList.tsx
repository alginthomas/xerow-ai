/**
 * SidebarChatList — Claude.ai-style chat history
 * Clean single-line items with gradient mask fade on hover
 */

import { cn } from "../ui/utils";
import { useChatList, type Chat } from "../../../hooks/useChatList";

export interface SidebarChatListProps {
  currentChatId?: string;
  collapsed: boolean;
  onNewChat: () => void;
  onChatClick?: (chatId: string) => void;
  className?: string;
}

export function SidebarChatList({
  currentChatId,
  collapsed,
  onNewChat,
  onChatClick,
  className,
}: SidebarChatListProps) {
  const { chats, loading, error } = useChatList();

  if (collapsed) return null;

  return (
    <div className={cn("flex flex-col", className)}>
      {loading && (
        <div className="space-y-1 px-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 w-full rounded-lg bg-muted/40 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && !error && chats.length === 0 && (
        <p className="px-4 py-3 text-xs text-muted-foreground/60">No conversations yet</p>
      )}

      {!loading && !error && chats.length > 0 && (
        <ul className="flex flex-col gap-px px-2">
          {chats.map((chat) => (
            <li key={chat.id}>
              <button
                onClick={() => onChatClick?.(chat.id)}
                className={cn(
                  "w-full h-8 flex items-center rounded-lg px-3 text-sm transition-colors duration-75 text-left cursor-pointer",
                  "group hover:bg-accent/60 active:bg-accent",
                  currentChatId === chat.id
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground"
                )}
              >
                <span className="truncate flex-1 whitespace-nowrap group-hover:[mask-image:linear-gradient(to_right,black_78%,transparent_95%)] [mask-size:100%_100%]">
                  {chat.title || <span className="opacity-50">Untitled</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
