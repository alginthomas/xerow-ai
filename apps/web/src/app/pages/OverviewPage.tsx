/**
 * Mission Control Dashboard — Operators check alarms FIRST, always
 * Auto-refreshes every 30s. Alarms are the dominant visual element.
 */

import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Separator } from '../components/ui/separator';
import { LastUpdated } from '../components/LastUpdated';
import { SlaTimer } from '../components/SlaTimer';
import {
  Activity, AlertTriangle, TicketCheck, Wind, GitBranch, Droplet,
  ArrowUpRight, CheckCircle, Radio,
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
function getToken() { return localStorage.getItem('auth_token'); }

const TYPE_ICONS: Record<string, typeof Wind> = { turbine: Wind, pipeline: GitBranch, well: Droplet };

const SEV_STYLE: Record<string, { bg: string; text: string; ring: string }> = {
  amber: { bg: 'bg-severity-amber/15', text: 'text-severity-amber', ring: 'ring-severity-amber/30' },
  red: { bg: 'bg-severity-red/15', text: 'text-severity-red', ring: 'ring-severity-red/30' },
  purple: { bg: 'bg-severity-purple/15', text: 'text-severity-purple', ring: 'ring-severity-purple/30' },
};

export function OverviewPage() {
  const navigate = useNavigate();
  const [assets, setAssets] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const [assetRes, ticketRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/assets?limit=50`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch(`${API_BASE}/api/v1/tickets?limit=20`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      ]);
      setAssets(assetRes.data || []);
      setTickets(ticketRes.data || []);
      setLastUpdated(new Date());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const totalAssets = assets.length;
  const openTickets = tickets.filter((t: any) => !['closed', 'false_positive'].includes(t.status));
  const breachedTickets = tickets.filter((t: any) => t.sla_breached);
  const recentAnomalies = assets.reduce((sum: number, a: any) => sum + (a.recent_anomaly_count || 0), 0);
  const degradedAssets = assets.filter((a: any) => a.status !== 'operational');

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Mission Control</h1>
          <p className="text-sm text-muted-foreground">Operations overview across all regions</p>
        </div>
        <LastUpdated timestamp={lastUpdated} onRefresh={fetchData} />
      </div>

      {/* Alarm Banner — THE dominant visual element */}
      {breachedTickets.length > 0 && (
        <div className="flex items-center gap-4 rounded-xl bg-severity-red/10 border border-severity-red/30 px-5 py-4 animate-pulse">
          <AlertTriangle className="h-6 w-6 text-severity-red shrink-0" />
          <div className="flex-1">
            <div className="text-lg font-bold text-severity-red">{breachedTickets.length} SLA Breach{breachedTickets.length > 1 ? 'es' : ''}</div>
            <p className="text-sm text-severity-red/80">Immediate attention required</p>
          </div>
          <Button
            variant="outline"
            className="border-severity-red/40 text-severity-red hover:bg-severity-red/10"
            onClick={() => navigate('/escalation')}
          >
            View Escalation
          </Button>
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="cursor-pointer hover:border-foreground/20 transition-colors" onClick={() => navigate('/tickets')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Open Tickets</span>
              <TicketCheck className="h-4 w-4 text-severity-amber" />
            </div>
            <div className="text-3xl font-bold tabular-nums">{openTickets.length}</div>
            {breachedTickets.length > 0 && (
              <p className="text-xs text-severity-red mt-1 font-medium">{breachedTickets.length} SLA breached</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Anomalies (24h)</span>
              <AlertTriangle className="h-4 w-4 text-severity-amber" />
            </div>
            <div className="text-3xl font-bold tabular-nums">{recentAnomalies}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Assets</span>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-3xl font-bold tabular-nums">{totalAssets}</div>
            {degradedAssets.length > 0 && (
              <p className="text-xs text-severity-amber mt-1 font-medium">{degradedAssets.length} need attention</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Escalated</span>
              <ArrowUpRight className="h-4 w-4 text-severity-red" />
            </div>
            <div className="text-3xl font-bold tabular-nums">
              {tickets.filter((t: any) => t.status === 'escalated').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Two-column: Active Tickets + Asset Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Active Tickets — sorted by urgency */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <TicketCheck className="h-4 w-4" />
                Active Tickets
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate('/tickets')}>
                View all
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {openTickets.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-severity-green/50" />
                All clear — no open tickets
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">Sev</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Asset</TableHead>
                    <TableHead className="text-right">SLA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {openTickets.slice(0, 8).map((t: any) => {
                    const sev = SEV_STYLE[t.severity] || SEV_STYLE.amber;
                    return (
                      <TableRow
                        key={t.ticket_id}
                        className="cursor-pointer hover:bg-accent/30"
                        onClick={() => navigate(`/tickets/${t.ticket_id}`)}
                      >
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${sev.bg} ${sev.text}`}>
                            {t.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm max-w-[180px] truncate">{t.title}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{t.asset_name}</TableCell>
                        <TableCell className="text-right">
                          {t.sla_deadline && <SlaTimer deadline={t.sla_deadline} compact />}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Asset Health Grid */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Radio className="h-4 w-4" />
              Asset Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {assets.map((asset: any) => {
                const Icon = TYPE_ICONS[asset.type] || Activity;
                const isHealthy = asset.status === 'operational';
                const hasIssues = (asset.open_ticket_count || 0) > 0 || (asset.recent_anomaly_count || 0) > 0;

                return (
                  <button
                    key={asset.id}
                    onClick={() => navigate(`/monitor/${asset.id}`)}
                    className={`flex items-center gap-2.5 rounded-lg border p-3 text-left transition-all hover:shadow-sm cursor-pointer ${
                      !isHealthy ? 'border-severity-amber/30 bg-severity-amber/5' :
                      hasIssues ? 'border-border/60 bg-card' :
                      'border-border/30 bg-card/50'
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${!isHealthy ? 'text-severity-amber' : 'text-muted-foreground'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{asset.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          isHealthy ? 'bg-severity-green' : 'bg-severity-amber'
                        }`} />
                        <span className="text-[10px] text-muted-foreground">
                          {(asset.open_ticket_count || 0) > 0
                            ? `${asset.open_ticket_count} tickets`
                            : isHealthy ? 'healthy' : asset.status}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
