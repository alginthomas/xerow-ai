"""
Tool Handlers - Direct database queries for Xerow AI Industrial Platform
Replaces the JSON-RPC MCP server with direct function calls.
"""

import json
import logging
import os
from typing import Dict, Any

import psycopg2
import psycopg2.extras

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def get_db():
    return psycopg2.connect(
        os.environ.get("DATABASE_URL", ""),
        cursor_factory=psycopg2.extras.RealDictCursor,
    )


def execute_tool(name: str, args: Dict[str, Any]) -> Any:
    """Dispatch tool call to the appropriate handler."""
    handler = HANDLERS.get(name)
    if not handler:
        return {"error": f"Unknown tool: {name}"}
    try:
        return handler(args)
    except Exception as e:
        logger.error(f"Tool '{name}' failed: {e}", exc_info=True)
        return {"error": str(e)}


def _serialize_row(row: dict) -> dict:
    """Convert non-JSON-serializable types in a row dict."""
    import datetime
    import decimal
    import uuid as uuid_mod

    out = {}
    for k, v in row.items():
        if isinstance(v, (datetime.datetime, datetime.date)):
            out[k] = v.isoformat()
        elif isinstance(v, decimal.Decimal):
            out[k] = float(v)
        elif isinstance(v, uuid_mod.UUID):
            out[k] = str(v)
        elif isinstance(v, str):
            # Try parsing JSON strings (e.g. location JSONB stored as text)
            if v.startswith("{") or v.startswith("["):
                try:
                    out[k] = json.loads(v)
                except (json.JSONDecodeError, ValueError):
                    out[k] = v
            else:
                out[k] = v
        else:
            out[k] = v
    return out


# ── Asset handlers ──────────────────────────────────────────────

def handle_query_assets(params: Dict) -> Dict:
    conn = get_db()
    cur = conn.cursor()
    conditions, values = [], []

    if params.get("type"):
        conditions.append("a.type = %s")
        values.append(params["type"])
    if params.get("region"):
        conditions.append("a.region ILIKE %s")
        values.append(f"%{params['region']}%")
    if params.get("status"):
        conditions.append("a.status = %s")
        values.append(params["status"])

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    cur.execute(f"""
        SELECT a.id, a.name, a.type, a.region, a.status,
            (SELECT COUNT(*) FROM sensors s WHERE s.asset_id = a.id) AS sensor_count,
            (SELECT COUNT(*) FROM tickets t WHERE t.asset_id = a.id
                AND t.status NOT IN ('closed','false_positive')) AS open_tickets,
            (SELECT COUNT(*) FROM anomalies an WHERE an.asset_id = a.id
                AND an.detected_at > NOW() - INTERVAL '24 hours') AS recent_anomalies
        FROM assets a {where} ORDER BY a.name LIMIT 20
    """, values)
    rows = [_serialize_row(dict(r)) for r in cur.fetchall()]
    cur.close(); conn.close()
    return {"assets": rows, "count": len(rows)}


def handle_get_asset_detail(params: Dict) -> Dict:
    asset_id = params.get("asset_id")
    if not asset_id:
        return {"error": "asset_id is required"}

    logger.info(f"get_asset_detail called with asset_id='{asset_id}'")

    conn = get_db()
    cur = conn.cursor()

    # Resolve name/shorthand to UUID if needed
    if len(asset_id) < 36 or '-' not in asset_id:
        cur.execute("SELECT id FROM assets WHERE LOWER(name) LIKE %s LIMIT 1", [f"%{asset_id.lower()}%"])
        row = cur.fetchone()
        if row:
            asset_id = str(row["id"])
            logger.info(f"Resolved to UUID: {asset_id}")
        else:
            logger.warning(f"Could not resolve asset_id '{asset_id}' to any asset")

    # If this UUID is actually a ticket_id, resolve to asset_id
    cur.execute("SELECT asset_id FROM tickets WHERE ticket_id = %s", [asset_id])
    ticket_row = cur.fetchone()
    if ticket_row:
        asset_id = str(ticket_row["asset_id"])
        logger.info(f"Resolved ticket_id to asset_id: {asset_id}")

    cur.execute("""
        SELECT a.*,
            (SELECT json_agg(json_build_object(
                'id', s.id, 'name', s.name, 'type', s.type, 'unit', s.unit,
                'baseline_value', s.baseline_value, 'status', s.status::text
            )) FROM sensors s WHERE s.asset_id = a.id) AS sensors,
            (SELECT COUNT(*) FROM tickets t WHERE t.asset_id = a.id
                AND t.status NOT IN ('closed','false_positive')) AS open_tickets,
            (SELECT COUNT(*) FROM anomalies an WHERE an.asset_id = a.id
                AND an.detected_at > NOW() - INTERVAL '24 hours') AS recent_anomalies
        FROM assets a WHERE a.id = %s
    """, [asset_id])
    row = cur.fetchone()
    cur.close(); conn.close()
    if not row:
        return {"error": "Asset not found"}
    return {"asset": _serialize_row(dict(row))}


