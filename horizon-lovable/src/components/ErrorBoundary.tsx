import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-white p-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-lg text-center shadow-2xl">
            <h2 className="text-xl font-bold text-amber-400 mb-2">Notice: Engine Reloading</h2>
            <p className="text-slate-400 text-sm mb-6">
              {this.state.error?.message || 'A graphics engine event occurred.'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              Restart Game Engine
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
