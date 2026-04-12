/**
 * SensorReadingsWidget — Renders get_sensor_readings as inline chart in chat
 */

import { LiveChart } from '../../../app/components/charts/LiveChart';
import { StatsDisplay } from '../stats-display';

export function SensorReadingsWidget({ result }: { result: any }) {
  if (result === undefined) {
    return (
      <div className="rounded-xl border border-border/40 bg-card/60 p-4 animate-pulse my-3 max-w-2xl">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-8 w-8 rounded-lg bg-muted" />
          <div className="space-y-1.5 flex-1"><div className="h-4 w-24 rounded bg-muted" /><div className="h-3 w-16 rounded bg-muted" /></div>
        </div>
        <div className="h-[180px] rounded-lg bg-muted" />
      </div>
    );
  }

  if (result?.error) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive my-3 max-w-2xl">
        {result.error}
      </div>
    );
  }

  const sensor = result?.sensor;
  const readings = result?.readings || [];
  const baseline = result?.baseline;
  const anomalies = result?.anomalies || [];

  if (!sensor) {
    return (
      <div className="rounded-xl border border-border/50 bg-card/60 px-5 py-4 text-sm text-muted-foreground my-3 max-w-2xl">
        No sensor data available.
      </div>
    );
  }

  const currentValue = readings.length > 0 ? Number(readings[readings.length - 1].value) : null;
  const deviation = currentValue && baseline
    ? ((currentValue - Number(baseline.mean)) / Number(baseline.mean) * 100)
    : 0;

  return (
    <div className="w-full max-w-2xl my-3 space-y-3">
      {/* KPI header */}
      <StatsDisplay
        id={`sensor-${sensor.id || 'chat'}`}
        title={`${sensor.name} — ${sensor.type} (${sensor.unit})`}
        stats={[
          {
            key: 'current',
            label: 'Current Value',
            value: currentValue != null ? currentValue.toFixed(1) : '--',
            format: { kind: 'text' as const },
          },
          {
            key: 'baseline',
            label: 'Baseline',
            value: baseline ? Number(baseline.mean).toFixed(1) : '--',
            format: { kind: 'text' as const },
          },
          {
            key: 'deviation',
            label: 'Deviation',
            value: `${deviation >= 0 ? '+' : ''}${deviation.toFixed(1)}%`,
            format: { kind: 'text' as const },
            diff: Math.abs(deviation) > 5 ? { value: deviation, upIsPositive: false, label: 'from baseline' } : undefined,
          },
          {
            key: 'anomalies',
            label: 'Anomalies',
            value: anomalies.length,
            format: { kind: 'number' as const },
          },
        ]}
      />

      {/* Inline chart */}
      {readings.length > 0 && (
        <div className="rounded-xl border border-border/40 bg-card/80 p-3">
          <LiveChart
            data={readings}
            baseline={baseline ? {
              mean: Number(baseline.mean),
              upper: Number(baseline.upper),
              lower: Number(baseline.lower),
            } : undefined}
            anomalies={anomalies}
            sensorName={sensor.name}
            unit={sensor.unit}
            className="aspect-[2.5/1]"
          />
        </div>
      )}
    </div>
  );
}
