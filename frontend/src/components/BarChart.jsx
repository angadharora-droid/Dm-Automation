import { useState } from 'react';

/**
 * Grouped daily bar chart (inline SVG, no library).
 *
 * Palette validated for CVD separation and contrast on the white surface
 * (dataviz six-checks validator): #6228d7 / #ee2a7b / #1570ef in fixed order.
 * Marks: thin bars, rounded data-end anchored to the baseline, 2px gaps,
 * recessive grid, integer ticks; hover shows a per-day tooltip.
 */

const W = 720;
const H = 240;
const PAD = { top: 14, right: 10, bottom: 26, left: 36 };

function niceCeil(value) {
  if (value <= 4) return Math.max(2, value);
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const mult of [1, 2, 5, 10]) {
    if (value <= mult * magnitude) return mult * magnitude;
  }
  return 10 * magnitude;
}

function topRoundedRect(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height);
  return [
    `M${x},${y + height}`,
    `L${x},${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    `L${x + width - r},${y}`,
    `Q${x + width},${y} ${x + width},${y + r}`,
    `L${x + width},${y + height}`,
    'Z',
  ].join(' ');
}

function shortDate(dateKey) {
  const [, month, day] = dateKey.split('-');
  return `${Number(month)}/${Number(day)}`;
}

export default function BarChart({ days, series }) {
  const [hovered, setHovered] = useState(null); // day index

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const values = days.map((day) => series.map((s) => s.value(day)));
  const rawMax = Math.max(1, ...values.flat());
  const maxY = niceCeil(rawMax);
  const tickStep = maxY <= 4 ? 1 : maxY / 4;
  const ticks = [];
  for (let t = 0; t <= maxY; t += tickStep) ticks.push(t);

  const groupW = innerW / days.length;
  const barGap = 2;
  const barW = Math.max(3, Math.min(16, (groupW - 10 - barGap * (series.length - 1)) / series.length));
  const groupContentW = barW * series.length + barGap * (series.length - 1);
  const labelEvery = Math.max(1, Math.ceil(days.length / 8));
  const yFor = (value) => PAD.top + innerH * (1 - value / maxY);

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Daily automation events" style={{ width: '100%', height: 'auto', display: 'block' }}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={W - PAD.right} y1={yFor(tick)} y2={yFor(tick)} stroke="#eef0f5" strokeWidth="1" />
            <text x={PAD.left - 8} y={yFor(tick) + 4} textAnchor="end" fontSize="11" fill="#98a2b3" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {tick}
            </text>
          </g>
        ))}

        {days.map((day, dayIndex) => {
          const groupX = PAD.left + dayIndex * groupW + (groupW - groupContentW) / 2;
          return (
            <g key={day.date}>
              {hovered === dayIndex && (
                <rect x={PAD.left + dayIndex * groupW + 1} y={PAD.top} width={groupW - 2} height={innerH} fill="#f2f4f9" rx="6" />
              )}
              {series.map((s, seriesIndex) => {
                const value = values[dayIndex][seriesIndex];
                if (value <= 0) return null;
                const x = groupX + seriesIndex * (barW + barGap);
                const y = yFor(value);
                return (
                  <path
                    key={s.label}
                    d={topRoundedRect(x, y, barW, PAD.top + innerH - y, 4)}
                    fill={s.color}
                  />
                );
              })}
              {dayIndex % labelEvery === 0 && (
                <text x={PAD.left + dayIndex * groupW + groupW / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#98a2b3" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {shortDate(day.date)}
                </text>
              )}
              <rect
                x={PAD.left + dayIndex * groupW}
                y={PAD.top}
                width={groupW}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHovered(dayIndex)}
                onMouseLeave={() => setHovered(null)}
              />
            </g>
          );
        })}

        <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + innerH} y2={PAD.top + innerH} stroke="#d6dbe8" strokeWidth="1" />
      </svg>

      {hovered !== null && days[hovered] && (
        <div
          className="chart-tooltip"
          style={{ left: `${((PAD.left + hovered * groupW + groupW / 2) / W) * 100}%` }}
        >
          <div className="tooltip-date">{days[hovered].date}</div>
          {series.map((s) => (
            <div key={s.label} className="tooltip-row">
              <span className="tooltip-chip" style={{ background: s.color }} aria-hidden="true" />
              <span>{s.label}</span>
              <strong>{s.value(days[hovered])}</strong>
            </div>
          ))}
        </div>
      )}

      <div className="legend-row">
        {series.map((s) => (
          <span key={s.label} className="legend-item">
            <span className="tooltip-chip" style={{ background: s.color }} aria-hidden="true" />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
