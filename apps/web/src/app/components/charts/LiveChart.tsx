/**
 * LiveChart — Shadcn ChartContainer-based live sensor chart
 * Features: baseline band, anomaly markers, drag-select range, highlight range
 */

import { useMemo, useState, useCallback } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '../ui/chart';

interface DataPoint {
  timestamp: string;
  value: number;
  baselineUpper?: number;
  baselineLower?: number;
}

interface AnomalyMarker {
  anomaly_id: string;
  detected_at: string;
  severity: string;
  deviation_pct: number;
  confidence_score: number;
}

interface HighlightRange {
  start: string;
  end: string;
  color: string;
  label?: string;
}

interface LiveChartProps {
  data: DataPoint[];
  comparisonData?: DataPoint[];
  baseline?: { mean: number; upper: number; lower: number };
  anomalies?: AnomalyMarker[];
  sensorName?: string;
  unit?: string;
  onAnomalyClick?: (anomalyId: string) => void;
  onRangeSelect?: (start: string, end: string) => void;
  highlightRange?: HighlightRange | null;
  className?: string;
}

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
  const r = 7;

  switch (severity) {
    case 'amber': {
      // Triangle (pointing up)
      const h = r * 1.8;
      const half = r * 1.1;
      return <polygon points={`${cx},${cy - h / 2} ${cx - half},${cy + h / 2} ${cx + half},${cy + h / 2}`} {...common} />;
    }
    case 'red': {
      // Diamond (rotated square)
      const d = r * 1.2;
      return <polygon points={`${cx},${cy - d} ${cx + d},${cy} ${cx},${cy + d} ${cx - d},${cy}`} {...common} />;
    }
    case 'purple': {
      // 4-point star
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
      // Circle (green / fallback)
      return <circle cx={cx} cy={cy} r={r} {...common} />;
    }
  }
}

