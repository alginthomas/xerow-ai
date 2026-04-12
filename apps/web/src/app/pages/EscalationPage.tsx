/**
 * Escalation Page - Escalated tickets and SLA breaches
 * PRD escalation matrix (Section 9.2)
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { SlaTimer } from '../components/SlaTimer';
import { AlertTriangle, ArrowUpRight, User } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const SEVERITY_BADGE: Record<string, string> = {
  amber: 'bg-severity-amber/20 text-severity-amber border-severity-amber/30',
  red: 'bg-severity-red/20 text-severity-red border-severity-red/30',
  purple: 'bg-severity-purple/20 text-severity-purple border-severity-purple/30',
};

export function EscalationPage() {
  const navigate = useNavigate();
  const [escalated, setEscalated] = useState<any[]>([]);
  const [breached, setBreached] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    Promise.all([
      fetch(`${API_BASE}/api/v1/tickets?status=escalated&limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
      fetch(`${API_BASE}/api/v1/tickets?sla_breached=true&limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
    ])
      .then(([escRes, breachRes]) => {
        setEscalated(escRes.data || []);
        setBreached(breachRes.data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function TicketRow({ ticket }: { ticket: any }) {
    return (
      <TableRow
        className="cursor-pointer hover:bg-accent/50"
        onClick={() => navigate(`/tickets/${ticket.ticket_id}`)}
      >
        <TableCell>
          <Badge variant="outline" className={SEVERITY_BADGE[ticket.severity] || ''}>
            {ticket.severity}
          </Badge>
        </TableCell>
        <TableCell className="max-w-[250px] truncate font-medium">{ticket.title}</TableCell>
        <TableCell className="text-sm text-muted-foreground">{ticket.asset_name}</TableCell>
        <TableCell>
          <div className="flex items-center gap-1.5">
            <User className="h-3 w-3 text-muted-foreground" />
            <span className="text-sm">{ticket.assigned_to_name || '--'}</span>
          </div>
        </TableCell>
        <TableCell>
          {ticket.sla_deadline && (
            <SlaTimer deadline={ticket.sla_deadline} compact />
          )}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          Level {ticket.escalation_level || 0}
        </TableCell>
      </TableRow>
    );
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Escalation</h1>
        <p className="text-muted-foreground">SLA breaches and escalated tickets requiring immediate attention</p>
      </div>

      {/* SLA Breached */}
      <Card className={breached.length > 0 ? 'border-severity-red/30' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className={`h-4 w-4 ${breached.length > 0 ? 'text-severity-red' : 'text-muted-foreground'}`} />
            SLA Breached ({breached.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {breached.length === 0 ? (
            <div className="flex h-24 items-center justify-center text-muted-foreground text-sm">
              No SLA breaches - all tickets within target
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Severity</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Asset</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead>Level</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {breached.map((ticket) => (
                  <TicketRow key={ticket.ticket_id} ticket={ticket} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Escalated tickets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowUpRight className="h-4 w-4 text-severity-amber" />
            Escalated Tickets ({escalated.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {escalated.length === 0 ? (
            <div className="flex h-24 items-center justify-center text-muted-foreground text-sm">
              No escalated tickets
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Severity</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Asset</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead>Level</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {escalated.map((ticket) => (
                  <TicketRow key={ticket.ticket_id} ticket={ticket} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
