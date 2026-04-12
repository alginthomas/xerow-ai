/**
 * Agents Page - AI agent monitoring
 * Placeholder - will be expanded in later phases
 */

import { Bot } from 'lucide-react';

export function AgentsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Agents</h1>
        <p className="text-muted-foreground">AI agent monitoring and performance</p>
      </div>
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <Bot className="h-10 w-10" />
          <p>Agent monitoring will be implemented in a later phase</p>
        </div>
      </div>
    </div>
  );
}