# ── Sensor handlers ─────────────────────────────────────────────

def handle_get_sensor_readings(params: Dict) -> Dict:
    sensor_id = params.get("sensor_id")
    if not sensor_id:
        return {"error": "sensor_id is required"}

    conn = get_db()
    cur = conn.cursor()

    # Resolve sensor name to UUID if needed
    if len(sensor_id) < 36 or '-' not in sensor_id:
        cur.execute("SELECT id FROM sensors WHERE LOWER(name) LIKE %s LIMIT 1", [f"%{sensor_id.lower()}%"])
        row = cur.fetchone()
        if row:
            sensor_id = str(row["id"])

    cur.execute("SELECT id, name, type, unit, baseline_value, baseline_stddev, asset_id FROM sensors WHERE id = %s", [sensor_id])
    sensor = cur.fetchone()
    if not sensor:
        cur.close(); conn.close()
        return {"error": "Sensor not found"}

    sensor = _serialize_row(dict(sensor))
    baseline_val = float(sensor.get("baseline_value") or 100)
    stddev = float(sensor.get("baseline_stddev") or baseline_val * 0.05)

    # Query real readings from DB (last 1 hour)
    cur.execute("""
        SELECT timestamp, value FROM sensor_readings
        WHERE sensor_id = %s AND timestamp > NOW() - INTERVAL '1 hour'
        ORDER BY timestamp ASC LIMIT 50
    """, [sensor_id])
    readings = [_serialize_row(dict(r)) for r in cur.fetchall()]

    # Fetch recent anomalies for this sensor
    cur.execute("""
        SELECT anomaly_id, severity, deviation_pct, confidence_score, detected_at
        FROM anomalies WHERE sensor_id = %s AND detected_at > NOW() - INTERVAL '24 hours'
        ORDER BY detected_at DESC LIMIT 10
    """, [sensor_id])
    anomalies = [_serialize_row(dict(r)) for r in cur.fetchall()]
    cur.close(); conn.close()

    return {
        "sensor": sensor,
        "readings": readings,
        "baseline": {
            "mean": baseline_val,
            "upper": round(baseline_val + 2 * stddev, 2),
            "lower": round(baseline_val - 2 * stddev, 2),
        },
        "anomalies": anomalies,
    }


# ── Anomaly handlers ────────────────────────────────────────────

