import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { BookOpen, LayoutDashboard, TrendingUp } from 'lucide-react';
import Journal from './pages/Journal';
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)' }}>
        {/* Sidebar */}
        <aside style={{
          width: '200px',
          background: 'linear-gradient(180deg, rgba(18, 18, 26, 0.95) 0%, rgba(12, 12, 18, 0.98) 100%)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          backdropFilter: 'blur(20px)',
        }}>
          {/* Logo */}
          <div style={{ padding: '24px', borderBottom: '1px solid var(--border)' }}>
            <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Trading Journal
            </h1>
          </div>

          {/* Nav */}
          <nav style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <NavLink
              to="/"
              end
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 500,
                textDecoration: 'none',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: isActive ? 'var(--bg-elevated)' : 'transparent',
              })}
            >
              <LayoutDashboard size={18} />
              Dashboard
            </NavLink>
            <NavLink
              to="/journal"
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 500,
                textDecoration: 'none',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: isActive ? 'var(--bg-elevated)' : 'transparent',
              })}
            >
              <BookOpen size={18} />
              Journal
            </NavLink>
            <NavLink
              to="/analytics"
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 500,
                textDecoration: 'none',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: isActive ? 'var(--bg-elevated)' : 'transparent',
              })}
            >
              <TrendingUp size={18} />
              Analytics
            </NavLink>
          </nav>
        </aside>

        {/* Main Content */}
        <main style={{ marginLeft: '200px', flex: 1, padding: '40px 48px' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/analytics" element={<Analytics />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
