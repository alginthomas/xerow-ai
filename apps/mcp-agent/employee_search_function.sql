-- Hybrid search function for employees
-- Combines vector similarity with keyword matching and filters

CREATE OR REPLACE FUNCTION hybrid_search_employees(
    search_query TEXT,
    query_embedding vector(384),
    skill_filter TEXT DEFAULT NULL,
    min_experience INTEGER DEFAULT NULL,
    location_filter TEXT DEFAULT NULL,
    stage_filter TEXT DEFAULT NULL,
    match_count INT DEFAULT 10
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
            e.skill ILIKE '%' || search_query || '%' OR
            e.full_name ILIKE '%' || search_query || '%' OR
            e.current_location ILIKE '%' || search_query || '%'
        ) AS keyword_match
    FROM employees e
    WHERE 
        e.embedding IS NOT NULL
        AND (skill_filter IS NULL OR e.skill ILIKE '%' || skill_filter || '%')
        AND (location_filter IS NULL OR e.current_location ILIKE '%' || location_filter || '%' OR e.preferred_location ILIKE '%' || location_filter || '%')
        AND (stage_filter IS NULL OR e.stage = stage_filter)
    ORDER BY 
        keyword_match DESC,
        e.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
