import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { BookOpen, BookMarked, LayoutDashboard, TrendingUp, CircleDot, Sparkles, Brain } from 'lucide-react';
import { useStore } from './store/useStore';
import { formatCurrency } from './utils/format';
import Journal from './pages/Journal';
import Predictions from './pages/Predictions';
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import Insights from './pages/Insights';
import Rulebook from './pages/Rulebook';
import AIAnalysisPage from './pages/AIAnalysis';
import ToastContainer from './components/Toast';
import './index.css';

function navLinkStyle({ isActive }: { isActive: boolean }): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: isActive ? 600 : 500,
    textDecoration: 'none',
    color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
    background: isActive
      ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(139, 92, 246, 0.06))'
      : 'transparent',
    borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
    position: 'relative',
  };
}

function useSidebarBadges() {
  const openPositionsCount = useStore(s => s.positions.filter(p => p.status === 'open').length);
  const openPredictionsCount = useStore(s => s.predictions.filter(p => p.status === 'open').length);

  return { openPositionsCount, openPredictionsCount };
}

function SidebarPnl() {
  const portfolioSummary = useStore(s => s.portfolioSummary);
  const predictionsSummary = useStore(s => s.predictionsSummary);
  const totalPnl = (portfolioSummary?.realizedPnl ?? 0) + (predictionsSummary?.predictionsPnl ?? 0);
  const isPositive = totalPnl >= 0;

  return (
    <div style={{
      padding: '10px 12px',
      borderRadius: '10px',
      background: isPositive ? 'rgba(52, 211, 153, 0.06)' : 'rgba(248, 113, 113, 0.06)',
      border: `1px solid ${isPositive ? 'rgba(52, 211, 153, 0.12)' : 'rgba(248, 113, 113, 0.12)'}`,
    }}>
      <div style={{
        fontSize: '10px',
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.8px',
        marginBottom: '4px',
        fontWeight: 600,
      }}>
        Realized P&L
      </div>
      <div style={{
        fontFamily: "'DM Mono', monospace",
        fontSize: '16px',
        fontWeight: 500,
        fontVariantNumeric: 'tabular-nums',
        color: isPositive ? 'var(--profit)' : 'var(--loss)',
        textShadow: isPositive
          ? '0 0 20px rgba(52, 211, 153, 0.3)'
          : '0 0 20px rgba(248, 113, 113, 0.3)',
      }}>
        {totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl)}
      </div>
    </div>
  );
}

function App() {
  const { openPositionsCount, openPredictionsCount } = useSidebarBadges();

  return (
    <BrowserRouter>
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)' }}>
        {/* Sidebar */}
        <aside className="sidebar" style={{
          width: '220px',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          backdropFilter: 'blur(20px)',
        }}>
          {/* Logo + P&L Summary */}
          <div style={{ padding: '24px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, var(--accent), var(--accent-dim))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '14px',
                color: '#000',
                letterSpacing: '-0.5px',
                boxShadow: '0 2px 12px var(--accent-glow), 0 0 40px rgba(16, 185, 129, 0.08)',
              }}>
                TJ
              </div>
              <div>
                <h1 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                  Trading Journal
                </h1>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                  Track & analyze
                </p>
              </div>
            </div>

            {/* Mini P&L Card */}
            <SidebarPnl />
          </div>

          {/* Nav */}
          <nav style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
            <NavLink to="/" end style={navLinkStyle}>
              <LayoutDashboard size={18} />
              Dashboard
            </NavLink>
            <NavLink to="/trades" style={navLinkStyle}>
              <BookOpen size={18} />
              <span style={{ flex: 1 }}>Trades</span>
              {openPositionsCount > 0 && (
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  background: 'rgba(52, 211, 153, 0.1)',
                  color: 'var(--profit)',
                  fontFamily: "'DM Mono', monospace",
                }}>
                  {openPositionsCount}
                </span>
              )}
            </NavLink>
            <NavLink to="/predictions" style={navLinkStyle}>
              <CircleDot size={18} />
              <span style={{ flex: 1 }}>Predictions</span>
              {openPredictionsCount > 0 && (
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  background: 'rgba(139, 92, 246, 0.1)',
                  color: 'var(--accent-violet)',
                  fontFamily: "'DM Mono', monospace",
                }}>
                  {openPredictionsCount}
                </span>
              )}
            </NavLink>
            <NavLink to="/insights" style={navLinkStyle}>
              <Sparkles size={18} />
              Insights
            </NavLink>
            <NavLink to="/analytics" style={navLinkStyle}>
              <TrendingUp size={18} />
              Analytics
            </NavLink>
            <NavLink to="/rulebook" style={navLinkStyle}>
              <BookMarked size={18} />
              Rulebook
            </NavLink>
            <NavLink to="/ai-analysis" style={navLinkStyle}>
              <Brain size={18} />
              AI Analysis
            </NavLink>
          </nav>
        </aside>

        {/* Main Content */}
        <main style={{ marginLeft: '220px', flex: 1, padding: '40px 48px' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/trades" element={<Journal />} />
            <Route path="/journal" element={<Navigate to="/trades" replace />} />
            <Route path="/predictions" element={<Predictions />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/rulebook" element={<Rulebook />} />
            <Route path="/ai-analysis" element={<AIAnalysisPage />} />
          </Routes>
        </main>
        <ToastContainer />
      </div>
    </BrowserRouter>
  );
}

export default App;
