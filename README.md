# Xerow AI

**Agentic Monitoring & Escalation Platform for Oil & Gas Operations**

Xerow AI deploys autonomous AI agents that continuously monitor field assets (turbines, pipelines, wells), detect anomalies in real-time sensor data, score severity using a deterministic rubric, and route findings through a structured human escalation chain — all before a human asks a question.

Built for operators working 12-hour shifts in control rooms and on field tablets. Dark-themed, ISA-101 compliant, with 44px touch targets.

---

## Architecture

```
xerow.ai/
├── apps/
│   ├── web/            # React SPA — dashboard, chat, monitoring UI
│   ├── server/         # Express REST API — assets, tickets, anomalies, auth
│   └── mcp-agent/      # Python FastAPI — GPT-4o conversational agent
├── docs/               # System design documentation
└── pnpm-workspace.yaml # Monorepo config
```

### System Design

```
┌──────────────────────────────────────────────────┐
│              AUTONOMOUS AGENT LAYER               │
│                                                   │
│  Analytics Agent    Anomaly Agent    Verification  │
│  (3-min cycle)      (severity +      Agent         │
│  Baseline           ticket spawn)    (cross-sensor  │
│  monitoring                          validation)    │
│                                                   │
├──────────────────────────────────────────────────┤
│              SHARED DATA LAYER                    │
│  PostgreSQL: assets, sensors, anomalies, tickets  │
│  Redis: agent session persistence                 │
│  Audit Log: immutable, append-only                │
├──────────────────────────────────────────────────┤
│          CONVERSATIONAL AGENT (GPT-4o)            │
│  7 tools · function calling · SSE streaming       │
│  Inline charts, cards, tables in chat             │
├──────────────────────────────────────────────────┤
│              HUMAN OPERATORS                      │
│  Tom (Field Operator) → Dick (Field Manager)      │
│  → Harry (Chief Operator)                         │
└──────────────────────────────────────────────────┘
```

---

## Features

### Autonomous Monitoring
- **Background anomaly detection** every 3 minutes — no human prompt required
- **Deterministic severity rubric**: GREEN (log only), AMBER (2h SLA), RED (30min SLA), PURPLE (unknown pattern — Harry paged)
- **Auto-escalation**: SLA breach checker runs every 60 seconds, escalates Tom → Dick → Harry
- **Confidence scoring**: Scores < 60 auto-upgrade to PURPLE ("I don't know")

### Mission Control Dashboard
- Real-time KPIs: active tickets, anomaly counts, SLA compliance
- SLA breach alert banner with pulsing red indicator
- Asset health grid across all regions
- Auto-refresh every 30 seconds with data freshness indicators

### Live Turbine Monitor
- Real-time sensor chart with 5-second polling and Live/Pause toggle
- Baseline band visualization with anomaly markers
- **Drag-select** a time range to create a manual ticket
- Historical comparison overlay (vs 7 days / 30 days ago)
- Click any anomaly or ticket to highlight ±5 minutes on chart
- Sensor selector and time presets (1h, 6h, 24h, 7d)

### Conversational AI (Chat)
- GPT-4o with function calling and 7 registered tools
- Inline interactive widgets: asset cards, sensor charts, ticket actions, audit trails
- Shift handover briefing shown automatically at login
- SSE streaming responses
- Redis-backed session persistence across deploys

### Ticket Management
- "My Tickets" default tab filtered by current user
- Batch acknowledge / escalate multiple tickets
- Full audit trail per ticket (immutable, append-only)
- SLA countdown timers with severity-colored urgency
- Manual ticket creation from chat or chart drag-select

### Command Palette (Cmd+K)
- Global search across assets, tickets, anomalies
- Recent items and quick commands
- Keyboard-first navigation

### Data Export
- CSV export for anomalies and tickets tables
- TXT post-incident reports auto-compiled from audit trail

### Field-Ready Design
- ISA-101 compliant dark theme (warm gray background, not pure black)
- 44px minimum touch targets for tablet/gloved use
- Responsive layout down to 768px tablet
- Manrope font with responsive sizing via `clamp()`
- Severity colors use both color AND text labels (accessible)

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18 + Vite + TypeScript | SPA with dark theme |
| UI | Shadcn UI + Radix UI + Lucide icons | 50+ accessible components |
| Charts | Recharts + Shadcn ChartContainer | Time-series visualization |
| Chat | assistant-ui + SSE streaming | Real-time AI with tool widgets |
| Animation | Motion (Framer Motion) | Smooth transitions |
| Styling | Tailwind CSS 4 + OKLCH colors | ISA-101 compliant design system |
| Backend | Express.js + TypeScript | REST API with JWT auth |
| Database | PostgreSQL | Assets, sensors, anomalies, tickets, audit log |
| Cache | Redis | Agent session persistence |
| AI Agent | OpenAI GPT-4o (function calling) | Conversational interface with 7 tools |
| Agent Server | FastAPI + Uvicorn (Python) | Agent API with SSE streaming |
| Deployment | Netlify (frontend) + Railway (backend + agent + Postgres + Redis) | Production |

