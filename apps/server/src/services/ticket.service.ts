/**
 * Ticket Service - SLA management, auto-assignment, escalation
 * Implements PRD TK-01 through TK-07
 */

import { ticketRepository, type TicketFilters } from '../repositories/ticket.repository.js';
import { auditService } from './audit.service.js';
import { query } from '../database/connection.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import { buildPaginatedResult, type PaginatedResult } from '../utils/pagination.js';

/** SLA deadlines by severity (in milliseconds) */
const SLA_DEADLINES: Record<string, number> = {
  amber: 2 * 60 * 60 * 1000,     // 2 hours
  red: 30 * 60 * 1000,            // 30 minutes for Tom acknowledgement
  purple: 10 * 60 * 1000,         // 10 minutes re-page interval
};

/** Escalation persona chain */
const ESCALATION_CHAIN = ['tom', 'dick', 'harry'];

async function findUserByPersona(persona: string): Promise<any | null> {
  const result = await query(
    'SELECT id, name, email, persona FROM users WHERE persona = $1 LIMIT 1',
    [persona]
  );
  return result.rows[0] || null;
}

function calculateSlaDeadline(severity: string): string {
  const deadline = new Date(Date.now() + (SLA_DEADLINES[severity] || SLA_DEADLINES.amber));
  return deadline.toISOString();
}

