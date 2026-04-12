# Employee Embeddings Setup Guide

This guide explains how to generate embeddings for the employees table to enable semantic search.

## Prerequisites

1. **Ollama installed and running**
   ```bash
   # Check if Ollama is running
   curl http://localhost:11434/api/tags
   
   # If not running, start it
   ollama serve
   ```

2. **Pull the embedding model**
   ```bash
   # Recommended: nomic-embed-text (768 dims, will be truncated to 384)
   ollama pull nomic-embed-text
   
   # Alternative models:
   # ollama pull mxbai-embed-large  # 1024 dimensions (will be truncated)
   # ollama pull all-minilm          # 384 dimensions (if available, perfect fit)
   ```
   
   **Note:** The code automatically handles dimension mismatches:
   - Models with >384 dimensions: Truncated to first 384
   - Models with <384 dimensions: Padded with zeros
   - Models with exactly 384: Used as-is

3. **Environment variables set**
   Create or update `.env` file in `apps/mcp-agent/`:
   ```env
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_key
   EMBEDDING_MODEL=ollama
   OLLAMA_URL=http://localhost:11434
   OLLAMA_EMBEDDING_MODEL=nomic-embed-text
   ```

## Testing

1. **Test Ollama connection and embedding generation:**
   ```bash
   cd apps/mcp-agent
   python3 test_ollama_embedding.py
   ```

2. **Test employee embedding generation:**
   ```bash
   python3 test_employee_embedding.py
   ```

## Generating Embeddings

### Option 1: Generate for all employees without embeddings (Recommended)

This will only process employees that don't have embeddings yet:
```bash
cd apps/mcp-agent
python3 migrate_employee_embeddings.py
```

### Option 2: Regenerate all embeddings

This will regenerate embeddings for ALL employees (including those that already have them):
```bash
python3 migrate_employee_embeddings.py --all
```

## What the Migration Does

1. **Fetches employees** from Supabase (only those without embeddings by default)
2. **Generates embeddings** using Ollama for each employee by combining:
   - Full name
   - Skill
   - Overall experience
   - Relevant experience
   - Current location
   - Preferred location
   - Current company
   - Stage and status (for context)
3. **Updates database** with the generated embeddings
4. **Processes in batches** of 100 employees with progress tracking

## Expected Output

```
============================================================
Starting migration for 5142 employees
Batch size: 100
============================================================

Processing batch 1/52 (100 employees)...
Batch 1 complete: 100 successful, 0 failed

Progress: 1.9% | Successful: 100 | Failed: 0

...

============================================================
Migration Complete!
============================================================
Total employees processed: 5142
Successful: 5142
Failed: 0
Time elapsed: 1234.56 seconds
Average time per employee: 0.24 seconds
============================================================
```

## Troubleshooting

### "Failed to connect to Ollama"
- Make sure Ollama is running: `ollama serve`
- Check the OLLAMA_URL in your .env file

### "Model not found"
- Pull the model: `ollama pull nomic-embed-text`
- Or use a different model and update OLLAMA_EMBEDDING_MODEL

### "Wrong embedding dimensions"
- The database expects 384 dimensions
- If your model produces different dimensions, you may need to:
  - Use a different model (nomic-embed-text produces 768, but can be truncated)
  - Or update the database schema to match your model's dimensions

### "Rate limiting errors"
- The script includes delays between batches
- You can increase DELAY_BETWEEN_BATCHES in migrate_employee_embeddings.py

## Verification

After migration, verify embeddings were created:
```sql
-- Check how many employees have embeddings
SELECT COUNT(*) as total, COUNT(embedding) as with_embeddings 
FROM employees;

-- Test semantic search
SELECT * FROM hybrid_search_employees(
  'experienced SAP developer',
  NULL::vector,  -- Will need actual embedding for real search
  NULL, NULL, NULL, NULL, NULL, NULL, 10, 0.5
);
```

## Notes

- The migration can be interrupted and resumed (it only processes employees without embeddings)
- Embeddings are generated using the text combination strategy defined in `generate_employee_embeddings.py`
- The hybrid_search_employees function will work once embeddings are populated
