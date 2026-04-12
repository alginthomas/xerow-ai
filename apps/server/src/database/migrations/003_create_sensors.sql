-- Sensors: individual measurement points on assets

DO $$ BEGIN
  CREATE TYPE sensor_status AS ENUM ('active', 'inactive', 'maintenance', 'error');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS sensors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  unit TEXT NOT NULL,
  baseline_value NUMERIC,
  baseline_stddev NUMERIC,
  hard_threshold_min NUMERIC,
  hard_threshold_max NUMERIC,
  status sensor_status NOT NULL DEFAULT 'active',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sensors_asset_id ON sensors(asset_id);
CREATE INDEX IF NOT EXISTS idx_sensors_type ON sensors(type);
