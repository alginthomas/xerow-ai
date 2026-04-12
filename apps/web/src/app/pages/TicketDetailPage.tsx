/**
 * Ticket Detail Page - Full ticket view with audit trail and actions
 * PRD requirements TK-05, TK-06
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { SlaTimer } from '../components/SlaTimer';
import { ScrollArea } from '../components/ui/scroll-area';
import { toast } from 'sonner';
import {
  ArrowLeft,
  CheckCircle,
  ArrowUpRight,
  MessageSquare,
  Clock,
  User,
  Activity,
  Shield,
  Download,
} from 'lucide-react';
import { exportAuditReport } from '../../lib/export';
import { API_BASE } from '../../lib/config';


const SEVERITY_BADGE: Record<string, string> = {
  amber: 'bg-severity-amber/20 text-severity-amber border-severity-amber/30',
  red: 'bg-severity-red/20 text-severity-red border-severity-red/30',
  purple: 'bg-severity-purple/20 text-severity-purple border-severity-purple/30',
};

function getToken() {
  return localStorage.getItem('auth_token');
}

async function apiPost(path: string, body: object) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState('');
  const [escalateReason, setEscalateReason] = useState('');
  const [resolveNote, setResolveNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [showEscalateForm, setShowEscalateForm] = useState(false);

  const fetchTicket = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/tickets/${id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const json = await res.json();
      setTicket(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  const handleAcknowledge = async () => {
    setActionLoading(true);
    try {
      await apiPost(`/api/v1/tickets/${id}/acknowledge`, {});
      toast.success('Ticket acknowledged');
      fetchTicket();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setActionLoading(true);
    try {
      await apiPost(`/api/v1/tickets/${id}/note`, { note: noteText });
      toast.success('Note added');
      setNoteText('');
      fetchTicket();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEscalate = async () => {
    if (!escalateReason.trim()) return;
    setActionLoading(true);
    try {
      await apiPost(`/api/v1/tickets/${id}/escalate`, { reason: escalateReason });
      toast.success('Ticket escalated');
      setEscalateReason('');
      setShowEscalateForm(false);
      fetchTicket();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!resolveNote.trim()) return;
    setActionLoading(true);
    try {
      await apiPost(`/api/v1/tickets/${id}/resolve`, { resolution_note: resolveNote });
      toast.success('Ticket resolved');
      setResolveNote('');
      setShowResolveForm(false);
      fetchTicket();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">Loading ticket...</div>;
  }

  if (!ticket) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">Ticket not found</div>;
  }

  const isClosed = ticket.status === 'closed' || ticket.status === 'false_positive';

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="mt-0.5">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold">{ticket.title}</h1>
            <Badge variant="outline" className={SEVERITY_BADGE[ticket.severity] || ''}>
              {ticket.severity}
            </Badge>
            <Badge variant="outline" className="capitalize text-xs">
              {ticket.status?.replace('_', ' ')}
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Activity className="h-3.5 w-3.5" />
              {ticket.asset_name}
            </span>
            <span className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              {ticket.assigned_to_name || 'Unassigned'}
              {ticket.assigned_to_persona && (
                <span className="capitalize">({ticket.assigned_to_persona})</span>
              )}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {new Date(ticket.created_at).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* SLA Timer */}
          {!isClosed && ticket.sla_deadline && (
            <SlaTimer deadline={ticket.sla_deadline} />
          )}
          {/* Export Report */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => exportAuditReport(ticket, ticket.audit_trail || [])}
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Anomaly context */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Anomaly Context
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <div className="text-xs text-muted-foreground">Sensor</div>
                  <div className="font-medium text-sm">{ticket.sensor_name || '--'}</div>
                  <div className="text-xs text-muted-foreground">{ticket.sensor_unit}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Deviation</div>
                  <div className="font-mono text-lg font-bold">
                    {Number(ticket.deviation_pct).toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Confidence</div>
                  <div className="font-mono text-lg font-bold">
                    {ticket.confidence_score}%
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Escalation Level</div>
                  <div className="font-mono text-lg font-bold">
                    {ticket.escalation_level || 0}
                  </div>
                </div>
              </div>

              {ticket.description && (
                <p className="mt-4 text-sm text-muted-foreground">{ticket.description}</p>
              )}

              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/assets/${ticket.asset_id}`)}
                >
                  View Asset
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Actions - only show if not closed */}
          {!isClosed && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Acknowledge */}
                {ticket.status === 'open' && (
                  <Button onClick={handleAcknowledge} disabled={actionLoading} className="w-full sm:w-auto">
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Acknowledge Ticket
                  </Button>
                )}

                {/* Add note */}
                <div className="space-y-2">
                  <Textarea
                    placeholder="Add a field note..."
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    rows={2}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddNote}
                    disabled={!noteText.trim() || actionLoading}
                  >
                    <MessageSquare className="mr-2 h-3.5 w-3.5" />
                    Add Note
                  </Button>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {/* Escalate */}
                  {!showEscalateForm ? (
                    <Button
                      variant="outline"
                      onClick={() => setShowEscalateForm(true)}
                      className="border-severity-amber/30 text-severity-amber hover:bg-severity-amber/10"
                    >
                      <ArrowUpRight className="mr-2 h-4 w-4" />
                      Escalate
                    </Button>
                  ) : (
                    <div className="w-full space-y-2">
                      <Textarea
                        placeholder="Escalation reason (required)..."
                        value={escalateReason}
                        onChange={(e) => setEscalateReason(e.target.value)}
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleEscalate}
                          disabled={!escalateReason.trim() || actionLoading}
                          className="bg-severity-amber text-black hover:bg-severity-amber/90"
                        >
                          Confirm Escalation
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setShowEscalateForm(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Resolve */}
                  {!showResolveForm ? (
                    <Button
                      variant="outline"
                      onClick={() => setShowResolveForm(true)}
                      className="border-severity-green/30 text-severity-green hover:bg-severity-green/10"
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Resolve
                    </Button>
                  ) : (
                    <div className="w-full space-y-2">
                      <Textarea
                        placeholder="Resolution note (required)..."
                        value={resolveNote}
                        onChange={(e) => setResolveNote(e.target.value)}
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleResolve}
                          disabled={!resolveNote.trim() || actionLoading}
                          className="bg-severity-green text-black hover:bg-severity-green/90"
                        >
                          Confirm Resolution
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setShowResolveForm(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Resolution info for closed tickets */}
          {isClosed && ticket.resolution_note && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-severity-green">
                  <CheckCircle className="h-4 w-4" />
                  Resolution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{ticket.resolution_note}</p>
                {ticket.classification_note && (
                  <div className="mt-3">
                    <div className="text-xs text-muted-foreground mb-1">Classification Note</div>
                    <p className="text-sm">{ticket.classification_note}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Audit trail sidebar (TK-06) */}
        <div>
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Audit Trail
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px] px-4 pb-4">
                {ticket.audit_trail && ticket.audit_trail.length > 0 ? (
                  <div className="space-y-0">
                    {ticket.audit_trail.map((entry: any, idx: number) => (
                      <div
                        key={entry.id || idx}
                        className="relative border-l-2 border-border pl-4 pb-4 last:pb-0"
                      >
                        <div className="absolute -left-1 top-0 h-2 w-2 rounded-full bg-border" />
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-xs">{entry.actor}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(entry.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground capitalize mt-0.5">
                          {entry.action?.replace(/_/g, ' ')}
                        </div>
                        {entry.note && (
                          <p className="mt-1 text-xs text-foreground/80 bg-muted/50 rounded px-2 py-1">
                            {entry.note}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4">No audit trail entries</p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
