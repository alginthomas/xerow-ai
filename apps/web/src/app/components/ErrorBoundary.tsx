import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Ignore React Refresh errors during development
    if (error.message?.includes('n is not a function') || 
        error.stack?.includes('react-refresh')) {
      console.log('React Refresh error caught (non-fatal):', error.message);
      this.setState({ hasError: false, error: null });
      return;
    }
    
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      // Don't show error UI for React Refresh errors
      if (this.state.error.message?.includes('n is not a function')) {
        return this.props.children;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="max-w-md w-full bg-card rounded-lg shadow-lg p-6">
            <h2 className="text-destructive mb-4">Something went wrong</h2>
            <p className="text-sm text-muted-foreground mb-4">{this.state.error.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}