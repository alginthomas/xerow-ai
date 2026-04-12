/**
 * TicketActionWidget — Renders update_ticket and create_ticket results
 * Follows the same card design as asset/ticket cards
 */

import { CheckCircle, ArrowUpRight, MessageSquare, ExternalLink, TicketCheck, Clock, User } from 'lucide-react';
import { useChatContext } from '../../../app/components/assistant-ui/ChatContext';
import { SlaTimer } from '../../../app/components/SlaTimer';

const SEV_STYLE: Record<string, { bg: string; text: string }> = {
  amber: { bg: 'bg-severity-amber/80', text: 'text-white' },
  red: { bg: 'bg-severity-red/80', text: 'text-white' },
  purple: { bg: 'bg-severity-purple/80', text: 'text-white' },
};

export function TicketActionWidget({ result }: { result: any }) {
  const ctx = useChatContext();

  if (result === undefined) {
    return (
      <div className="rounded-2xl bg-card border border-border/40 p-5 animate-pulse my-3 max-w-sm">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-muted" />
          <div className="space-y-2 flex-1"><div className="h-4 w-32 rounded bg-muted" /><div className="h-3 w-24 rounded bg-muted" /></div>
        </div>
      </div>
    );
  }

  if (result?.error) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive my-3 max-w-sm">
        {result.error}
      </div>
    );
  }

  // Handle create_ticket response
  if (result?.status === 'created' && result?.ticket) {
    const ticket = result.ticket;
    const ticketId = ticket.ticket_id;
    const sev = SEV_STYLE[ticket.severity] || SEV_STYLE.amber;

    return (
      <button
        onClick={() => ctx.onNavigateToTicket?.(ticketId)}
        className="relative flex flex-col items-start rounded-2xl bg-card border border-border/40 p-5 pb-4 gap-3 transition-all duration-150 hover:border-border/80 hover:shadow-lg cursor-pointer group text-left my-3 max-w-sm"
      >
        <span className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-150 inline-flex items-center gap-1 rounded-lg bg-muted/80 px-2.5 py-1 text-[11px] font-medium text-foreground">
          View <ArrowUpRight className="h-3 w-3" />
        </span>

        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-severity-green/20">
          <TicketCheck className="h-5 w-5 text-severity-green" />
        </div>

        <div className="space-y-0.5 w-full">
          <div className="text-sm font-bold text-foreground">{ticket.title}</div>
          <div className="text-xs text-muted-foreground">
            {ticket.assigned_to_name && `Assigned to ${ticket.assigned_to_name}`}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 w-full">
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-severity-green/80 text-white">
            created
          </span>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${sev.bg} ${sev.text}`}>
            {ticket.severity}
          </span>
          {ticket.assigned_to_persona && (
            <span className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground">
              <User className="h-2.5 w-2.5" />
              {ticket.assigned_to_persona}
            </span>
          )}
          {ticket.sla_deadline && <SlaTimer deadline={ticket.sla_deadline} compact />}
        </div>
      </button>
    );
  }

  // Handle update_ticket response
  const action = result?.action || 'note';
  const ticketId = result?.ticket_id || result?.ticket?.ticket_id;

  const actionLabel: Record<string, string> = {
    acknowledge: 'Acknowledged', note: 'Note Added', escalate: 'Escalated', resolve: 'Resolved',
  };
  const actionIcon: Record<string, typeof CheckCircle> = {
    acknowledge: CheckCircle, note: MessageSquare, escalate: ArrowUpRight, resolve: CheckCircle,
  };
  const Icon = actionIcon[action] || CheckCircle;

  return (
    <button
      onClick={() => ticketId && ctx.onNavigateToTicket?.(ticketId)}
      className="relative flex flex-col items-start rounded-2xl bg-card border border-border/40 p-5 pb-4 gap-3 transition-all duration-150 hover:border-border/80 hover:shadow-lg cursor-pointer group text-left my-3 max-w-sm"
    >
      <span className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-150 inline-flex items-center gap-1 rounded-lg bg-muted/80 px-2.5 py-1 text-[11px] font-medium text-foreground">
        View <ArrowUpRight className="h-3 w-3" />
      </span>

      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/60">
        <Icon className="h-5 w-5 text-foreground" />
      </div>

      <div className="space-y-0.5 w-full">
        <div className="text-sm font-bold text-foreground">{actionLabel[action] || action}</div>
        {result?.message && <div className="text-xs text-muted-foreground line-clamp-2">{result.message}</div>}
        {result?.note && <div className="text-xs text-muted-foreground line-clamp-2">{result.note}</div>}
      </div>

      <div className="flex flex-wrap items-center gap-1 w-full">
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground capitalize">
          {action}
        </span>
      </div>
    </button>
  );
}
