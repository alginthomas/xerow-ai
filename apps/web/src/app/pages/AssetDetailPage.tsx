/**
 * Asset Detail Page - Comprehensive view of a single asset
 * PRD requirements AD-01 through AD-07
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '../components/ui/sheet';
import { ScrollArea } from '../components/ui/scroll-area';
import { TimeSeriesChart } from '../components/charts/TimeSeriesChart';
import { SlaTimer } from '../components/SlaTimer';
import {
  ArrowLeft,
  MapPin,
  Activity,
  AlertTriangle,
  TicketCheck,
  Bot,
  Clock,
  Shield,
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const SEVERITY_BADGE: Record<string, string> = {
  green: 'bg-severity-green/20 text-severity-green border-severity-green/30',
  amber: 'bg-severity-amber/20 text-severity-amber border-severity-amber/30',
  red: 'bg-severity-red/20 text-severity-red border-severity-red/30',
  purple: 'bg-severity-purple/20 text-severity-purple border-severity-purple/30',
};

const STATUS_BADGE: Record<string, string> = {
  operational: 'bg-severity-green/20 text-severity-green border-severity-green/30',
  degraded: 'bg-severity-amber/20 text-severity-amber border-severity-amber/30',
  offline: 'bg-severity-red/20 text-severity-red border-severity-red/30',
  maintenance: 'bg-severity-purple/20 text-severity-purple border-severity-purple/30',
};

function getToken() {
  return localStorage.getItem('auth_token');
}

async function apiFetch(path: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [asset, setAsset] = useState<any>(null);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [sensorReadings, setSensorReadings] = useState<any>(null);
  const [activeSensorId, setActiveSensorId] = useState<string | null>(null);
  const [selectedAnomaly, setSelectedAnomaly] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Fetch asset details
  useEffect(() => {
    if (!id) return;
    setLoading(true);

    Promise.all([
      apiFetch(`/api/v1/assets/${id}`),
      apiFetch(`/api/v1/assets/${id}/anomalies?limit=50`),
      apiFetch(`/api/v1/assets/${id}/tickets?limit=20`),
    ])
      .then(([assetRes, anomalyRes, ticketRes]) => {
        setAsset(assetRes.data);
        setAnomalies(anomalyRes.data || []);
        setTickets(ticketRes.data || []);

        // Auto-select first sensor for chart
        const sensors = assetRes.data?.sensors;
        if (sensors?.length > 0) {
          setActiveSensorId(sensors[0].id);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  // Fetch sensor readings when active sensor changes
  useEffect(() => {
    if (!activeSensorId || !id) return;

    const now = new Date();
    const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    apiFetch(
      `/api/v1/assets/${id}/sensors/${activeSensorId}/readings?from=${from.toISOString()}&to=${now.toISOString()}&interval=5m`
    )
      .then((res) => setSensorReadings(res.data))
      .catch(console.error);
  }, [activeSensorId, id]);

  // Fetch audit log
  useEffect(() => {
    if (!id) return;
    // Audit logs are fetched per-entity from the agents route
    apiFetch(`/api/v1/agents/asset/${id}`)
      .then((res) => {
        // Use agent data as audit-like entries for now
        setAuditLog(
          (res.data || []).map((agent: any) => ({
            id: agent.id,
            actor: `${agent.agent_type}_agent`,
            action: agent.status,
            timestamp: agent.last_assessment || agent.created_at,
            note: `Confidence: ${agent.confidence_score}%`,
          }))
        );
      })
      .catch(console.error);
  }, [id]);

  const handleAnomalyClick = useCallback((anomalyId: string) => {
    const anomaly = anomalies.find((a) => a.anomaly_id === anomalyId);
    setSelectedAnomaly(anomaly);
  }, [anomalies]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading asset details...
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Asset not found
      </div>
    );
  }

  const sensors = asset.sensors || [];
  const activeSensor = sensors.find((s: any) => s.id === activeSensorId);
  const location = asset.location || {};

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header (AD-07) */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="mt-0.5">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{asset.name}</h1>
            <Badge variant="outline" className={STATUS_BADGE[asset.status] || ''}>
              {asset.status}
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1 capitalize">
              <Activity className="h-3.5 w-3.5" />
              {asset.type}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {asset.region}
            </span>
            {location.facility && (
              <span className="flex items-center gap-1">
                <Shield className="h-3.5 w-3.5" />
                {location.facility}
              </span>
            )}
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-severity-amber">{anomalies.length}</div>
            <div className="text-xs text-muted-foreground">Anomalies</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-severity-red">
              {tickets.filter((t) => t.status !== 'closed' && t.status !== 'false_positive').length}
            </div>
            <div className="text-xs text-muted-foreground">Open Tickets</div>
          </div>
        </div>
      </div>

      {/* Sensor selector + Time Series Chart (AD-01, AD-02) */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Sensor Readings</CardTitle>
            {sensors.length > 1 && (
              <div className="flex gap-1">
                {sensors.map((sensor: any) => (
                  <Button
                    key={sensor.id}
                    variant={activeSensorId === sensor.id ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setActiveSensorId(sensor.id)}
                  >
                    {sensor.name}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {sensorReadings?.data?.length > 0 ? (
            <TimeSeriesChart
              data={sensorReadings.data}
              baseline={sensorReadings.baseline}
              anomalies={anomalies.filter(
                (a) => a.sensor_id === activeSensorId
              )}
              sensorName={activeSensor?.name}
              unit={activeSensor?.unit}
              onAnomalyClick={handleAnomalyClick}
            />
          ) : (
            <div className="flex h-[300px] items-center justify-center text-muted-foreground">
              {activeSensorId ? 'Loading sensor data...' : 'Select a sensor to view readings'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabbed panels */}
      <Tabs defaultValue="sensors">
        <TabsList>
          <TabsTrigger value="sensors">
            <Activity className="mr-1.5 h-3.5 w-3.5" />
            Sensors
          </TabsTrigger>
          <TabsTrigger value="anomalies">
            <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
            Anomalies ({anomalies.length})
          </TabsTrigger>
          <TabsTrigger value="tickets">
            <TicketCheck className="mr-1.5 h-3.5 w-3.5" />
            Tickets ({tickets.length})
          </TabsTrigger>
          <TabsTrigger value="agents">
            <Bot className="mr-1.5 h-3.5 w-3.5" />
            Agents
          </TabsTrigger>
          <TabsTrigger value="audit">
            <Clock className="mr-1.5 h-3.5 w-3.5" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        {/* Sensors Tab */}
        <TabsContent value="sensors">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Baseline</TableHead>
                    <TableHead className="text-right">Hard Threshold</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sensors.map((sensor: any) => (
                    <TableRow
                      key={sensor.id}
                      className="cursor-pointer hover:bg-accent/50"
                      onClick={() => setActiveSensorId(sensor.id)}
                    >
                      <TableCell className="font-medium">{sensor.name}</TableCell>
                      <TableCell className="text-muted-foreground">{sensor.type}</TableCell>
                      <TableCell className="text-muted-foreground">{sensor.unit}</TableCell>
                      <TableCell className="text-right font-mono">
                        {sensor.baseline_value ?? '--'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-severity-red">
                        {sensor.hard_threshold_max ?? '--'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">
                          {sensor.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Anomalies Tab */}
        <TabsContent value="anomalies">
          <Card>
            <CardContent className="p-0">
              {anomalies.length === 0 ? (
                <div className="flex h-32 items-center justify-center text-muted-foreground">
                  No anomalies detected for this asset
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Severity</TableHead>
                      <TableHead>Sensor</TableHead>
                      <TableHead>Detected</TableHead>
                      <TableHead className="text-right">Deviation</TableHead>
                      <TableHead className="text-right">Confidence</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {anomalies.map((anomaly: any) => (
                      <TableRow
                        key={anomaly.anomaly_id}
                        className="cursor-pointer hover:bg-accent/50"
                        onClick={() => setSelectedAnomaly(anomaly)}
                      >
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={SEVERITY_BADGE[anomaly.severity] || ''}
                          >
                            {anomaly.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {anomaly.sensor_name || anomaly.sensor_id?.slice(0, 8)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {new Date(anomaly.detected_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {Number(anomaly.deviation_pct).toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {anomaly.confidence_score}%
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">
                            {anomaly.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tickets Tab (AD-06) */}
        <TabsContent value="tickets">
          <Card>
            <CardContent className="p-0">
              {tickets.length === 0 ? (
                <div className="flex h-32 items-center justify-center text-muted-foreground">
                  No tickets for this asset
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Severity</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>SLA</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tickets.map((ticket: any) => (
                      <TableRow
                        key={ticket.ticket_id}
                        className="cursor-pointer hover:bg-accent/50"
                        onClick={() => navigate(`/tickets/${ticket.ticket_id}`)}
                      >
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={SEVERITY_BADGE[ticket.severity] || ''}
                          >
                            {ticket.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium max-w-[300px] truncate">
                          {ticket.title}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">
                            {ticket.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {ticket.assigned_to_name || '--'}
                        </TableCell>
                        <TableCell>
                          {ticket.sla_deadline && ticket.status !== 'closed' && (
                            <SlaTimer deadline={ticket.sla_deadline} compact />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Agents Tab (AD-03) */}
        <TabsContent value="agents">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {auditLog.map((agent: any) => (
              <Card key={agent.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Bot className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium text-sm capitalize">
                        {agent.actor.replace('_agent', '')} Agent
                      </div>
                      <div className="text-xs text-muted-foreground capitalize">
                        Status: {agent.action}
                      </div>
                      <div className="text-xs text-muted-foreground">{agent.note}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {auditLog.length === 0 && (
              <div className="col-span-3 flex h-32 items-center justify-center text-muted-foreground">
                No agents assigned to this asset
              </div>
            )}
          </div>
        </TabsContent>

        {/* Audit Log Tab (AD-05) */}
        <TabsContent value="audit">
          <Card>
            <CardContent className="p-4">
              {auditLog.length === 0 ? (
                <div className="flex h-32 items-center justify-center text-muted-foreground">
                  No audit log entries
                </div>
              ) : (
                <div className="space-y-3">
                  {auditLog.map((entry: any, idx: number) => (
                    <div key={entry.id || idx} className="flex gap-3 border-l-2 border-border pl-4 py-1">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm capitalize">
                            {entry.actor}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {entry.action}
                          </span>
                        </div>
                        {entry.note && (
                          <p className="text-xs text-muted-foreground mt-0.5">{entry.note}</p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {entry.timestamp
                          ? new Date(entry.timestamp).toLocaleString()
                          : '--'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Anomaly Detail Sheet */}
      <Sheet open={!!selectedAnomaly} onOpenChange={() => setSelectedAnomaly(null)}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              Anomaly Detail
              {selectedAnomaly && (
                <Badge
                  variant="outline"
                  className={SEVERITY_BADGE[selectedAnomaly.severity] || ''}
                >
                  {selectedAnomaly.severity}
                </Badge>
              )}
            </SheetTitle>
            <SheetDescription>
              Detected {selectedAnomaly?.detected_at
                ? new Date(selectedAnomaly.detected_at).toLocaleString()
                : ''}
            </SheetDescription>
          </SheetHeader>

          {selectedAnomaly && (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">Deviation</div>
                  <div className="font-mono text-lg font-bold">
                    {Number(selectedAnomaly.deviation_pct).toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Confidence</div>
                  <div className="font-mono text-lg font-bold">
                    {selectedAnomaly.confidence_score}%
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Sensor</div>
                  <div className="text-sm">
                    {selectedAnomaly.sensor_name || selectedAnomaly.sensor_id?.slice(0, 8)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Status</div>
                  <div className="text-sm capitalize">{selectedAnomaly.status}</div>
                </div>
              </div>

              {selectedAnomaly.data_snapshot && (
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">Data Snapshot</div>
                  <pre className="rounded-lg bg-muted p-3 text-xs overflow-auto max-h-48">
                    {JSON.stringify(
                      typeof selectedAnomaly.data_snapshot === 'string'
                        ? JSON.parse(selectedAnomaly.data_snapshot)
                        : selectedAnomaly.data_snapshot,
                      null,
                      2
                    )}
                  </pre>
                </div>
              )}

              {selectedAnomaly.ticket_id && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setSelectedAnomaly(null);
                    navigate(`/tickets/${selectedAnomaly.ticket_id}`);
                  }}
                >
                  <TicketCheck className="mr-2 h-4 w-4" />
                  View Linked Ticket
                </Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
