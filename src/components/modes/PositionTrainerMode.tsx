import React, { useState, useEffect } from 'react';
import { useChessStore } from '../../store/useChessStore';
import { TrainingPuzzle } from '../../types/chess';
import { Lightbulb, Eye, CheckCircle2, XCircle, ArrowRight, Target } from 'lucide-react';

const SAMPLE_PUZZLES: TrainingPuzzle[] = [
  {
    id: 'puzzle_fork_1',
    fen: 'r1bqkb1r/pppp1ppp/2n5/4p3/2B1n3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 5',
    solution: ['c4f7', 'e8f7', 'd1d5'],
    rating: 1200,
    themes: ['Fork', 'Decoy'],
    description: 'Punish Black for leaving the f7 square vulnerable with an active tactical fork.',
  },
  {
    id: 'puzzle_mate_1',
    fen: '6k1/5ppp/8/8/8/8/1Q3PPP/6K1 w - - 0 1',
    solution: ['b2b8'],
    rating: 800,
    themes: ['Back Rank Mate'],
    description: 'Spot the classic back-rank weakness to deliver immediate checkmate.',
  },
  {
    id: 'puzzle_pin_1',
    fen: 'r1b1k2r/ppppqppp/2n5/8/1bBP4/5N2/PP1B1PPP/R2Q1RK1 w kq - 0 10',
    solution: ['f1e1'],
    rating: 1350,
    themes: ['Absolute Pin'],
    description: 'Pin the enemy Queen directly to the uncastled King along the open e-file.',
  },
  {
    id: 'puzzle_endgame_1',
    fen: '8/8/8/4k3/8/4K3/4P3/8 w - - 0 1',
    solution: ['e3d3', 'e5d5', 'e2e4'],
    rating: 1500,
    themes: ['Opposition', 'King and Pawn'],
    description: 'Use the opposition rule to shepherd your pawn to promotion.',
  },
];

export const PositionTrainerMode: React.FC = () => {
  const { loadFen, fen, history, makeMove } = useChessStore();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [hintLevel, setHintLevel] = useState(0); // 0 = none, 1 = theme, 2 = first move
  const [status, setStatus] = useState<'solving' | 'correct' | 'incorrect'>('solving');

  const puzzle = SAMPLE_PUZZLES[currentIdx];

  // Load puzzle FEN on change
  useEffect(() => {
    loadFen(puzzle.fen);
    setStatus('solving');
    setHintLevel(0);
  }, [currentIdx, puzzle.fen, loadFen]);

  // Check user moves against solution
  useEffect(() => {
    if (history.length === 0 || status !== 'solving') return;

    const userLastMove = history[history.length - 1].uci;
    const expectedMove = puzzle.solution[history.length - 1];

    if (userLastMove === expectedMove) {
      if (history.length === puzzle.solution.length) {
        setStatus('correct');
      } else {
        // Play opponent response in solution
        const nextOpponentMove = puzzle.solution[history.length];
        if (nextOpponentMove) {
          setTimeout(() => {
            const from = nextOpponentMove.substring(0, 2);
            const to = nextOpponentMove.substring(2, 4);
            const promo = nextOpponentMove.length > 4 ? nextOpponentMove[4] : undefined;
            makeMove(from, to, promo);
          }, 350);
        }
      }
    } else {
      setStatus('incorrect');
    }
  }, [history, puzzle.solution, status, makeMove]);

  const nextPuzzle = () => {
    setCurrentIdx((prev) => (prev + 1) % SAMPLE_PUZZLES.length);
  };

  const revealSolution = () => {
    setStatus('correct');
    loadFen(puzzle.fen);
    // Auto-play solution
    puzzle.solution.forEach((m, i) => {
      setTimeout(() => {
        const from = m.substring(0, 2);
        const to = m.substring(2, 4);
        const promo = m.length > 4 ? m[4] : undefined;
        makeMove(from, to, promo);
      }, (i + 1) * 500);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Puzzle Header Card */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-400" />
            <h3 className="font-bold text-sm text-slate-100">
              Puzzle #{currentIdx + 1}
            </h3>
            <span className="text-xs px-2 py-0.5 rounded font-mono bg-slate-800 text-slate-300 border border-slate-700">
              Rating: {puzzle.rating}
            </span>
          </div>

          <div className="flex gap-1">
            {puzzle.themes.map((th) => (
              <span
                key={th}
                className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium"
              >
                {th}
              </span>
            ))}
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          {puzzle.description}
        </p>
      </div>

      {/* Status banner */}
      {status === 'correct' && (
        <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/50 flex items-center justify-between text-emerald-300 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Puzzle Solved! Excellent calculation.</span>
          </div>
          <button
            onClick={nextPuzzle}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded flex items-center gap-1 transition"
          >
            Next <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}

      {status === 'incorrect' && (
        <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/50 flex items-center justify-between text-rose-300 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-rose-400" />
            <span>Not the best move. Try another continuation!</span>
          </div>
          <button
            onClick={() => loadFen(puzzle.fen)}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* Hint box */}
      {hintLevel > 0 && (
        <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-500/30 text-amber-300 text-xs">
          {hintLevel === 1 && (
            <p>
              💡 <strong>Hint:</strong> Look for a {puzzle.themes.join(' & ')} tactic starting with the {puzzle.solution[0].substring(0, 2)} square!
            </p>
          )}
          {hintLevel >= 2 && (
            <p>
              💡 <strong>Solution Move:</strong> {puzzle.solution[0]}
            </p>
          )}
        </div>
      )}

      {/* Action controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setHintLevel((prev) => Math.min(2, prev + 1))}
          className="flex-1 py-2 px-3 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-medium text-amber-300 flex items-center justify-center gap-1.5 transition"
        >
          <Lightbulb className="w-3.5 h-3.5" /> Get Hint
        </button>
        <button
          onClick={revealSolution}
          className="flex-1 py-2 px-3 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-medium text-slate-300 flex items-center justify-center gap-1.5 transition"
        >
          <Eye className="w-3.5 h-3.5" /> Reveal Solution
        </button>
        <button
          onClick={nextPuzzle}
          className="py-2 px-3 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-medium text-slate-300 flex items-center justify-center gap-1 transition"
        >
          Next
        </button>
      </div>
    </div>
  );
};

