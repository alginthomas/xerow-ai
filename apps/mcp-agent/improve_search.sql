-- Improvements for Hybrid Search Function
-- Adds a similarity threshold to filter noise
-- Prioritizes keyword matches significantly

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
            -- STRICT FILTER: 
            -- Either it matches keywords OR the vector similarity is high enough (> 0.25)
            -- This removes complete noise like "Kitchen Sink" when searching for "Shoes"
            (
                p.title ILIKE '%' || search_query || '%' OR
                p.category ILIKE '%' || search_query || '%' OR
                p.brand ILIKE '%' || search_query || '%'
            )
            OR
            (1 - (p.embedding <=> query_embedding) > 0.25)
        )
    ORDER BY 
        keyword_match DESC,  -- Always show direct text matches first
        similarity DESC
    LIMIT match_count;
END;
$$;
