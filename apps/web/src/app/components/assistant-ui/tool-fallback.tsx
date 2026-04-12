/**
 * Tool Fallback Component
 * Bridges assistant-ui tool call format to ToolCallRenderer
 * Pure bridge component - no business logic, just data conversion
 */

import { ToolCallRenderer } from '../../../components/chat/ToolCallRenderer';
import type { ToolCallData } from '../../../lib/tool-ui-registry';
import type { ComponentProps } from 'react';
import type { ToolCallMessagePartComponent } from '@assistant-ui/react';

/**
 * Tool fallback component that integrates with the ToolCallRenderer
 * This component receives tool call data from assistant-ui and forwards it to
 * the ToolCallRenderer which handles widget rendering
 *
 * Note: Props are flat (not nested in 'part'), from ToolCallMessagePartComponent
 */
export const ToolFallback: ToolCallMessagePartComponent = (props: ComponentProps<ToolCallMessagePartComponent>) => {
  // Props are spread out: { toolCallId, toolName, args, result, status, ... }
  const { toolCallId, toolName, args, result, status } = props;

  // Determine state based on tool call status
  let state: 'running' | 'complete' | 'error' = 'running';
  if (status.type === 'error') {
    state = 'error';
  } else if (status.type === 'complete') {
    state = 'complete';
  }

  // Create tool call data structure compatible with ToolCallRenderer
  const toolCallData: ToolCallData = {
    type: 'tool-call' as const,
    toolCallId: toolCallId,
    toolName: toolName,
    args: args || {},
    state,
    result: status.type === 'complete' ? result : undefined,
    error: status.type === 'error' ? (result?.error || 'Tool call failed') : undefined
  };

  // Use the existing ToolCallRenderer which handles widget rendering
  return <ToolCallRenderer toolCall={toolCallData} />;
};
