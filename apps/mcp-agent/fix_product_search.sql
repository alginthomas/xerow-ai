-- ============================================
-- Fix Product Search Function
-- ============================================
-- This migration fixes the hybrid_search_products function to:
-- 1. Add similarity threshold filtering (prevents returning unrelated products)
-- 2. Include description in keyword matching
-- 3. Return empty results when no products match (instead of random products)
--
-- Run this in your Supabase SQL Editor to apply the fix

CREATE OR REPLACE FUNCTION hybrid_search_products(
    search_query TEXT,
    query_embedding vector(384),
    max_price NUMERIC DEFAULT NULL,
    match_count INT DEFAULT 10,
    min_similarity FLOAT DEFAULT 0.15
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
            p.brand ILIKE '%' || search_query || '%' OR
            COALESCE(p.description, '') ILIKE '%' || search_query || '%'
        ) AS keyword_match
    FROM products p
    WHERE 
        (max_price IS NULL OR p.price <= max_price)
        AND (
            -- STRICT FILTER: 
            -- Either it matches keywords OR the vector similarity is high enough
            -- This prevents returning completely unrelated products like "Kitchen Sink" when searching for "Shoes"
            (
                p.title ILIKE '%' || search_query || '%' OR
                p.category ILIKE '%' || search_query || '%' OR
                p.brand ILIKE '%' || search_query || '%' OR
                COALESCE(p.description, '') ILIKE '%' || search_query || '%'
            )
            OR
            (1 - (p.embedding <=> query_embedding) >= min_similarity)
        )
    ORDER BY 
        keyword_match DESC,  -- Always show direct text matches first
        (1 - (p.embedding <=> query_embedding)) DESC
    LIMIT match_count;
END;
$$;

-- Verify the function was updated
SELECT 
    proname, 
    pg_get_function_arguments(oid) as arguments
FROM pg_proc 
WHERE proname = 'hybrid_search_products';
