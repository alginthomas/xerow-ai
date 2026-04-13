# Xerow AI — Agentic Human + AI Fault Detection System

## Design Documentation for Industrial Software

---

## 1. Approach & Assumptions

### What We Built

Xerow AI is an **agentic monitoring and escalation platform** for oil & gas operations. It deploys autonomous AI agents that continuously monitor field assets (turbines, pipelines, wells), detect anomalies in sensor data, score severity, and route findings through a structured human escalation chain — all before a human asks a question.

### Key Assumptions

1. **Data source**: Time-series sensor data from field assets (vibration, temperature, pressure, flow rate, H2S concentration). In production, this ingests from historians (OSIsoft PI, AVEVA) or SCADA. Our prototype generates realistic sensor readings with daily cycles, Gaussian noise, and occasional spikes.

2. **Operators work 12-hour shifts**: The UI is designed for sustained use in control rooms and on field tablets. Dark theme with ISA-101 compliant backgrounds. Touch targets ≥44px.

3. **AI will be imperfect**: The system is designed around the assumption that agents will miss faults, raise false positives, and encounter ambiguous situations. The severity rubric, confidence scoring, and escalation chain exist precisely because of this imperfection.

4. **Trust is earned operationally**: Operators don't trust AI by default. The system builds trust through transparency (audit trails), consistent behavior (deterministic severity rubric), and graceful degradation (humans can always override).

5. **Chat is one channel, not the only channel**: The conversational interface supplements — but does not replace — the dashboard, live monitoring, and ticket management system.

---

## 2. Agentic System Design

### Agent Architecture

Xerow AI deploys **three specialized autonomous agents** and one **conversational agent**:

```
┌──────────────────────────────────────────────────────────────┐
│                    XEROW AI AGENT LAYER                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐    │
│  │  ANALYTICS   │  │  ANOMALY    │  │  VERIFICATION    │    │
│  │  AGENT       │──▶│  AGENT      │──▶│  AGENT           │    │
│  │             │  │             │  │                  │    │
│  │ Continuous   │  │ Severity    │  │ Cross-sensor     │    │
│  │ baseline     │  │ scoring     │  │ validation       │    │
│  │ monitoring   │  │ & ticket    │  │ & confidence     │    │
│  │             │  │ spawning    │  │ scoring          │    │
│  └─────────────┘  └─────────────┘  └──────────────────┘    │
│         │                │                   │               │
│         ▼                ▼                   ▼               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              SHARED DATA LAYER                       │    │
│  │  Anomaly Table │ Ticket System │ Audit Log │ Redis   │    │
│  └─────────────────────────────────────────────────────┘    │
│         │                │                   │               │
│         ▼                ▼                   ▼               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │           CONVERSATIONAL AGENT (GPT-4o)              │    │
│  │  7 tools │ Natural language │ Inline data viz        │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
          ┌───────────────────────────────┐
          │      HUMAN OPERATORS          │
          │                               │
          │  Tom ──▶ Dick ──▶ Harry       │
          │  Field    Field    Chief      │
          │  Operator Manager  Operator   │
          └───────────────────────────────┘
```

### Agent Definitions

#### Analytics Agent (Background, Autonomous)
- **Goal**: Continuous baseline comparison and trigger detection
- **Skills**: 30-day rolling baseline calculation, trend analysis, deviation measurement, rate-of-change monitoring
- **Autonomy boundary**: Fully autonomous. Runs every 3 minutes without human input. Cannot create tickets directly — only triggers the Anomaly Agent.
- **Reasoning**: Compares current sensor value against baseline. Triggers when deviation exceeds 5% sustained for 15+ minutes OR rate of change exceeds 2× normal.
- **Handoff**: Emits a structured trigger payload to the Anomaly Agent containing: asset ID, sensor ID, current value, baseline value, deviation %, rate of change, adjacent sensor readings.

