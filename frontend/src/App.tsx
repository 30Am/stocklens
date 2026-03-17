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

export default function App() {
  return (
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
                  </Routes>
                </main>
                <ChatWidget />
              </div>
            </ToastProvider>
          </PortfolioProvider>
        </WatchlistProvider>
      </MarketProvider>
    </BrowserRouter>
  );
}
