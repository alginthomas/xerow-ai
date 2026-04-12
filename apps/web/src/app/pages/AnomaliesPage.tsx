/**
 * Anomaly Capture Table - Immutable anomaly records with filtering
 * PRD Section 4.5
 */

import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { AlertTriangle, Lock, ExternalLink, Download } from 'lucide-react';
import { exportToCSV } from '../../lib/export';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const SEVERITY_BADGE: Record<string, string> = {
  green: 'bg-severity-green/20 text-severity-green border-severity-green/30',
  amber: 'bg-severity-amber/20 text-severity-amber border-severity-amber/30',
  red: 'bg-severity-red/20 text-severity-red border-severity-red/30',
  purple: 'bg-severity-purple/20 text-severity-purple border-severity-purple/30',
};

export function AnomaliesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasNext, setHasNext] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);

  const severityFilter = searchParams.get('severity') || '';
  const statusFilter = searchParams.get('status') || '';

  const fetchAnomalies = useCallback(async (append = false) => {
    setLoading(true);
    const token = localStorage.getItem('auth_token');
    const params = new URLSearchParams({ limit: '30' });
    if (severityFilter) params.set('severity', severityFilter);
    if (statusFilter) params.set('status', statusFilter);
    if (append && cursor) params.set('cursor', cursor);

    try {
      const res = await fetch(`${API_BASE}/api/v1/anomalies?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      const data = json.data || [];
      setHasNext(json.meta?.has_next || false);
      setCursor(json.meta?.next_cursor || null);
      setAnomalies(append ? (prev) => [...prev, ...data] : data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [severityFilter, statusFilter, cursor]);

  useEffect(() => {
    setCursor(null);
    fetchAnomalies(false);
  }, [severityFilter, statusFilter]);

  const setSeverity = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'all') next.delete('severity');
    else next.set('severity', value);
    setSearchParams(next);
  };

  const setStatus = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'all') next.delete('status');
    else next.set('status', value);
    setSearchParams(next);
  };

  // Summary counts
  const counts = anomalies.reduce(
    (acc, a) => {
      acc[a.severity] = (acc[a.severity] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Anomaly Capture Table</h1>
          <p className="text-muted-foreground">
            Immutable record of all detected anomalies
          </p>
        </div>
        {anomalies.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => exportToCSV(
              anomalies.map((a) => ({
                severity: a.severity,
                asset: a.asset_name,
                sensor: a.sensor_name,
                deviation_pct: a.deviation_pct,
                confidence: a.confidence_score,
                detected_at: a.detected_at,
                status: a.status,
              })),
              'anomalies'
            )}
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        )}
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-3">
        {['green', 'amber', 'red', 'purple'].map((sev) => (
          <div
            key={sev}
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm cursor-pointer transition-colors ${
              severityFilter === sev ? 'ring-2 ring-ring' : ''
            } ${SEVERITY_BADGE[sev]}`}
            onClick={() => setSeverity(severityFilter === sev ? 'all' : sev)}
          >
            <div
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: `var(--severity-${sev})` }}
            />
            <span className="capitalize font-medium">{sev}</span>
            <span className="font-mono">{counts[sev] || 0}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter || 'all'} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="logged">Logged</SelectItem>
            <SelectItem value="ticket_open">Ticket Open</SelectItem>
            <SelectItem value="ticket_closed">Ticket Closed</SelectItem>
            <SelectItem value="false_positive">False Positive</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>

        {(severityFilter || statusFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearchParams({})}
          >
            Clear filters
          </Button>
        )}

        <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />
          Core fields are immutable
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading && anomalies.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              Loading anomalies...
            </div>
          ) : anomalies.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
              <AlertTriangle className="h-8 w-8" />
              <p>No anomalies match the current filters</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Severity</TableHead>
                  <TableHead>Asset</TableHead>
                  <TableHead>Sensor</TableHead>
                  <TableHead>Detected</TableHead>
                  <TableHead className="text-right">Deviation</TableHead>
                  <TableHead className="text-right">Confidence</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ticket</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {anomalies.map((anomaly: any) => (
                  <TableRow key={anomaly.anomaly_id} className="hover:bg-accent/50">
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={SEVERITY_BADGE[anomaly.severity] || ''}
                      >
                        {anomaly.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <button
                        className="text-sm font-medium hover:underline cursor-pointer"
                        onClick={() => navigate(`/assets/${anomaly.asset_id}`)}
                      >
                        {anomaly.asset_name || anomaly.asset_id?.slice(0, 8)}
                      </button>
                      <div className="text-xs text-muted-foreground capitalize">
                        {anomaly.asset_type}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {anomaly.sensor_name || '--'}
                      {anomaly.sensor_unit && (
                        <span className="text-xs ml-1">({anomaly.sensor_unit})</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(anomaly.detected_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {Number(anomaly.deviation_pct).toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {anomaly.confidence_score}%
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">
                        {anomaly.status?.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {anomaly.ticket_id ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => navigate(`/tickets/${anomaly.ticket_id}`)}
                        >
                          <ExternalLink className="mr-1 h-3 w-3" />
                          View
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">--</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Load more */}
      {hasNext && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => fetchAnomalies(true)}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Load More'}
          </Button>
        </div>
      )}
    </div>
  );
}
