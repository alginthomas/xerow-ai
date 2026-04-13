/**
 * TicketEditSheet — Side panel for viewing/editing a ticket
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from './ui/sheet';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { SlaTimer } from './SlaTimer';
import { toast } from 'sonner';
import { API_BASE } from '../../lib/config';
import {
  CheckCircle, ArrowUpRight, MessageSquare, Clock, User, Bot, Cpu,
} from 'lucide-react';


const SEV_BADGE: Record<string, string> = {
  amber: 'bg-severity-amber/20 text-severity-amber border-severity-amber/30',
  red: 'bg-severity-red/20 text-severity-red border-severity-red/30',
  purple: 'bg-severity-purple/20 text-severity-purple border-severity-purple/30',
};

function getToken() { return localStorage.getItem('auth_token'); }

async function apiPost(path: string, body: object) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || 'Request failed'); }
  return res.json();
}

function actorIcon(actor: string) {
  const l = actor.toLowerCase();
  if (l.includes('agent')) return { icon: Bot, color: 'bg-blue-500/20 text-blue-400' };
  if (l === 'system' || l === 'seed_script') return { icon: Cpu, color: 'bg-muted text-muted-foreground' };
  return { icon: User, color: 'bg-severity-green/20 text-severity-green' };
}

function timeAgo(d: string) {
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface TicketEditSheetProps {
  ticketId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export function TicketEditSheet({ ticketId, open, onOpenChange, onUpdated }: TicketEditSheetProps) {
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [escalateReason, setEscalateReason] = useState('');
  const [resolveNote, setResolveNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const fetchTicket = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/tickets/${ticketId}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const json = await res.json();
      setTicket(json.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [ticketId]);

  useEffect(() => { if (open && ticketId) fetchTicket(); }, [open, ticketId, fetchTicket]);

  const doAction = async (path: string, body: object, msg: string) => {
    setActionLoading(true);
    try {
      await apiPost(path, body);
      toast.success(msg);
      setNoteText(''); setEscalateReason(''); setResolveNote('');
      setActiveAction(null);
      fetchTicket();
      onUpdated();
    } catch (err: any) { toast.error(err.message); }
    finally { setActionLoading(false); }
  };

  const isClosed = ticket?.status === 'closed' || ticket?.status === 'false_positive';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4">
          <SheetTitle className="flex items-center gap-2">
            Ticket Detail
            {ticket && (
              <Badge variant="outline" className={SEV_BADGE[ticket.severity] || ''}>
                {ticket.severity}
              </Badge>
            )}
          </SheetTitle>
          {ticket && <SheetDescription>{ticket.title}</SheetDescription>}
        </SheetHeader>

        <ScrollArea className="flex-1 px-6">
          {loading || !ticket ? (
            <div className="space-y-4 animate-pulse py-4">
              <div className="h-5 w-48 bg-muted rounded" />
              <div className="h-4 w-32 bg-muted rounded" />
              <div className="h-20 bg-muted rounded" />
            </div>
          ) : (
            <div className="space-y-5 pb-6">
              {/* Meta */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-[11px] text-muted-foreground">Status</div>
                  <div className="font-medium capitalize">{ticket.status?.replace('_', ' ')}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">Assigned To</div>
                  <div className="font-medium">{ticket.assigned_to_name || 'Unassigned'}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">Asset</div>
                  <div className="font-medium">{ticket.asset_name}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">SLA</div>
                  {!isClosed && ticket.sla_deadline ? (
                    <SlaTimer deadline={ticket.sla_deadline} />
                  ) : (
                    <span className="text-severity-green text-sm">Resolved</span>
                  )}
                </div>
              </div>

              {ticket.description && (
                <p className="text-sm text-muted-foreground">{ticket.description}</p>
              )}

              {/* Actions */}
              {!isClosed && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</div>

                    {ticket.status === 'open' && (
                      <Button size="sm" className="w-full" onClick={() => doAction(`/api/v1/tickets/${ticketId}/acknowledge`, {}, 'Ticket acknowledged')} disabled={actionLoading}>
                        <CheckCircle className="h-3.5 w-3.5 mr-2" /> Acknowledge
                      </Button>
                    )}

                    {/* Add Note */}
                    {activeAction !== 'note' ? (
                      <Button size="sm" variant="outline" className="w-full" onClick={() => setActiveAction('note')}>
                        <MessageSquare className="h-3.5 w-3.5 mr-2" /> Add Note
                      </Button>
                    ) : (
                      <div className="space-y-2">
                        <Textarea placeholder="Field note..." value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={2} />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => doAction(`/api/v1/tickets/${ticketId}/note`, { note: noteText }, 'Note added')} disabled={!noteText.trim() || actionLoading}>Save</Button>
                          <Button size="sm" variant="ghost" onClick={() => setActiveAction(null)}>Cancel</Button>
                        </div>
                      </div>
                    )}

                    {/* Escalate */}
                    {activeAction !== 'escalate' ? (
                      <Button size="sm" variant="outline" className="w-full border-severity-amber/30 text-severity-amber" onClick={() => setActiveAction('escalate')}>
                        <ArrowUpRight className="h-3.5 w-3.5 mr-2" /> Escalate
                      </Button>
                    ) : (
                      <div className="space-y-2">
                        <Textarea placeholder="Escalation reason..." value={escalateReason} onChange={(e) => setEscalateReason(e.target.value)} rows={2} />
                        <div className="flex gap-2">
                          <Button size="sm" className="bg-severity-amber text-black" onClick={() => doAction(`/api/v1/tickets/${ticketId}/escalate`, { reason: escalateReason }, 'Ticket escalated')} disabled={!escalateReason.trim() || actionLoading}>Escalate</Button>
                          <Button size="sm" variant="ghost" onClick={() => setActiveAction(null)}>Cancel</Button>
                        </div>
                      </div>
                    )}

                    {/* Resolve */}
                    {activeAction !== 'resolve' ? (
                      <Button size="sm" variant="outline" className="w-full border-severity-green/30 text-severity-green" onClick={() => setActiveAction('resolve')}>
                        <CheckCircle className="h-3.5 w-3.5 mr-2" /> Resolve
                      </Button>
                    ) : (
                      <div className="space-y-2">
                        <Textarea placeholder="Resolution note..." value={resolveNote} onChange={(e) => setResolveNote(e.target.value)} rows={2} />
                        <div className="flex gap-2">
                          <Button size="sm" className="bg-severity-green text-black" onClick={() => doAction(`/api/v1/tickets/${ticketId}/resolve`, { resolution_note: resolveNote }, 'Ticket resolved')} disabled={!resolveNote.trim() || actionLoading}>Resolve</Button>
                          <Button size="sm" variant="ghost" onClick={() => setActiveAction(null)}>Cancel</Button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Audit Trail */}
              <Separator />
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Audit Trail</div>
                {ticket.audit_trail?.length > 0 ? (
                  <div className="space-y-0">
                    {ticket.audit_trail.map((entry: any, idx: number) => {
                      const { icon: ActorIcon, color } = actorIcon(entry.actor);
                      return (
                        <div key={entry.id || idx} className="flex items-start gap-2.5 relative pb-3">
                          {idx < ticket.audit_trail.length - 1 && <div className="absolute left-3 top-6 bottom-0 w-px bg-border/40" />}
                          <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${color}`}>
                            <ActorIcon className="h-3 w-3" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium">{entry.actor}</span>
                              <span className="text-[10px] text-muted-foreground">{entry.timestamp ? timeAgo(entry.timestamp) : ''}</span>
                            </div>
                            <div className="text-[11px] text-muted-foreground capitalize">{entry.action?.replace(/_/g, ' ')}</div>
                            {entry.note && <p className="text-[11px] text-foreground/70 mt-0.5 bg-muted/30 rounded px-2 py-1">{entry.note}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No audit entries</p>
                )}
              </div>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
