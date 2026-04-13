/**
 * Time Series Chart - Zoomable, pannable sensor data visualization
 * PRD requirements AD-01, AD-02
 */

import { useMemo, useState } from 'react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Brush,
  ReferenceDot,
  ReferenceArea,
} from 'recharts';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';

interface DataPoint {
  timestamp: string;
  value: number;
}

interface AnomalyMarker {
  anomaly_id: string;
  detected_at: string;
  severity: string;
  colour_code: string;
  deviation_pct: number;
  confidence_score: number;
  sensor_name?: string;
}

interface Baseline {
  mean: number;
  stddev: number;
  upper: number;
  lower: number;
}

interface TimeSeriesChartProps {
  data: DataPoint[];
  baseline?: Baseline;
  anomalies?: AnomalyMarker[];
  sensorName?: string;
  unit?: string;
  onAnomalyClick?: (anomalyId: string) => void;
  className?: string;
}

const TIME_PRESETS = [
  { label: '1h', hours: 1 },
  { label: '6h', hours: 6 },
  { label: '24h', hours: 24 },
  { label: '7d', hours: 168 },
  { label: '30d', hours: 720 },
];

const SEVERITY_COLORS: Record<string, string> = {
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
  purple: '#a855f7',
};

/**
 * ISA-101 Accessibility: distinct shapes per severity so color-blind operators
 * can differentiate markers. green=circle, amber=triangle, red=diamond, purple=star
 */
