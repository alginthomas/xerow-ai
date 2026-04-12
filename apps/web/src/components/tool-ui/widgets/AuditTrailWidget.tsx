/**
 * AuditTrailWidget — Renders get_audit_log as a compact timeline
 */

import { Clock, Bot, User, Cpu } from 'lucide-react';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function actorIcon(actor: string) {
  const lower = actor.toLowerCase();
  if (lower.includes('agent') || lower.includes('analytics') || lower.includes('anomaly') || lower.includes('verification')) {
    return { icon: Bot, color: 'bg-blue-500/20 text-blue-400' };
  }
  if (lower === 'system' || lower === 'seed_script') {
    return { icon: Cpu, color: 'bg-muted text-muted-foreground' };
  }
  return { icon: User, color: 'bg-severity-green/20 text-severity-green' };
}

export function AuditTrailWidget({ result }: { result: any }) {
  if (result === undefined) {
    return (
      <div className="rounded-xl border border-border/40 bg-card/60 p-4 my-3 max-w-md space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="h-6 w-6 rounded-full bg-muted shrink-0 mt-0.5" />
            <div className="space-y-1.5 flex-1"><div className="h-3 w-28 rounded bg-muted" /><div className="h-3 w-36 rounded bg-muted" /></div>
            <div className="h-3 w-12 rounded bg-muted shrink-0" />
          </div>
        ))}
      </div>
    );
  }

  const entries: any[] = result?.audit_log || (Array.isArray(result) ? result : []);

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-border/50 bg-card/60 px-5 py-6 text-center text-sm text-muted-foreground my-3 max-w-md">
        <Clock className="mx-auto mb-2 h-6 w-6 opacity-40" />
        No audit trail entries found.
      </div>
    );
  }

  const displayEntries = entries.slice(0, 10);
  const hasMore = entries.length > 10;

  return (
    <div className="rounded-xl border border-border/40 bg-card/60 p-4 my-3 max-w-md">
      <div className="flex items-center gap-2 mb-3 text-xs font-medium text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        Audit Trail ({entries.length} entries)
      </div>

      <div className="space-y-0">
        {displayEntries.map((entry, idx) => {
          const { icon: ActorIcon, color } = actorIcon(entry.actor);
          const isLast = idx === displayEntries.length - 1;

          return (
            <div key={entry.id || idx} className="flex items-start gap-3 relative">
              {/* Timeline line */}
              {!isLast && (
                <div className="absolute left-3 top-7 bottom-0 w-px bg-border/50" />
              )}

              {/* Actor icon */}
              <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${color}`}>
                <ActorIcon className="h-3 w-3" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-foreground truncate">{entry.actor}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {entry.timestamp ? timeAgo(entry.timestamp) : ''}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground capitalize mt-0.5">
                  {entry.action?.replace(/_/g, ' ')}
                </div>
                {entry.note && (
                  <div className="text-xs text-foreground/70 mt-1 bg-muted/30 rounded px-2 py-1 line-clamp-2">
                    {entry.note}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <div className="text-center text-xs text-muted-foreground mt-2 pt-2 border-t border-border/30">
          +{entries.length - 10} more entries
        </div>
      )}
    </div>
  );
}
