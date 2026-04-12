/**
 * App Sidebar — Claude.ai-inspired layout for Xerow AI
 * Pattern: Logo → New Chat → Nav → Recents (scrollable) → User footer
 */

import {
  LayoutDashboard,
  Wind,
  GitBranch,
  Droplet,
  Bot,
  TicketCheck,
  AlertTriangle,
  Settings,
  Plus,
  LogOut,
  UserCircle,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SidebarChatList } from './assistant-ui/SidebarChatList';
import { Button } from './ui/button';
import { useState, useEffect, useRef } from 'react';
import { cn } from './ui/utils';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from './ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import Group427320662 from '../../imports/Group427320662';

interface AppSidebarProps {
  user: any;
  onSignOut: () => void;
  onShowAuth: () => void;
  onNewChat: () => void;
  onChatClick?: (chatId: string) => void;
}

const NAV_ITEMS = [
  { path: '/overview', label: 'Overview', icon: LayoutDashboard },
  { path: '/assets/turbines', label: 'Turbines', icon: Wind },
  { path: '/assets/pipelines', label: 'Pipelines', icon: GitBranch },
  { path: '/assets/wells', label: 'Wells', icon: Droplet },
  { path: '/agents', label: 'Agents', icon: Bot },
  { path: '/tickets', label: 'Tickets', icon: TicketCheck },
  { path: '/escalation', label: 'Escalation', icon: AlertTriangle },
];

const PERSONA_LABEL: Record<string, string> = {
  tom: 'Field Operator',
  dick: 'Field Manager',
  harry: 'Chief Operator',
};

export function AppSidebar({ user, onSignOut, onShowAuth, onNewChat, onChatClick }: AppSidebarProps) {
  const { state: sidebarState, toggleSidebar } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const collapsed = sidebarState === 'collapsed';

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        onNewChat();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onNewChat]);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      {/* Header: Logo (expanded) or Expand button on hover (collapsed) */}
      <SidebarHeader className={cn("pt-3 pb-1", collapsed ? "px-0 flex items-center justify-center" : "px-3")}>
        {collapsed ? (
          /* Collapsed: show logo, on hover show expand button */
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleSidebar}
                  className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent/60 transition-colors cursor-pointer group/logo mx-auto"
                >
                  <div className="[&>div]:size-full h-5 w-5 group-hover/logo:hidden">
                    <Group427320662 />
                  </div>
                  <PanelLeftOpen className="h-4 w-4 text-muted-foreground hidden group-hover/logo:block" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Expand sidebar</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          /* Expanded: logo + name + collapse button */
          <div className="flex items-center justify-between h-8">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center [&>div]:size-full">
                <Group427320662 />
              </div>
              <span className="truncate font-semibold text-sm text-foreground">
                Xerow AI
              </span>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
                    onClick={toggleSidebar}
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Collapse sidebar</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="flex flex-col gap-0 overflow-hidden">
        {/* Top actions */}
        <div className={cn("flex flex-col gap-0.5 pt-2", collapsed ? "px-1 items-center" : "px-2")}>
          {/* New Chat */}
          <NavButton
            icon={Plus}
            label="New Chat"
            shortcut="⌘N"
            onClick={onNewChat}
            active={false}
            collapsed={collapsed}
            className="group"
            iconWrapper
          />

          {/* Nav Items */}
          {NAV_ITEMS.map((item) => (
            <NavButton
              key={item.path}
              icon={item.icon}
              label={item.label}
              onClick={() => navigate(item.path)}
              active={isActive(item.path)}
              collapsed={collapsed}
            />
          ))}

          {/* Settings */}
          <NavButton
            icon={Settings}
            label="Settings"
            onClick={() => navigate('/settings')}
            active={isActive('/settings')}
            collapsed={collapsed}
          />
        </div>

        {/* Recents — scrollable, fills remaining space */}
        <div className="flex-1 flex flex-col overflow-hidden mt-2">
          {!collapsed && (
            <div className="px-4 pb-1.5 pt-3">
              <h2 className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-wider select-none">
                Recents
              </h2>
            </div>
          )}
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <SidebarChatList
              collapsed={collapsed}
              onNewChat={onNewChat}
              onChatClick={onChatClick}
            />
          </div>
        </div>
      </SidebarContent>

      {/* Footer: User */}
      <SidebarFooter className={cn("border-t border-border/40 p-0", collapsed && "flex items-center justify-center")}>
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn(
                "flex items-center hover:bg-accent/40 transition-colors duration-75 cursor-pointer",
                collapsed ? "justify-center p-2" : "w-full gap-3 px-3 py-3 text-left"
              )}>
                {/* Avatar circle */}
                <div className={cn(
                  "flex shrink-0 items-center justify-center rounded-full bg-muted text-foreground font-bold select-none",
                  collapsed ? "h-8 w-8 text-xs" : "h-9 w-9 text-sm"
                )}>
                  {user.name?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || 'U'}
                </div>
                {!collapsed && (
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{user.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {PERSONA_LABEL[user.persona] || user.role || ''}
                    </div>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span>{user.name}</span>
                  <span className="font-normal text-xs text-muted-foreground">{user.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onSignOut} className="text-destructive">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <button
            onClick={onShowAuth}
            className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-accent/40 transition-colors cursor-pointer"
          >
            <UserCircle className="h-5 w-5 text-muted-foreground" />
            {!collapsed && <span className="text-sm text-muted-foreground">Sign In</span>}
          </button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

/* ── NavButton ─────────────────────────────────────── */

function NavButton({
  icon: Icon,
  label,
  shortcut,
  onClick,
  active,
  collapsed,
  className,
  iconWrapper,
}: {
  icon: typeof Plus;
  label: string;
  shortcut?: string;
  onClick: () => void;
  active: boolean;
  collapsed: boolean;
  className?: string;
  iconWrapper?: boolean;
}) {
  if (collapsed) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onClick}
              className={cn(
                'flex items-center justify-center h-9 w-9 rounded-lg transition-colors duration-75 cursor-pointer',
                'hover:bg-accent/60 active:bg-accent',
                active ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground',
                className
              )}
              aria-label={label}
            >
              <Icon className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">{label}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 h-8 rounded-lg px-3 text-sm transition-colors duration-75 cursor-pointer',
        'hover:bg-accent/60 active:bg-accent active:scale-[1.0]',
        active ? 'bg-accent text-foreground font-medium' : 'text-muted-foreground hover:text-foreground',
        className
      )}
      aria-label={label}
    >
      {iconWrapper ? (
        <div className="flex items-center justify-center rounded-full h-[1.3rem] w-[1.3rem] bg-muted/60 group-hover:bg-muted">
          <Icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
        </div>
      ) : (
        <Icon className="h-4 w-4 shrink-0" />
      )}
      <span className="truncate flex-1 text-left">{label}</span>
      {shortcut && (
        <span className="text-[11px] text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {shortcut}
        </span>
      )}
    </button>
  );
}
