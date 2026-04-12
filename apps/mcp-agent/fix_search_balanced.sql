-- Balanced hybrid search - not too strict, not too loose
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
    image_url TEXT,
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
        p.image_url,
        1 - (p.embedding <=> query_embedding) AS similarity,
        (
            p.title ILIKE '%' || search_query || '%' OR
            p.category ILIKE '%' || search_query || '%' OR
            p.brand ILIKE '%' || search_query || '%'
        ) AS keyword_match
    FROM products p
    WHERE 
        (max_price IS NULL OR p.price <= max_price)
    ORDER BY 
        -- Prioritize keyword matches, then similarity
        keyword_match DESC,
        p.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Note: This version does NOT require keyword match, but prioritizes it
-- So you'll get semantic results if no exact matches, but exact matches come first
