"""
Xerow AI Industrial Platform - Tool Definitions for OpenAI Function Calling
"""

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "query_assets",
            "description": "Search and list monitored field assets (turbines, pipelines, wells). Use when user asks about asset status, health, or wants to view assets in a region.",
            "parameters": {
                "type": "object",
                "properties": {
                    "type": {"type": "string", "enum": ["turbine", "pipeline", "well"], "description": "Filter by asset type"},
                    "region": {"type": "string", "description": "Filter by region name"},
                    "status": {"type": "string", "enum": ["operational", "degraded", "offline", "maintenance"], "description": "Filter by asset status"}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_asset_detail",
            "description": "Get detailed information about a specific asset including its sensors, recent anomalies, and open tickets.",
            "parameters": {
                "type": "object",
                "properties": {
                    "asset_id": {"type": "string", "description": "UUID of the asset"}
                },
                "required": ["asset_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_sensor_readings",
            "description": "Retrieve time-series sensor readings for a specific sensor. Returns chart data with readings, baseline bounds, and recent anomalies. Use when user asks for data, readings, chart, live data, or sensor data.",
            "parameters": {
                "type": "object",
                "properties": {
                    "sensor_id": {"type": "string", "description": "UUID of the sensor"},
                    "from_time": {"type": "string", "description": "Start time ISO 8601 (default: 24h ago)"},
                    "to_time": {"type": "string", "description": "End time ISO 8601 (default: now)"}
                },
                "required": ["sensor_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "query_anomalies",
            "description": "Search detected anomalies. Supports filtering by severity (green/amber/red/purple), status, asset, and date range.",
            "parameters": {
                "type": "object",
                "properties": {
                    "asset_id": {"type": "string", "description": "Filter by asset UUID"},
                    "severity": {"type": "string", "enum": ["green", "amber", "red", "purple"], "description": "Filter by severity"},
                    "status": {"type": "string", "enum": ["logged", "ticket_open", "ticket_closed", "false_positive", "dismissed"], "description": "Filter by status"},
                    "date_from": {"type": "string", "description": "Start date ISO 8601"},
                    "date_to": {"type": "string", "description": "End date ISO 8601"}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "query_tickets",
            "description": "Search agentic tickets. Results sorted by severity and SLA urgency. Use when user asks about tickets, SLA, or their work queue.",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {"type": "string", "enum": ["open", "acknowledged", "under_review", "escalated", "closed", "false_positive"], "description": "Filter by status"},
                    "severity": {"type": "string", "enum": ["amber", "red", "purple"], "description": "Filter by severity"},
                    "assigned_to": {"type": "string", "description": "Filter by user name (e.g. 'Tom'), persona (e.g. 'tom'), or UUID"},
                    "sla_breached": {"type": "boolean", "description": "Only show SLA-breached tickets"}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "update_ticket",
            "description": "Perform an action on a ticket: acknowledge, add note, escalate, or resolve.",
            "parameters": {
                "type": "object",
                "properties": {
                    "ticket_id": {"type": "string", "description": "UUID of the ticket"},
                    "action": {"type": "string", "enum": ["acknowledge", "note", "escalate", "resolve"], "description": "Action to perform"},
                    "note": {"type": "string", "description": "Note/reason text for the action"}
                },
                "required": ["ticket_id", "action"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_audit_log",
            "description": "Retrieve the immutable audit trail for a ticket, anomaly, or asset.",
            "parameters": {
                "type": "object",
                "properties": {
                    "entity_type": {"type": "string", "enum": ["ticket", "anomaly", "asset", "agent"], "description": "Type of entity"},
                    "entity_id": {"type": "string", "description": "UUID of the entity"}
                },
                "required": ["entity_type", "entity_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_ticket",
            "description": "Create a new ticket for an asset. Requires asset_id (or asset name) and title. If the user hasn't specified severity, default to amber. Ask the user for missing details before calling this tool.",
            "parameters": {
                "type": "object",
                "properties": {
                    "asset_id": {"type": "string", "description": "UUID or name of the asset (e.g. 'Turbine T-01')"},
                    "title": {"type": "string", "description": "Short description of the issue"},
                    "severity": {"type": "string", "enum": ["amber", "red", "purple"], "description": "Severity level (default: amber)"},
                    "description": {"type": "string", "description": "Detailed description including time range if applicable"},
                    "time_from": {"type": "string", "description": "Start time of observed issue (ISO 8601, optional)"},
                    "time_to": {"type": "string", "description": "End time of observed issue (ISO 8601, optional)"}
                },
                "required": ["asset_id", "title"]
            }
        }
    }
]
