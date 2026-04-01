import { useState, useMemo } from 'react';
import {
  startOfMonth,
  getDaysInMonth,
  getDay,
  addMonths,
  subMonths,
  format,
  isToday,
  isFuture,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCurrency } from '../utils/format';
import type { EquityCurvePoint } from '../types';

interface PnlCalendarProps {
  data: EquityCurvePoint[];
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function PnlCalendar({ data }: PnlCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

  // Build lookup map from date string -> equity curve point
  const dataMap = useMemo(() => {
    const map = new Map<string, EquityCurvePoint>();
    for (const point of data) {
      map.set(point.date, point);
    }
    return map;
  }, [data]);

  // Build the month grid
  const { cells, monthStats } = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const daysInMonth = getDaysInMonth(currentMonth);
    const startWeekday = getDay(monthStart); // 0 = Sun

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    let monthTotal = 0;
    let tradingDays = 0;
    let winDays = 0;
    let lossDays = 0;
    let maxAbsPnl = 0;

    // First pass: compute stats
    const dayData: (EquityCurvePoint | null)[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const point = dataMap.get(dateStr) ?? null;
      dayData.push(point);
      if (point) {
        monthTotal += point.dailyPnl;
        tradingDays++;
        if (point.dailyPnl >= 0) winDays++;
        else lossDays++;
        maxAbsPnl = Math.max(maxAbsPnl, Math.abs(point.dailyPnl));
      }
    }

    // Build cells: padding + actual days
    const gridCells: {
      day: number;
      date: Date;
      pnlData: EquityCurvePoint | null;
      intensity: number;
    }[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const point = dayData[d - 1];
      const intensity = point && maxAbsPnl > 0
        ? Math.abs(point.dailyPnl) / maxAbsPnl
        : 0;
      gridCells.push({ day: d, date, pnlData: point, intensity });
    }

    return {
      cells: { padding: startWeekday, days: gridCells },
      monthStats: { monthTotal, tradingDays, winDays, lossDays },
    };
  }, [currentMonth, dataMap]);

  const navBtnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  };

  return (
    <div className="card" style={{ padding: '28px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px',
      }}>
        <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>
          P&L Calendar
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setCurrentMonth(m => subMonths(m, 1))}
            style={navBtnStyle}
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <span style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            minWidth: '120px',
            textAlign: 'center',
          }}>
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <button
            onClick={() => setCurrentMonth(m => addMonths(m, 1))}
            style={navBtnStyle}
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Day-of-week header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '2px',
        marginBottom: '4px',
      }}>
        {DAY_LABELS.map(d => (
          <div key={d} style={{
            textAlign: 'center',
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--text-muted)',
            padding: '4px 0',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '2px',
      }}>
        {/* Padding cells for offset */}
        {Array.from({ length: cells.padding }).map((_, i) => (
          <div key={`pad-${i}`} style={{ aspectRatio: '1.2' }} />
        ))}

        {/* Day cells */}
        {cells.days.map(({ day, date, pnlData, intensity }) => {
          const today = isToday(date);
          const future = isFuture(date);
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          const hasData = pnlData !== null;
          const isPositive = hasData && pnlData.dailyPnl >= 0;

          let bgColor = 'transparent';
          if (hasData) {
            const alpha = 0.06 + intensity * 0.14;
            bgColor = isPositive
              ? `rgba(52, 211, 153, ${alpha.toFixed(3)})`
              : `rgba(248, 113, 113, ${alpha.toFixed(3)})`;
          }

          return (
            <div
              key={day}
              style={{
                aspectRatio: '1.2',
                borderRadius: '8px',
                padding: '4px',
                background: bgColor,
                border: today ? '1px solid var(--accent)' : '1px solid transparent',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1px',
                opacity: future ? 0.3 : (isWeekend && !hasData) ? 0.5 : 1,
                transition: 'background 0.2s ease',
              }}
            >
              <span style={{
                fontSize: '11px',
                fontWeight: today ? 700 : 400,
                color: today ? 'var(--accent)' : 'var(--text-muted)',
              }}>
                {day}
              </span>
              {hasData && (
                <>
                  <span style={{
                    fontSize: '10px',
                    fontFamily: "'DM Mono', monospace",
                    fontWeight: 600,
                    color: isPositive ? 'var(--profit)' : 'var(--loss)',
                    lineHeight: 1.2,
                  }}>
                    {pnlData.dailyPnl >= 0 ? '+' : ''}{formatCurrency(pnlData.dailyPnl)}
                  </span>
                  {pnlData.tradeCount > 0 && (
                    <span style={{
                      fontSize: '9px',
                      color: 'var(--text-muted)',
                      lineHeight: 1,
                    }}>
                      {pnlData.tradeCount}t
                    </span>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Month summary */}
      <div style={{
        marginTop: '20px',
        paddingTop: '16px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        gap: '24px',
        flexWrap: 'wrap',
        fontSize: '13px',
        color: 'var(--text-secondary)',
      }}>
        <div>
          Monthly P&L:{' '}
          <span style={{
            fontFamily: "'DM Mono', monospace",
            fontWeight: 600,
            color: monthStats.monthTotal >= 0 ? 'var(--profit)' : 'var(--loss)',
          }}>
            {monthStats.monthTotal >= 0 ? '+' : ''}{formatCurrency(monthStats.monthTotal)}
          </span>
        </div>
        <div>
          Trading Days: <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{monthStats.tradingDays}</span>
        </div>
        <div>
          <span style={{ color: 'var(--profit)' }}>{monthStats.winDays}W</span>
          {' / '}
          <span style={{ color: 'var(--loss)' }}>{monthStats.lossDays}L</span>
        </div>
      </div>
    </div>
  );
}
