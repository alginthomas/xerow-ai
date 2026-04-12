# Supabase PostgreSQL + pgvector Setup Guide

This guide walks you through setting up Supabase with pgvector for semantic product search.

## Step 1: Run SQL Setup Script in Supabase

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy and paste the contents of `supabase_setup.sql`
5. Click **Run** to execute the script

This will:
- ✅ Enable pgvector extension
- ✅ Create products table with embedding column
- ✅ Create indexes for performance
- ✅ Create search functions (semantic + hybrid)
- ✅ Set up Row Level Security policies

## Step 2: Configure Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Get your Supabase credentials:
   - Go to **Project Settings** → **API**
   - Copy **Project URL** → paste as `SUPABASE_URL`
   - Copy **anon/public key** → paste as `SUPABASE_KEY`

3. Edit `.env` file:
   ```
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_KEY=your-anon-key-here
   EMBEDDING_MODEL=sentence-transformers
   ```

## Step 3: Install Dependencies

```bash
pip install -r requirements.txt
```

This installs:
- `supabase` - Supabase Python client
- `sentence-transformers` - Local embedding model
- `python-dotenv` - Environment variable management
- `torch` - PyTorch (required by sentence-transformers)

**Note:** First run will download the embedding model (~80MB), this is normal.

## Step 4: Migrate Existing Data

Run the migration script to populate Supabase with products from `catalog.json`:

```bash
python migrate_data.py
```

This will:
- Read products from `catalog.json`
- Generate embeddings for each product
- Insert into Supabase database
- Show migration progress

## Step 5: Test the Integration

Test the agent with Supabase backend:

```bash
./run_agent.sh
```

Try these queries:
- "I need running shoes under 4500"
- "Show me affordable sneakers" (semantic search!)
- "Find shoes from Nike"

## Architecture Overview

```
User Query
    ↓
agent.py (LLM + Tools)
    ↓
mcp_client.py (JSON-RPC)
    ↓
mock_mcp_server.py (Tool Handler)
    ↓
supabase_client.py (DB + Embeddings)
    ↓
Supabase PostgreSQL + pgvector
```

## Key Features

✅ **Semantic Search** - Understands "sneakers" = "running shoes"
✅ **Hybrid Search** - Combines keyword + vector similarity
✅ **Price Filtering** - Respects max_price parameter
✅ **Scalable** - Ready for thousands of products
✅ **Local Embeddings** - Free, no API costs

## Production Deployment

### Option 1: Keep Using Supabase (Recommended)
- No changes needed
- Supabase handles scaling, backups, security
- Just update `.env` with production credentials

### Option 2: Self-Hosted PostgreSQL on VM

1. Install PostgreSQL 14+ on VM
2. Install pgvector extension:
   ```bash
   sudo apt-get install postgresql-14-pgvector
   ```
3. Run `supabase_setup.sql` on your PostgreSQL instance
4. Update `.env`:
   ```
   DATABASE_URL=postgresql://user:password@vm-ip:5432/dbname
   ```
5. Modify `supabase_client.py` to use `psycopg2` instead of Supabase client

## Troubleshooting

**Error: "SUPABASE_URL and SUPABASE_KEY must be set"**
- Make sure `.env` file exists and has correct credentials

**Error: "sentence-transformers not installed"**
- Run: `pip install sentence-transformers torch`

**Error: "relation 'products' does not exist"**
- Run the SQL setup script in Supabase SQL Editor

**Slow first query**
- First run downloads embedding model (~80MB)
- Subsequent queries will be fast

## Next Steps

- Add more products to `catalog.json` and re-run migration
- Experiment with different search queries
- Adjust similarity threshold in search functions
- Add product descriptions for better semantic matching
