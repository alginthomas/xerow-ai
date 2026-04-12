/**
 * SignInPage — Full-page sign in screen, blocks access to the app
 */

import { useState } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import Group427320662 from '../../imports/Group427320662';

interface SignInPageProps {
  onSignIn: (email: string, password: string) => Promise<void>;
}

export function SignInPage({ onSignIn }: SignInPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setError('');
    setLoading(true);
    try {
      await onSignIn(email, password);
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo + Branding */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 mx-auto">
            <Group427320662 />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Xerow AI</h1>
        </div>

        {/* Sign In Card */}
        <Card className="border-border/50">
          <CardContent className="pt-6 space-y-5">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">Sign in</h2>
              <p className="text-sm text-muted-foreground">Enter your credentials to access the platform</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tom@xerow.ai"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Test accounts hint */}
        <div className="text-center space-y-2">
          <p className="text-xs text-muted-foreground/60">Test accounts</p>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              { label: 'Tom', email: 'tom@xerow.ai', desc: 'Field Operator' },
              { label: 'Dick', email: 'dick@xerow.ai', desc: 'Field Manager' },
              { label: 'Harry', email: 'harry@xerow.ai', desc: 'Chief Operator' },
            ].map((account) => (
              <button
                key={account.email}
                onClick={() => { setEmail(account.email); setPassword('password123'); }}
                className="rounded-lg border border-border/40 bg-card/50 px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent/40 hover:text-foreground transition-colors cursor-pointer"
              >
                <span className="font-medium">{account.label}</span>
                <span className="text-muted-foreground/60 ml-1">— {account.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
