/**
 * Tickets Page — "My Tickets" first, batch actions, search, SLA management
 */

import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams, useOutletContext } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Checkbox } from '../components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { LastUpdated } from '../components/LastUpdated';
import { SlaTimer } from '../components/SlaTimer';
import { toast } from 'sonner';
import { API_BASE } from '../../lib/config';
import {
  TicketCheck, AlertTriangle, Clock, User, Search, CheckCircle, ArrowUpRight,
} from 'lucide-react';


const SEV_BADGE: Record<string, string> = {
  amber: 'bg-severity-amber/20 text-severity-amber border-severity-amber/30',
  red: 'bg-severity-red/20 text-severity-red border-severity-red/30',
  purple: 'bg-severity-purple/20 text-severity-purple border-severity-purple/30',
};

const STATUS_BADGE: Record<string, string> = {
  open: 'bg-severity-amber/15 text-severity-amber',
  acknowledged: 'bg-blue-500/15 text-blue-400',
  under_review: 'bg-severity-purple/15 text-severity-purple',
  escalated: 'bg-severity-red/15 text-severity-red',
  closed: 'bg-muted text-muted-foreground',
  false_positive: 'bg-muted text-muted-foreground',
};

function getToken() { return localStorage.getItem('auth_token'); }

export function TicketsPage() {
  const navigate = useNavigate();
  const context = useOutletContext<{ user: any }>();
  const user = context?.user;
  const [searchParams, setSearchParams] = useSearchParams();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const tab = searchParams.get('tab') || 'mine';
  const severityFilter = searchParams.get('severity') || '';

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: '50' });
    if (severityFilter) params.set('severity', severityFilter);
    if (tab === 'breached') params.set('sla_breached', 'true');
    if (tab === 'escalated') params.set('status', 'escalated');
    if (tab === 'closed') params.set('status', 'closed,false_positive');
    // 'mine' and 'all' and 'open' fetch all non-closed, client-side filter for 'mine'

    try {
      const res = await fetch(`${API_BASE}/api/v1/tickets?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const json = await res.json();
      setTickets(json.data || []);
      setLastUpdated(new Date());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [tab, severityFilter]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  // Auto-refresh
  useEffect(() => {
    const interval = setInterval(fetchTickets, 30000);
    return () => clearInterval(interval);
  }, [fetchTickets]);

  const setTab = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'mine') next.delete('tab');
    else next.set('tab', value);
    setSearchParams(next);
    setSelected(new Set());
  };

  // Filter logic
  const myTickets = tickets.filter((t) => t.assigned_to_name === user?.name);
  const openTickets = tickets.filter((t) => !['closed', 'false_positive'].includes(t.status));
  const breachedTickets = tickets.filter((t) => t.sla_breached);

  let displayTickets = tab === 'mine' ? myTickets : tickets;
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    displayTickets = displayTickets.filter((t) =>
      t.title?.toLowerCase().includes(q) ||
      t.asset_name?.toLowerCase().includes(q) ||
      t.ticket_id?.includes(q)
    );
  }

  // Batch actions
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === displayTickets.length) setSelected(new Set());
    else setSelected(new Set(displayTickets.map((t) => t.ticket_id)));
  };

  const batchAcknowledge = async () => {
    const token = getToken();
    let count = 0;
    for (const id of selected) {
      try {
        await fetch(`${API_BASE}/api/v1/tickets/${id}/acknowledge`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        count++;
      } catch (e) { /* skip */ }
    }
    toast.success(`Acknowledged ${count} ticket${count !== 1 ? 's' : ''}`);
    setSelected(new Set());
    fetchTickets();
  };

  return (
    <div className="flex flex-col gap-5 p-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Tickets</h1>
          <p className="text-sm text-muted-foreground">Manage anomaly tickets and SLA compliance</p>
        </div>
        <div className="flex items-center gap-3">
          {breachedTickets.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg border border-severity-red/30 bg-severity-red/10 px-2.5 py-1 text-xs font-medium text-severity-red">
              <AlertTriangle className="h-3.5 w-3.5" />
              {breachedTickets.length} breached
            </div>
          )}
          <LastUpdated timestamp={lastUpdated} onRefresh={fetchTickets} />
        </div>
      </div>

      {/* Search + Batch actions */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by title, asset, or ticket ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {/* Severity chips */}
        <div className="flex gap-1.5">
          {['amber', 'red', 'purple'].map((sev) => (
            <Badge
              key={sev}
              variant="outline"
              className={`cursor-pointer text-xs ${severityFilter === sev ? 'ring-2 ring-ring' : ''} ${SEV_BADGE[sev]}`}
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                if (severityFilter === sev) next.delete('severity'); else next.set('severity', sev);
                setSearchParams(next);
              }}
            >
              {sev}
            </Badge>
          ))}
        </div>

        {/* Batch actions */}
        {selected.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-muted-foreground">{selected.size} selected</span>
            <Button size="sm" className="h-7 text-xs" onClick={batchAcknowledge}>
              <CheckCircle className="h-3 w-3 mr-1" />
              Acknowledge All
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="mine">
            <User className="mr-1 h-3 w-3" />
            My Tickets ({myTickets.length})
          </TabsTrigger>
          <TabsTrigger value="all">All ({tickets.length})</TabsTrigger>
          <TabsTrigger value="escalated">
            <ArrowUpRight className="mr-1 h-3 w-3" />
            Escalated
          </TabsTrigger>
          <TabsTrigger value="breached">
            <AlertTriangle className="mr-1 h-3 w-3" />
            SLA Breached ({breachedTickets.length})
          </TabsTrigger>
          <TabsTrigger value="closed">Closed</TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex h-40 items-center justify-center text-muted-foreground">Loading...</div>
              ) : displayTickets.length === 0 ? (
                <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
                  <TicketCheck className="h-8 w-8 opacity-40" />
                  <p className="text-sm">{tab === 'mine' ? 'No tickets assigned to you' : 'No tickets match filters'}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={selected.size === displayTickets.length && displayTickets.length > 0}
                          onCheckedChange={selectAll}
                        />
                      </TableHead>
                      <TableHead className="w-16">Sev</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Asset</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assigned</TableHead>
                      <TableHead className="text-right">SLA</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayTickets.map((ticket) => (
                      <TableRow
                        key={ticket.ticket_id}
                        className={`cursor-pointer hover:bg-accent/30 ${selected.has(ticket.ticket_id) ? 'bg-accent/20' : ''}`}
                        onClick={() => navigate(`/tickets/${ticket.ticket_id}`)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selected.has(ticket.ticket_id)}
                            onCheckedChange={() => toggleSelect(ticket.ticket_id)}
                          />
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${SEV_BADGE[ticket.severity] || ''}`}>
                            {ticket.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate font-medium text-sm">
                          {ticket.title}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{ticket.asset_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] capitalize ${STATUS_BADGE[ticket.status] || ''}`}>
                            {ticket.status?.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">{ticket.assigned_to_name || '--'}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          {ticket.sla_deadline && !['closed', 'false_positive'].includes(ticket.status) ? (
                            <SlaTimer deadline={ticket.sla_deadline} compact />
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
