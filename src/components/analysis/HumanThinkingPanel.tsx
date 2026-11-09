import React, { useMemo } from 'react';
import { useChessStore } from '../../store/useChessStore';
import { useEngineStore } from '../../store/useEngineStore';
import { HumanThinkingService } from '../../engine/HumanThinkingService';
import { DIFFICULTY_CONFIGS } from '../../engine/HumanSkillEngine';
import { HumanDifficultyLevel } from '../../types/chess';
import { MoveClassificationBadge } from './MoveClassificationBadge';
import {
  Brain,
  Sliders,
  Scale,
  Sparkles,
  Play,
  ArrowRightLeft,
  Eye,
} from 'lucide-react';

export const HumanThinkingPanel: React.FC = () => {
  const { fen, chess, makeMove } = useChessStore();
  const {
    analysis,
    humanThinkingLevel,
    setHumanThinkingLevel,
    humanCandidateCount,
    setHumanCandidateCount,
    sideFilter,
    setSideFilter,
  } = useEngineStore();

  const sideToMove = chess.turn(); // 'w' | 'b'

  // Check side filter restriction
  const isSideBlocked =
    (sideFilter === 'white' && sideToMove !== 'w') ||
    (sideFilter === 'black' && sideToMove !== 'b');

  // Compute human move predictions
  const prediction = useMemo(() => {
    if (isSideBlocked || !analysis || !analysis.candidates || analysis.candidates.length === 0) {
      return null;
    }
    return HumanThinkingService.predictHumanMoves(
      fen,
      analysis.candidates,
      humanThinkingLevel,
      humanCandidateCount
    );
  }, [fen, analysis, humanThinkingLevel, humanCandidateCount, isSideBlocked]);

  if (isSideBlocked) {
    const targetSide = sideFilter === 'white' ? 'White' : 'Black';
    const currentTurnName = sideToMove === 'w' ? 'White' : 'Black';

    return (
      <div className="p-5 text-center bg-slate-900/80 rounded-xl border border-slate-800 text-slate-300 space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 text-xs font-semibold text-slate-200 border border-slate-700">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span>Currently {currentTurnName}'s turn to move</span>
        </div>

        <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
          Human prediction is set to <strong>{targetSide} only</strong>. To view predictions for the active turn:
        </p>

        <div className="flex items-center justify-center gap-2 pt-1">
          <button
            onClick={() => setSideFilter(sideToMove === 'w' ? 'white' : 'black')}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-lg transition flex items-center gap-1.5 shadow"
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

  if (chess.isGameOver()) {
    return (
      <div className="p-5 text-center bg-slate-900/60 rounded-xl border border-slate-800 text-slate-400 space-y-1">
        <h4 className="text-sm font-bold text-slate-200">Position Terminal</h4>
        <p className="text-xs">
          {chess.isCheckmate() ? 'Checkmate. No legal moves remaining.' : 'Game over by draw.'}
        </p>
      </div>
    );
  }

  if (!prediction) {
    return (
      <div className="p-6 text-center text-slate-400 bg-slate-900/60 rounded-xl border border-slate-800">
        <Brain className="w-8 h-8 mx-auto mb-2 text-amber-400 animate-pulse" />
        <p className="text-sm">Modeling human move prediction...</p>
      </div>
    );
  }

  const { humanLikelyMove, engineBestMove, comparisonAnalysis, candidates } = prediction;

  return (
    <div className="flex flex-col gap-3">
      {/* Skill Level & Candidate Count Controls */}
      <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Brain className="w-3.5 h-3.5 text-amber-400" /> Target Human Skill
          </span>
          <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
            {DIFFICULTY_CONFIGS[humanThinkingLevel].ratingRange}
          </span>
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          {(['beginner', 'casual', 'intermediate', 'advanced', 'expert'] as HumanDifficultyLevel[]).map((lvl) => {
            const conf = DIFFICULTY_CONFIGS[lvl];
            const isActive = humanThinkingLevel === lvl;

            return (
              <button
                key={lvl}
                onClick={() => setHumanThinkingLevel(lvl)}
                className={`py-1.5 px-1 rounded-lg border text-center transition ${
                  isActive
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold shadow'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="text-[11px] truncate">{conf.name}</div>
              </button>
            );
          })}
        </div>

        {/* Candidate count slider */}
        <div className="flex items-center justify-between pt-1 text-xs text-slate-400">
          <span className="flex items-center gap-1 text-[11px]">
            <Sliders className="w-3 h-3 text-slate-500" /> Candidates:
          </span>
          <div className="flex gap-1">
            {[2, 3, 4, 5].map((cnt) => (
              <button
                key={cnt}
                onClick={() => setHumanCandidateCount(cnt)}
                className={`w-6 h-6 rounded text-xs font-mono font-bold transition ${
                  humanCandidateCount === cnt
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {cnt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Comparison Panel: Human Likely vs Stockfish Best */}
      <div className="p-3.5 rounded-xl bg-gradient-to-br from-amber-950/20 via-slate-900 to-slate-950 border border-amber-500/30 space-y-2">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 text-amber-400" /> Human vs Engine Comparison
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
            {sideToMove === 'w' ? 'White to move' : 'Black to move'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* Human predicted move */}
          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400 block mb-0.5">
              👤 Human-Likely Move
            </span>
            <div className="flex items-center justify-between">
              <span className="text-base font-bold font-mono text-slate-100">
                {humanLikelyMove.candidate.san}
              </span>
              <span className="text-xs font-bold text-amber-400 font-mono">
                {humanLikelyMove.humanLikelihoodPercent}% pick
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 line-clamp-1">
              {humanLikelyMove.candidate.score.text} • {humanLikelyMove.humanReasoningCategory.replace('_', ' ')}
            </div>
          </div>

          {/* Engine best move */}
          <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 block mb-0.5">
              ⚡ Engine-Best Move
            </span>
            <div className="flex items-center justify-between">
              <span className="text-base font-bold font-mono text-slate-100">
                {engineBestMove.san}
              </span>
              <span className="text-xs font-bold text-emerald-400 font-mono">
                {engineBestMove.score.text}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 line-clamp-1">
              Top engine line
            </div>
          </div>
        </div>

        {/* Narrative explanation */}
        <p className="text-xs text-slate-300 leading-relaxed pt-1 border-t border-slate-800/80">
          {comparisonAnalysis}
        </p>
      </div>

      {/* Human Candidate Moves Ranked by Estimated Likelihood */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5 text-slate-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Human Candidate Moves ({candidates.length})
          </span>
          <span className="text-[11px] text-slate-500">Ranked by Human Likelihood</span>
        </div>

        <div className="space-y-2">
          {candidates.map((cand, idx) => {
            const isTopHuman = idx === 0;

            return (
              <div
                key={cand.candidate.uci}
                className={`p-3 rounded-lg border transition-all ${
                  isTopHuman
                    ? 'bg-amber-950/20 border-amber-500/40 shadow-sm'
                    : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Header: SAN, Likelihood bar, Score */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        isTopHuman ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className="text-base font-bold font-mono text-slate-100">
                      {cand.candidate.san}
                    </span>
                    <MoveClassificationBadge classification={cand.candidate.classification} />
                    {cand.isEngineBest && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        Engine Best
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-300">
                      {cand.candidate.score.text}
                    </span>
                    <button
                      onClick={() =>
                        makeMove(
                          cand.candidate.from,
                          cand.candidate.to,
                          cand.candidate.promotion
                        )
                      }
                      className="p-1 rounded bg-slate-800 hover:bg-amber-600 hover:text-white text-slate-400 transition"
                      title={`Play ${cand.candidate.san}`}
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Human Likelihood Meter */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all duration-300"
                      style={{ width: `${cand.humanLikelihoodPercent}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-mono font-bold text-amber-400">
                    {cand.humanLikelihoodPercent}%
                  </span>
                </div>

                {/* Human Reasoning Text */}
                <div className="text-xs text-slate-300 leading-relaxed flex items-start gap-1.5">
                  <span className="text-amber-400 font-semibold shrink-0">
                    Reasoning:
                  </span>
                  <span>{cand.humanReasoningText}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
