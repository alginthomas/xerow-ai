import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string, name: string, role: string) => Promise<void>;
}

export function AuthModal({ open, onClose, onSignIn, onSignUp }: AuthModalProps) {
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpName, setSignUpName] = useState('');
  const [signUpRole, setSignUpRole] = useState('customer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('signin');

  // Clear error when switching tabs
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setError('');
  };

  const handleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      await onSignIn(signInEmail, signInPassword);
      onClose();
    } catch (err: any) {
      console.error('Auth error:', err);
      // Provide more helpful error messages
      if (err.message?.includes('Invalid login credentials')) {
        setError('Invalid email or password. Please check your credentials or sign up for a new account.');
      } else if (err.message?.includes('Email not confirmed')) {
        setError('Please confirm your email address before signing in.');
      } else {
        setError(err.message || 'Failed to sign in');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    setError('');
    setLoading(true);
    try {
      await onSignUp(signUpEmail, signUpPassword, signUpName, signUpRole);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to sign up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-background border-border">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-foreground">Welcome to Xerow</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Sign in to your account or create a new one to start shopping
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'signin' | 'signup')} className="mt-4">
          <TabsList className="grid w-full grid-cols-2 bg-muted">
            <TabsTrigger value="signin" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Sign In
            </TabsTrigger>
            <TabsTrigger value="signup" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Sign Up
            </TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="space-y-4">
            <div className="text-sm text-muted-foreground bg-accent p-3 rounded-lg border border-border">
              <strong className="text-foreground">First time here?</strong> Switch to the Sign Up tab to create an account.
            </div>
            <div className="space-y-2">
              <Label htmlFor="signin-email" className="text-foreground">Email</Label>
              <Input
                id="signin-email"
                type="email"
                placeholder="your@email.com"
                value={signInEmail}
                onChange={(e) => setSignInEmail(e.target.value)}
                className="bg-background border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signin-password" className="text-foreground">Password</Label>
              <Input
                id="signin-password"
                type="password"
                placeholder="••••••••"
                value={signInPassword}
                onChange={(e) => setSignInPassword(e.target.value)}
                className="bg-background border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button 
              onClick={handleSignIn} 
              disabled={loading || !signInEmail || !signInPassword}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </TabsContent>

          <TabsContent value="signup" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signup-name" className="text-foreground">Full Name</Label>
              <Input
                id="signup-name"
                placeholder="John Doe"
                value={signUpName}
                onChange={(e) => setSignUpName(e.target.value)}
                className="bg-background border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-email" className="text-foreground">Email</Label>
              <Input
                id="signup-email"
                type="email"
                placeholder="your@email.com"
                value={signUpEmail}
                onChange={(e) => setSignUpEmail(e.target.value)}
                className="bg-background border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-password" className="text-foreground">Password</Label>
              <Input
                id="signup-password"
                type="password"
                placeholder="••••••••"
                value={signUpPassword}
                onChange={(e) => setSignUpPassword(e.target.value)}
                className="bg-background border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Account Type</Label>
              <RadioGroup value={signUpRole} onValueChange={setSignUpRole} className="space-y-3">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="customer" id="customer" className="border-border text-primary" />
                  <Label htmlFor="customer" className="font-normal cursor-pointer text-foreground">
                    Customer - Browse and buy products
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="seller" id="seller" className="border-border text-primary" />
                  <Label htmlFor="seller" className="font-normal cursor-pointer text-foreground">
                    Seller - Manage products and inventory
                  </Label>
                </div>
              </RadioGroup>
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button 
              onClick={handleSignUp} 
              disabled={loading || !signUpEmail || !signUpPassword || !signUpName}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}