import { useEffect, useMemo, useState } from 'react';
import { Search, Lightbulb, BookOpen, GraduationCap, AlertTriangle } from 'lucide-react';
import { fetchInsightsFeed } from '../api/reflections';
import { formatCurrency, formatDate } from '../utils/format';
import FilterPills from '../components/FilterPills';
import PageTransition from '../components/PageTransition';
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
  reflection: {
    label: 'Reflection',
    icon: BookOpen,
    color: '#6366f1',
    bg: 'rgba(99, 102, 241, 0.1)',
    border: 'rgba(99, 102, 241, 0.2)',
  },
  lesson: {
    label: 'Lesson',
    icon: GraduationCap,
    color: 'var(--profit)',
    bg: 'rgba(52, 211, 153, 0.1)',
    border: 'rgba(52, 211, 153, 0.2)',
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
  const [feed, setFeed] = useState<InsightFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

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

  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { all: feed.length };
    for (const item of feed) {
      counts[item.type] = (counts[item.type] || 0) + 1;
    }
    return counts;
  }, [feed]);

  const filteredFeed = useMemo(() => {
    if (typeFilter === 'all') return feed;
    return feed.filter(item => item.type === typeFilter);
  }, [feed, typeFilter]);

  const grouped = useMemo(() => groupByMonth(filteredFeed), [filteredFeed]);

  return (
    <PageTransition>
      <div className="page-container">
        {/* Header */}
        <div style={{ marginBottom: '40px' }}>
          <h1 className="page-header">Insights</h1>
          <p className="page-subtitle">Your trade hypotheses, reflections, and lessons</p>
        </div>

        {/* Search + Filters */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', gap: '16px', flexWrap: 'wrap' }}>
          <FilterPills
            options={[
              { key: 'all', label: 'All', count: filterCounts.all || 0 },
              { key: 'hypothesis', label: 'Hypotheses', count: filterCounts.hypothesis || 0 },
              { key: 'reflection', label: 'Reflections', count: filterCounts.reflection || 0 },
              { key: 'lesson', label: 'Lessons', count: filterCounts.lesson || 0 },
              { key: 'mistake', label: 'Mistakes', count: filterCounts.mistake || 0 },
            ]}
            active={typeFilter}
            onChange={setTypeFilter}
          />

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
              Add hypotheses when creating trades, or write reflections on your positions
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
                    <InsightCard key={item.id} item={item} index={idx} />
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

function InsightCard({ item, index }: { item: InsightFeedItem; index: number }) {
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
          {item.symbol}
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
          {item.direction} / {item.status}
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
            {item.realizedPnlPercent != null && (
              <span style={{ fontWeight: 400, fontSize: '12px', marginLeft: '4px' }}>
                ({item.realizedPnlPercent >= 0 ? '+' : ''}{item.realizedPnlPercent.toFixed(1)}%)
              </span>
            )}
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

      {/* Tags */}
      {item.tags.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', marginTop: '12px', flexWrap: 'wrap' }}>
          {item.tags.map((tag) => (
            <span key={tag} style={{
              padding: '2px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 500,
              background: 'var(--bg-tertiary)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border)',
            }}>
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