---

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 8+ (`npm install -g pnpm`)
- Python 3.11+
- PostgreSQL 14+
- Redis (optional — agent falls back to in-memory sessions)

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment

**Server** (`apps/server/.env`):
```env
PORT=3001
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=xerow
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_jwt_secret
OPENAI_API_KEY=sk-...
```

**Agent** (`apps/mcp-agent/.env`):
```env
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/xerow
REDIS_URL=redis://localhost:6379  # optional
```

**Web** (`apps/web/.env`):
```env
VITE_API_BASE_URL=http://localhost:3001/api
VITE_PYTHON_AGENT_URL=http://localhost:8000
```

### 3. Set Up Database

```bash
# Create database
createdb xerow

# Run migrations
pnpm --filter xerow-server run migrate

# Seed with industrial data (8 assets, 21 sensors, 6000+ readings, 3 test users)
pnpm --filter xerow-server run seed
```

### 4. Set Up Agent

```bash
cd apps/mcp-agent
python3 -m venv env
source env/bin/activate
pip install -r requirements.txt
```

### 5. Start Development

```bash
# All services (web + server)
pnpm dev

# Agent (separate terminal)
cd apps/mcp-agent && source env/bin/activate && uvicorn server:app --reload --port 8000

# Or individually:
pnpm dev:web      # Frontend on :5173
pnpm dev:server   # Backend on :3001
pnpm dev:agent    # Agent on :8000
```

---

## Test Accounts

All passwords: `password123`

| Account | Email | Persona | Role |
|---------|-------|---------|------|
| Tom Henderson | tom@xerow.ai | Field Operator | Receives AMBER/RED tickets, first responder |
| Dick Morrison | dick@xerow.ai | Field Manager | Escalation target, team oversight |
| Harry Chen | harry@xerow.ai | Chief Operator | PURPLE tickets, final escalation, system admin |

---

## Database Schema

### Migrations (sequential)

| # | Migration | Purpose |
|---|-----------|---------|
| 001 | `add_persona_to_users` | User persona field (tom/dick/harry) |
| 002 | `create_assets` | Monitored field assets (turbines, pipelines, wells) |
| 003 | `create_sensors` | Sensor definitions per asset with baselines |
| 004 | `create_sensor_readings` | Time-series sensor data |
| 005 | `create_anomalies` | Anomaly detection records with severity + confidence |
| 006 | `create_tickets` | Agentic tickets with SLA deadlines |
| 007 | `create_audit_log` | Immutable audit trail |
| 008 | `create_agent_instances` | Agent lifecycle tracking |
| 009 | `create_conversations` | Persistent chat history |
| 010 | `tickets_nullable_anomaly` | Allow manual tickets (no anomaly_id required) |

### Seed Data

- **8 assets**: 3 turbines, 3 pipelines, 2 wells across North Sea and Gulf Coast
- **21 sensors**: vibration, exhaust temp, RPM, pressure, flow rate, H2S, wellhead pressure
- **6,048 sensor readings**: 7 days of 5-minute interval data with realistic daily cycles
- **50 anomalies**: distributed across severities (GREEN/AMBER/RED/PURPLE)
- **10 tickets**: with various statuses and SLA states
- **3 test users**: Tom, Dick, Harry with personas

---

## API Reference

### REST API (Express — port 3001)

**Authentication**
- `POST /api/auth/signin` — JWT login
- `POST /api/auth/signup` — Create account
- `POST /api/auth/refresh` — Refresh token

**Assets (v1)**
- `GET /api/v1/assets` — List assets (filter by type, region, status)
- `GET /api/v1/assets/:id` — Asset detail with sensors

**Anomalies (v1)**
- `GET /api/v1/anomalies` — List anomalies (filter by severity, status, asset, date range)
- `GET /api/v1/anomalies/:id` — Anomaly detail