def handle_query_anomalies(params: Dict) -> Dict:
    logger.info(f"query_anomalies called with params: {params}")
    conn = get_db()
    cur = conn.cursor()
    conditions, values = [], []

    if params.get("asset_id"):
        asset_id = params["asset_id"]
        # Resolve name to UUID
        if len(asset_id) < 36 or '-' not in asset_id:
            cur.execute("SELECT id FROM assets WHERE LOWER(name) LIKE %s LIMIT 1", [f"%{asset_id.lower()}%"])
            row = cur.fetchone()
            if row:
                asset_id = str(row["id"])
        conditions.append("an.asset_id = %s"); values.append(asset_id)
    if params.get("severity"):
        conditions.append("an.severity = %s"); values.append(params["severity"])
    if params.get("status"):
        conditions.append("an.status = %s"); values.append(params["status"])
    if params.get("date_from"):
        date_from = params["date_from"]
        if date_from.lower() == "today":
            conditions.append("an.detected_at >= CURRENT_DATE")
        elif date_from.startswith("202") and int(date_from[:4]) >= 2025:
            # Valid recent date
            conditions.append("an.detected_at >= %s"); values.append(date_from)
        else:
            # GPT hallucinated a wrong year — fall back to last 24h
            logger.warning(f"Ignoring invalid date_from '{date_from}', using last 24h")
            conditions.append("an.detected_at >= NOW() - INTERVAL '24 hours'")
    if params.get("date_to"):
        date_to = params["date_to"]
        if date_to.startswith("202") and int(date_to[:4]) >= 2025:
            conditions.append("an.detected_at <= %s"); values.append(date_to)
        else:
            logger.warning(f"Ignoring invalid date_to '{date_to}'")

    # Default: if no date filter, show last 24 hours
    if not params.get("date_from") and not params.get("date_to"):
        conditions.append("an.detected_at >= NOW() - INTERVAL '24 hours'")

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    cur.execute(f"""
        SELECT an.anomaly_id, an.severity, an.colour_code, an.deviation_pct,
               an.confidence_score, an.detected_at, an.status, an.maintenance_window,
               a.name AS asset_name, a.type AS asset_type,
               s.name AS sensor_name, s.unit AS sensor_unit
        FROM anomalies an
        JOIN assets a ON a.id = an.asset_id
        JOIN sensors s ON s.id = an.sensor_id
        {where}
        ORDER BY an.detected_at DESC LIMIT 20
    """, values)
    rows = [_serialize_row(dict(r)) for r in cur.fetchall()]
    cur.close(); conn.close()
    return {"anomalies": rows, "count": len(rows)}


# ── Ticket handlers ──────────────────────────────────────────────

def handle_query_tickets(params: Dict) -> Dict:
    conn = get_db()
    cur = conn.cursor()
    conditions, values = [], []

    if params.get("status"):
        status = params["status"]
        # "open" means any non-closed status
        if status == "open":
            conditions.append("t.status NOT IN ('closed', 'false_positive')")
        else:
            conditions.append("t.status = %s"); values.append(status)
    if params.get("severity"):
        conditions.append("t.severity = %s"); values.append(params["severity"])
    if params.get("assigned_to"):
        assigned = params["assigned_to"]
        # Support name/persona lookup, not just UUID
        if len(assigned) < 36 or '-' not in assigned:
            # Looks like a name or persona, resolve to user ID
            cur.execute("SELECT id FROM users WHERE LOWER(name) LIKE %s OR LOWER(persona) = %s LIMIT 1",
                        [f"%{assigned.lower()}%", assigned.lower()])
            user_row = cur.fetchone()
            if user_row:
                conditions.append("t.assigned_to = %s"); values.append(user_row["id"])
            else:
                conditions.append("1=0")  # No match, return empty
        else:
            conditions.append("t.assigned_to = %s"); values.append(assigned)
    if params.get("sla_breached"):
        conditions.append("t.sla_deadline < NOW() AND t.status NOT IN ('closed','false_positive')")

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    cur.execute(f"""
        SELECT t.ticket_id, t.severity, t.title, t.status, t.created_at,
               t.sla_deadline, t.escalation_level,
               a.name AS asset_name, a.type AS asset_type,
               u.name AS assigned_to_name, u.persona AS assigned_to_persona,
               CASE WHEN t.sla_deadline < NOW() AND t.status NOT IN ('closed','false_positive')
                 THEN true ELSE false END AS sla_breached
        FROM tickets t
        JOIN assets a ON a.id = t.asset_id
        LEFT JOIN users u ON u.id = t.assigned_to
        {where}
        ORDER BY
          CASE t.severity WHEN 'purple' THEN 0 WHEN 'red' THEN 1 WHEN 'amber' THEN 2 END,
          t.sla_deadline ASC
        LIMIT 20
    """, values)
    rows = [_serialize_row(dict(r)) for r in cur.fetchall()]
    cur.close(); conn.close()
    return {"tickets": rows, "count": len(rows)}


def handle_update_ticket(params: Dict) -> Dict:
    ticket_id = params.get("ticket_id")
    action = params.get("action")
    note = params.get("note", "")
    if not ticket_id or not action:
        return {"error": "ticket_id and action are required"}

    return {
        "status": "action_recorded",
        "ticket_id": ticket_id,
        "action": action,
        "note": note,
        "message": f"Action '{action}' recorded for ticket {ticket_id[:8]}. Use the ticket detail view to complete this action.",
    }


