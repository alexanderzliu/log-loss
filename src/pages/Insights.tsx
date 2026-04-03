import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Lightbulb, CheckCircle, GraduationCap, AlertTriangle, ExternalLink } from 'lucide-react';
import { fetchInsightsFeed } from '../api/reflections';
import { formatCurrency, formatDate } from '../utils/format';
import { isDateInRange } from '../utils/tradeFilters';
import FilterPills from '../components/FilterPills';
import PageTransition from '../components/PageTransition';
import { FilterDropdown, DateRangeFilter, FilterToggleButton, FilterPanel } from '../components/FilterControls';
import type { InsightFeedItem } from '../types';

const TYPE_CONFIG: Record<InsightFeedItem['type'], {
  label: string;
  icon: typeof Lightbulb;
  color: string;
  bg: string;
  border: string;
}> = {
  hypothesis: {
    label: 'Hypothesis',
    icon: Lightbulb,
    color: 'var(--accent-violet)',
    bg: 'rgba(139, 92, 246, 0.1)',
    border: 'rgba(139, 92, 246, 0.2)',
  },
  success: {
    label: 'Success',
    icon: CheckCircle,
    color: 'var(--profit)',
    bg: 'rgba(52, 211, 153, 0.1)',
    border: 'rgba(52, 211, 153, 0.2)',
  },
  lesson: {
    label: 'Lesson',
    icon: GraduationCap,
    color: 'var(--accent-violet)',
    bg: 'rgba(139, 92, 246, 0.1)',
    border: 'rgba(139, 92, 246, 0.2)',
  },
  mistake: {
    label: 'Mistake',
    icon: AlertTriangle,
    color: 'var(--accent-warm)',
    bg: 'rgba(245, 158, 11, 0.1)',
    border: 'rgba(245, 158, 11, 0.2)',
  },
};

function groupByMonth(items: InsightFeedItem[]): { month: string; items: InsightFeedItem[] }[] {
  const groups = new Map<string, InsightFeedItem[]>();
  for (const item of items) {
    const d = new Date(item.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return Array.from(groups.entries()).map(([key, items]) => {
    const [year, month] = key.split('-');
    const label = new Date(Number(year), Number(month) - 1).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
    });
    return { month: label, items };
  });
}

