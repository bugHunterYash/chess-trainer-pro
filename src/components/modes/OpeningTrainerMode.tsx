import React, { useState, useEffect } from 'react';
import { useChessStore } from '../../store/useChessStore';
import { BookOpen, CheckCircle, RotateCcw, ChevronRight } from 'lucide-react';

interface OpeningLine {
  id: string;
  name: string;
  eco: string;
  moves: string[]; // SAN sequence
  description: string;
}

const REPERTOIRES: OpeningLine[] = [
  {
    id: 'italian_game',
    name: 'Italian Game (Giuoco Piano)',
    eco: 'C50',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd3'],
    description: 'A classical, fundamental opening prioritizing rapid kingside development and harmonious central pawn support.',
  },
  {
    id: 'sicilian_najdorf',
    name: 'Sicilian Defense (Najdorf)',
    eco: 'B90',
    moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'],
    description: 'The sharpest and most celebrated response to 1.e4, fighting for unbalanced asymmetrical tactical counterplay.',
  },
  {
    id: 'queens_gambit',
    name: "Queen's Gambit Declined",
    eco: 'D30',
    moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Bg5', 'Be7', 'e3'],
    description: 'Solid, reliable mastery of the center, refusing the gambit pawn to preserve rigid central pawn control.',
  },
  {
    id: 'ruy_lopez',
    name: 'Ruy Lopez (Spanish Opening)',
    eco: 'C60',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O'],
    description: 'One of the oldest and deepest openings in chess history, applying indirect pressure to the e5 defender.',
  },
  {
    id: 'caro_kann',
    name: 'Caro-Kann Defense',
    eco: 'B12',
    moves: ['e4', 'c6', 'd4', 'd5', 'e5', 'Bf5', 'Nf3', 'e6'],
    description: 'Ultra-solid pawn structure enabling Black to develop the light-squared bishop before closing the pawn chain.',
  },
];

export const OpeningTrainerMode: React.FC = () => {
  const { resetGame, makeMove, history } = useChessStore();
  const [selectedOpening, setSelectedOpening] = useState<OpeningLine>(REPERTOIRES[0]);

  // Restart board when opening changes
  useEffect(() => {
    resetGame();
  }, [selectedOpening, resetGame]);

  const currentStep = history.length;
  const isComplete = currentStep >= selectedOpening.moves.length;
  const nextTargetMove = !isComplete ? selectedOpening.moves[currentStep] : null;

  // Auto-respond with opponent move if user plays correct move
  const handleAutoStep = () => {
    if (isComplete) return;
    const target = selectedOpening.moves[currentStep];
    // We can simulate playing the step
    const tempBoard = useChessStore.getState().chess;
    const moves = tempBoard.moves({ verbose: true });
    const match = moves.find((m) => m.san === target);
    if (match) {
      makeMove(match.from, match.to, match.promotion);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Repertoire Selector */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-emerald-400" /> Opening Repertoire
          </label>
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            {selectedOpening.eco}
          </span>
        </div>

        <select
          value={selectedOpening.id}
          onChange={(e) => {
            const found = REPERTOIRES.find((r) => r.id === e.target.value);
            if (found) setSelectedOpening(found);
          }}
          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs font-medium text-slate-200 focus:outline-none focus:border-emerald-500"
        >
          {REPERTOIRES.map((rep) => (
            <option key={rep.id} value={rep.id}>
              {rep.name} ({rep.eco})
            </option>
          ))}
        </select>

        <p className="text-xs text-slate-400 leading-relaxed">
          {selectedOpening.description}
        </p>
      </div>

      {/* Progress & Next Move Goal */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400">Repertoire Progress</span>
          <span className="text-xs font-mono font-bold text-slate-200">
            {currentStep} / {selectedOpening.moves.length} Moves
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${(currentStep / selectedOpening.moves.length) * 100}%` }}
          />
        </div>

        {isComplete ? (
          <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/40 flex items-center gap-2 text-emerald-300 text-xs font-semibold">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            Line completed! You mastered this variation.
          </div>
        ) : (
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-xs text-slate-400">Target Move:</span>
            <span className="text-sm font-bold font-mono text-emerald-400">
              {nextTargetMove}
            </span>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleAutoStep}
            disabled={isComplete}
            className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded-lg disabled:opacity-40 transition flex items-center justify-center gap-1.5"
          >
            Play Next Step <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={resetGame}
            className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
        </div>
      </div>
    </div>
  );
};

