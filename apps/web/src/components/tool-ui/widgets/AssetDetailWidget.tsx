/**
 * AssetDetailWidget — get_asset_detail results with StatsDisplay + sensor pills
 */

import { Wind, GitBranch, Droplet, Activity, MapPin, ExternalLink } from 'lucide-react';
import { StatsDisplay } from '../stats-display';
import { useChatContext } from '../../../app/components/assistant-ui/ChatContext';

const TYPE_ICONS: Record<string, typeof Wind> = {
  turbine: Wind, pipeline: GitBranch, well: Droplet,
};

const STATUS_DOT: Record<string, string> = {
  operational: 'bg-severity-green', degraded: 'bg-severity-amber',
  offline: 'bg-severity-red', maintenance: 'bg-severity-purple',
};

export function AssetDetailWidget({ result }: { result: any }) {
  const ctx = useChatContext();

  if (result === undefined) {
    return (
      <div className="rounded-xl border border-border/50 bg-card/60 p-5 animate-pulse my-3 max-w-2xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-lg bg-muted" />
          <div className="space-y-2 flex-1"><div className="h-4 w-32 rounded bg-muted" /><div className="h-3 w-24 rounded bg-muted" /></div>
        </div>
        <div className="h-20 rounded-xl bg-muted" />
        <div className="flex gap-2">{[1, 2, 3].map((i) => <div key={i} className="h-7 w-20 rounded-full bg-muted" />)}</div>
      </div>
    );
  }

  const asset = result?.asset || result;
  if (!asset || asset.error) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-5 py-4 text-sm text-destructive my-3 max-w-2xl">
        {asset?.error || 'Asset not found'}
      </div>
    );
  }

  const Icon = TYPE_ICONS[asset.type] || Activity;
  const sensors = asset.sensors || [];
  const location = typeof asset.location === 'string' ? JSON.parse(asset.location) : asset.location || {};

  return (
    <div className="rounded-xl border border-border/50 bg-card/80 p-5 my-3 max-w-2xl space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted/50">
          <Icon className="h-5 w-5 text-foreground" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">{asset.name}</span>
            <span className={`h-2 w-2 rounded-full ${STATUS_DOT[asset.status] || 'bg-muted'}`} />
            <span className="text-xs text-muted-foreground capitalize">{asset.status}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="capitalize">{asset.type}</span>
            <span>-</span>
            <MapPin className="h-3 w-3" />
            <span>{asset.region}</span>
            {location.facility && <><span>-</span><span>{location.facility}</span></>}
          </div>
        </div>
      </div>

      {/* Stats via StatsDisplay */}
      <StatsDisplay
        id={`asset-${asset.id}-stats`}
        stats={[
          { key: 'sensors', label: 'Sensors', value: sensors.length, format: { kind: 'number' } },
          { key: 'tickets', label: 'Open Tickets', value: asset.open_tickets ?? 0, format: { kind: 'number' } },
          { key: 'anomalies', label: 'Anomalies (24h)', value: asset.recent_anomalies ?? 0, format: { kind: 'number' } },
        ]}
      />

      {/* Sensors as pills */}
      {sensors.length > 0 && (
        <div>
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Sensors</div>
          <div className="flex flex-wrap gap-1.5">
            {sensors.map((s: any) => (
              <span key={s.id || s.name} className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-2.5 py-1 text-xs">
                <span className="font-medium text-foreground">{s.name}</span>
                {s.baseline_value != null && (
                  <span className="text-muted-foreground font-mono">{Number(s.baseline_value).toFixed(1)} {s.unit}</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <button
        onClick={() => ctx.onNavigateToAsset?.(asset.id)}
        className="flex items-center justify-center gap-2 w-full rounded-lg border border-border/60 bg-muted/20 py-2 text-sm font-medium text-foreground hover:bg-accent/50 transition-colors cursor-pointer"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        View Full Asset Details
      </button>
    </div>
  );
}
