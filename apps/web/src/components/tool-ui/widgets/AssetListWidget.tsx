/**
 * AssetListWidget — query_assets with StatsDisplay KPIs + redesigned cards
 * Card: left-aligned, icon top-left, "View Details" top-right on hover, badges bottom
 */

import { Wind, GitBranch, Droplet, Activity, AlertTriangle, TicketCheck, ArrowUpRight } from 'lucide-react';
import { StatsDisplay } from '../stats-display';
import { useChatContext } from '../../../app/components/assistant-ui/ChatContext';

const TYPE_ICONS: Record<string, typeof Wind> = {
  turbine: Wind, pipeline: GitBranch, well: Droplet,
};

const STATUS_PILL: Record<string, { bg: string; text: string }> = {
  operational: { bg: 'bg-severity-green/80', text: 'text-white' },
  degraded: { bg: 'bg-severity-amber/80', text: 'text-white' },
  offline: { bg: 'bg-severity-red/80', text: 'text-white' },
  maintenance: { bg: 'bg-severity-purple/80', text: 'text-white' },
};

function Skeleton() {
  return (
    <div className="w-full max-w-2xl my-4 space-y-4">
      <div className="h-[100px] rounded-2xl border bg-card animate-pulse" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-[200px] rounded-2xl bg-card animate-pulse" />)}
      </div>
    </div>
  );
}

export function AssetListWidget({ result }: { result: any }) {
  const ctx = useChatContext();

  if (result === undefined) return <Skeleton />;

  const assets: any[] = result?.assets || (Array.isArray(result) ? result : []);

  if (assets.length === 0) {
    return (
      <div className="rounded-2xl border bg-card px-5 py-10 text-center text-sm text-muted-foreground my-4 max-w-2xl">
        <Activity className="mx-auto mb-3 h-10 w-10 opacity-30" />
        No assets found matching your query.
      </div>
    );
  }

  const operational = assets.filter((a) => a.status === 'operational').length;
  const totalTickets = assets.reduce((s: number, a: any) => s + (a.open_tickets || 0), 0);
  const totalAnomalies = assets.reduce((s: number, a: any) => s + (a.recent_anomalies || 0), 0);

  return (
    <div className="w-full max-w-2xl my-4 space-y-4">
      {/* KPI Header */}
      <StatsDisplay
        id="asset-overview"
        title="Asset Overview"
        stats={[
          { key: 'total', label: 'Total Assets', value: assets.length, format: { kind: 'number' } },
          { key: 'operational', label: 'Operational', value: operational, format: { kind: 'number' },
            diff: operational === assets.length
              ? { value: 100, label: 'all healthy' }
              : { value: -((assets.length - operational) / assets.length) * 100, label: `${assets.length - operational} need attention`, upIsPositive: true },
          },
          { key: 'tickets', label: 'Open Tickets', value: totalTickets, format: { kind: 'number' } },
          { key: 'anomalies', label: 'Anomalies (24h)', value: totalAnomalies, format: { kind: 'number' } },
        ]}
      />

      {/* Asset Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {assets.map((asset) => {
          const Icon = TYPE_ICONS[asset.type] || Activity;
          const status = STATUS_PILL[asset.status] || STATUS_PILL.operational;
          const tickets = asset.open_tickets || 0;
          const anomalies = asset.recent_anomalies || 0;

          return (
            <button
              key={asset.id}
              onClick={() => ctx.onNavigateToAsset?.(asset.id)}
              className="relative flex flex-col items-start rounded-2xl bg-card border border-border/40 p-5 gap-4 transition-all duration-150 hover:border-border/80 hover:shadow-lg cursor-pointer group text-left"
            >
              {/* View Details — top-right, visible on hover */}
              <span className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-150 inline-flex items-center gap-1 rounded-lg bg-muted/80 px-2.5 py-1 text-[11px] font-medium text-foreground">
                View Details
                <ArrowUpRight className="h-3 w-3" />
              </span>

              {/* Icon */}
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted/60 group-hover:bg-muted transition-colors">
                <Icon className="h-6 w-6 text-foreground" />
              </div>

              {/* Name + Region — left aligned */}
              <div className="space-y-0.5 w-full">
                <div className="text-base font-bold text-foreground truncate">{asset.name}</div>
                <div className="text-sm text-muted-foreground truncate">{asset.region}</div>
              </div>

              {/* Badge row */}
              <div className="flex flex-wrap items-center gap-1 w-full">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${status.bg} ${status.text}`}>
                  {asset.status}
                </span>
                {tickets > 0 && (
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-severity-red/70 text-white">
                    {tickets} tickets
                  </span>
                )}
                {anomalies > 0 && (
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-severity-amber/60 text-white">
                    {anomalies} anomalies
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
