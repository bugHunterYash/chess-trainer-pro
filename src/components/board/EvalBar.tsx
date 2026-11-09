import React from 'react';
import { ScoreInfo } from '../../types/chess';
import { EvaluationService } from '../../engine/EvaluationService';

interface EvalBarProps {
  score?: ScoreInfo;
  orientation?: 'white' | 'black';
  height?: number;
}

export const EvalBar: React.FC<EvalBarProps> = ({
  score,
  orientation = 'white',
  height = 560,
}) => {
  // Convert score to White winning percentage (0 to 100)
  const whiteWinPct = score ? EvaluationService.calculateWinChance(score) : 50;

  // Adjust for orientation: if viewing as Black, flip the fill percentage
  const fillPct = orientation === 'white' ? whiteWinPct : 100 - whiteWinPct;

  const scoreText = score ? score.text : '0.0';

  return (
    <div
      className="relative w-7 bg-slate-900 border border-slate-700/80 rounded-md overflow-hidden flex flex-col shadow-inner select-none"
      style={{ height: `${height}px` }}
      title={`Position Eval: ${scoreText} (White win chance: ${whiteWinPct}%)`}
    >
      {/* Top section (black advantage) */}
      <div
        className="w-full bg-slate-800 transition-all duration-300 ease-out"
        style={{ height: `${100 - fillPct}%` }}
      />

      {/* Bottom section (white advantage) */}
      <div
        className="w-full bg-slate-100 transition-all duration-300 ease-out"
        style={{ height: `${fillPct}%` }}
      />

      {/* Numerical score label */}
      <div
        className={`absolute w-full text-center text-[11px] font-bold tracking-tighter ${
          fillPct > 50 ? 'bottom-2 text-slate-900' : 'top-2 text-slate-100'
        }`}
      >
        {scoreText}
      </div>
    </div>
  );
};

