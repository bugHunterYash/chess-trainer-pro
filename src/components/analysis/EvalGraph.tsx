import React, { useMemo } from 'react';
import { useChessStore } from '../../store/useChessStore';
import { Activity } from 'lucide-react';

interface EvalGraphProps {
  height?: number;
}

export const EvalGraph: React.FC<EvalGraphProps> = ({ height = 70 }) => {
  const { history, currentMoveIndex, goToMove } = useChessStore();

  // Extract centipawn evaluations for each move in history
  const points = useMemo(() => {
    if (history.length === 0) return [];

    return history.map((m, idx) => {
      let cp = 0;
      if (m.evalAfter) {
        if (m.evalAfter.type === 'mate') {
          cp = m.evalAfter.value > 0 ? 800 : -800;
        } else {
          cp = m.evalAfter.value;
        }
      } else {
        // Approximate from move number or neutral if not yet deeply reviewed
        cp = 0;
      }

      // Clamp between -600 (-6 pawns) and +600 (+6 pawns) for graph rendering
      const clampedCp = Math.max(-600, Math.min(600, cp));
      return {
        idx,
        san: m.san,
        cp: clampedCp,
        displayScore: m.evalAfter?.text || '0.0',
      };
    });
  }, [history]);

  if (history.length < 2) return null;

  const width = 100; // viewBox width in percentage
  const midY = height / 2;

  // Build SVG path coordinates
  const stepX = width / Math.max(1, points.length - 1);
  const coords = points.map((p, i) => {
    const x = i * stepX;
    // Positive cp (White advantage) goes UP (-Y), negative cp goes DOWN (+Y)
    const y = midY - (p.cp / 600) * (midY - 4);
    return { x, y, ...p };
  });

  const pathD = coords.reduce((acc, curr, i) => {
    return i === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
  }, '');

  // Fill area between line and middle Y
  const areaD = `${pathD} L ${width} ${midY} L 0 ${midY} Z`;

  const activeCoord = currentMoveIndex >= 0 && currentMoveIndex < coords.length ? coords[currentMoveIndex] : null;

  return (
    <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-slate-950/70 border border-slate-800">
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5 text-slate-300">
          <Activity className="w-3.5 h-3.5 text-sky-400" /> Advantage Timeline
        </span>
        <span className="font-mono text-slate-400">
          {activeCoord ? `Move ${activeCoord.idx + 1} (${activeCoord.san}): ${activeCoord.displayScore}` : 'Click graph to jump to move'}
        </span>
      </div>

      <div className="relative w-full overflow-hidden rounded bg-slate-900 border border-slate-800/80 cursor-pointer select-none">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="w-full"
          style={{ height: `${height}px` }}
        >
          <defs>
            <linearGradient id="evalGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.05" />
              <stop offset="50%" stopColor="#ef4444" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.4" />
            </linearGradient>
          </defs>

          {/* Center equilibrium line (0.00 eval) */}
          <line
            x1="0"
            y1={midY}
            x2={width}
            y2={midY}
            stroke="#475569"
            strokeDasharray="2 2"
            strokeWidth="0.75"
          />

          {/* Area fill */}
          <path d={areaD} fill="url(#evalGradient)" />

          {/* Trend line */}
          <path
            d={pathD}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Active move vertical indicator */}
          {activeCoord && (
            <g>
              <line
                x1={activeCoord.x}
                y1="0"
                x2={activeCoord.x}
                y2={height}
                stroke="#ffffff"
                strokeWidth="1"
                opacity="0.8"
              />
              <circle
                cx={activeCoord.x}
                cy={activeCoord.y}
                r="3"
                fill="#ffffff"
                stroke="#38bdf8"
                strokeWidth="1.5"
              />
            </g>
          )}

          {/* Clickable hit boxes for every move */}
          {coords.map((c) => (
            <rect
              key={c.idx}
              x={Math.max(0, c.x - stepX / 2)}
              y="0"
              width={stepX}
              height={height}
              fill="transparent"
              onClick={() => goToMove(c.idx)}
              className="hover:fill-white/10 transition-colors"
            >
              <title>{`Move ${c.idx + 1} (${c.san})`}</title>
            </rect>
          ))}
        </svg>
      </div>
    </div>
  );
};

