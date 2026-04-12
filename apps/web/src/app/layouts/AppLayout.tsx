/**
 * App Layout — Auth-gated shell. Shows SignInPage when not authenticated.
 */

import { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Toaster } from '../components/ui/sonner';
import { AppSidebar } from '../components/AppSidebar';
import { SidebarProvider, SidebarInset } from '../components/ui/sidebar';
import { SignInPage } from '../pages/SignInPage';
import { CommandPalette } from '../components/CommandPalette';
import { toast } from 'sonner';

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  persona?: string;
}

export function AppLayout() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  // Auto-login: check for stored token on mount
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
      fetch(`${API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.ok ? res.json() : Promise.reject())
        .then(({ user }) => setUser(user))
        .catch(() => localStorage.removeItem('auth_token'))
        .finally(() => setCheckingAuth(false));
    } else {
      setCheckingAuth(false);
    }
  }, []);

  const handleSignIn = useCallback(async (email: string, password: string) => {
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
    const response = await fetch(`${API_BASE_URL}/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Invalid credentials');
    }

    const { user, token } = await response.json();
    localStorage.setItem('auth_token', token);
    setUser(user);
    toast.success(`Welcome back, ${user.name}`);
  }, []);

  const handleSignOut = useCallback(() => {
    localStorage.removeItem('auth_token');
    setUser(null);
    toast.success('Signed out');
  }, []);

  const handleNewChat = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const handleChatClick = useCallback((chatId: string) => {
    navigate(`/chat/${chatId}`);
  }, [navigate]);

  // Loading state while checking auth
  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    );
  }

  // Not authenticated — show sign-in page (blocks everything)
  if (!user) {
    return (
      <>
        <SignInPage onSignIn={handleSignIn} />
        <Toaster position="top-right" />
      </>
    );
  }

  // Authenticated — show the app
  return (
    <SidebarProvider>
      <AppSidebar
        user={user}
        onSignOut={handleSignOut}
        onShowAuth={() => {}}
        onNewChat={handleNewChat}
        onChatClick={handleChatClick}
      />
      <SidebarInset>
        <Outlet context={{ user, navigate }} />
      </SidebarInset>
      <CommandPalette onNewChat={handleNewChat} />
      <Toaster position="top-right" />
    </SidebarProvider>
  );
}
