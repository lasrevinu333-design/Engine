import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryState {
  error: Error | null;
}

export class ShellErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    window.dispatchEvent(new CustomEvent('mz:shell-error', {
      detail: {
        name: error.name,
        route: window.location.hash || '/',
        componentStack: info.componentStack,
      },
    }));
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <main className="shellFatal" role="alert">
        <p className="eyebrow">Memphis Zoo App</p>
        <h1>The app shell could not open.</h1>
        <p>Your existing app pages are still available.</p>
        <button type="button" onClick={() => window.location.replace('./index.html')}>
          Open current app
        </button>
      </main>
    );
  }
}