export const ticketService = {
  async list(filters: TicketFilters, userPersona?: string, userId?: string): Promise<PaginatedResult<any>> {
    // Don't force persona filtering — let the frontend control it via filters
    // All users can see all tickets; "My Tickets" tab passes assigned_to explicitly

    const limit = filters.limit || 20;
    const rows = await ticketRepository.findAll(filters);
    return buildPaginatedResult(rows, limit, 'ticket_id', 'created_at');
  },

  async getById(ticketId: string) {
    const ticket = await ticketRepository.findByIdWithDetails(ticketId);
    if (!ticket) throw new NotFoundError('Ticket', ticketId);

    const auditLog = await auditService.getEntityHistory('ticket', ticketId);
    return { ...ticket, audit_trail: auditLog };
  },

  /**
   * Auto-create ticket from anomaly (PRD TK-01, TK-02)
   */
  async createFromAnomaly(anomaly: {
    anomaly_id: string;
    asset_id: string;
    severity: string;
    deviation_pct: number;
    confidence_score: number;
  }) {
    // Auto-assignment: amber->Tom, red->Tom+Dick notified, purple->Harry
    let assignPersona: string;
    switch (anomaly.severity) {
      case 'purple':
        assignPersona = 'harry';
        break;
      case 'red':
      case 'amber':
      default:
        assignPersona = 'tom';
        break;
    }

    const assignee = await findUserByPersona(assignPersona);
    if (!assignee) {
      throw new Error(`No user with persona '${assignPersona}' found for ticket assignment`);
    }

    const slaDeadline = calculateSlaDeadline(anomaly.severity);

    const ticket = await ticketRepository.create({
      anomaly_id: anomaly.anomaly_id,
      asset_id: anomaly.asset_id,
      severity: anomaly.severity as 'amber' | 'red' | 'purple',
      title: `${anomaly.severity.toUpperCase()} anomaly: ${anomaly.deviation_pct.toFixed(1)}% deviation`,
      description: `Automated ticket for ${anomaly.severity} anomaly. Confidence: ${anomaly.confidence_score}%. Deviation: ${anomaly.deviation_pct.toFixed(1)}%.`,
      assigned_to: assignee.id,
      sla_deadline: slaDeadline,
    });

    await auditService.log({
      entity_type: 'ticket',
      entity_id: ticket.ticket_id,
      actor: 'anomaly_agent',
      action: 'created',
      note: `Ticket auto-created from ${anomaly.severity} anomaly. Assigned to ${assignee.name} (${assignPersona}). SLA: ${new Date(slaDeadline).toLocaleString()}.`,
      metadata: { anomaly_id: anomaly.anomaly_id, assigned_persona: assignPersona },
    });

    // Notify Dick for red tickets (PRD TK-02)
    if (anomaly.severity === 'red') {
      await auditService.log({
        entity_type: 'ticket',
        entity_id: ticket.ticket_id,
        actor: 'system',
        action: 'notification_sent',
        note: 'Dick (Field Manager) notified of red ticket creation.',
      });
    }

    return ticket;
  },

  async acknowledge(ticketId: string, userId: string, userName: string) {
    const ticket = await ticketRepository.findById(ticketId, 'ticket_id');
    if (!ticket) throw new NotFoundError('Ticket', ticketId);
    if (ticket.assigned_to !== userId) throw new ForbiddenError('Only the assigned user can acknowledge this ticket');

    const updated = await ticketRepository.updateStatus(ticketId, { status: 'acknowledged' });

    await auditService.log({
      entity_type: 'ticket',
      entity_id: ticketId,
      actor: userName,
      action: 'acknowledged',
      note: `Ticket acknowledged by ${userName}`,
    });

    return updated;
  },

  async addNote(ticketId: string, note: string, userId: string, userName: string) {
    const ticket = await ticketRepository.findById(ticketId, 'ticket_id');
    if (!ticket) throw new NotFoundError('Ticket', ticketId);

    await auditService.log({
      entity_type: 'ticket',
      entity_id: ticketId,
      actor: userName,
      action: 'note_added',
      note,
    });

    return ticket;
  },

  async escalate(ticketId: string, reason: string, userId: string, userName: string) {
    const ticket = await ticketRepository.findById(ticketId, 'ticket_id');
    if (!ticket) throw new NotFoundError('Ticket', ticketId);

    const currentLevel = ticket.escalation_level || 0;
    const nextLevel = Math.min(currentLevel + 1, ESCALATION_CHAIN.length - 1);
    const nextPersona = ESCALATION_CHAIN[nextLevel];

    const nextAssignee = await findUserByPersona(nextPersona);
    if (!nextAssignee) {
      throw new Error(`No user with persona '${nextPersona}' for escalation`);
    }

    const updated = await ticketRepository.updateStatus(ticketId, {
      status: 'escalated',
      assigned_to: nextAssignee.id,
      escalation_level: nextLevel,
    });

    await auditService.log({
      entity_type: 'ticket',
      entity_id: ticketId,
      actor: userName,
      action: 'escalated',
      note: `Escalated to ${nextAssignee.name} (${nextPersona}). Reason: ${reason}`,
      metadata: { from_level: currentLevel, to_level: nextLevel, to_persona: nextPersona },
    });

    return updated;
  },

  async resolve(ticketId: string, resolutionNote: string, classificationNote: string | undefined, userId: string, userName: string) {
    const ticket = await ticketRepository.findById(ticketId, 'ticket_id');
    if (!ticket) throw new NotFoundError('Ticket', ticketId);

    const updated = await ticketRepository.updateStatus(ticketId, {
      status: 'closed',
      resolution_note: resolutionNote,
      ...(classificationNote && { classification_note: classificationNote }),
    });

    await auditService.log({
      entity_type: 'ticket',
      entity_id: ticketId,
      actor: userName,
      action: 'resolved',
      note: `Ticket resolved: ${resolutionNote}`,
      metadata: { classification_note: classificationNote },
    });

    return updated;
  },

  /**
   * Check for SLA breaches and auto-escalate (PRD TK-04)
   */
  async checkSlaBreaches() {
    const breached = await ticketRepository.findBreachedTickets();

    for (const ticket of breached) {
      const currentLevel = ticket.escalation_level || 0;
      if (currentLevel >= ESCALATION_CHAIN.length - 1) continue;

      const nextLevel = currentLevel + 1;
      const nextPersona = ESCALATION_CHAIN[nextLevel];
      const nextAssignee = await findUserByPersona(nextPersona);

      if (!nextAssignee) continue;

      await ticketRepository.updateStatus(ticket.ticket_id, {
        status: 'escalated',
        assigned_to: nextAssignee.id,
        escalation_level: nextLevel,
      });

      await auditService.log({
        entity_type: 'ticket',
        entity_id: ticket.ticket_id,
        actor: 'system',
        action: 'sla_breach_escalation',
        note: `SLA breached. Auto-escalated to ${nextAssignee.name} (${nextPersona}).`,
        metadata: { sla_deadline: ticket.sla_deadline, from_level: currentLevel, to_level: nextLevel },
      });
    }

    return breached.length;
  },

  SLA_DEADLINES,
  ESCALATION_CHAIN,
};
