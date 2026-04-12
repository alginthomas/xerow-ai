/**
 * ShiftBriefing — Proactive briefing shown at top of chat on login
 * "Since your last session: 3 new anomalies, 2 tickets resolved, 1 SLA breach"
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, TicketCheck, CheckCircle, Activity } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

interface ShiftData {
  anomalies: { total: number; by_severity: Record<string, number> };
  tickets: { new: number; resolved: number; sla_breached: number };
  assets: Record<string, number>;
}

export function ShiftBriefing() {
  const [data, setData] = useState<ShiftData | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    fetch(`${API_BASE}/api/v1/shift/summary?hours=8`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((res) => setData(res.data))
      .catch(() => {});
  }, []);

  if (!data || dismissed) return null;

  const hasIssues = data.tickets.sla_breached > 0 || data.anomalies.total > 0;
  if (!hasIssues && data.tickets.new === 0) return null;

  return (
    <div className="w-full max-w-[40rem] mx-auto mb-4">
      <div className="rounded-xl border border-border/50 bg-card/80 px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Shift Briefing — Last 8 hours
          </span>
          <button
            onClick={() => setDismissed(true)}
            className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground cursor-pointer"
          >
            Dismiss
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          {data.anomalies.total > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 text-severity-amber" />
              <span className="text-foreground font-medium">{data.anomalies.total}</span>
              <span className="text-muted-foreground">anomalies detected</span>
              {data.anomalies.by_severity.red && (
                <span className="text-severity-red font-medium">({data.anomalies.by_severity.red} red)</span>
              )}
            </div>
          )}

          {data.tickets.new > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <TicketCheck className="h-3.5 w-3.5 text-severity-amber" />
              <span className="text-foreground font-medium">{data.tickets.new}</span>
              <span className="text-muted-foreground">new tickets</span>
            </div>
          )}

          {data.tickets.resolved > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <CheckCircle className="h-3.5 w-3.5 text-severity-green" />
              <span className="text-foreground font-medium">{data.tickets.resolved}</span>
              <span className="text-muted-foreground">resolved</span>
            </div>
          )}

          {data.tickets.sla_breached > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 text-severity-red" />
              <span className="text-severity-red font-medium">{data.tickets.sla_breached} SLA breached</span>
            </div>
          )}

          {data.anomalies.total === 0 && data.tickets.new === 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <Activity className="h-3.5 w-3.5 text-severity-green" />
              <span className="text-muted-foreground">All systems normal</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
