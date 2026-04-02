import { useEffect, useRef } from 'react';
import {
  createChart,
  type IChartApi,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  ColorType,
  type SeriesMarker,
  type Time,
  createSeriesMarkers,
} from 'lightweight-charts';
import type { OhlcvBar, VwapPoint } from '../../types';

interface CandlestickChartProps {
  bars: OhlcvBar[];
  vwap?: VwapPoint[];
  entryTime?: number;
  exitTime?: number;
  height?: number;
}

export default function CandlestickChart({
  bars,
  vwap,
  entryTime,
  exitTime,
  height = 300,
}: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || bars.length === 0) return;

    const chart = createChart(containerRef.current, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'var(--text-muted)',
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
      },
      crosshair: {
        vertLine: { color: 'rgba(255, 255, 255, 0.1)', labelBackgroundColor: '#2a2a3e' },
        horzLine: { color: 'rgba(255, 255, 255, 0.1)', labelBackgroundColor: '#2a2a3e' },
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.06)',
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.06)',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // Candlestick series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: 'rgba(52, 211, 153, 0.9)',
      downColor: 'rgba(248, 113, 113, 0.9)',
      borderUpColor: 'rgba(52, 211, 153, 0.9)',
      borderDownColor: 'rgba(248, 113, 113, 0.9)',
      wickUpColor: 'rgba(52, 211, 153, 0.5)',
      wickDownColor: 'rgba(248, 113, 113, 0.5)',
    });

    candleSeries.setData(
      bars.map((b) => ({
        time: b.t as Time,
        open: b.o,
        high: b.h,
        low: b.l,
        close: b.c,
      }))
    );

    // Entry/exit markers
    const markers: SeriesMarker<Time>[] = [];
    if (entryTime) {
      const nearestBar = findNearestBar(bars, entryTime);
      if (nearestBar) {
        markers.push({
          time: nearestBar.t as Time,
          position: 'belowBar',
          color: '#34d399',
          shape: 'arrowUp',
          text: 'Entry',
        });
      }
    }
    if (exitTime) {
      const nearestBar = findNearestBar(bars, exitTime);
      if (nearestBar) {
        markers.push({
          time: nearestBar.t as Time,
          position: 'aboveBar',
          color: '#f87171',
          shape: 'arrowDown',
          text: 'Exit',
        });
      }
    }
    if (markers.length > 0) {
      markers.sort((a, b) => (a.time as number) - (b.time as number));
      createSeriesMarkers(candleSeries, markers);
    }

    // Volume histogram
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    volumeSeries.setData(
      bars.map((b) => ({
        time: b.t as Time,
        value: b.v,
        color: b.c >= b.o ? 'rgba(52, 211, 153, 0.15)' : 'rgba(248, 113, 113, 0.15)',
      }))
    );

    // VWAP + bands
    if (vwap && vwap.length > 0) {
      // VWAP line
      const vwapSeries = chart.addSeries(LineSeries, {
        color: 'rgba(59, 130, 246, 0.8)',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      vwapSeries.setData(vwap.map((v) => ({ time: v.t as Time, value: v.vwap })));

      // ±1 SD bands
      addBandSeries(chart, vwap, 'upperBand1', 'lowerBand1', 'rgba(59, 130, 246, 0.25)');
      // ±2 SD bands
      addBandSeries(chart, vwap, 'upperBand2', 'lowerBand2', 'rgba(59, 130, 246, 0.15)');
      // ±3 SD bands
      addBandSeries(chart, vwap, 'upperBand3', 'lowerBand3', 'rgba(59, 130, 246, 0.08)');
    }

    chart.timeScale().fitContent();

    // Resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chart.applyOptions({ width: entry.contentRect.width });
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [bars, vwap, entryTime, exitTime, height]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: `${height}px`,
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    />
  );
}

function addBandSeries(
  chart: IChartApi,
  vwap: VwapPoint[],
  upperKey: keyof VwapPoint,
  lowerKey: keyof VwapPoint,
  color: string,
) {
  const upper = chart.addSeries(LineSeries, {
    color,
    lineWidth: 1,
    lineStyle: 2, // Dashed
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false,
  });
  upper.setData(vwap.map((v) => ({ time: v.t as Time, value: v[upperKey] as number })));

  const lower = chart.addSeries(LineSeries, {
    color,
    lineWidth: 1,
    lineStyle: 2,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false,
  });
  lower.setData(vwap.map((v) => ({ time: v.t as Time, value: v[lowerKey] as number })));
}

function findNearestBar(bars: OhlcvBar[], timestamp: number): OhlcvBar | null {
  if (bars.length === 0) return null;
  let nearest = bars[0];
  let minDiff = Math.abs(bars[0].t - timestamp);
  for (const bar of bars) {
    const diff = Math.abs(bar.t - timestamp);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = bar;
    }
  }
  return nearest;
}