#### Anomaly Agent (Event-Driven, Semi-Autonomous)
- **Goal**: Severity scoring and ticket spawning
- **Skills**: Four-level severity rubric application, confidence scoring, anomaly table writes, chart marker placement
- **Autonomy boundary**: Can create GREEN anomaly records autonomously. For AMBER+ severity, autonomously spawns tickets and assigns to humans. Cannot resolve or close tickets.
- **Reasoning**: Applies deterministic severity rubric:
  - **GREEN**: Deviation ≤5%, no correlation → log only
  - **AMBER**: 5-15% deviation, sustained → ticket to Tom (2h SLA)
  - **RED**: >15% deviation or hard threshold breach → ticket to Tom + Dick notified (30min SLA)
  - **PURPLE**: Confidence <60 or no historical match → Harry paged immediately (10min re-page)
- **Handoff**: Writes to anomaly table, triggers Verification Agent, creates ticket with SLA deadline.

#### Verification Agent (Event-Driven, Advisory)
- **Goal**: Cross-sensor validation and false positive filtering
- **Skills**: Adjacent sensor correlation, 365-day historical pattern matching, confidence score adjustment
- **Autonomy boundary**: Can downgrade AMBER to GREEN (with audit note). Can upgrade any severity to PURPLE if confidence drops below 60. Cannot create or close tickets.
- **Reasoning**: Queries adjacent sensors on same asset and co-located assets. Compares pattern against historical data. If no corroboration found for amber: downgrades. If pattern has zero matches in 365-day history: upgrades to purple.
- **Handoff**: Writes verification entry to audit log with reasoning trace and confidence scores before/after.

#### Conversational Agent (On-Demand, Tool-Calling)
- **Goal**: Natural language interface for operators to query, investigate, and act
- **Skills/Tools** (7 registered):
  1. `query_assets` — Search assets by type, region, status
  2. `get_asset_detail` — Full asset info with sensors
  3. `get_sensor_readings` — Time-series data with baseline and anomalies
  4. `query_anomalies` — Search by severity, status, asset, date range
  5. `query_tickets` — Search with SLA status, severity filtering
  6. `update_ticket` — Acknowledge, add note, escalate, resolve
  7. `create_ticket` — Manual ticket creation with auto-assignment
- **Autonomy boundary**: Can query any data. Can create tickets on user request. Cannot override severity scoring or modify the anomaly table directly.
- **Reasoning**: Uses GPT-4o with function calling. System prompt includes current date, severity definitions, escalation chain, and behavioral rules per persona.
- **Handoff**: Renders results as interactive widgets (charts, cards, tables) inline in chat. Navigation links to full pages.

---

## 3. Moving Beyond Chatbots

### Background Monitoring (No User Prompt Required)

The system operates **continuously without user interaction**:

```
Every 3 minutes:
  Analytics Agent → picks 1-3 random sensors
                  → calculates deviation from 30-day baseline
                  → triggers Anomaly Agent if threshold exceeded

Every 60 seconds:
  SLA Breach Checker → scans all open tickets
                     → auto-escalates if deadline passed
                     → Tom → Dick → Harry chain

Every 30 seconds (frontend):
  Mission Control Dashboard → auto-refreshes all KPIs
  Turbine Monitor → polls sensor readings + anomalies
```

### Proactive Interventions

The system **interrupts humans when necessary**, not when prompted:

| Trigger | Action | Who Gets Interrupted |
|---------|--------|---------------------|
| RED anomaly detected | Ticket auto-created, Dick notified | Tom (assigned) + Dick (notified) |
| PURPLE anomaly detected | Immediate page, 10-min re-page | Harry (paged) |
| SLA breach (amber, 2h) | Auto-escalate to Dick | Dick (new assignment) |
| SLA breach (red, 30min) | Auto-escalate to Harry | Harry (new assignment) |

### Asynchronous Operation

Agents don't wait for user prompts. The anomaly simulator, SLA breach checker, and background refresh all operate on independent timers. The conversational agent is available but not required — the system detects, scores, tickets, and escalates without any human typing a question.

### Why Chat Exists

Chat serves a specific role: **investigation and ad-hoc queries**. When Tom receives a ticket notification, he can:
- Ask "show me the sensor data for this turbine" → gets inline chart
- Ask "what other anomalies happened today?" → gets filtered table
- Ask "create a ticket for the vibration spike I'm seeing" → ticket created with one sentence