const chartConfig = {
  value: { label: 'Sensor Value', color: 'hsl(210 100% 50%)' },
  comparison: { label: 'Historical', color: 'hsl(0 0% 55%)' },
  baselineUpper: { label: 'Upper Bound', color: 'hsl(210 20% 50%)' },
  baselineLower: { label: 'Lower Bound', color: 'hsl(210 20% 50%)' },
} satisfies ChartConfig;

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function LiveChart({
  data,
  comparisonData,
  baseline,
  anomalies = [],
  sensorName,
  unit,
  onAnomalyClick,
  onRangeSelect,
  highlightRange,
  className,
}: LiveChartProps) {
  // Drag-select state
  const [dragStart, setDragStart] = useState<string | null>(null);
  const [dragEnd, setDragEnd] = useState<string | null>(null);
  const isDragging = dragStart !== null;

  // Build chart data with baseline bands + optional comparison series
  const chartData = useMemo(() => {
    const upper = baseline ? Number(baseline.upper) : undefined;
    const lower = baseline ? Number(baseline.lower) : undefined;
    return data
      .map((p, i) => ({
        timestamp: p.timestamp,
        value: Number(p.value),
        comparison: comparisonData?.[i] ? Number(comparisonData[i].value) : undefined,
        baselineUpper: upper,
        baselineLower: lower,
      }))
      .filter((p) => isFinite(p.value));
  }, [data, comparisonData, baseline]);

  // Map anomalies to closest data points
  const anomalyDots = useMemo(() => {
    if (!anomalies.length || !data.length) return [];
    return anomalies.map((a) => {
      const aTime = new Date(a.detected_at).getTime();
      let closest = data[0];
      let minDist = Infinity;
      for (const p of data) {
        const d = Math.abs(new Date(p.timestamp).getTime() - aTime);
        if (d < minDist) { minDist = d; closest = p; }
      }
      return { ...a, timestamp: closest.timestamp, value: Number(closest.value) };
    });
  }, [anomalies, data]);

  // Y domain with padding
  const [yMin, yMax] = useMemo(() => {
    if (!chartData.length) return [0, 100];
    const vals = chartData.map((d) => d.value).filter((v) => isFinite(v));
    if (!vals.length) return [0, 100];
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = (max - min) * 0.15 || 10;
    return [min - pad, max + pad];
  }, [chartData]);

  // Drag handlers
  const handleMouseDown = useCallback((e: any) => {
    if (e?.activeLabel && onRangeSelect) {
      setDragStart(e.activeLabel);
      setDragEnd(e.activeLabel);
    }
  }, [onRangeSelect]);

  const handleMouseMove = useCallback((e: any) => {
    if (isDragging && e?.activeLabel) {
      setDragEnd(e.activeLabel);
    }
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    if (dragStart && dragEnd && onRangeSelect) {
      // Ensure start < end
      const s = new Date(dragStart).getTime();
      const e = new Date(dragEnd).getTime();
      if (s !== e) {
        const [start, end] = s < e ? [dragStart, dragEnd] : [dragEnd, dragStart];
        onRangeSelect(start, end);
      }
    }
    setDragStart(null);
    setDragEnd(null);
  }, [dragStart, dragEnd, onRangeSelect]);

  return (
    <ChartContainer config={chartConfig} className={className}>
      <AreaChart
        data={chartData}
        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: onRangeSelect ? 'crosshair' : undefined }}
      >
        <defs>
          <linearGradient id="fillValue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="fillBaseline" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-baselineUpper)" stopOpacity={0.08} />
            <stop offset="100%" stopColor="var(--color-baselineLower)" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/30" />

        <XAxis
          dataKey="timestamp"
          tickFormatter={formatTime}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
          minTickGap={60}
        />
        <YAxis
          domain={[yMin, yMax]}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
          width={55}
          tickFormatter={(v: number) => v.toFixed(1)}
        />

        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(label) => new Date(label).toLocaleString()}
              indicator="line"
            />
          }
        />

        {/* Baseline band */}
        {baseline && (
          <Area
            dataKey="baselineUpper"
            type="monotone"
            fill="url(#fillBaseline)"
            stroke="none"
            isAnimationActive={false}
          />
        )}

        {/* Baseline mean reference line */}
        {baseline && (
          <ReferenceLine
            y={Number(baseline.mean)}
            stroke="var(--color-baselineUpper)"
            strokeDasharray="6 4"
            strokeWidth={1}
            label={{ value: `baseline ${Number(baseline.mean).toFixed(1)}`, position: 'insideTopRight', fontSize: 10, fill: 'var(--color-baselineUpper)' }}
          />
        )}

        {/* Sensor data area */}
        <Area
          dataKey="value"
          type="monotone"
          fill="url(#fillValue)"
          stroke="var(--color-value)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />

        {/* Historical comparison line (dashed gray) */}
        {comparisonData && comparisonData.length > 0 && (
          <Area
            dataKey="comparison"
            type="monotone"
            fill="none"
            stroke="var(--color-comparison)"
            strokeWidth={1.5}
            strokeDasharray="6 3"
            strokeOpacity={0.5}
            dot={false}
            isAnimationActive={false}
          />
        )}

        {/* Drag-select overlay */}
        {isDragging && dragStart && dragEnd && (
          <ReferenceArea
            x1={dragStart}
            x2={dragEnd}
            fill="#f59e0b"
            fillOpacity={0.12}
            stroke="#f59e0b"
            strokeOpacity={0.4}
            strokeDasharray="4 2"
          />
        )}

        {/* Highlight range (from ticket/anomaly click) */}
        {highlightRange && (
          <ReferenceArea
            x1={highlightRange.start}
            x2={highlightRange.end}
            fill={highlightRange.color}
            fillOpacity={0.15}
            stroke={highlightRange.color}
            strokeOpacity={0.5}
            strokeDasharray="6 3"
            label={highlightRange.label ? {
              value: highlightRange.label,
              position: 'insideTop',
              fontSize: 10,
              fill: highlightRange.color,
            } : undefined}
          />
        )}

        {/* Anomaly markers — ISA-101 distinct shapes per severity */}
        {anomalyDots.map((a) => (
          <ReferenceDot
            key={a.anomaly_id}
            x={a.timestamp}
            y={a.value}
            r={0}
            fill="transparent"
            stroke="none"
            shape={(props: any) => (
              <SeverityShape
                cx={props.cx}
                cy={props.cy}
                severity={a.severity}
                onClick={() => onAnomalyClick?.(a.anomaly_id)}
              />
            )}
          />
        ))}
      </AreaChart>
    </ChartContainer>
  );
}