function SeverityShape({ cx, cy, severity, onClick }: { cx: number; cy: number; severity: string; onClick?: () => void }) {
  const color = SEVERITY_COLORS[severity] || '#888';
  const bg = 'var(--background)';
  const common = { fill: color, stroke: bg, strokeWidth: 2, cursor: onClick ? 'pointer' : undefined, onClick };
  const r = 6;

  switch (severity) {
    case 'amber': {
      const h = r * 1.8;
      const half = r * 1.1;
      return <polygon points={`${cx},${cy - h / 2} ${cx - half},${cy + h / 2} ${cx + half},${cy + h / 2}`} {...common} />;
    }
    case 'red': {
      const d = r * 1.2;
      return <polygon points={`${cx},${cy - d} ${cx + d},${cy} ${cx},${cy + d} ${cx - d},${cy}`} {...common} />;
    }
    case 'purple': {
      const outer = r * 1.3;
      const inner = r * 0.5;
      const pts = Array.from({ length: 8 }, (_, i) => {
        const angle = (i * Math.PI) / 4 - Math.PI / 2;
        const rad = i % 2 === 0 ? outer : inner;
        return `${cx + rad * Math.cos(angle)},${cy + rad * Math.sin(angle)}`;
      }).join(' ');
      return <polygon points={pts} {...common} />;
    }
    default: {
      return <circle cx={cx} cy={cy} r={r} {...common} />;
    }
  }
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border bg-popover p-3 text-sm shadow-md">
      <p className="mb-1 text-xs text-muted-foreground">
        {new Date(label).toLocaleString()}
      </p>
      {payload.map((entry: any, idx: number) => (
        <div key={idx} className="flex items-center gap-2">
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-mono font-medium">{Number(entry.value).toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

export function TimeSeriesChart({
  data,
  baseline,
  anomalies = [],
  sensorName,
  unit,
  onAnomalyClick,
  className,
}: TimeSeriesChartProps) {
  const [activePreset, setActivePreset] = useState('24h');

  // Build chart data with baseline band — filter out invalid points
  const chartData = useMemo(() => {
    return data
      .filter((point) => point.value != null && !isNaN(Number(point.value)))
      .map((point) => ({
        timestamp: point.timestamp,
        value: Number(point.value),
        ...(baseline && {
          baselineUpper: Number(baseline.upper) || undefined,
          baselineLower: Number(baseline.lower) || undefined,
          baselineMean: Number(baseline.mean) || undefined,
        }),
      }));
  }, [data, baseline]);

  // Map anomalies to chart positions
  const anomalyDots = useMemo(() => {
    if (!anomalies.length || !data.length) return [];

    return anomalies.map((anomaly) => {
      // Find closest data point to anomaly timestamp
      const anomalyTime = new Date(anomaly.detected_at).getTime();
      let closest = data[0];
      let minDist = Infinity;
      for (const point of data) {
        const dist = Math.abs(new Date(point.timestamp).getTime() - anomalyTime);
        if (dist < minDist) {
          minDist = dist;
          closest = point;
        }
      }
      return {
        ...anomaly,
        timestamp: closest.timestamp,
        value: closest.value,
      };
    });
  }, [anomalies, data]);

  // Value domain — filter out NaN/undefined to prevent Recharts DecimalError
  const [minVal, maxVal] = useMemo(() => {
    if (!chartData.length) return [0, 100];
    const values = chartData.map((d) => d.value).filter((v) => v != null && !isNaN(v));
    if (!values.length) return [0, 100];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min) * 0.1 || 10;
    return [min - padding, max + padding];
  }, [chartData]);

  // Don't render chart if no valid data
  if (!chartData.length) {
    return (
      <div className={cn('flex h-[300px] items-center justify-center text-muted-foreground', className)}>
        No sensor data available for this time range
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Header with time presets */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {sensorName && (
            <span className="text-sm font-medium">{sensorName}</span>
          )}
          {unit && (
            <span className="text-xs text-muted-foreground">({unit})</span>
          )}
        </div>
        <div className="flex gap-1">
          {TIME_PRESETS.map((preset) => (
            <Button
              key={preset.label}
              variant={activePreset === preset.label ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setActivePreset(preset.label)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              opacity={0.3}
            />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatTimestamp}
              stroke="var(--muted-foreground)"
              tick={{ fontSize: 11 }}
              minTickGap={50}
            />
            <YAxis
              domain={[minVal, maxVal]}
              stroke="var(--muted-foreground)"
              tick={{ fontSize: 11 }}
              width={60}
              tickFormatter={(v: number) => v.toFixed(1)}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Baseline band */}
            {baseline && (
              <Area
                dataKey="baselineUpper"
                stroke="none"
                fill="var(--chart-2)"
                fillOpacity={0.08}
                name="Baseline Upper"
                isAnimationActive={false}
              />
            )}
            {baseline && (
              <Area
                dataKey="baselineLower"
                stroke="none"
                fill="var(--background)"
                fillOpacity={1}
                name="Baseline Lower"
                isAnimationActive={false}
              />
            )}

            {/* Baseline mean line */}
            {baseline && (
              <Line
                dataKey="baselineMean"
                stroke="var(--chart-2)"
                strokeDasharray="5 5"
                strokeWidth={1}
                dot={false}
                name="Baseline"
                isAnimationActive={false}
              />
            )}

            {/* Sensor data line */}
            <Line
              dataKey="value"
              stroke="var(--chart-1)"
              strokeWidth={2}
              dot={false}
              name={sensorName || 'Value'}
              isAnimationActive={false}
              connectNulls
            />

            {/* Anomaly markers — ISA-101 distinct shapes per severity */}
            {anomalyDots.map((anomaly) => (
              <ReferenceDot
                key={anomaly.anomaly_id}
                x={anomaly.timestamp}
                y={anomaly.value}
                r={0}
                fill="transparent"
                stroke="none"
                shape={(props: any) => (
                  <SeverityShape
                    cx={props.cx}
                    cy={props.cy}
                    severity={anomaly.severity}
                    onClick={() => onAnomalyClick?.(anomaly.anomaly_id)}
                  />
                )}
              />
            ))}

            {/* Brush for zoom — only render with sufficient data points */}
            {chartData.length > 10 && (
              <Brush
                dataKey="timestamp"
                height={30}
                stroke="var(--border)"
                fill="var(--card)"
                tickFormatter={formatDate}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Anomaly legend */}
      {anomalyDots.length > 0 && (
        <div className="flex flex-wrap gap-3 text-xs">
          {Object.entries(SEVERITY_COLORS).map(([severity, color]) => {
            const count = anomalyDots.filter((a) => a.severity === severity).length;
            if (count === 0) return null;
            return (
              <div key={severity} className="flex items-center gap-1.5">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="capitalize text-muted-foreground">
                  {severity}: {count}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
