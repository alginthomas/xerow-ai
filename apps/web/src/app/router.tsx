/**
 * Application Router - Xerow AI Industrial Platform
 */

import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { ChatHome } from './pages/ChatHome';
import { OverviewPage } from './pages/OverviewPage';
import { AssetListPage } from './pages/AssetListPage';
import { AssetDetailPage } from './pages/AssetDetailPage';
import { TicketsPage } from './pages/TicketsPage';
import { TicketDetailPage } from './pages/TicketDetailPage';
import { EscalationPage } from './pages/EscalationPage';
import { AgentsPage } from './pages/AgentsPage';
import { AnomaliesPage } from './pages/AnomaliesPage';
import { TurbineMonitorPage } from './pages/TurbineMonitorPage';
import { SettingsPage } from './pages/SettingsPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <ChatHome /> },
      { path: 'chat/:chatId', element: <ChatHome /> },
      { path: 'overview', element: <OverviewPage /> },
      { path: 'assets/turbines', element: <AssetListPage assetType="turbine" /> },
      { path: 'assets/pipelines', element: <AssetListPage assetType="pipeline" /> },
      { path: 'assets/wells', element: <AssetListPage assetType="well" /> },
      { path: 'assets/:id', element: <AssetDetailPage /> },
      { path: 'monitor/:id', element: <TurbineMonitorPage /> },
      { path: 'anomalies', element: <AnomaliesPage /> },
      { path: 'tickets', element: <TicketsPage /> },
      { path: 'tickets/:id', element: <TicketDetailPage /> },
      { path: 'escalation', element: <EscalationPage /> },
      { path: 'agents', element: <AgentsPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
]);
