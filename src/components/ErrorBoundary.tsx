import React from 'react';
import { RotateCcw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    let message = error.message || 'An unexpected error occurred.';
    try {
      const parsed = JSON.parse(message);
      if (parsed && typeof parsed.error === 'string') {
        message = `${parsed.operationType?.toUpperCase() || 'SYNC'} failed on ${parsed.path || 'database'}: ${parsed.error}`;
      }
    } catch {
      // Plain error message
    }
    return { hasError: true, message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('LastOneStanding ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full items-center justify-center bg-[#11161D] p-6 text-slate-100">
          <div className="w-full max-w-md rounded-xl border border-slate-700/70 bg-[#1A212C] p-6 shadow-2xl">
            <h2 className="font-display text-2xl font-bold tracking-wide text-slate-50">
              Connection Interrupted
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                window.location.href = window.location.pathname;
              }}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
            >
              <RotateCcw className="h-4 w-4" />
              Return to Arena Menu
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
