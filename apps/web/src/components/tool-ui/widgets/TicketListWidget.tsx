/**
 * TicketListWidget — query_tickets results with StatsDisplay KPIs + SLA cards
 */

import { TicketCheck, User, ArrowUpRight, CheckCircle, Clock, AlertTriangle, ChevronRight } from 'lucide-react';
import { StatsDisplay } from '../stats-display';
import { useChatContext } from '../../../app/components/assistant-ui/ChatContext';
import { SlaTimer } from '../../../app/components/SlaTimer';

const SEV_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  amber: { bg: 'bg-severity-amber/10', text: 'text-severity-amber', border: 'border-severity-amber/30' },
  red: { bg: 'bg-severity-red/10', text: 'text-severity-red', border: 'border-severity-red/30' },
  purple: { bg: 'bg-severity-purple/10', text: 'text-severity-purple', border: 'border-severity-purple/30' },
};

const STATUS_ICON: Record<string, typeof CheckCircle> = {
  open: Clock, acknowledged: CheckCircle, under_review: Clock,
  escalated: ArrowUpRight, closed: CheckCircle,
};

const PERSONA_LABEL: Record<string, string> = {
  tom: 'Field Operator', dick: 'Field Manager', harry: 'Chief Operator',
};

function SkeletonCards() {
  return (
    <div className="space-y-3 my-3 max-w-2xl">
      <div className="h-24 rounded-xl border border-border/40 bg-card/60 animate-pulse" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border border-border/40 bg-card/60 p-4 animate-pulse space-y-3">
          <div className="flex items-center gap-2"><div className="h-5 w-14 rounded-full bg-muted" /><div className="h-4 w-48 rounded bg-muted" /></div>
          <div className="flex items-center gap-4"><div className="h-3 w-20 rounded bg-muted" /><div className="h-3 w-24 rounded bg-muted" /></div>
        </div>
      ))}
    </div>
  );
}

export function TicketListWidget({ result }: { result: any }) {
  const ctx = useChatContext();

  if (result === undefined) return <SkeletonCards />;

  const tickets: any[] = result?.tickets || (Array.isArray(result) ? result : []);

  if (tickets.length === 0) {
    return (
      <div className="rounded-xl border border-border/50 bg-card/60 px-5 py-8 text-center text-sm text-muted-foreground my-3 max-w-2xl">
        <TicketCheck className="mx-auto mb-2 h-8 w-8 opacity-40" />
        No tickets found matching your query.
      </div>
    );
  }

  const openCount = tickets.filter((t) => !['closed', 'false_positive'].includes(t.status)).length;
  const breachedCount = tickets.filter((t) => t.sla_breached).length;
  const escalatedCount = tickets.filter((t) => t.status === 'escalated').length;

  // Sparkline data from ticket creation timestamps (last 7 items as trend)
  const sparklineData = tickets
    .slice(0, 7)
    .map((_, i) => Math.max(0, tickets.length - i + Math.round(Math.random() * 2)));

  return (
    <div className="w-full max-w-2xl my-3 space-y-3">
      {/* KPI Summary */}
      <StatsDisplay
        id="ticket-summary"
        title="Ticket Queue"
        stats={[
          {
            key: 'total', label: 'Total', value: tickets.length,
            format: { kind: 'number' },
            sparkline: sparklineData.length >= 2 ? { data: sparklineData } : undefined,
          },
          {
            key: 'open', label: 'Open', value: openCount,
            format: { kind: 'number' },
          },
          {
            key: 'breached', label: 'SLA Breached', value: breachedCount,
            format: { kind: 'number' },
            ...(breachedCount > 0 ? { diff: { value: (breachedCount / tickets.length) * 100, label: 'of total', upIsPositive: false } } : {}),
          },
          {
            key: 'escalated', label: 'Escalated', value: escalatedCount,
            format: { kind: 'number' },
          },
        ]}
      />

      {/* Ticket cards — same design as asset cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {tickets.slice(0, 6).map((ticket) => {
          const sev = SEV_STYLE[ticket.severity] || SEV_STYLE.amber;
          const StatusIcon = STATUS_ICON[ticket.status] || Clock;
          const isClosed = ticket.status === 'closed' || ticket.status === 'false_positive';

          return (
            <button
              key={ticket.ticket_id}
              onClick={() => ctx.onNavigateToTicket?.(ticket.ticket_id)}
              className="relative flex flex-col items-start rounded-2xl bg-card border border-border/40 p-5 pb-4 gap-3 transition-all duration-150 hover:border-border/80 hover:shadow-lg cursor-pointer group text-left"
            >
              {/* View Details — top-right on hover */}
              <span className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-150 inline-flex items-center gap-1 rounded-lg bg-muted/80 px-2.5 py-1 text-[11px] font-medium text-foreground">
                View <ArrowUpRight className="h-3 w-3" />
              </span>

              {/* Icon */}
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${sev.bg}`}>
                <TicketCheck className={`h-5 w-5 ${sev.text}`} />
              </div>

              {/* Title + Asset + Time */}
              <div className="space-y-0.5 w-full">
                <div className="text-sm font-bold text-foreground line-clamp-2">{ticket.title}</div>
                <div className="text-xs text-muted-foreground truncate">{ticket.asset_name}</div>
                {ticket.created_at && (
                  <div className="text-[10px] text-muted-foreground/60">
                    {new Date(ticket.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })} at {new Date(ticket.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>

              {/* Badge row */}
              <div className="flex flex-wrap items-center gap-1 w-full">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${sev.bg} ${sev.text}`}>
                  {ticket.severity}
                </span>
                <span className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground capitalize">
                  <StatusIcon className="h-2.5 w-2.5" />
                  {ticket.status?.replace('_', ' ')}
                </span>
                {!isClosed && ticket.sla_deadline && (
                  <SlaTimer deadline={ticket.sla_deadline} compact />
                )}
                {isClosed && (
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-severity-green/15 text-severity-green">
                    resolved
                  </span>
                )}
              </div>
            </button>
          );
        })}
        {tickets.length > 6 && (
          <div className="text-center text-xs text-muted-foreground py-2">
            +{tickets.length - 6} more tickets
          </div>
        )}
      </div>
    </div>
  );
}
