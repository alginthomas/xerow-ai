-- Assets: monitored field equipment (turbines, pipelines, wells)

DO $$ BEGIN
  CREATE TYPE asset_type AS ENUM ('turbine', 'pipeline', 'well');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE asset_status AS ENUM ('operational', 'degraded', 'offline', 'maintenance');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type asset_type NOT NULL,
  region TEXT NOT NULL,
  location JSONB DEFAULT '{}',
  status asset_status NOT NULL DEFAULT 'operational',
  thresholds JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type);
CREATE INDEX IF NOT EXISTS idx_assets_region ON assets(region);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
