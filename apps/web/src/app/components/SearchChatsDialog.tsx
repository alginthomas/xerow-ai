import { useState, useMemo, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { X, Search } from 'lucide-react';
import { useChatList, type Chat } from '../../hooks/useChatList';
import { threadStorage } from '../../lib/thread-storage';
import type { ThreadMessage } from '@assistant-ui/react';

interface SearchChatsDialogProps {
  open: boolean;
  onClose: () => void;
  onLoadChat: (chatId: string) => void;
  onDeleteChat?: (chatId: string) => void;
}

const ITEMS_PER_PAGE = 20;

export function SearchChatsDialog({ 
  open, 
  onClose, 
  onLoadChat,
  onDeleteChat 
}: SearchChatsDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { chats, loading, error } = useChatList();
  const [chatMessages, setChatMessages] = useState<Map<string, ThreadMessage[]>>(new Map());
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Load messages for visible chats only (for search functionality)
  useEffect(() => {
    if (!open || chats.length === 0) return;

    const loadMessages = async () => {
      setLoadingMessages(true);
      const messagesMap = new Map<string, ThreadMessage[]>();
      
      // Only load messages for chats that are currently visible or match search
      const chatsToLoad = searchQuery.trim()
        ? chats.slice(0, Math.min(visibleCount, chats.length))
        : chats.slice(0, visibleCount);
      
      for (const chat of chatsToLoad) {
        try {
          // Only load if not already loaded
          if (!chatMessages.has(chat.id)) {
            const messages = threadStorage.loadMessagesForChat(chat.id);
            messagesMap.set(chat.id, messages);
          }
        } catch (error) {
          console.error(`Failed to load messages for chat ${chat.id}:`, error);
          messagesMap.set(chat.id, []);
        }
      }
      
      setChatMessages(prev => new Map([...prev, ...messagesMap]));
      setLoadingMessages(false);
    };

    loadMessages();
  }, [open, chats, visibleCount, searchQuery]);

  // Reset visible count when search query changes
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [searchQuery]);

  // Filter and group chat history by date
  const groupedChats = useMemo(() => {
    const filtered = searchQuery.trim() 
      ? chats.filter(chat => {
          const query = searchQuery.toLowerCase();
          const titleMatch = chat.title.toLowerCase().includes(query);
          
          // Search in messages if available
          const messages = chatMessages.get(chat.id) || [];
          const messageMatch = messages.some(msg => {
            if (msg.role === 'user') {
              const textContent = msg.content
                .filter((part: any) => part.type === 'text')
                .map((part: any) => part.text || '')
                .join(' ')
                .toLowerCase();
              return textContent.includes(query);
            }
            return false;
          });
          
          return titleMatch || messageMatch;
        })
      : chats;

    const now = new Date();
    const today: Chat[] = [];
    const yesterday: Chat[] = [];
    const older: Chat[] = [];

    filtered.forEach(chat => {
      const lastUpdated = new Date(chat.lastUpdated);
      const diffInMs = now.getTime() - lastUpdated.getTime();
      const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

      if (diffInDays < 1) {
        today.push(chat);
      } else if (diffInDays < 2) {
        yesterday.push(chat);
      } else {
        older.push(chat);
      }
    });

    return { today, yesterday, older };
  }, [chats, chatMessages, searchQuery]);

  // Get visible chats based on pagination
  const visibleChats = useMemo(() => {
    const allChats = [
      ...groupedChats.today,
      ...groupedChats.yesterday,
      ...groupedChats.older
    ];
    return allChats.slice(0, visibleCount);
  }, [groupedChats, visibleCount]);

  const hasMore = useMemo(() => {
    const allChats = [
      ...groupedChats.today,
      ...groupedChats.yesterday,
      ...groupedChats.older
    ];
    return visibleCount < allChats.length;
  }, [groupedChats, visibleCount]);

  // Infinite scroll observer
  useEffect(() => {
    if (!hasMore || loadingMessages || loading || !open) return;

    let observer: IntersectionObserver | null = null;
    let timeoutId: NodeJS.Timeout;

    // Wait for DOM to be ready
    timeoutId = setTimeout(() => {
      const viewport = scrollAreaRef.current?.querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement;
      if (!viewport || !observerTarget.current) return;

      observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMore && !loadingMessages && !loading) {
            setVisibleCount(prev => prev + ITEMS_PER_PAGE);
          }
        },
        {
          root: viewport,
          rootMargin: '100px',
          threshold: 0.1,
        }
      );

      const currentTarget = observerTarget.current;
      if (currentTarget) {
        observer.observe(currentTarget);
      }
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      if (observer) {
        const currentTarget = observerTarget.current;
        if (currentTarget) {
          observer.unobserve(currentTarget);
        }
        observer.disconnect();
      }
    };
  }, [hasMore, loadingMessages, loading, open]);

  const handleLoadChat = (chatId: string) => {
    onLoadChat(chatId);
    onClose();
    setSearchQuery('');
  };

  const handleClose = () => {
    onClose();
    setSearchQuery('');
    setVisibleCount(ITEMS_PER_PAGE);
  };

  const totalResults = groupedChats.today.length + groupedChats.yesterday.length + groupedChats.older.length;
  
  // Group visible chats by date
  const visibleGroupedChats = useMemo(() => {
    const now = new Date();
    const today: Chat[] = [];
    const yesterday: Chat[] = [];
    const older: Chat[] = [];

    visibleChats.forEach(chat => {
      const lastUpdated = new Date(chat.lastUpdated);
      const diffInMs = now.getTime() - lastUpdated.getTime();
      const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

      if (diffInDays < 1) {
        today.push(chat);
      } else if (diffInDays < 2) {
        yesterday.push(chat);
      } else {
        older.push(chat);
      }
    });

    return { today, yesterday, older };
  }, [visibleChats]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl bg-background border-border p-0 gap-0 max-h-[520px] flex flex-col rounded-3xl overflow-hidden [&>button]:hidden">
        {/* Visually hidden for accessibility */}
        <DialogTitle className="sr-only">Search Conversations</DialogTitle>
        <DialogDescription className="sr-only">
          Search through your chat history to find past conversations
        </DialogDescription>

        {/* Search Header */}
        <div className="px-6 py-5 shrink-0">
          <div className="flex items-center gap-3 bg-muted/50 rounded-full px-5 py-2.5 border border-border/50">
            <Search className="w-5 h-5 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent outline-none placeholder:text-muted-foreground text-foreground"
              autoFocus
            />
            <button
              onClick={handleClose}
              className="w-7 h-7 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors shrink-0"
            >
              <X className="w-4 h-4 text-primary" />
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border/50 shrink-0" />

        {/* Results */}
        <ScrollArea ref={scrollAreaRef} className="flex-1 min-h-0 overflow-hidden px-2 pb-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-muted-foreground animate-pulse" />
              </div>
              <p className="text-foreground font-medium mb-1">Loading chats...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <p className="text-destructive font-medium mb-1">Failed to load chats</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          ) : totalResults === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-foreground font-medium mb-1">
                {searchQuery ? 'No conversations found' : 'No chat history yet'}
              </p>
              <p className="text-sm text-muted-foreground">
                {searchQuery 
                  ? 'Try a different search term' 
                  : 'Start chatting to build your history'}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {/* Today */}
              {visibleGroupedChats.today.length > 0 && (
                <div className="mb-1">
                  <div className="px-4 py-2">
                    <p className="text-xs text-muted-foreground leading-4">Today</p>
                  </div>
                  {visibleGroupedChats.today.map((chat) => (
                    <button
                      key={chat.id}
                      onClick={() => handleLoadChat(chat.id)}
                      className="w-full text-left p-3 rounded-2xl hover:bg-sidebar-accent transition-colors group flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center shrink-0 group-hover:bg-muted transition-colors">
                        <Search className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">{chat.title}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Yesterday */}
              {visibleGroupedChats.yesterday.length > 0 && (
                <div className="mb-1">
                  <div className="px-4 py-2">
                    <p className="text-xs text-muted-foreground leading-4">Yesterday</p>
                  </div>
                  {visibleGroupedChats.yesterday.map((chat) => (
                    <button
                      key={chat.id}
                      onClick={() => handleLoadChat(chat.id)}
                      className="w-full text-left p-3 rounded-2xl hover:bg-sidebar-accent transition-colors group flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center shrink-0 group-hover:bg-muted transition-colors">
                        <Search className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">{chat.title}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Older */}
              {visibleGroupedChats.older.length > 0 && (
                <div className="mb-1">
                  <div className="px-4 py-2">
                    <p className="text-xs text-muted-foreground leading-4">Previous 7 days</p>
                  </div>
                  {visibleGroupedChats.older.map((chat) => (
                    <button
                      key={chat.id}
                      onClick={() => handleLoadChat(chat.id)}
                      className="w-full text-left p-3 rounded-2xl hover:bg-sidebar-accent transition-colors group flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center shrink-0 group-hover:bg-muted transition-colors">
                        <Search className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">{chat.title}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Infinite scroll trigger */}
              {hasMore && (
                <div ref={observerTarget} className="flex items-center justify-center py-4">
                  {loadingMessages ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                      <span>Loading more...</span>
                    </div>
                  ) : (
                    <div className="h-4" />
                  )}
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}