/**
 * Settings Page - Platform configuration
 * Placeholder
 */

import { Settings } from 'lucide-react';

export function SettingsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground">Platform configuration and preferences</p>
      </div>
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <Settings className="h-10 w-10" />
          <p>Settings will be implemented in a later phase</p>
        </div>
      </div>
    </div>
  );
}
