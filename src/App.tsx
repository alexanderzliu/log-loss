import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { useState, useEffect, type CSSProperties } from 'react';
import { BookOpen, LayoutDashboard, TrendingUp, Sun, Moon } from 'lucide-react';
import Journal from './pages/Journal';
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import './index.css';

function navLinkStyle({ isActive }: { isActive: boolean }): CSSProperties {
  return {
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
  };
}

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved === 'light' || saved === 'dark') ? saved : 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  return (
    <BrowserRouter>
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)' }}>
        {/* Sidebar */}
        <aside className="sidebar" style={{
          width: '200px',
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
          <nav style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
            <NavLink to="/" end style={navLinkStyle}>
              <LayoutDashboard size={18} />
              Dashboard
            </NavLink>
            <NavLink to="/journal" style={navLinkStyle}>
              <BookOpen size={18} />
              Journal
            </NavLink>
            <NavLink to="/analytics" style={navLinkStyle}>
              <TrendingUp size={18} />
              Analytics
            </NavLink>
          </nav>

          {/* Theme Toggle */}
          <div style={{ padding: '16px', borderTop: '1px solid var(--border)' }}>
            <button
              onClick={toggleTheme}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '12px 16px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--text-secondary)',
                background: 'transparent',
                border: '1px solid var(--border)',
                cursor: 'pointer',
              }}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </button>
          </div>
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
