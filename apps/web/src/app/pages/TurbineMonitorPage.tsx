/**
 * TurbineMonitorPage — Live monitoring dashboard for a single turbine
 * Real-time chart with anomaly markers, ticket management
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Separator } from '../components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../components/ui/sheet';
import { StatsDisplay } from '../../components/tool-ui/stats-display';
import { LiveChart } from '../components/charts/LiveChart';
import { SlaTimer } from '../components/SlaTimer';
import { TicketCreateDialog } from '../components/TicketCreateDialog';
import { TicketEditSheet } from '../components/TicketEditSheet';
import {
  ArrowLeft, Activity, MapPin, Radio, Pause, Play, Plus,
  AlertTriangle, TicketCheck, Clock,
} from 'lucide-react';
import { API_BASE } from '../../lib/config';


const SEV_BADGE: Record<string, string> = {
  green: 'bg-severity-green/20 text-severity-green border-severity-green/30',
  amber: 'bg-severity-amber/20 text-severity-amber border-severity-amber/30',
  red: 'bg-severity-red/20 text-severity-red border-severity-red/30',
  purple: 'bg-severity-purple/20 text-severity-purple border-severity-purple/30',
};

const SEVERITY_COLORS: Record<string, string> = {
  green: '#22c55e', amber: '#f59e0b', red: '#ef4444', purple: '#a855f7',
};

const STATUS_DOT: Record<string, string> = {
  operational: 'bg-severity-green', degraded: 'bg-severity-amber',
  offline: 'bg-severity-red', maintenance: 'bg-severity-purple',
};

function getToken() { return localStorage.getItem('auth_token'); }

async function apiFetch(path: string) {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

function timeAgo(d: string) {
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const TIME_PRESETS = [
  { label: '1h', hours: 1 },
  { label: '6h', hours: 6 },
  { label: '24h', hours: 24 },
  { label: '7d', hours: 168 },
];

export function TurbineMonitorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [asset, setAsset] = useState<any>(null);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [sensorReadings, setSensorReadings] = useState<any>(null);
  const [activeSensorId, setActiveSensorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Live mode
  const [isLive, setIsLive] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [timeRange, setTimeRange] = useState(1); // hours
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Modals
  const [selectedAnomaly, setSelectedAnomaly] = useState<any>(null);
  const [createTicketOpen, setCreateTicketOpen] = useState(false);
  const [editTicketId, setEditTicketId] = useState<string | null>(null);

  // Chart highlight + drag-select
  const [highlightRange, setHighlightRange] = useState<{ start: string; end: string; color: string; label?: string } | null>(null);
  const [dragDescription, setDragDescription] = useState('');

  // Historical comparison
  const [compareMode, setCompareMode] = useState<'off' | '7d' | '30d'>('off');
  const [comparisonData, setComparisonData] = useState<any[] | null>(null);

  // Fetch asset + anomalies + tickets
  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const [assetRes, anomRes, ticketRes] = await Promise.all([
        apiFetch(`/api/v1/assets/${id}`),
        apiFetch(`/api/v1/assets/${id}/anomalies?limit=50`),
        apiFetch(`/api/v1/assets/${id}/tickets?limit=20`),
      ]);
      setAsset(assetRes.data);
      setAnomalies(anomRes.data || []);
      setTickets(ticketRes.data || []);
      if (!activeSensorId && assetRes.data?.sensors?.length > 0) {
        setActiveSensorId(assetRes.data.sensors[0].id);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [id, activeSensorId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Fetch sensor readings
  const fetchReadings = useCallback(async () => {
    if (!activeSensorId || !id) return;
    const now = new Date();
    const from = new Date(now.getTime() - timeRange * 60 * 60 * 1000);
    try {
      const res = await apiFetch(
        `/api/v1/assets/${id}/sensors/${activeSensorId}/readings?from=${from.toISOString()}&to=${now.toISOString()}&interval=5m`
      );
      setSensorReadings(res.data);
    } catch (err) { console.error(err); }
  }, [activeSensorId, id, timeRange]);

  useEffect(() => { fetchReadings(); }, [fetchReadings]);

  // Fetch comparison data when compare mode changes
  useEffect(() => {
    if (compareMode === 'off' || !activeSensorId || !id) {
      setComparisonData(null);
      return;
    }
    const days = compareMode === '7d' ? 7 : 30;
    const now = new Date();
    const compFrom = new Date(now.getTime() - (timeRange * 60 * 60 * 1000) - (days * 24 * 60 * 60 * 1000));
    const compTo = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
    apiFetch(
      `/api/v1/assets/${id}/sensors/${activeSensorId}/readings?from=${compFrom.toISOString()}&to=${compTo.toISOString()}&interval=5m`
    )
      .then((res) => setComparisonData(res.data?.data || []))
      .catch(() => setComparisonData(null));
  }, [compareMode, activeSensorId, id, timeRange]);

  // Live polling
  useEffect(() => {
    if (isLive && !isPaused) {
      intervalRef.current = setInterval(() => {
        fetchReadings();
        fetchData(); // refresh anomalies + tickets too
      }, 5000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isLive, isPaused, fetchReadings, fetchData]);

  const sensors = asset?.sensors || [];
  const activeSensor = sensors.find((s: any) => s.id === activeSensorId);
  const currentValue = sensorReadings?.data?.length > 0
    ? sensorReadings.data[sensorReadings.data.length - 1].value
    : null;
  const baseline = sensorReadings?.baseline;
  const deviation = currentValue && baseline
    ? ((currentValue - baseline.mean) / baseline.mean * 100)
    : 0;
  const openTickets = tickets.filter((t: any) => !['closed', 'false_positive'].includes(t.status));

  if (loading) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">Loading turbine data...</div>;
  }
  if (!asset) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">Asset not found</div>;
  }

  return (
    <div className="flex flex-col gap-5 p-5 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">{asset.name}</h1>
            <span className={`h-2 w-2 rounded-full ${STATUS_DOT[asset.status] || 'bg-muted'}`} />
            <Badge variant="outline" className="text-xs capitalize">{asset.status}</Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            <MapPin className="h-3 w-3" /> {asset.region}
            {asset.location?.facility && <><span>-</span>{asset.location.facility}</>}
          </div>
        </div>
        {isLive && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-severity-green/15 text-severity-green text-xs font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-severity-green animate-pulse" />
            Live
          </div>
        )}
      </div>

      {/* KPI Row */}
      <StatsDisplay
        id="turbine-kpi"
        stats={[
          {
            key: 'value',
            label: activeSensor ? `${activeSensor.name} (${activeSensor.unit})` : 'Current Value',
            value: currentValue != null ? Number(currentValue).toFixed(1) : '--',
            format: { kind: 'text' },
          },
          {
            key: 'deviation',
            label: 'Deviation',
            value: `${deviation >= 0 ? '+' : ''}${deviation.toFixed(1)}%`,
            format: { kind: 'text' },
            diff: Math.abs(deviation) > 5 ? { value: deviation, upIsPositive: false, label: 'from baseline' } : undefined,
          },
          {
            key: 'anomalies',
            label: 'Anomalies (24h)',
            value: anomalies.length,
            format: { kind: 'number' },
          },
          {
            key: 'tickets',
            label: 'Open Tickets',
            value: openTickets.length,
            format: { kind: 'number' },
          },
        ]}
      />

      {/* Chart Section */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            {/* Sensor selector */}
            <div className="flex gap-1">
              {sensors.map((s: any) => (
                <Button
                  key={s.id}
                  variant={activeSensorId === s.id ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setActiveSensorId(s.id)}
                >
                  <Radio className="h-3 w-3 mr-1" />
                  {s.name}
                </Button>
              ))}
            </div>

            {/* Time + Live controls */}
            <div className="flex items-center gap-1">
              {TIME_PRESETS.map((p) => (
                <Button
                  key={p.label}
                  variant={timeRange === p.hours && !isLive ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={() => { setTimeRange(p.hours); setIsLive(false); }}
                >
                  {p.label}
                </Button>
              ))}
              <Separator orientation="vertical" className="h-5 mx-1" />
              <Button
                variant={isLive ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => { setIsLive(true); setTimeRange(1); setIsPaused(false); }}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${isLive ? 'bg-severity-green animate-pulse' : 'bg-muted-foreground'}`} />
                Live
              </Button>
              {isLive && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setIsPaused(!isPaused)}
                >
                  {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                </Button>
              )}
              <Separator orientation="vertical" className="h-5 mx-1" />
              {/* Historical comparison toggle */}
              {(['off', '7d', '30d'] as const).map((mode) => (
                <Button
                  key={mode}
                  variant={compareMode === mode ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={() => setCompareMode(mode)}
                >
                  {mode === 'off' ? 'No Compare' : `vs ${mode}`}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sensorReadings?.data?.length > 0 ? (
            <>
            {highlightRange && (
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs text-muted-foreground">
                  Highlighting: {new Date(highlightRange.start).toLocaleTimeString()} — {new Date(highlightRange.end).toLocaleTimeString()}
                </span>
                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setHighlightRange(null)}>
                  Clear
                </Button>
              </div>
            )}
            <LiveChart
              data={sensorReadings.data}
              comparisonData={comparisonData || undefined}
              baseline={sensorReadings.baseline}
              anomalies={anomalies.filter((a: any) => a.sensor_id === activeSensorId)}
              sensorName={activeSensor?.name}
              unit={activeSensor?.unit}
              onAnomalyClick={(aId) => {
                const a = anomalies.find((x: any) => x.anomaly_id === aId);
                if (a) {
                  setSelectedAnomaly(a);
                  // Highlight ±5 min around anomaly
                  const t = new Date(a.detected_at).getTime();
                  setHighlightRange({
                    start: new Date(t - 5 * 60000).toISOString(),
                    end: new Date(t + 5 * 60000).toISOString(),
                    color: SEVERITY_COLORS[a.severity] || '#f59e0b',
                    label: `${a.severity} anomaly`,
                  });
                }
              }}
              onRangeSelect={(start, end) => {
                const desc = `Manual observation: anomaly detected between ${new Date(start).toLocaleString()} and ${new Date(end).toLocaleString()}`;
                setDragDescription(desc);
                setHighlightRange({ start, end, color: '#f59e0b', label: 'Selected range' });
                setCreateTicketOpen(true);
              }}
              highlightRange={highlightRange}
              className="aspect-[2.5/1]"
            />
            </>
          ) : (
            <div className="flex h-[250px] items-center justify-center text-muted-foreground text-sm">
              Loading sensor data...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bottom: Anomalies + Tickets side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Anomalies */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-severity-amber" />
              Anomalies ({anomalies.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {anomalies.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-muted-foreground">No anomalies detected</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Sev</TableHead>
                    <TableHead>Sensor</TableHead>
                    <TableHead className="text-right">Dev%</TableHead>
                    <TableHead className="text-right">Conf%</TableHead>
                    <TableHead className="text-right">When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {anomalies.slice(0, 10).map((a: any) => (
                    <TableRow
                      key={a.anomaly_id}
                      className="cursor-pointer hover:bg-accent/30"
                      onClick={() => {
                        setSelectedAnomaly(a);
                        const t = new Date(a.detected_at).getTime();
                        setHighlightRange({
                          start: new Date(t - 5 * 60000).toISOString(),
                          end: new Date(t + 5 * 60000).toISOString(),
                          color: SEVERITY_COLORS[a.severity] || '#f59e0b',
                          label: `${a.severity} anomaly`,
                        });
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${SEV_BADGE[a.severity] || ''}`}>
                          {a.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{a.sensor_name || '--'}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{Number(a.deviation_pct).toFixed(1)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{a.confidence_score}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{timeAgo(a.detected_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Tickets */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <TicketCheck className="h-4 w-4 text-severity-red" />
                Tickets ({tickets.length})
              </CardTitle>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setCreateTicketOpen(true)}>
                <Plus className="h-3 w-3" /> Create
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {tickets.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-muted-foreground">No tickets</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Sev</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">SLA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.slice(0, 8).map((t: any) => {
                    const isClosed = t.status === 'closed' || t.status === 'false_positive';
                    return (
                      <TableRow
                        key={t.ticket_id}
                        className="cursor-pointer hover:bg-accent/30"
                        onClick={() => {
                          setEditTicketId(t.ticket_id);
                          // Highlight ±5 min around ticket creation
                          const tc = new Date(t.created_at).getTime();
                          setHighlightRange({
                            start: new Date(tc - 5 * 60000).toISOString(),
                            end: new Date(tc + 5 * 60000).toISOString(),
                            color: SEVERITY_COLORS[t.severity] || '#ef4444',
                            label: `ticket: ${t.title?.slice(0, 20)}`,
                          });
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${SEV_BADGE[t.severity] || ''}`}>
                            {t.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs max-w-[150px] truncate">{t.title}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] capitalize">{t.status?.replace('_', ' ')}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {!isClosed && t.sla_deadline ? (
                            <SlaTimer deadline={t.sla_deadline} compact />
                          ) : (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Anomaly Detail Sheet */}
      <Sheet open={!!selectedAnomaly} onOpenChange={() => setSelectedAnomaly(null)}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              Anomaly
              {selectedAnomaly && (
                <Badge variant="outline" className={SEV_BADGE[selectedAnomaly.severity] || ''}>
                  {selectedAnomaly.severity}
                </Badge>
              )}
            </SheetTitle>
            <SheetDescription>
              {selectedAnomaly?.detected_at ? new Date(selectedAnomaly.detected_at).toLocaleString() : ''}
            </SheetDescription>
          </SheetHeader>
          {selectedAnomaly && (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">Deviation</div>
                  <div className="font-mono text-lg font-bold">{Number(selectedAnomaly.deviation_pct).toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Confidence</div>
                  <div className="font-mono text-lg font-bold">{selectedAnomaly.confidence_score}%</div>
                </div>
              </div>
              {selectedAnomaly.data_snapshot && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Data Snapshot</div>
                  <pre className="rounded-lg bg-muted p-3 text-xs overflow-auto max-h-40">
                    {JSON.stringify(
                      typeof selectedAnomaly.data_snapshot === 'string'
                        ? JSON.parse(selectedAnomaly.data_snapshot)
                        : selectedAnomaly.data_snapshot,
                      null, 2
                    )}
                  </pre>
                </div>
              )}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setSelectedAnomaly(null);
                  setCreateTicketOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Ticket from Anomaly
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Ticket Create Dialog */}
      <TicketCreateDialog
        assetId={id || ''}
        assetName={asset.name}
        anomalyId={selectedAnomaly?.anomaly_id}
        defaultDescription={dragDescription}
        open={createTicketOpen}
        onOpenChange={(open) => { setCreateTicketOpen(open); if (!open) setDragDescription(''); }}
        onCreated={fetchData}
      />

      {/* Ticket Edit Sheet */}
      <TicketEditSheet
        ticketId={editTicketId}
        open={!!editTicketId}
        onOpenChange={(open) => { if (!open) setEditTicketId(null); }}
        onUpdated={fetchData}
      />
    </div>
  );
}
