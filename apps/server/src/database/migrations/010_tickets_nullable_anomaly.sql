-- Allow tickets to be created without a linked anomaly (manual tickets from chat)
ALTER TABLE tickets ALTER COLUMN anomaly_id DROP NOT NULL;
