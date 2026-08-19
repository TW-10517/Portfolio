import { Component } from "react";

// Catches render/lifecycle errors anywhere below it so one broken component
// (a bad portfolio field, a canvas rendering bug, etc.) shows a recoverable
// screen instead of a permanently blank page. Does not catch errors in event
// handlers or async code — those are already caught locally where they occur.
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Unhandled UI error:", error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
          <div className="w-full max-w-sm text-center">
            <div className="inline-flex items-center gap-2 text-white font-head font-bold text-lg mb-6">
              <span className="text-xl">🧩</span> Portfolio Builder
            </div>
            <h1 className="text-xl font-head font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-sm text-slate-400 mb-6">
              This part of the app hit an unexpected error. Your data is safe — reloading usually fixes it.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium bg-gradient-to-r from-cyan-400 to-violet-500 text-slate-950 hover:shadow-lg hover:shadow-cyan-500/25 transition"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
