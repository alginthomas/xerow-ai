/**
 * AnomalyListWidget — query_anomalies results with severity chart + detail rows
 */

import { AlertTriangle, Clock, ChevronRight } from 'lucide-react';
import { StatsDisplay } from '../stats-display';
import { Chart } from '../chart';
import { useChatContext } from '../../../app/components/assistant-ui/ChatContext';

const SEV_STYLE: Record<string, { bar: string; badge: string; bg: string; color: string }> = {
  green: { bar: 'bg-severity-green', badge: 'bg-severity-green/15 text-severity-green border-severity-green/30', bg: 'bg-severity-green', color: '#22c55e' },
  amber: { bar: 'bg-severity-amber', badge: 'bg-severity-amber/15 text-severity-amber border-severity-amber/30', bg: 'bg-severity-amber', color: '#f59e0b' },
  red: { bar: 'bg-severity-red', badge: 'bg-severity-red/15 text-severity-red border-severity-red/30', bg: 'bg-severity-red', color: '#ef4444' },
  purple: { bar: 'bg-severity-purple', badge: 'bg-severity-purple/15 text-severity-purple border-severity-purple/30', bg: 'bg-severity-purple', color: '#a855f7' },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function SkeletonRows() {
  return (
    <div className="space-y-3 my-3 max-w-2xl">
      <div className="h-24 rounded-xl border border-border/40 bg-card/60 animate-pulse" />
      <div className="h-40 rounded-xl border border-border/40 bg-card/60 animate-pulse" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-16 rounded-xl border border-border/40 bg-card/60 animate-pulse" />
      ))}
    </div>
  );
}

export function AnomalyListWidget({ result }: { result: any }) {
  const ctx = useChatContext();

  if (result === undefined) return <SkeletonRows />;

  const anomalies: any[] = result?.anomalies || (Array.isArray(result) ? result : []);

  if (anomalies.length === 0) {
    return (
      <div className="rounded-xl border border-border/50 bg-card/60 px-5 py-8 text-center text-sm text-muted-foreground my-3 max-w-2xl">
        <AlertTriangle className="mx-auto mb-2 h-8 w-8 opacity-40" />
        No anomalies found matching your query.
      </div>
    );
  }

  // Count by severity
  const counts: Record<string, number> = {};
  anomalies.forEach((a) => { counts[a.severity] = (counts[a.severity] || 0) + 1; });

  // Build severity distribution chart data
  const chartData = ['green', 'amber', 'red', 'purple']
    .filter((s) => counts[s])
    .map((s) => ({ severity: s.charAt(0).toUpperCase() + s.slice(1), count: counts[s] || 0 }));

  // Average confidence + deviation stats
  const avgConfidence = Math.round(anomalies.reduce((s: number, a: any) => s + (a.confidence_score || 0), 0) / anomalies.length);
  const avgDeviation = (anomalies.reduce((s: number, a: any) => s + (Number(a.deviation_pct) || 0), 0) / anomalies.length).toFixed(1);

  return (
    <div className="w-full max-w-2xl my-3 space-y-3">
      {/* KPI Stats */}
      <StatsDisplay
        id="anomaly-summary"
        title="Anomaly Summary"
        stats={[
          { key: 'total', label: 'Total Detected', value: anomalies.length, format: { kind: 'number' } },
          { key: 'critical', label: 'Red + Purple', value: (counts.red || 0) + (counts.purple || 0), format: { kind: 'number' },
            ...(((counts.red || 0) + (counts.purple || 0)) > 0 ? { diff: { value: ((counts.red || 0) + (counts.purple || 0)) / anomalies.length * 100, label: 'of total', upIsPositive: false } } : {}),
          },
          { key: 'confidence', label: 'Avg Confidence', value: avgConfidence, format: { kind: 'percent', basis: 'unit' as const } },
          { key: 'deviation', label: 'Avg Deviation', value: `${avgDeviation}%`, format: { kind: 'text' as const } },
        ]}
      />

      {/* Severity distribution chart */}
      {chartData.length > 1 && (
        <Chart
          id="anomaly-severity-chart"
          type="bar"
          title="Severity Distribution"
          data={chartData}
          xKey="severity"
          series={[{ key: 'count', label: 'Anomalies' }]}
          colors={chartData.map((d) => SEV_STYLE[d.severity.toLowerCase()]?.color || '#888')}
          showGrid={false}
        />
      )}

      {/* Anomaly rows */}
      <div className="space-y-1.5">
        {anomalies.slice(0, 8).map((anomaly) => {
          const s = SEV_STYLE[anomaly.severity] || SEV_STYLE.green;
          return (
            <button
              key={anomaly.anomaly_id}
              onClick={() => ctx.onNavigateToAsset?.(anomaly.asset_id)}
              className="flex items-center gap-2.5 w-full rounded-lg border border-border/40 bg-card/80 p-2.5 text-left hover:bg-accent/30 transition-colors cursor-pointer group"
            >
              <div className={`w-1 self-stretch rounded-full ${s.bar}`} />
              <span className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${s.badge}`}>
                {anomaly.severity}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{anomaly.asset_name || 'Unknown Asset'}</div>
                <div className="text-xs text-muted-foreground truncate">{anomaly.sensor_name} {anomaly.sensor_unit && `(${anomaly.sensor_unit})`}</div>
              </div>
              <div className="flex items-center gap-3 shrink-0 text-xs">
                <div className="text-right">
                  <div className="font-mono font-semibold text-foreground">{Number(anomaly.deviation_pct).toFixed(1)}%</div>
                  <div className="text-[10px] text-muted-foreground">deviation</div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-semibold text-foreground">{anomaly.confidence_score}%</div>
                  <div className="text-[10px] text-muted-foreground">confidence</div>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground w-14 justify-end">
                  <Clock className="h-3 w-3" />
                  <span className="text-[11px]">{timeAgo(anomaly.detected_at)}</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          );
        })}
        {anomalies.length > 8 && (
          <div className="text-center text-xs text-muted-foreground py-2">
            +{anomalies.length - 8} more anomalies
          </div>
        )}
      </div>
    </div>
  );
}
