import { useMemo } from 'react';

export interface SparklinePoint {
  time: number;
  value: number;
}

interface SparklineProps {
  data: SparklinePoint[];
  width?: number;
  height?: number;
  color?: string;
  showArea?: boolean;
  showEndDot?: boolean;
  showMinMax?: boolean;
  strokeWidth?: number;
}

export default function Sparkline({
  data,
  width = 100,
  height = 30,
  color = 'var(--profit)',
  showArea = true,
  showEndDot = true,
  showMinMax = false,
  strokeWidth = 1.5,
}: SparklineProps) {
  const { path, areaPath, min, max, lastPoint } = useMemo(() => {
    if (data.length < 2) return { path: '', areaPath: '', min: null, max: null, lastPoint: null };

    const values = data.map((d) => d.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal || 1;

    const padding = 2;
    const dotPadding = showEndDot ? 3 : 0;
    const innerWidth = width - padding * 2 - dotPadding;
    const innerHeight = height - padding * 2;

    const points = data.map((d, i) => ({
      x: padding + (i / (data.length - 1)) * innerWidth,
      y: padding + innerHeight - ((d.value - minVal) / range) * innerHeight,
    }));

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    const area = `${linePath} L${points[points.length - 1].x.toFixed(1)},${height} L${points[0].x.toFixed(1)},${height} Z`;

    const minIdx = values.indexOf(minVal);
    const maxIdx = values.indexOf(maxVal);

    return {
      path: linePath,
      areaPath: area,
      min: showMinMax ? { x: points[minIdx].x, y: points[minIdx].y, value: minVal } : null,
      max: showMinMax ? { x: points[maxIdx].x, y: points[maxIdx].y, value: maxVal } : null,
      lastPoint: points[points.length - 1],
    };
  }, [data, width, height, showEndDot, showMinMax]);

  if (data.length < 2) {
    return (
      <svg width={width} height={height}>
        <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke="var(--border)" strokeWidth={1} strokeDasharray="2,2" />
      </svg>
    );
  }

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {showArea && (
        <path d={areaPath} fill={color} opacity={0.08} />
      )}
      <path d={path} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      {showEndDot && lastPoint && (
        <>
          <circle cx={lastPoint.x} cy={lastPoint.y} r={3} fill={color} opacity={0.3} />
          <circle cx={lastPoint.x} cy={lastPoint.y} r={1.5} fill={color} />
        </>
      )}
      {min && (
        <text x={min.x} y={height - 1} textAnchor="middle" fill="var(--text-muted)" fontSize={7} fontFamily="'DM Mono', monospace">
          {formatCompact(min.value)}
        </text>
      )}
      {max && (
        <text x={max.x} y={7} textAnchor="middle" fill="var(--text-muted)" fontSize={7} fontFamily="'DM Mono', monospace">
          {formatCompact(max.value)}
        </text>
      )}
    </svg>
  );
}

function formatCompact(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  if (v >= 1) return v.toFixed(1);
  if (v >= 0.01) return v.toFixed(2);
  return v.toPrecision(2);
}
