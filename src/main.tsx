import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('Salery Bingo UI Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '24px', color: '#fff', backgroundColor: '#090d16', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', textAlign: 'center' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: '#f59e0b', marginBottom: '12px' }}>ሳለሪ ቢንጎ (Salery Bingo)</h2>
          <p style={{ color: '#94a3b8', marginBottom: '20px' }}>ገጹን እንደገና በመጫን ይሞክሩ</p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '10px 24px', backgroundColor: '#f59e0b', color: '#000', fontWeight: 'bold', borderRadius: '12px', border: 'none', cursor: 'pointer' }}
          >
            🔄 እንደገና ጫን (Reload)
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
