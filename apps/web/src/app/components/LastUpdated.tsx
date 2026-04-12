/**
 * LastUpdated — Shows relative timestamp with stale data warning
 * "Just now" / "3m ago" / "⚠ 15m ago (stale)"
 */

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from './ui/utils';

interface LastUpdatedProps {
  timestamp: Date | null;
  onRefresh?: () => void;
  staleThresholdMs?: number; // default 10 minutes
  className?: string;
}

function formatAgo(ts: Date): string {
  const diff = Date.now() - ts.getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 10) return 'Just now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}

export function LastUpdated({
  timestamp,
  onRefresh,
  staleThresholdMs = 10 * 60 * 1000,
  className,
}: LastUpdatedProps) {
  const [, setTick] = useState(0);

  // Re-render every 15 seconds to keep the "X ago" fresh
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 15000);
    return () => clearInterval(interval);
  }, []);

  if (!timestamp) return null;

  const isStale = Date.now() - timestamp.getTime() > staleThresholdMs;

  return (
    <div className={cn('flex items-center gap-1.5 text-[11px]', className)}>
      <span className={cn(
        'tabular-nums',
        isStale ? 'text-severity-amber' : 'text-muted-foreground/60'
      )}>
        {isStale && '⚠ '}
        {formatAgo(timestamp)}
      </span>
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="p-0.5 rounded hover:bg-accent/50 text-muted-foreground/50 hover:text-foreground transition-colors cursor-pointer"
          aria-label="Refresh data"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
