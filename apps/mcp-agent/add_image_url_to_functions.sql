-- Drop existing functions first (required to change return type)
DROP FUNCTION IF EXISTS match_products(vector, double precision, numeric, integer);
DROP FUNCTION IF EXISTS hybrid_search_products(text, vector, numeric, integer);

-- Add image_url to the match_products function return type
CREATE OR REPLACE FUNCTION match_products(
    query_embedding vector(384),
    match_threshold FLOAT DEFAULT 0.7,
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
    similarity FLOAT
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
        1 - (p.embedding <=> query_embedding) AS similarity
    FROM products p
    WHERE 
        1 - (p.embedding <=> query_embedding) > match_threshold
        AND (max_price IS NULL OR p.price <= max_price)
    ORDER BY p.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Add image_url to the hybrid_search_products function return type
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
        keyword_match DESC,
        p.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
