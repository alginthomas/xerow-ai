/**
 * Progress Tracker Component
 * Real-time status feedback for multi-step operations
 * See: https://www.tool-ui.com/docs/progress-tracker
 */

"use client";

import React from 'react';
import { CheckCircle2, Circle, Loader2, XCircle, Clock } from 'lucide-react';
import { cn } from '../../app/components/ui/utils';
import type { ProgressStep } from '../../lib/tool-ui/schemas';
import { SerializableProgressTrackerSchema } from '../../lib/tool-ui/schemas';

interface ProgressTrackerProps {
  id: string;
  steps: ProgressStep[];
  elapsedTime?: number; // Milliseconds
  responseActions?: any;
  onResponseAction?: (actionId: string) => void | Promise<void>;
  receipt?: {
    outcome: 'success' | 'partial' | 'failed' | 'cancelled';
    summary: string;
    at: string;
    identifiers?: Record<string, string>;
  };
}

/**
 * Format elapsed time
 */
function formatElapsedTime(ms: number): string {
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Get step icon based on status
 */
function StepIcon({ status }: { status: ProgressStep['status'] }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    case 'in-progress':
      return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
    case 'failed':
      return <XCircle className="h-5 w-5 text-destructive" />;
    case 'pending':
    default:
      return <Circle className="h-5 w-5 text-muted-foreground" />;
  }
}

/**
 * Get receipt outcome icon
 */
function ReceiptIcon({ outcome }: { outcome: string }) {
  switch (outcome) {
    case 'success':
      return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    case 'failed':
      return <XCircle className="h-5 w-5 text-destructive" />;
    case 'cancelled':
      return <CheckCircle2 className="h-5 w-5 text-muted-foreground" />;
    default:
      return <CheckCircle2 className="h-5 w-5 text-amber-600" />;
  }
}

export function ProgressTracker({
  id,
  steps,
  elapsedTime,
  responseActions,
  onResponseAction,
  receipt,
}: ProgressTrackerProps) {
  // Find current step (in-progress or first pending)
  const currentStepIndex = steps.findIndex(
    (step) => step.status === 'in-progress' || step.status === 'pending'
  );
  const currentStep = currentStepIndex >= 0 ? steps[currentStepIndex] : null;

  // Receipt mode (terminal state)
  if (receipt) {
    return (
      <article
        role="status"
        aria-live="polite"
        className="bg-card border rounded-lg p-6 my-4"
      >
        <div className="flex items-start justify-between mb-4">
          {elapsedTime && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{formatElapsedTime(elapsedTime)}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <ReceiptIcon outcome={receipt.outcome} />
            <span className="text-sm font-medium">{receipt.summary}</span>
          </div>
        </div>

        <ul className="space-y-4">
          {steps.map((step, index) => (
            <li key={step.id} className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <StepIcon status={step.status} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{step.label}</div>
                {step.description && (
                  <div className="text-sm text-muted-foreground mt-1">
                    {step.description}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </article>
    );
  }

  // Active progress mode
  return (
    <article
      role="status"
      aria-live="polite"
      aria-busy={currentStep?.status === 'in-progress'}
      className="bg-card border rounded-lg p-6 my-4"
    >
      {elapsedTime && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Clock className="h-4 w-4" />
          <span>{formatElapsedTime(elapsedTime)}</span>
        </div>
      )}

      <ul className="space-y-4">
        {steps.map((step, index) => {
          const isCurrent = step.id === currentStep?.id;
          const isCompleted = step.status === 'completed';
          const isInProgress = step.status === 'in-progress';
          const isFailed = step.status === 'failed';

          return (
            <li
              key={step.id}
              aria-current={isCurrent ? 'step' : undefined}
              className={cn(
                'flex items-start gap-3 p-3 rounded-md transition-colors',
                isCurrent && 'bg-muted/50'
              )}
            >
              <div className="flex-shrink-0 mt-0.5">
                <StepIcon status={step.status} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{step.label}</div>
                {step.description && (
                  <div className="text-sm text-muted-foreground mt-1">
                    {step.description}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {responseActions && onResponseAction && (
        <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
          {Array.isArray(responseActions) ? (
            responseActions.map((action: any) => (
              <button
                key={action.id}
                onClick={() => onResponseAction(action.id)}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-md transition-colors',
                  action.variant === 'outline'
                    ? 'border border-border hover:bg-muted'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                )}
              >
                {action.label}
              </button>
            ))
          ) : (
            responseActions.items?.map((action: any) => (
              <button
                key={action.id}
                onClick={() => onResponseAction(action.id)}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-md transition-colors',
                  action.variant === 'outline'
                    ? 'border border-border hover:bg-muted'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                )}
              >
                {action.label}
              </button>
            ))
          )}
        </div>
      )}
    </article>
  );
}

/**
 * Error boundary for Progress Tracker
 */
export class ProgressTrackerErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ProgressTracker] Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 my-4">
          <div className="text-sm font-medium text-destructive">
            Failed to render progress tracker
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Parse and validate progress tracker data
 */
export function parseSerializableProgressTracker(
  data: any
): Omit<ProgressTrackerProps, 'onResponseAction'> {
  // Validate against schema
  const validated = SerializableProgressTrackerSchema.parse(data);

  return {
    id: validated.id,
    steps: validated.steps,
    elapsedTime: validated.elapsedTime,
    responseActions: validated.responseActions,
    receipt: validated.receipt,
  };
}

export { SerializableProgressTrackerSchema } from '../../lib/tool-ui/schemas';
export type { SerializableProgressTracker } from '../../lib/tool-ui/schemas';
