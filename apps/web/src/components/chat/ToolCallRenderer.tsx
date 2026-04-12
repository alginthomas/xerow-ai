/**
 * Tool Call Renderer
 * Routes tool calls to appropriate display locations (inline or panel)
 * Widgets access context directly via useChatContext() hook
 */

import React from 'react';
import { toolRegistry } from '../../lib/tool-ui-registry';
import type { ToolCallData } from '../../lib/tool-ui-registry';

// ============================================================================
// Types and Constants
// ============================================================================

type RenderingStrategy = 'panel' | 'inline' | 'none';

interface ToolCallRendererProps {
  toolCall: ToolCallData;
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Panel indicator component shown when tool is routed to panel
 * (For future panel/sidebar rendering support)
 */
function PanelIndicator({ toolCall }: { toolCall: ToolCallData }) {
  return (
    <div className="my-2 p-3 bg-muted border border-border rounded-lg">
      <div className="flex items-center gap-2 text-card-foreground">
        <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
        <span className="text-sm font-medium">Tool routed to panel</span>
        <span className="text-xs text-muted-foreground ml-auto">→ View in panel</span>
      </div>
    </div>
  );
}

/**
 * Inline widget component for tools that render directly in chat
 */
function InlineWidget({
  toolCall,
  sessionId
}: {
  toolCall: ToolCallData;
  sessionId?: string;
}) {
  const CustomWidget = toolRegistry.getWidget(toolCall.toolName);

  if (CustomWidget) {
    return (
      <CustomWidget
        toolCall={toolCall}
        sessionId={sessionId}
      />
    );
  }

  // No widget registered - show basic info
  return (
    <div className="my-2 p-3 bg-muted border border-border rounded-lg">
      <div className="text-sm font-medium text-muted-foreground">
        Tool: {toolCall.toolName}
      </div>
      {toolCall.state === 'running' && (
        <div className="text-xs text-muted-foreground mt-1">Executing...</div>
      )}
      {toolCall.state === 'complete' && toolCall.result && (
        <div className="text-xs text-muted-foreground mt-1">
          Completed
        </div>
      )}
      {toolCall.state === 'error' && toolCall.error && (
        <div className="text-xs text-destructive mt-1">
          Error: {toolCall.error}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determines the rendering strategy for a tool call
 * @param toolName - The name of the tool
 * @returns The rendering strategy to use
 */
function getRenderingStrategy(toolName: string): RenderingStrategy {
  if (toolRegistry.shouldRenderInPanel(toolName)) {
    return 'panel';
  }

  if (toolRegistry.getWidget(toolName)) {
    return 'inline';
  }

  return 'inline'; // Default to inline for now
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Tool call renderer that routes tool calls to appropriate display locations
 * @param toolCall - The tool call data to render
 * @returns The appropriate UI component based on tool type
 */
export function ToolCallRenderer({
  toolCall,
}: ToolCallRendererProps) {
  const strategy = getRenderingStrategy(toolCall.toolName);

  // Handle panel routing
  if (strategy === 'panel') {
    return <PanelIndicator toolCall={toolCall} />;
  }

  // Handle inline rendering
  if (strategy === 'inline') {
    return (
      <InlineWidget
        toolCall={toolCall}
      />
    );
  }

  // No rendering strategy found
  return null;
}
