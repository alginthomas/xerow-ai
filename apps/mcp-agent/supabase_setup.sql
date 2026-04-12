-- ============================================
-- Supabase PostgreSQL + pgvector Setup Script
-- ============================================
-- Run this script in Supabase SQL Editor to set up the database

-- Step 1: Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Create products table
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    rating NUMERIC(2, 1),
    brand TEXT,
    description TEXT,
    embedding vector(384),  -- 384 dimensions for sentence-transformers/all-MiniLM-L6-v2
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);

-- Vector similarity index (HNSW for fast approximate nearest neighbor search)
CREATE INDEX IF NOT EXISTS idx_products_embedding ON products 
USING hnsw (embedding vector_cosine_ops);

-- Step 4: Create semantic search function
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
        1 - (p.embedding <=> query_embedding) AS similarity
    FROM products p
    WHERE 
        1 - (p.embedding <=> query_embedding) > match_threshold
        AND (max_price IS NULL OR p.price <= max_price)
    ORDER BY p.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Step 5: Create hybrid search function (keyword + vector)
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
    ORDER BY 
        keyword_match DESC,
        p.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Step 6: Enable Row Level Security (RLS)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access (adjust based on your needs)
CREATE POLICY "Allow public read access" ON products
    FOR SELECT
    USING (true);

-- Create policy to allow authenticated insert (for data migration)
CREATE POLICY "Allow authenticated insert" ON products
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Create policy to allow authenticated update
CREATE POLICY "Allow authenticated update" ON products
    FOR UPDATE
    USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Create policy to allow authenticated delete
CREATE POLICY "Allow authenticated delete" ON products
    FOR DELETE
    USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- ============================================
-- Verification Queries
-- ============================================

-- Check if pgvector is enabled
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Check table structure
\d products;

-- Check indexes
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'products';

-- Check functions
SELECT proname, prosrc FROM pg_proc WHERE proname IN ('match_products', 'hybrid_search_products');