Chat is the investigation tool, not the monitoring tool.

---

## 4. Designing for Imperfection and Uncertainty

### Communicating Uncertainty

Every anomaly record includes a **confidence score (0-100)** visible to operators:

- Scores 80-100: High confidence. Agent is certain this is anomalous.
- Scores 60-80: Moderate confidence. Cross-sensor validation partially corroborated.
- Scores <60: Low confidence. **Automatically upgraded to PURPLE** (unclassified) — agent explicitly says "I don't know" rather than generating a false positive.

The purple severity level is the system's **built-in uncertainty signal**. It means: "This pattern doesn't match anything in 365 days of history. A human expert must classify it."

### Handling False Positives

```
Detection ──▶ Verification Agent checks:
               ├─ Adjacent sensors corroborate? (cross-sensor check)
               ├─ Pattern seen ≥3 times in 365 days without incident? (historical filter)
               └─ Maintenance window active? (context check)

If no corroboration + amber severity:
  → DOWNGRADE to green (with audit note explaining why)
  → Confidence score reduced
  → No ticket created

If pattern has zero historical matches:
  → UPGRADE to purple regardless of deviation %
  → Harry paged for expert classification
```

### Disagreement Between Human and AI

When a human disagrees with the agent's assessment:

1. **Dismiss as false positive**: Operator marks ticket as `false_positive`. Audit log records who dismissed and why. The pattern is preserved for future reference.
2. **Add corrective note**: Operator adds a field note explaining what they observed. This becomes part of the immutable audit trail.
3. **Reclassify**: Harry can close a PURPLE ticket with a **classification note** that documents the novel pattern for future reference.

### Recovery After Mistakes

The audit trail is **immutable and append-only**. Every agent decision and human action is logged with: actor, action, timestamp, and note. This enables:
- Post-incident reconstruction: "What did the agent see? When? What did it decide?"
- Pattern identification: "How often does this false positive pattern occur?"
- System improvement: Classification notes from Harry feed back into pattern recognition.

---

## 5. Human-in-the-Loop as Responsibility Transfer

### When Agents Act Independently

| Action | Agent Autonomy | Human Required? |
|--------|---------------|-----------------|
| Monitor baseline | Full autonomy | No |
| Log GREEN anomaly | Full autonomy | No |
| Suppress GREEN during maintenance | Full autonomy | No |
| Downgrade AMBER to GREEN | Semi-autonomous (Verification Agent) | No, but audit logged |
| Create ticket for AMBER+ | Full autonomy | No — human is notified after |
| Assign ticket to Tom/Dick/Harry | Full autonomy (based on severity) | No |
| Set SLA deadline | Full autonomy | No |
| Auto-escalate on SLA breach | Full autonomy | No |
| Re-page Harry every 10 min | Full autonomy | No |

### When Humans Are Required

| Action | Why Human Required |
|--------|-------------------|
| Acknowledge ticket | Confirms "I see this and I'm on it" |
| Add field observation notes | Only humans can observe physical conditions |
| Resolve ticket | Requires confirmation that the issue is actually fixed |
| Classify PURPLE anomaly | Agent explicitly cannot classify unknown patterns |
| Authorize shutdown | Legal and safety implications beyond AI scope |
| Override severity | Human judgment may differ from algorithmic scoring |

### How Humans Correct Agent Behavior

1. **Mark false positive** → Pattern recorded in audit trail
2. **Add classification note (Harry)** → Documents novel pattern for future reference
3. **Adjust thresholds** → Hard safety thresholds are configurable per asset type
4. **Escalation override** → Any persona can escalate regardless of automatic assignment

### Where Accountability Sits

```
GREEN anomalies:  Agent is accountable (autonomous logging)
AMBER tickets:    Tom is accountable (2-hour SLA)
RED tickets:      Tom (30-min ack) + Dick (1-hour action)
PURPLE tickets:   Harry is accountable (immediate response)
SLA breaches:     Auto-escalated, but the escalated-to person is accountable
Shutdowns:        Harry authorizes, control system executes (outside Xerow AI)
```

