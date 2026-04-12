/**
 * Data Export Utilities — CSV and formatted text export
 */

export function exportToCSV(data: Record<string, any>[], filename: string) {
  if (!data.length) return;

  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map((row) =>
      headers.map((h) => {
        const val = row[h];
        const str = val == null ? '' : String(val);
        // Escape commas and quotes
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(',')
    ),
  ];

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportAuditReport(ticket: any, auditTrail: any[]) {
  const lines = [
    `INCIDENT REPORT`,
    `Generated: ${new Date().toLocaleString()}`,
    ``,
    `Ticket: ${ticket.ticket_id}`,
    `Title: ${ticket.title}`,
    `Severity: ${ticket.severity?.toUpperCase()}`,
    `Asset: ${ticket.asset_name}`,
    `Status: ${ticket.status}`,
    `Created: ${new Date(ticket.created_at).toLocaleString()}`,
    `Assigned To: ${ticket.assigned_to_name || 'Unassigned'}`,
    `SLA Deadline: ${ticket.sla_deadline ? new Date(ticket.sla_deadline).toLocaleString() : 'N/A'}`,
    `Resolution: ${ticket.resolution_note || 'N/A'}`,
    ``,
    `--- AUDIT TRAIL ---`,
    ...auditTrail.map((e) =>
      `[${new Date(e.timestamp).toLocaleString()}] ${e.actor} — ${e.action}${e.note ? `: ${e.note}` : ''}`
    ),
    ``,
    `--- END OF REPORT ---`,
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `incident_report_${ticket.ticket_id?.slice(0, 8)}_${new Date().toISOString().slice(0, 10)}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}
