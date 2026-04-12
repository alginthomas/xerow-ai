# Quick Start Guide - Supabase Integration

## 🚀 5-Minute Setup

### 1. Run SQL in Supabase
Copy all contents of `supabase_setup.sql` → Paste in Supabase SQL Editor → Run

### 2. Configure Credentials
```bash
cp .env.example .env
# Edit .env with your Supabase URL and Key
```

### 3. Install & Migrate
```bash
pip install -r requirements.txt
python migrate_data.py
```

### 4. Test
```bash
./run_agent.sh
> I need running shoes under 4500
```

---

## 📁 New Files Overview

| File | What It Does |
|------|--------------|
| `supabase_setup.sql` | Database schema + search functions |
| `supabase_client.py` | DB client + embedding generation |
| `migrate_data.py` | Migrate catalog.json → Supabase |
| `requirements.txt` | Python dependencies |
| `.env.example` | Config template |

---

## 🔄 What Changed

**Before:** `catalog.json` → String matching  
**After:** Supabase PostgreSQL → Semantic vector search

**Agent code:** No changes needed! Same tool interface.

---

## 🎯 Key Features

✅ Semantic search ("sneakers" finds "running shoes")  
✅ Hybrid search (keyword + vector similarity)  
✅ Price filtering  
✅ Local embeddings (free, no API costs)  
✅ Production-ready (indexes, RLS, error handling)

---

## 🚢 Production Deployment

### Option 1: Supabase (Easy)
- Keep using Supabase in production
- Update `.env` with production credentials
- Done!

### Option 2: Self-Hosted PostgreSQL
1. Install PostgreSQL 14+ on VM
2. Install pgvector: `apt-get install postgresql-14-pgvector`
3. Run `supabase_setup.sql` on your DB
4. Update connection in `supabase_client.py`

**Key:** Same SQL schema works for both!

---

## 📚 Documentation

- **Setup Guide:** `SUPABASE_SETUP.md` (detailed steps)
- **Walkthrough:** See artifacts (architecture + testing)
- **Implementation Plan:** See artifacts (technical details)

---

## ❓ Troubleshooting

**"SUPABASE_URL must be set"**  
→ Create `.env` file with your credentials

**"sentence-transformers not installed"**  
→ Run: `pip install -r requirements.txt`

**"relation 'products' does not exist"**  
→ Run SQL setup script in Supabase

**First query is slow**  
→ Normal! Downloads embedding model (~80MB) once

---

## 🧪 Test Queries

Try these to see semantic search in action:

```
> I need running shoes under 4500
> Show me affordable sneakers
> Find Nike shoes
> Compare shoe_1 and shoe_2
```

Notice how "sneakers" finds "running shoes" products!
