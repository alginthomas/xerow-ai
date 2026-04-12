/**
 * Default Tool Widget
 * Fallback widget for unregistered tools
 * Shows tool name, state, collapsible args/result
 */

import React, { useState } from 'react';
import { Card } from '../../../app/components/ui/card';
import { Badge } from '../../../app/components/ui/badge';
import { Button } from '../../../app/components/ui/button';
import type { ToolCallData } from '../../../lib/tool-ui-registry';
import { ChevronDown, ChevronUp, Loader2, CheckCircle2, XCircle } from 'lucide-react';

interface DefaultToolWidgetProps {
  toolCall: ToolCallData;
}

export function DefaultToolWidget({ toolCall }: DefaultToolWidgetProps) {
  const [showArgs, setShowArgs] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const { toolName, args, result, state, error } = toolCall;

  const getStateIcon = () => {
    switch (state) {
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'complete':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return null;
    }
  };

  const getStateBadge = () => {
    switch (state) {
      case 'running':
        return <Badge variant="secondary">Running</Badge>;
      case 'complete':
        return <Badge variant="default" className="bg-green-500">Complete</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card className="my-2 p-4 border-border bg-card">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStateIcon()}
            <span className="text-sm font-medium text-foreground">Tool: {toolName}</span>
          </div>
          {getStateBadge()}
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-2 bg-destructive/10 border border-destructive/20 rounded text-xs text-destructive">
            {error}
          </div>
        )}

        {/* Arguments Section */}
        {args && Object.keys(args).length > 0 && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between h-8"
              onClick={() => setShowArgs(!showArgs)}
            >
              <span className="text-xs text-muted-foreground">Arguments</span>
              {showArgs ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </Button>
            {showArgs && (
              <div className="mt-2 p-3 bg-muted/50 rounded border border-border/50">
                <pre className="text-xs text-muted-foreground overflow-auto">
                  {JSON.stringify(args, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Result Section */}
        {result !== undefined && state === 'complete' && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between h-8"
              onClick={() => setShowResult(!showResult)}
            >
              <span className="text-xs text-muted-foreground">Result</span>
              {showResult ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </Button>
            {showResult && (
              <div className="mt-2 p-3 bg-muted/50 rounded border border-border/50">
                <pre className="text-xs text-muted-foreground overflow-auto">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
