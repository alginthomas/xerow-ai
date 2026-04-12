-- Anomalies: detected irregularities from agent monitoring
-- Core fields are immutable after creation (status can change)

DO $$ BEGIN
  CREATE TYPE anomaly_severity AS ENUM ('green', 'amber', 'red', 'purple');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE anomaly_status AS ENUM ('logged', 'ticket_open', 'ticket_closed', 'false_positive', 'dismissed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS anomalies (
  anomaly_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id),
  sensor_id UUID NOT NULL REFERENCES sensors(id),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  severity anomaly_severity NOT NULL,
  colour_code TEXT NOT NULL,
  deviation_pct NUMERIC NOT NULL DEFAULT 0,
  confidence_score INTEGER NOT NULL DEFAULT 50 CHECK (confidence_score >= 0 AND confidence_score <= 100),
  data_snapshot JSONB NOT NULL DEFAULT '{}',
  ticket_id UUID,
  maintenance_window BOOLEAN NOT NULL DEFAULT false,
  status anomaly_status NOT NULL DEFAULT 'logged',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anomalies_asset_id ON anomalies(asset_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_sensor_id ON anomalies(sensor_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_severity ON anomalies(severity);
CREATE INDEX IF NOT EXISTS idx_anomalies_status ON anomalies(status);
CREATE INDEX IF NOT EXISTS idx_anomalies_detected_at ON anomalies(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_anomalies_ticket_id ON anomalies(ticket_id);
