# Employee Embeddings Setup Guide

## Overview
This guide will help you generate vector embeddings for all employees in the database to enable semantic search.

## Prerequisites

1. **Python 3.8+** installed
2. **Dependencies installed**:
   ```bash
   cd apps/mcp-agent
   pip install -r requirements.txt
   ```

3. **Environment variables** set in `.env` file:
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_service_role_key
   EMBEDDING_MODEL=sentence-transformers  # or "openai"
   OPENAI_API_KEY=your_openai_key  # if using OpenAI embeddings
   ```

## Quick Start

### Step 1: Test with One Employee

First, verify the setup works with a single employee:

```bash
cd apps/mcp-agent
python3 test_employee_embedding.py
```

This will:
- Fetch one employee
- Generate an embedding
- Update the database
- Verify it was saved

### Step 2: Generate Embeddings for All Employees

Once the test passes, run the full migration:

```bash
python3 migrate_employee_embeddings.py
```

This will:
- Process all 5,142 employees in batches of 100
- Generate embeddings for each employee
- Update the database
- Show progress and final statistics

**Note**: This will take some time (approximately 1-2 hours depending on your setup).

### Step 3: Verify Embeddings

Check that embeddings were generated:

```sql
-- In Supabase SQL Editor
SELECT COUNT(*) as total, COUNT(embedding) as with_embeddings 
FROM employees;
```

You should see `with_embeddings` equal to `total`.

## Troubleshooting

### Issue: "ModuleNotFoundError: No module named 'dotenv'"

**Solution**: Install dependencies:
```bash
pip install -r requirements.txt
```

### Issue: "SUPABASE_URL and SUPABASE_KEY must be set"

**Solution**: Create a `.env` file in `apps/mcp-agent/` with your Supabase credentials.

### Issue: Embedding generation is slow

**Solution**: 
- The script processes in batches with delays to avoid rate limiting
- For faster processing, you can reduce `DELAY_BETWEEN_BATCHES` in `migrate_employee_embeddings.py`
- Or use OpenAI embeddings (faster but costs money)

### Issue: Some employees failed to update

**Solution**: 
- Check the error logs in the output
- Re-run the script - it will skip employees that already have embeddings
- Or use `--all` flag to regenerate all embeddings

## Using OpenAI Embeddings (Faster)

If you want to use OpenAI embeddings instead of sentence-transformers:

1. Set in `.env`:
   ```
   EMBEDDING_MODEL=openai
   OPENAI_API_KEY=your_openai_key
   ```

2. Run the migration script as usual

**Note**: OpenAI embeddings cost money but are faster and don't require local model download.

## Resuming Interrupted Migration

If the migration is interrupted, simply run it again:
```bash
python3 migrate_employee_embeddings.py
```

It will automatically skip employees that already have embeddings.

## Verification Queries

After migration, test the semantic search:

```sql
-- Test semantic search (requires an embedding vector)
-- This will work once embeddings are generated
SELECT * FROM hybrid_search_employees(
  'experienced SAP developer',
  NULL::vector,  -- Will be replaced with actual embedding in application
  NULL, NULL, NULL, NULL, NULL, NULL, 20, 0.5
) LIMIT 5;
```

## Next Steps

Once embeddings are generated:
1. Test the search functionality in your application
2. Monitor search performance
3. Adjust `min_similarity` threshold if needed (currently 0.5)
