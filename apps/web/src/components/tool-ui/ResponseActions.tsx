/**
 * Response Actions Component (Tool UI)
 * Lightweight CTAs for human-in-the-loop decision points
 * See: https://www.tool-ui.com/docs/response-actions
 */

import React, { useState, useEffect } from 'react';
import { Button } from '../../app/components/ui/button';
import type { SerializableAction, ResponseActions } from '../../lib/tool-ui/schemas';

interface ResponseActionsProps {
  responseActions: ResponseActions;
  onResponseAction?: (actionId: string) => void;
  onBeforeResponseAction?: (actionId: string) => boolean | Promise<boolean>;
  align?: 'left' | 'right';
  confirmTimeout?: number;
}

export function ResponseActionsComponent({
  responseActions,
  onResponseAction,
  onBeforeResponseAction,
  align: propAlign,
  confirmTimeout: propConfirmTimeout,
}: ResponseActionsProps) {
  // Normalize responseActions to array format
  const actions: SerializableAction[] = Array.isArray(responseActions)
    ? responseActions
    : responseActions.items;

  const align = propAlign || (Array.isArray(responseActions) ? 'right' : responseActions.align) || 'right';
  const confirmTimeout = propConfirmTimeout || (Array.isArray(responseActions) ? 3000 : responseActions.confirmTimeout) || 3000;

  const [confirmingActionId, setConfirmingActionId] = useState<string | null>(null);
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);

  // Clear confirm state after timeout
  useEffect(() => {
    if (confirmingActionId) {
      const timer = setTimeout(() => {
        setConfirmingActionId(null);
      }, confirmTimeout);
      return () => clearTimeout(timer);
    }
  }, [confirmingActionId, confirmTimeout]);

  const handleActionClick = async (action: SerializableAction) => {
    // If action has confirmLabel and not yet confirming, show confirm state
    if (action.confirmLabel && confirmingActionId !== action.id) {
      setConfirmingActionId(action.id);
      return;
    }

    // Check before action hook
    if (onBeforeResponseAction) {
      const shouldProceed = await onBeforeResponseAction(action.id);
      if (!shouldProceed) {
        setConfirmingActionId(null);
        return;
      }
    }

    // Set loading state
    setLoadingActionId(action.id);
    setConfirmingActionId(null);

    try {
      // Call the action handler
      if (onResponseAction) {
        await onResponseAction(action.id);
      }
    } finally {
      // Clear loading state after a brief delay
      setTimeout(() => {
        setLoadingActionId(null);
      }, 500);
    }
  };

  const getButtonVariant = (variant?: string): "default" | "secondary" | "destructive" | "outline" | "ghost" => {
    switch (variant) {
      case 'destructive':
        return 'destructive';
      case 'secondary':
        return 'secondary';
      case 'outline':
        return 'outline';
      case 'ghost':
        return 'ghost';
      default:
        return 'default';
    }
  };

  return (
    <div
      className={`flex flex-wrap gap-2 mt-4 ${align === 'right' ? 'justify-end' : 'justify-start'}`}
    >
      {actions.map((action) => {
        const isConfirming = confirmingActionId === action.id;
        const isLoading = loadingActionId === action.id;
        const displayLabel = isConfirming && action.confirmLabel
          ? action.confirmLabel
          : action.label;

        return (
          <Button
            key={action.id}
            variant={getButtonVariant(action.variant)}
            size="sm"
            disabled={action.disabled || isLoading}
            onClick={() => handleActionClick(action)}
            className="min-w-[80px]"
          >
            {isLoading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                <span>{action.label}</span>
              </>
            ) : (
              displayLabel
            )}
            {action.shortcut && !isLoading && (
              <span className="ml-2 text-xs opacity-60">
                {action.shortcut}
              </span>
            )}
          </Button>
        );
      })}
    </div>
  );
}