**Tickets (v1)**
- `GET /api/v1/tickets` — List tickets (filter by status, severity, assigned_to, SLA)
- `GET /api/v1/tickets/:id` — Ticket detail with audit trail
- `POST /api/v1/tickets` — Create ticket
- `PATCH /api/v1/tickets/:id` — Update ticket (acknowledge, note, escalate, resolve)

**Conversations (v1)**
- `GET /api/v1/conversations` — List chat conversations
- `POST /api/v1/conversations` — Create conversation
- `GET /api/v1/conversations/:id/messages` — Get messages
- `POST /api/v1/conversations/:id/messages` — Save message

### Agent API (FastAPI — port 8000)

- `GET /health` — Health check
- `POST /api/chat` — Send message (returns complete response)
- `POST /api/chat/stream` — Send message (SSE streaming)

### Agent Tools (GPT-4o Function Calling)

| Tool | Purpose |
|------|---------|
| `query_assets` | Search assets by type, region, status |
| `get_asset_detail` | Full asset info with sensors and recent activity |
| `get_sensor_readings` | Time-series data with baseline and anomaly markers |
| `query_anomalies` | Search by severity, status, asset, date range |
| `query_tickets` | Search with SLA status and severity filtering |
| `update_ticket` | Acknowledge, add notes, escalate, resolve |
| `create_ticket` | Manual ticket creation with auto-assignment by severity |
| `get_audit_log` | Immutable audit trail for any entity |

---

## Severity Rubric

| Level | Deviation | SLA | Assigned To | Auto-Actions |
|-------|-----------|-----|-------------|--------------|
| GREEN | ≤5% | None | — | Log only, no ticket |
| AMBER | 5-15%, sustained | 2 hours | Tom | Ticket created, monitored |
| RED | >15% or hard threshold | 30 minutes | Tom + Dick notified | Ticket created, Dick alerted |
| PURPLE | Confidence < 60 | Immediate | Harry | Harry paged, 10-min re-page |

### Auto-Escalation on SLA Breach

```
Amber ticket → 2h passes unacknowledged → escalate to Dick
Red ticket → 30min passes unacknowledged → escalate to Harry
Any ticket → next-level SLA breached → escalate up chain
```

---

## Deployment

### Production URLs

- **Frontend**: Netlify (static SPA with API proxy)
- **Backend API**: Railway (Express + PostgreSQL)
- **Agent API**: Railway (FastAPI + Redis)

### Netlify Configuration

The frontend proxies API calls to Railway:
- `/api/chat/*` → Agent service (FastAPI)
- `/api/*` → Backend service (Express)
- `/*` → `index.html` (SPA fallback)

### Railway Services

1. **xerow-server** — Express API + PostgreSQL connection
2. **xerow-agent** — FastAPI agent + Redis session store
3. **PostgreSQL** — Managed database
4. **Redis** — Session persistence (optional)

### Build Commands

```bash
# Frontend (Netlify)
pnpm --filter web build    # outputs to apps/web/dist/

# Backend (Railway)
pnpm --filter xerow-server build   # TypeScript → dist/

# Agent (Railway)
pip install -r requirements.txt && uvicorn server:app --host 0.0.0.0 --port $PORT
```

---

## Project Scripts

```bash
pnpm dev              # Start web + server in parallel
pnpm dev:web          # Frontend only (Vite on :5173)
pnpm dev:server       # Backend only (Express on :3001)
pnpm dev:agent        # Python agent (FastAPI on :8000)
pnpm build            # Build web + server
pnpm build:web        # Build frontend
pnpm build:server     # Build backend

# Database
pnpm --filter xerow-server run migrate   # Run all migrations
pnpm --filter xerow-server run seed      # Seed industrial data

# Agent
pnpm setup:agent      # Create venv + install requirements
```

---

## Design System

- **Theme**: OKLCH color space with ISA-101 compliant severity colors
- **Font**: Manrope (variable weight 200-800) with responsive `clamp()` sizing
- **Radius**: 0.75rem default
- **Dark mode**: Warm gray background `oklch(0.18 0.004 308)` — not pure black (reduces eye strain)
- **Touch targets**: 44px minimum for all interactive elements
- **Severity colors**: Green, Amber, Red, Purple with background variants at 12-15% opacity

See `apps/web/src/styles/theme.css` for the full design token system.

---

## Documentation

- [`docs/AGENTIC_SYSTEM_DESIGN.md`](docs/AGENTIC_SYSTEM_DESIGN.md) — Comprehensive system design covering agent architecture, severity rubric, escalation chain, trust mechanisms, and interaction flows

---

## License

Private — All rights reserved
