-- Improved hybrid search with stricter category filtering
DROP FUNCTION IF EXISTS hybrid_search_products(text, vector, numeric, integer);

CREATE OR REPLACE FUNCTION hybrid_search_products(
    search_query TEXT,
    query_embedding vector(384),
    max_price NUMERIC DEFAULT NULL,
    match_count INT DEFAULT 10
)
RETURNS TABLE (
    id TEXT,
    title TEXT,
    category TEXT,
    price NUMERIC,
    rating NUMERIC,
    brand TEXT,
    description TEXT,
    similarity FLOAT,
    keyword_match BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.title,
        p.category,
        p.price,
        p.rating,
        p.brand,
        p.description,
        1 - (p.embedding <=> query_embedding) AS similarity,
        (
            p.title ILIKE '%' || search_query || '%' OR
            p.category ILIKE '%' || search_query || '%' OR
            p.brand ILIKE '%' || search_query || '%'
        ) AS keyword_match
    FROM products p
    WHERE 
        (max_price IS NULL OR p.price <= max_price)
        AND (
            -- CRITICAL FIX: Require keyword match for specific product searches
            p.title ILIKE '%' || search_query || '%' OR
            p.category ILIKE '%' || search_query || '%' OR
            p.brand ILIKE '%' || search_query || '%' OR
            -- Fallback to similarity only if search is very generic (less than 3 chars)
            LENGTH(search_query) < 3
        )
    ORDER BY 
        keyword_match DESC,
        p.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
