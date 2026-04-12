-- Agent instances: AI agents monitoring assets

DO $$ BEGIN
  CREATE TYPE agent_type AS ENUM ('analytics', 'anomaly', 'verification');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE agent_status AS ENUM ('active', 'idle', 'investigating', 'escalated', 'error');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS agent_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  agent_type agent_type NOT NULL,
  status agent_status NOT NULL DEFAULT 'active',
  last_assessment TIMESTAMPTZ,
  confidence_score INTEGER DEFAULT 100 CHECK (confidence_score >= 0 AND confidence_score <= 100),
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(asset_id, agent_type)
);

CREATE INDEX IF NOT EXISTS idx_agent_instances_asset_id ON agent_instances(asset_id);
CREATE INDEX IF NOT EXISTS idx_agent_instances_status ON agent_instances(status);
