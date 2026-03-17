import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MarketProvider } from './context/MarketContext';
import { WatchlistProvider } from './context/WatchlistContext';
import { PortfolioProvider } from './context/PortfolioContext';
import { ToastProvider } from './components/common/ToastProvider';
import { Header } from './components/layout/Header';
import { ChatWidget } from './components/chat/ChatWidget';
import { Dashboard } from './pages/Dashboard';
import { StockDetail } from './pages/StockDetail';
import { News } from './pages/News';
import { CrossMarket } from './pages/CrossMarket';
import { Watchlist } from './pages/Watchlist';
import { Portfolio } from './pages/Portfolio';
import { GeoRisk } from './pages/GeoRisk';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] caught:', error.message);
    console.error('[ErrorBoundary] stack:', error.stack);
    console.error('[ErrorBoundary] component stack:', info.componentStack);
  }
  render() {
    if (this.state.error) {
      const err = this.state.error as Error;
      return (
        <div style={{ padding: 32, fontFamily: 'monospace', color: '#fff', background: '#0a0a0a', minHeight: '100vh' }}>
          <h2 style={{ color: '#f87171', marginBottom: 12 }}>⚠ StockLens Render Error — check console for full trace</h2>
          <pre style={{ color: '#fca5a5', whiteSpace: 'pre-wrap', fontSize: 14, marginBottom: 16 }}>{err.message}</pre>
          <pre style={{ color: '#71717a', whiteSpace: 'pre-wrap', fontSize: 11 }}>{err.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <MarketProvider>
          <WatchlistProvider>
            <PortfolioProvider>
              <ToastProvider>
                <div className="min-h-screen bg-surface-0 flex flex-col">
                  <Header />
                  <main className="flex-1 flex flex-col">
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/stock/:ticker" element={<StockDetail />} />
                      <Route path="/news" element={<News />} />
                      <Route path="/cross-market" element={<CrossMarket />} />
                      <Route path="/watchlist" element={<Watchlist />} />
                      <Route path="/portfolio" element={<Portfolio />} />
                      <Route path="/maps" element={<GeoRisk />} />
                    </Routes>
                  </main>
                  <ChatWidget />
                </div>
              </ToastProvider>
            </PortfolioProvider>
          </WatchlistProvider>
        </MarketProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
