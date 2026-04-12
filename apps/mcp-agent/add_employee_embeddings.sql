-- ============================================
-- Add Vector Embeddings to Employees Table
-- Makes employees table LLM-friendly with semantic search
-- ============================================
-- Run this script in Supabase SQL Editor

-- Step 1: Ensure pgvector extension is enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Add embedding column to employees table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS embedding vector(384);

-- Step 3: Create vector similarity index (HNSW for fast approximate nearest neighbor search)
CREATE INDEX IF NOT EXISTS idx_employees_embedding ON employees 
USING hnsw (embedding vector_cosine_ops);

-- Step 4: Create semantic search function
CREATE OR REPLACE FUNCTION match_employees(
    query_embedding vector(384),
    match_threshold FLOAT DEFAULT 0.7,
    min_ctc NUMERIC DEFAULT NULL,
    max_ctc NUMERIC DEFAULT NULL,
    stage_filter TEXT DEFAULT NULL,
    status_filter TEXT DEFAULT NULL,
    match_count INT DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    candidate_id TEXT,
    full_name TEXT,
    email TEXT,
    phone_number TEXT,
    skill TEXT,
    overall_experience TEXT,
    relevant_experience TEXT,
    current_location TEXT,
    preferred_location TEXT,
    current_company TEXT,
    current_ctc TEXT,
    expected_ctc TEXT,
    current_ctc_numeric NUMERIC,
    expected_ctc_numeric NUMERIC,
    stage TEXT,
    status TEXT,
    resume_url TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id,
        e.candidate_id,
        e.full_name,
        e.email,
        e.phone_number,
        e.skill,
        e.overall_experience,
        e.relevant_experience,
        e.current_location,
        e.preferred_location,
        e.current_company,
        e.current_ctc,
        e.expected_ctc,
        e.current_ctc_numeric,
        e.expected_ctc_numeric,
        e.stage,
        e.status,
        e.resume_url,
        1 - (e.embedding <=> query_embedding) AS similarity
    FROM employees e
    WHERE 
        e.embedding IS NOT NULL
        AND 1 - (e.embedding <=> query_embedding) > match_threshold
        AND (min_ctc IS NULL OR COALESCE(e.expected_ctc_numeric, e.current_ctc_numeric, 0) >= min_ctc)
        AND (max_ctc IS NULL OR COALESCE(e.expected_ctc_numeric, e.current_ctc_numeric, 0) <= max_ctc)
        AND (stage_filter IS NULL OR e.stage ILIKE '%' || stage_filter || '%')
        AND (status_filter IS NULL OR e.status ILIKE '%' || status_filter || '%')
    ORDER BY e.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Step 5: Create hybrid search function (keyword + vector)
CREATE OR REPLACE FUNCTION hybrid_search_employees(
    search_query TEXT,
    query_embedding vector(384),
    skill_filter TEXT DEFAULT NULL,
    location_filter TEXT DEFAULT NULL,
    stage_filter TEXT DEFAULT NULL,
    status_filter TEXT DEFAULT NULL,
    min_ctc NUMERIC DEFAULT NULL,
    max_ctc NUMERIC DEFAULT NULL,
    match_count INT DEFAULT 20,
    min_similarity FLOAT DEFAULT 0.5
)
RETURNS TABLE (
    id UUID,
    candidate_id TEXT,
    full_name TEXT,
    email TEXT,
    phone_number TEXT,
    skill TEXT,
    overall_experience TEXT,
    relevant_experience TEXT,
    current_location TEXT,
    preferred_location TEXT,
    current_company TEXT,
    current_ctc TEXT,
    expected_ctc TEXT,
    current_ctc_numeric NUMERIC,
    expected_ctc_numeric NUMERIC,
    stage TEXT,
    status TEXT,
    resume_url TEXT,
    similarity FLOAT,
    keyword_match BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id,
        e.candidate_id,
        e.full_name,
        e.email,
        e.phone_number,
        e.skill,
        e.overall_experience,
        e.relevant_experience,
        e.current_location,
        e.preferred_location,
        e.current_company,
        e.current_ctc,
        e.expected_ctc,
        e.current_ctc_numeric,
        e.expected_ctc_numeric,
        e.stage,
        e.status,
        e.resume_url,
        1 - (e.embedding <=> query_embedding) AS similarity,
        (
            e.full_name ILIKE '%' || search_query || '%' OR
            COALESCE(e.skill, '') ILIKE '%' || search_query || '%' OR
            COALESCE(e.current_location, '') ILIKE '%' || search_query || '%' OR
            COALESCE(e.preferred_location, '') ILIKE '%' || search_query || '%' OR
            COALESCE(e.current_company, '') ILIKE '%' || search_query || '%'
        ) AS keyword_match
    FROM employees e
    WHERE 
        e.embedding IS NOT NULL
        AND (
            -- Keyword match OR semantic similarity above threshold
            (
                e.full_name ILIKE '%' || search_query || '%' OR
                COALESCE(e.skill, '') ILIKE '%' || search_query || '%' OR
                COALESCE(e.current_location, '') ILIKE '%' || search_query || '%' OR
                COALESCE(e.preferred_location, '') ILIKE '%' || search_query || '%' OR
                COALESCE(e.current_company, '') ILIKE '%' || search_query || '%'
            )
            OR
            (1 - (e.embedding <=> query_embedding) >= min_similarity)
            OR
            -- Fallback to similarity only if search is very generic (less than 3 chars)
            LENGTH(search_query) < 3
        )
        AND (skill_filter IS NULL OR e.skill ILIKE '%' || skill_filter || '%')
        AND (
            location_filter IS NULL OR 
            e.current_location ILIKE '%' || location_filter || '%' OR
            e.preferred_location ILIKE '%' || location_filter || '%'
        )
        AND (stage_filter IS NULL OR e.stage ILIKE '%' || stage_filter || '%')
        AND (status_filter IS NULL OR e.status ILIKE '%' || status_filter || '%')
        AND (min_ctc IS NULL OR COALESCE(e.expected_ctc_numeric, e.current_ctc_numeric, 0) >= min_ctc)
        AND (max_ctc IS NULL OR COALESCE(e.expected_ctc_numeric, e.current_ctc_numeric, 0) <= max_ctc)
    ORDER BY 
        keyword_match DESC,
        e.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ============================================
-- Verification Queries
-- ============================================

-- Check if pgvector is enabled
-- SELECT * FROM pg_extension WHERE extname = 'vector';

-- Check if embedding column exists
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'employees' AND column_name = 'embedding';

-- Check indexes
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'employees' AND indexname = 'idx_employees_embedding';

-- Check functions
-- SELECT proname, pg_get_function_arguments(oid) as arguments 
-- FROM pg_proc WHERE proname IN ('match_employees', 'hybrid_search_employees');
