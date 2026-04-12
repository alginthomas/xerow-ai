-- ============================================
-- RLS Fix Script - Allow Public Inserts
-- ============================================
-- Run this in Supabase SQL Editor to allow data migration

-- 1. Drop existing insert policy if strict
DROP POLICY IF EXISTS "Allow authenticated insert" ON products;

-- 2. Create permissive insert policy (for development/prototype)
-- This allows anyone with the anon key (your script) to insert products
CREATE POLICY "Allow public insert" ON products
    FOR INSERT
    WITH CHECK (true);

-- 3. Also allow updates just in case
DROP POLICY IF EXISTS "Allow authenticated update" ON products;
CREATE POLICY "Allow public update" ON products
    FOR UPDATE
    USING (true);

-- 4. Allow deletes (for the cleanup step in migration)
DROP POLICY IF EXISTS "Allow authenticated delete" ON products;
CREATE POLICY "Allow public delete" ON products
    FOR DELETE
    USING (true);
