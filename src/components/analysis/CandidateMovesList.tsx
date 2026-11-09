import React from 'react';
import { useEngineStore } from '../../store/useEngineStore';
import { useChessStore } from '../../store/useChessStore';
import { MoveClassificationBadge } from './MoveClassificationBadge';
import { Play, Sparkles, Cpu, CheckCircle2, ArrowRightLeft, Eye } from 'lucide-react';

export const CandidateMovesList: React.FC = () => {
  const { analysis, isAnalyzing, getFilteredCandidates, setSideFilter, sideFilter, qualityFilter } = useEngineStore();
  const { chess, makeMove, fen } = useChessStore();

  const sideToMove = chess.turn(); // 'w' | 'b'

  if (chess.isGameOver()) {
    return (
      <div className="p-6 text-center text-slate-400 bg-slate-900/60 rounded-xl border border-slate-800 space-y-1.5">
        <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400" />
        <h4 className="text-sm font-bold text-slate-200">Position Terminal</h4>
        <p className="text-xs">
          {chess.isCheckmate()
            ? `Checkmate. ${sideToMove === 'w' ? 'White' : 'Black'} has no legal moves.`
            : 'Game drawn. No legal moves to evaluate.'}
        </p>
      </div>
    );
  }

  const { isFilteredOutBySide, targetSide, candidates } = getFilteredCandidates(sideToMove);

  if (isFilteredOutBySide) {
    const currentTurnName = sideToMove === 'w' ? 'White' : 'Black';
    return (
      <div className="p-5 text-center bg-slate-900/80 rounded-xl border border-slate-800 text-slate-300 space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 text-xs font-semibold text-slate-200 border border-slate-700">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span>Currently {currentTurnName}'s turn to move</span>
        </div>

        <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
          Suggestions are currently filtered for <strong>{targetSide} only</strong>. To view suggestions for the current position:
        </p>

        <div className="flex items-center justify-center gap-2 pt-1">
          <button
            onClick={() => setSideFilter(sideToMove === 'w' ? 'white' : 'black')}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded-lg transition flex items-center gap-1.5 shadow"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" /> Switch to {currentTurnName}
          </button>
          <button
            onClick={() => setSideFilter('both')}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition border border-slate-700 flex items-center gap-1.5"
          >
            <Eye className="w-3.5 h-3.5" /> Show Both Sides
          </button>
        </div>
      </div>
    );
  }

  if (!analysis || candidates.length === 0) {
    return (
      <div className="p-6 text-center text-slate-400 bg-slate-900/60 rounded-xl border border-slate-800">
        <Cpu className="w-8 h-8 mx-auto mb-2 text-slate-500 animate-pulse" />
        <p className="text-sm">Calculating candidate moves...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5 text-slate-300">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          Engine Candidates ({candidates.length})
        </span>
        <span className="text-[11px] font-mono bg-slate-800 px-2 py-0.5 rounded border border-slate-700/60">
          Depth {analysis.depth} {isAnalyzing && '• calculating...'}
        </span>
      </div>

      <div className="space-y-2">
        {candidates.map((cand, idx) => {
          const isTop = idx === 0;

          return (
            <div
              key={cand.uci}
              className={`p-3 rounded-lg border transition-all ${
                isTop
                  ? 'bg-emerald-950/20 border-emerald-500/40 shadow-sm'
                  : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Header: Rank, SAN, Score, Classification */}
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isTop
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span className="text-base font-bold font-mono text-slate-100">
                    {cand.san}
                  </span>
                  <MoveClassificationBadge classification={cand.classification} />
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`font-mono font-bold text-xs px-2 py-0.5 rounded ${
                      cand.score.type === 'mate'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : cand.score.value >= 0
                        ? 'bg-slate-800 text-slate-200'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {cand.score.text}
                  </span>
                  <button
                    onClick={() => makeMove(cand.from, cand.to, cand.promotion)}
                    className="p-1 rounded bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-400 transition"
                    title={`Play ${cand.san}`}
                  >
                    <Play className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Theme & Explanation */}
              {cand.explanation && (
                <p className="text-xs text-slate-300 leading-relaxed mb-2">
                  {cand.explanation}
                </p>
              )}

              {/* Continuation PV preview */}
              {cand.pvSan && cand.pvSan.length > 1 && (
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 bg-slate-950/50 px-2 py-1 rounded border border-slate-800/80 overflow-x-auto">
                  <span className="text-slate-500 select-none">Line:</span>
                  {cand.pvSan.slice(0, 6).join(' ')}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
