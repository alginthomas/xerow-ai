-- Add persona column to existing users table for the escalation hierarchy
-- tom = Field Operator, dick = Field Manager, harry = Chief Operator

DO $$ BEGIN
  CREATE TYPE user_persona AS ENUM ('tom', 'dick', 'harry');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS persona user_persona;
