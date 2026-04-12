/**
 * Tool UI Registry
 * Maps tool names to UI widget components
 */

import { ComponentType } from 'react';

export interface ToolCallData {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  args: Record<string, any>;
  state: 'running' | 'complete' | 'error';
  result?: any;
  error?: string;
}

export interface ToolWidgetProps {
  toolCall: ToolCallData;
  sessionId?: string;
}

export type ToolWidget = ComponentType<ToolWidgetProps>;

/**
 * Registry for mapping tool names to UI widgets
 */
export class ToolUIRegistry {
  private exactMatches: Map<string, ToolWidget> = new Map();
  private patterns: Array<{ pattern: RegExp; widget: ToolWidget }> = [];
  private panelOnlyTools: Set<string> = new Set();
  private defaultWidget: ToolWidget | null = null;

  /**
   * Register a widget for an exact tool name match
   */
  register(toolName: string, widget: ToolWidget): void {
    this.exactMatches.set(toolName, widget);
  }

  /**
   * Register a widget for a pattern-based match
   * @param pattern - String with wildcards (*) or RegExp
   */
  registerPattern(pattern: string | RegExp, widget: ToolWidget): void {
    const regex =
      typeof pattern === 'string' ? new RegExp(pattern.replace(/\*/g, '.*')) : pattern;
    this.patterns.push({ pattern: regex, widget });
  }

  /**
   * Register a default widget for all tools without exact or pattern matches
   * This widget will be used as a fallback for any unregistered tools
   */
  registerDefault(widget: ToolWidget): void {
    this.defaultWidget = widget;
  }

  /**
   * Mark a tool as panel-only (should not render inline in chat)
   */
  markAsPanelOnly(toolName: string): void {
    this.panelOnlyTools.add(toolName);
  }

  /**
   * Check if a tool should render in panel instead of inline
   */
  shouldRenderInPanel(toolName: string): boolean {
    return this.panelOnlyTools.has(toolName);
  }

  /**
   * Look up a widget for a tool name
   * Returns default widget if no exact or pattern match found
   * Returns null only if no default widget registered
   */
  getWidget(toolName: string): ToolWidget | null {
    // Check exact match first
    const exactMatch = this.exactMatches.get(toolName);
    if (exactMatch) return exactMatch;

    // Check patterns in registration order
    for (const { pattern, widget } of this.patterns) {
      if (pattern.test(toolName)) return widget;
    }

    // Return default widget if no match found
    if (this.defaultWidget) {
      return this.defaultWidget;
    }

    return null;
  }
}

// Global registry instance
export const toolRegistry = new ToolUIRegistry();