The escalation chain is a **responsibility transfer protocol**: each escalation moves accountability to the next person, with full audit trail showing the handoff.

---

## 6. Trust as an Operational Outcome

### How Trust Is Earned

Trust is not designed — it emerges from consistent, predictable system behavior:

1. **Deterministic severity rubric**: Same reading always gets same severity. No black-box decisions.
2. **Transparent reasoning**: Every agent decision is logged with the exact inputs (deviation %, confidence score, cross-sensor results).
3. **Graceful uncertainty**: PURPLE severity explicitly says "I don't know" — operators trust systems that acknowledge limitations.
4. **Consistent SLA tracking**: SLA deadlines are calculated at ticket creation and never modified. Breach detection is deterministic.
5. **Immutable audit trail**: Nothing can be edited or deleted. Full reconstruction is always possible.

### Trust Signals and Metrics

| Metric | Indicates | Target |
|--------|-----------|--------|
| False positive rate | Agent accuracy | <15% of amber tickets |
| PURPLE classification rate | Novelty detection | Decreasing over time as patterns are learned |
| SLA compliance rate | Human responsiveness | >95% of all tickets |
| Mean time to acknowledgement | Operator engagement | <30 min for red tickets |
| Audit trail completeness | System integrity | 100% of closed tickets |
| Agent confidence score trend | Model calibration | Mean confidence increasing quarter-over-quarter |

### Balancing Value, Reliability, and Cost

| Constraint | How Addressed |
|-----------|---------------|
| **Latency** | Anomaly detection <60s from sensor reading to table entry. Ticket creation <30s from anomaly. |
| **Streaming data** | Sensor readings polled every 5 minutes. Charts update every 5 seconds in live mode. |
| **LLM cost** | Conversational agent uses GPT-4o only when user asks. Background agents use deterministic rules, not LLM. |
| **False alarm fatigue** | GREEN anomalies don't create tickets. Verification agent filters false positives before ticketing. |
| **Offline field use** | Tablet-optimized UI with 44px touch targets. (Future: offline caching with sync-on-reconnect.) |

---

## 7. AI-Native Execution

### Context and Memory

- **Agent session memory**: Redis-backed session store persists conversation context across deploys. Sessions expire after 1 hour of inactivity.
- **System prompt injection**: Current date/time injected dynamically to prevent hallucinated dates.
- **Historical context**: 365-day historical data available for pattern matching. 30-day rolling baseline per sensor.

### Skill/Tool Invocation

The conversational agent uses **OpenAI function calling** with 7 registered tools:

```
User: "Show me Turbine T-01 vibration data"
  ↓
Agent calls: get_asset_detail("Turbine T-01")
  → resolves name to UUID
  → returns sensors: [T01-VIB, T01-EXT, T01-RPM]
  ↓
Agent calls: get_sensor_readings(sensor_id: T01-VIB UUID)
  → queries PostgreSQL for last hour of readings
  → returns: 12 data points + baseline + recent anomalies
  ↓
Frontend renders: inline area chart with baseline band + anomaly markers
```

Tool handlers include **smart resolution**: asset names, sensor names, user names, and even ticket IDs are automatically resolved to UUIDs. The agent never needs to know internal database identifiers.

### Constraints Influencing Design

| Constraint | Design Decision |
|-----------|-----------------|
| GPT-4o token cost | Background agents use deterministic rules, not LLM. Only the conversational agent uses GPT-4o, and only on user request. |
| 4096 max tokens | Tool results are truncated to essential fields. Large result sets limited to 20 items. |
| Railway deploy cold starts | Redis session persistence ensures chat context survives redeploys. |
| Netlify static hosting | API proxy via redirects — `/api/*` routes to Railway backend. No server-side rendering needed. |
| ISA-101 compliance | Dark mode default. No pure black backgrounds. Severity colors use both color AND text labels. |

---

## 8. System Interaction Flows

### Flow 1: Automated Anomaly Detection → Human Resolution

