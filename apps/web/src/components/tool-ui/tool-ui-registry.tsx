/**
 * Tool UI Component Registry — Xerow AI Industrial Platform
 * Registers tool-specific renderers using makeAssistantToolUI
 */

import { makeAssistantToolUI } from '@assistant-ui/react';
import { AssetListWidget } from './widgets/AssetListWidget';
import { AssetDetailWidget } from './widgets/AssetDetailWidget';
import { AnomalyListWidget } from './widgets/AnomalyListWidget';
import { TicketListWidget } from './widgets/TicketListWidget';
import { TicketActionWidget } from './widgets/TicketActionWidget';
import { SensorReadingsWidget } from './widgets/SensorReadingsWidget';
import { AuditTrailWidget } from './widgets/AuditTrailWidget';

/**
 * query_assets — Asset grid with status indicators
 */
export const QueryAssetsToolUI = makeAssistantToolUI({
  toolName: 'query_assets',
  render: ({ result }) => <AssetListWidget result={result} />,
});

/**
 * get_asset_detail — Rich asset detail card
 */
export const GetAssetDetailToolUI = makeAssistantToolUI({
  toolName: 'get_asset_detail',
  render: ({ result }) => <AssetDetailWidget result={result} />,
});

/**
 * query_anomalies — Severity-coded anomaly list
 */
export const QueryAnomaliesToolUI = makeAssistantToolUI({
  toolName: 'query_anomalies',
  render: ({ result }) => <AnomalyListWidget result={result} />,
});

/**
 * query_tickets — Ticket cards with SLA timers
 */
export const QueryTicketsToolUI = makeAssistantToolUI({
  toolName: 'query_tickets',
  render: ({ result }) => <TicketListWidget result={result} />,
});

/**
 * update_ticket — Action confirmation card
 */
export const UpdateTicketToolUI = makeAssistantToolUI({
  toolName: 'update_ticket',
  render: ({ result }) => <TicketActionWidget result={result} />,
});

/**
 * get_sensor_readings — Sensor data summary
 */
export const GetSensorReadingsToolUI = makeAssistantToolUI({
  toolName: 'get_sensor_readings',
  render: ({ result }) => <SensorReadingsWidget result={result} />,
});

/**
 * get_audit_log — Timeline view
 */
export const GetAuditLogToolUI = makeAssistantToolUI({
  toolName: 'get_audit_log',
  render: ({ result }) => <AuditTrailWidget result={result} />,
});

/**
 * create_ticket — Shows created ticket confirmation
 */
export const CreateTicketToolUI = makeAssistantToolUI({
  toolName: 'create_ticket',
  render: ({ result }) => <TicketActionWidget result={result} />,
});

/**
 * All Tool UI components — mount inside AssistantRuntimeProvider
 */
export const ToolUIComponents = [
  QueryAssetsToolUI,
  GetAssetDetailToolUI,
  QueryAnomaliesToolUI,
  QueryTicketsToolUI,
  UpdateTicketToolUI,
  CreateTicketToolUI,
  GetSensorReadingsToolUI,
  GetAuditLogToolUI,
];