export default function Insights() {
  const navigate = useNavigate();
  const [feed, setFeed] = useState<InsightFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  // Advanced filters
  const [underlyingFilter, setUnderlyingFilter] = useState('');
  const [strategyFilter, setStrategyFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const loadFeed = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchInsightsFeed({
        search: search || undefined,
      });
      setFeed(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load insights');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(loadFeed, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  // Available filter options from data
  const filterOptions = useMemo(() => {
    const underlyings = new Set<string>();
    const strategies = new Set<string>();
    for (const item of feed) {
      if (item.underlying) underlyings.add(item.underlying);
      if (item.strategy) strategies.add(item.strategy);
    }
    return {
      underlyings: Array.from(underlyings).sort(),
      strategies: Array.from(strategies).sort(),
    };
  }, [feed]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (underlyingFilter) count++;
    if (strategyFilter) count++;
    if (dateFrom || dateTo) count++;
    return count;
  }, [underlyingFilter, strategyFilter, dateFrom, dateTo]);

  const clearAllFilters = () => {
    setUnderlyingFilter('');
    setStrategyFilter('');
    setDateFrom('');
    setDateTo('');
  };

  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { all: feed.length };
    for (const item of feed) {
      counts[item.type] = (counts[item.type] || 0) + 1;
    }
    return counts;
  }, [feed]);

  const filteredFeed = useMemo(() => {
    return feed.filter((item) => {
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (underlyingFilter && item.underlying !== underlyingFilter) return false;
      if (strategyFilter && item.strategy !== strategyFilter) return false;
      if ((dateFrom || dateTo) && !isDateInRange(item.date.slice(0, 10), dateFrom || null, dateTo || null)) return false;
      return true;
    });
  }, [feed, typeFilter, underlyingFilter, strategyFilter, dateFrom, dateTo]);

  const grouped = useMemo(() => groupByMonth(filteredFeed), [filteredFeed]);

  const searchBox = (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '8px 14px',
      minWidth: '240px',
    }}>
      <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search insights..."
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-primary)',
          fontSize: '14px',
          outline: 'none',
          width: '100%',
          padding: 0,
        }}
      />
    </div>
  );

  return (
    <PageTransition>
      <div className="page-container">
        {/* Header */}
        <div style={{ marginBottom: '40px' }}>
          <h1 className="page-header">Insights</h1>
          <p className="page-subtitle">Your trade hypotheses, reflections, and lessons</p>
        </div>

        {/* Search + Filters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
          {/* Top row: always one compact line */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <FilterPills
              options={[
                { key: 'all', label: 'All', count: filterCounts.all || 0 },
                { key: 'hypothesis', label: 'Hypotheses', count: filterCounts.hypothesis || 0 },
                { key: 'success', label: 'Successes', count: filterCounts.success || 0 },
                { key: 'lesson', label: 'Lessons', count: filterCounts.lesson || 0 },
                { key: 'mistake', label: 'Mistakes', count: filterCounts.mistake || 0 },
              ]}
              active={typeFilter}
              onChange={setTypeFilter}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FilterToggleButton
                activeCount={activeFilterCount}
                isOpen={showFilters}
                onToggle={() => setShowFilters((v) => !v)}
              />
              {searchBox}
            </div>
          </div>

          {/* Expanded filter panel: separate section below */}
          <FilterPanel isOpen={showFilters}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-start' }}>
              <FilterDropdown
                label="Underlying"
                value={underlyingFilter}
                options={filterOptions.underlyings}
                onChange={setUnderlyingFilter}
              />
              <FilterDropdown
                label="Strategy"
                value={strategyFilter}
                options={filterOptions.strategies}
                onChange={setStrategyFilter}
                formatLabel={(s) => s.replace(/_/g, ' ')}
              />
              <DateRangeFilter
                from={dateFrom}
                to={dateTo}
                onChange={(from, to) => { setDateFrom(from); setDateTo(to); }}
              />
              {activeFilterCount > 0 && (
                <button
                  onClick={clearAllFilters}
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'var(--text-muted)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    transition: 'color 0.15s ease',
                    alignSelf: 'center',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                  Clear all
                </button>
              )}
            </div>
          </FilterPanel>
        </div>

        {/* Feed */}
        {error ? (
          <div className="card empty-state">
            <p style={{ color: 'var(--loss)', marginBottom: '8px' }}>{error}</p>
            <button onClick={loadFeed} className="btn-ghost" style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
              Retry
            </button>
          </div>
        ) : loading ? (
          <div className="card empty-state">
            <p className="empty-state-text">Loading...</p>
          </div>
        ) : feed.length === 0 ? (
          <div className="card empty-state">
            <p className="empty-state-title" style={{ fontSize: '16px', fontWeight: 600 }}>No insights yet</p>
            <p className="empty-state-text">
              Add hypotheses when creating trades, or write reflections on your trades
            </p>
          </div>
        ) : filteredFeed.length === 0 ? (
          <div className="card empty-state">
            <p className="empty-state-title" style={{ fontSize: '16px', fontWeight: 600 }}>No matching insights</p>
            <p className="empty-state-text">
              No insights match the current filter
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
            {grouped.map(({ month, items }) => (
              <div key={month}>
                {/* Month header */}
                <div style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '1.2px',
                  marginBottom: '16px',
                  paddingBottom: '8px',
                  borderBottom: '1px solid var(--border)',
                }}>
                  {month}
                </div>

                {/* Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {items.map((item, idx) => (
                    <InsightCard key={item.id} item={item} index={idx} onViewTrade={(tradeId) => navigate(`/trades?highlight=${tradeId}`)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}

function InsightCard({ item, index, onViewTrade }: { item: InsightFeedItem; index: number; onViewTrade: (tradeId: string) => void }) {
  const config = TYPE_CONFIG[item.type];
  const Icon = config.icon;
  const isPositivePnl = item.realizedPnl >= 0;
  const hasPnl = item.status === 'closed' && item.realizedPnl !== 0;

  return (
    <div
      className="card"
      style={{
        padding: '20px 24px',
        position: 'relative',
        overflow: 'hidden',
        animation: `slideUp 0.35s ease-out ${index * 0.04}s both`,
      }}
    >
      {/* Left color bar */}
      <div style={{
        position: 'absolute',
        left: 0,
        top: '12px',
        bottom: '12px',
        width: '3px',
        borderRadius: '0 3px 3px 0',
        background: config.color,
        boxShadow: `0 0 8px ${config.border}`,
      }} />

      {/* Top row: badge + symbol + P&L + date */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '12px',
        flexWrap: 'wrap',
      }}>
        {/* Type badge */}
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          padding: '3px 10px',
          borderRadius: '9999px',
          fontSize: '12px',
          fontWeight: 600,
          background: config.bg,
          color: config.color,
          border: `1px solid ${config.border}`,
        }}>
          <Icon size={13} />
          {config.label}
        </span>

        {/* Symbol */}
        <span style={{
          fontWeight: 600,
          color: 'var(--text-primary)',
          fontSize: '14px',
        }}>
          {item.underlying}
        </span>

        {/* Status pill */}
        <span style={{
          fontSize: '11px',
          fontWeight: 500,
          padding: '2px 8px',
          borderRadius: '9999px',
          background: item.status === 'open' ? 'rgba(52, 211, 153, 0.08)' : 'rgba(255, 255, 255, 0.04)',
          color: item.status === 'open' ? 'var(--profit)' : 'var(--text-muted)',
        }}>
          {item.strategy} / {item.status}
        </span>

        {/* P&L if closed */}
        {hasPnl && (
          <span style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: '13px',
            fontWeight: 600,
            color: isPositivePnl ? 'var(--profit)' : 'var(--loss)',
          }}>
            {isPositivePnl ? '+' : ''}{formatCurrency(item.realizedPnl)}
          </span>
        )}

        {/* Date pushed right */}
        <span style={{
          marginLeft: 'auto',
          fontSize: '12px',
          color: 'var(--text-muted)',
          whiteSpace: 'nowrap',
        }}>
          {formatDate(item.date)}
        </span>
      </div>

      {/* Content */}
      <p style={{
        color: 'var(--text-secondary)',
        fontSize: '14px',
        lineHeight: 1.6,
        whiteSpace: 'pre-wrap',
      }}>
        {item.content}
      </p>

      {/* View Trade link */}
      {item.tradeId && (
        <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={(e) => { e.stopPropagation(); onViewTrade(item.tradeId); }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              fontSize: '12px',
              fontWeight: 500,
              fontFamily: 'inherit',
              padding: '4px 8px',
              borderRadius: '6px',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            View Trade
            <ExternalLink size={11} />
          </button>
        </div>
      )}
    </div>
  );
}
