-- Tickets: agentic tickets spawned from anomalies with SLA management

DO $$ BEGIN
  CREATE TYPE ticket_severity AS ENUM ('amber', 'red', 'purple');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ticket_status AS ENUM ('open', 'acknowledged', 'under_review', 'escalated', 'closed', 'false_positive');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS tickets (
  ticket_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anomaly_id UUID NOT NULL REFERENCES anomalies(anomaly_id),
  asset_id UUID NOT NULL REFERENCES assets(id),
  severity ticket_severity NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_to UUID REFERENCES users(id),
  sla_deadline TIMESTAMPTZ NOT NULL,
  status ticket_status NOT NULL DEFAULT 'open',
  escalation_level INTEGER NOT NULL DEFAULT 0,
  resolution_note TEXT,
  classification_note TEXT,
  closed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_anomaly_id ON tickets(anomaly_id);
CREATE INDEX IF NOT EXISTS idx_tickets_asset_id ON tickets(asset_id);
CREATE INDEX IF NOT EXISTS idx_tickets_severity ON tickets(severity);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_sla_deadline ON tickets(sla_deadline);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC);

-- Add foreign key from anomalies to tickets (deferred because tickets table didn't exist yet)
ALTER TABLE anomalies DROP CONSTRAINT IF EXISTS fk_anomalies_ticket;
DO $$ BEGIN
  ALTER TABLE anomalies ADD CONSTRAINT fk_anomalies_ticket
    FOREIGN KEY (ticket_id) REFERENCES tickets(ticket_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
