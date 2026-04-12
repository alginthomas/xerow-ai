/**
 * SLA Timer - Countdown display with severity-based color transitions
 * PRD requirement TK-03
 */

import { useEffect, useState } from 'react';
import { cn } from './ui/utils';

interface SlaTimerProps {
  deadline: string;
  className?: string;
  compact?: boolean;
}

function getTimeRemaining(deadline: string) {
  const now = Date.now();
  const end = new Date(deadline).getTime();
  const diff = end - now;

  if (diff <= 0) {
    return { total: diff, hours: 0, minutes: 0, seconds: 0, breached: true, pct: 0 };
  }

  return {
    total: diff,
    hours: Math.floor(diff / (1000 * 60 * 60)),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    breached: false,
    pct: -1, // Caller should compute if they know the original duration
  };
}

function formatRemaining(r: ReturnType<typeof getTimeRemaining>, compact: boolean) {
  if (r.breached) return null;
  if (r.hours > 0) return `${r.hours}h ${r.minutes}m`;
  if (r.minutes > 0) return `${r.minutes}m ${r.seconds}s`;
  return `${r.seconds}s`;
}

function getTimerColor(remaining: ReturnType<typeof getTimeRemaining>) {
  if (remaining.breached) return 'text-severity-red bg-severity-red/15 border-severity-red/30';
  if (remaining.total < 15 * 60 * 1000) return 'text-severity-red bg-severity-red/10 border-severity-red/20'; // < 15 min
  if (remaining.total < 60 * 60 * 1000) return 'text-severity-amber bg-severity-amber/10 border-severity-amber/20'; // < 1 hour
  return 'text-severity-green bg-severity-green/10 border-severity-green/20';
}

export function SlaTimer({ deadline, className, compact = false }: SlaTimerProps) {
  const [remaining, setRemaining] = useState(() => getTimeRemaining(deadline));

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(getTimeRemaining(deadline));
    }, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  // Hide entirely when SLA is breached
  if (remaining.breached) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-xs font-medium tabular-nums',
        getTimerColor(remaining),
        className
      )}
    >
      {!compact && <span className="text-[10px] opacity-70">SLA</span>}
      {formatRemaining(remaining, compact)}
    </span>
  );
}
