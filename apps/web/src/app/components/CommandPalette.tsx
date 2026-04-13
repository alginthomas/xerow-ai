/**
 * CommandPalette — Cmd+K global search for assets, tickets, anomalies
 */

import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from './ui/command';
import { API_BASE } from '../../lib/config';
import {
  Wind, GitBranch, Droplet, TicketCheck, AlertTriangle, LayoutDashboard,
  Bot, Settings, Activity, MessageSquarePlus,
} from 'lucide-react';


function getToken() { return localStorage.getItem('auth_token'); }

interface CommandPaletteProps {
  onNewChat: () => void;
}

const TYPE_ICONS: Record<string, typeof Wind> = {
  turbine: Wind, pipeline: GitBranch, well: Droplet,
};

export function CommandPalette({ onNewChat }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const [assets, setAssets] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);

  // Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Fetch data when opened
  useEffect(() => {
    if (!open) return;
    const token = getToken();
    if (!token) return;

    Promise.all([
      fetch(`${API_BASE}/api/v1/assets?limit=20`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(`${API_BASE}/api/v1/tickets?limit=10`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ]).then(([assetRes, ticketRes]) => {
      setAssets(assetRes.data || []);
      setTickets(ticketRes.data || []);
    }).catch(console.error);
  }, [open]);

  const go = useCallback((path: string) => {
    setOpen(false);
    navigate(path);
  }, [navigate]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search assets, tickets, or type a command..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Quick Navigation */}
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => go('/')}>
            <MessageSquarePlus className="mr-2 h-4 w-4" />
            New Chat
          </CommandItem>
          <CommandItem onSelect={() => go('/overview')}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Overview Dashboard
          </CommandItem>
          <CommandItem onSelect={() => go('/tickets')}>
            <TicketCheck className="mr-2 h-4 w-4" />
            Tickets
          </CommandItem>
          <CommandItem onSelect={() => go('/escalation')}>
            <AlertTriangle className="mr-2 h-4 w-4" />
            Escalation
          </CommandItem>
          <CommandItem onSelect={() => go('/agents')}>
            <Bot className="mr-2 h-4 w-4" />
            Agents
          </CommandItem>
          <CommandItem onSelect={() => go('/settings')}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Assets */}
        {assets.length > 0 && (
          <CommandGroup heading="Assets">
            {assets.map((asset) => {
              const Icon = TYPE_ICONS[asset.type] || Activity;
              return (
                <CommandItem key={asset.id} onSelect={() => go(`/monitor/${asset.id}`)}>
                  <Icon className="mr-2 h-4 w-4" />
                  <span>{asset.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{asset.region}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        <CommandSeparator />

        {/* Tickets */}
        {tickets.length > 0 && (
          <CommandGroup heading="Open Tickets">
            {tickets.map((ticket) => (
              <CommandItem key={ticket.ticket_id} onSelect={() => go(`/tickets/${ticket.ticket_id}`)}>
                <TicketCheck className="mr-2 h-4 w-4" />
                <span className="truncate flex-1">{ticket.title}</span>
                <span className={`ml-2 text-[10px] font-medium uppercase ${
                  ticket.severity === 'red' ? 'text-severity-red' :
                  ticket.severity === 'purple' ? 'text-severity-purple' :
                  'text-severity-amber'
                }`}>{ticket.severity}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
