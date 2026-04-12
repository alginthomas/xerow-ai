/**
 * Register Tool Widgets
 * Legacy registry initialization — industrial tools use makeAssistantToolUI in tool-ui-registry.tsx
 */

import { toolRegistry } from './tool-ui-registry';
import { DefaultToolWidget } from '../components/chat/widgets/DefaultToolWidget';

/**
 * Register fallback widget for any unmatched tools
 */
export function registerToolWidgets() {
  toolRegistry.registerDefault(DefaultToolWidget);
}