```
[Sensor reads 13.5 mm/s vibration on Turbine T-01]
        │
        ▼
[Analytics Agent: deviation 221% from 4.2 baseline]
        │
        ▼
[Anomaly Agent: severity = RED (>15%), confidence = 87%]
        │
        ├──▶ [Anomaly table: record created]
        ├──▶ [Chart marker: red dot placed at timestamp]
        └──▶ [Ticket created: "RED anomaly: 221% deviation"]
             │
             ├── Assigned to: Tom Henderson (Field Operator)
             ├── SLA deadline: 30 minutes
             └── Dick Morrison (Field Manager) notified
                  │
                  ▼
        [Tom sees ticket in Mission Control dashboard]
        [Tom acknowledges within 15 minutes]
        [Tom adds field note: "Bearing wear visible, scheduling replacement"]
        [Tom resolves ticket with note]
                  │
                  ▼
        [Audit trail complete: 4 entries]
        [Post-incident report exportable as .txt]
```

### Flow 2: Unknown Pattern → Human Classification

```
[Sensor pattern matches nothing in 365-day history]
        │
        ▼
[Verification Agent: confidence drops to 45%]
[Verification Agent: UPGRADE to PURPLE]
        │
        ▼
[Ticket created: assigned to Harry Chen (Chief Operator)]
[Harry paged immediately, re-paged every 10 minutes]
        │
        ▼
[Harry investigates via chat: "show me the sensor data"]
[Inline chart renders with anomaly markers]
[Harry classifies: "New condensation pattern during winter startup"]
[Harry closes ticket with classification note]
        │
        ▼
[Classification note preserved for future pattern matching]
```

### Flow 3: SLA Breach → Auto-Escalation

```
[Amber ticket created, assigned to Tom, SLA: 2 hours]
        │
        ▼
[2 hours pass, Tom has not acknowledged]
        │
        ▼
[SLA Breach Checker: deadline < NOW()]
[Auto-escalate: reassign to Dick Morrison]
[Audit log: "sla_breach_escalation"]
        │
        ▼
[Dick sees escalated ticket in Mission Control]
[Dick resolves or escalates to Harry]
```

---

## 9. Screenshots & UI Reference

*The following screenshots should be captured from the live application at https://xerow-ai.netlify.app for the presentation:*

### Recommended Screenshots

1. **Sign-In Page** — Clean authentication, test account quick-fill buttons
2. **Mission Control Dashboard** — SLA breach banner, KPI cards, active tickets table, asset health grid
3. **Turbine Monitor (Live)** — Real-time chart with baseline band, anomaly markers, sensor selector, time presets, Live/Pause toggle
4. **Turbine Monitor (Comparison)** — Historical overlay (vs 7d dashed line)
5. **Turbine Monitor (Drag Select)** — Amber selection overlay for manual ticket creation
6. **Ticket Detail** — Full ticket with severity, SLA timer, audit trail, action buttons
7. **Tickets Page (My Tickets)** — Batch select, search, severity filters
8. **Chat: Asset Query** — "Check all turbines" → asset cards with StatsDisplay
9. **Chat: Sensor Data** — "Show T-01 sensor data" → inline chart widget
10. **Chat: Ticket Creation** — "Create a ticket for vibration spike" → confirmation card
11. **Anomalies Table** — CSV export, severity filter, immutable records
12. **Command Palette (Cmd+K)** — Global search across assets, tickets
13. **Shift Briefing** — Proactive summary at chat login
14. **Collapsed Sidebar** — Icon-only mode for tablet use

---

## 10. Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18 + Vite + Tailwind CSS | SPA with dark theme |
| UI Components | Shadcn UI + Radix UI | Accessible component primitives |
| Charts | Recharts + Shadcn ChartContainer | Time-series visualization |
| Chat | assistant-ui + SSE streaming | Real-time AI responses with tool widgets |
| Backend | Express.js + TypeScript | REST API with JWT auth |
| Database | PostgreSQL | Assets, sensors, anomalies, tickets, audit log |
| Cache | Redis | Session persistence, future pub/sub |
| AI Agent | OpenAI GPT-4o (function calling) | Conversational interface with 7 tools |
| Background | Node.js timers | Anomaly simulator, SLA breach checker |
| Deployment | Netlify (frontend) + Railway (backend, agent, Postgres, Redis) | Production infrastructure |