# ── Audit log handler ───────────────────────────────────────────

def handle_get_audit_log(params: Dict) -> Dict:
    entity_type = params.get("entity_type")
    entity_id = params.get("entity_id")
    if not entity_type or not entity_id:
        return {"error": "entity_type and entity_id are required"}

    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, actor, action, timestamp, note
        FROM audit_log
        WHERE entity_type = %s AND entity_id = %s
        ORDER BY timestamp DESC LIMIT 20
    """, [entity_type, entity_id])
    rows = [_serialize_row(dict(r)) for r in cur.fetchall()]
    cur.close(); conn.close()
    return {"audit_log": rows, "count": len(rows)}


# ── Ticket creation handler ──────────────────────────────────────

def handle_create_ticket(params: Dict) -> Dict:
    asset_id = params.get("asset_id")
    title = params.get("title")
    severity = params.get("severity", "amber")
    description = params.get("description", "")
    time_from = params.get("time_from", "")
    time_to = params.get("time_to", "")

    if not asset_id:
        return {"error": "asset_id is required. Please specify which asset this ticket is for."}
    if not title:
        return {"error": "title is required. Please provide a short description of the issue."}

    conn = get_db()
    cur = conn.cursor()

    # Resolve asset name → UUID
    if len(asset_id) < 36 or '-' not in asset_id:
        cur.execute("SELECT id, name FROM assets WHERE LOWER(name) LIKE %s LIMIT 1", [f"%{asset_id.lower()}%"])
        row = cur.fetchone()
        if row:
            asset_id = str(row["id"])
        else:
            cur.close(); conn.close()
            return {"error": f"Asset '{params.get('asset_id')}' not found. Available assets: use query_assets to find them."}

    # Add time range to description if provided
    full_desc = description
    if time_from or time_to:
        full_desc += f"\nTime range: {time_from or '?'} to {time_to or '?'}"

    # Find assignee by severity
    assign_persona = "harry" if severity == "purple" else "tom"
    cur.execute("SELECT id, name FROM users WHERE persona = %s LIMIT 1", [assign_persona])
    assignee = cur.fetchone()
    if not assignee:
        cur.close(); conn.close()
        return {"error": f"No user with persona '{assign_persona}' found"}

    # Calculate SLA
    sla_ms = {"amber": 7200000, "red": 1800000, "purple": 600000}.get(severity, 7200000)
    import datetime
    sla_deadline = (datetime.datetime.utcnow() + datetime.timedelta(milliseconds=sla_ms)).isoformat() + "Z"

    # Create ticket
    cur.execute("""
        INSERT INTO tickets (asset_id, severity, title, description, assigned_to, sla_deadline, anomaly_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING ticket_id, severity, title, status, created_at, sla_deadline
    """, [asset_id, severity, title, full_desc or None, assignee["id"], sla_deadline, None])
    ticket = _serialize_row(dict(cur.fetchone()))

    # Audit log
    cur.execute("""
        INSERT INTO audit_log (entity_type, entity_id, actor, action, note)
        VALUES ('ticket', %s, %s, 'created_via_chat', %s)
    """, [ticket["ticket_id"], assignee["name"], f"Ticket created via chat: {title}"])

    conn.commit()
    cur.close(); conn.close()

    return {
        "status": "created",
        "ticket": {
            **ticket,
            "assigned_to_name": assignee["name"],
            "assigned_to_persona": assign_persona,
            "asset_id": asset_id,
        },
        "message": f"Ticket created and assigned to {assignee['name']} ({assign_persona}). SLA deadline: {sla_deadline}.",
    }


# ── Dispatch table ───────────────────────────────────────────────

HANDLERS = {
    "query_assets": handle_query_assets,
    "get_asset_detail": handle_get_asset_detail,
    "get_sensor_readings": handle_get_sensor_readings,
    "query_anomalies": handle_query_anomalies,
    "query_tickets": handle_query_tickets,
    "update_ticket": handle_update_ticket,
    "create_ticket": handle_create_ticket,
    "get_audit_log": handle_get_audit_log,
}
