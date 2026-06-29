'use client';
import { Component } from 'react';

const CHUNK_RE =
  /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk \d+ failed/i;

export class RouteErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    const message = String(error?.message || error || '');
    if (!CHUNK_RE.test(message) || typeof window === 'undefined') return;

    const key = 'odin_chunk_reload';
    try {
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        window.location.reload();
      } else {
        sessionStorage.removeItem(key);
      }
    } catch {
      /* ignore storage errors */
    }
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="route-error-boundary">
          <h1 className="route-error-boundary__title">Something went wrong</h1>
          <p className="route-error-boundary__msg">
            {String(this.state.error?.message || 'Unexpected error')}
          </p>
          <button
            type="button"
            className="route-error-boundary__retry"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
