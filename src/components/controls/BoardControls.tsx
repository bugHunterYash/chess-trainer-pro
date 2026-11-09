import React, { useEffect } from 'react';
import { useChessStore } from '../../store/useChessStore';
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
  RefreshCw,
} from 'lucide-react';

export const BoardControls: React.FC = () => {
  const {
    history,
    currentMoveIndex,
    goToStart,
    goToEnd,
    goToPrev,
    goToNext,
    flipBoard,
    resetGame,
    isPlayingReplay,
    setIsPlayingReplay,
    replaySpeedMs,
    setReplaySpeedMs,
  } = useChessStore();

  // Keyboard navigation (Left, Right, Up, Down arrows)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === 'ArrowLeft') {
        goToPrev();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      } else if (e.key === 'ArrowUp') {
        goToStart();
      } else if (e.key === 'ArrowDown') {
        goToEnd();
      } else if (e.key === 'f' || e.key === 'F') {
        flipBoard();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPrev, goToNext, goToStart, goToEnd, flipBoard]);

  // Auto-replay interval
  useEffect(() => {
    if (!isPlayingReplay) return;

    const interval = setInterval(() => {
      if (currentMoveIndex < history.length - 1) {
        goToNext();
      } else {
        setIsPlayingReplay(false);
      }
    }, replaySpeedMs);

    return () => clearInterval(interval);
  }, [isPlayingReplay, currentMoveIndex, history.length, goToNext, replaySpeedMs, setIsPlayingReplay]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-900/90 border border-slate-800 rounded-xl">
      {/* Navigation arrows */}
      <div className="flex items-center gap-1">
        <button
          onClick={goToStart}
          disabled={currentMoveIndex <= -1}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
          title="First Move (Up Arrow)"
        >
          <ChevronFirst className="w-4 h-4" />
        </button>
        <button
          onClick={goToPrev}
          disabled={currentMoveIndex <= -1}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
          title="Previous Move (Left Arrow)"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <button
          onClick={() => setIsPlayingReplay(!isPlayingReplay)}
          disabled={history.length === 0}
          className={`p-2 rounded-lg text-slate-300 transition ${
            isPlayingReplay
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'bg-slate-800/80 hover:bg-slate-700'
          }`}
          title={isPlayingReplay ? 'Pause Replay' : 'Auto Play Replay'}
        >
          {isPlayingReplay ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>

        <button
          onClick={goToNext}
          disabled={currentMoveIndex >= history.length - 1}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
          title="Next Move (Right Arrow)"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={goToEnd}
          disabled={currentMoveIndex >= history.length - 1}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
          title="Last Move (Down Arrow)"
        >
          <ChevronLast className="w-4 h-4" />
        </button>
      </div>

      {/* Board Utility Buttons */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={flipBoard}
          className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-xs font-medium text-slate-300 flex items-center gap-1.5 transition"
          title="Flip Board (Press F)"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Flip</span>
        </button>

        <button
          onClick={resetGame}
          className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-900/40 hover:text-rose-300 text-xs font-medium text-slate-400 flex items-center gap-1.5 transition"
          title="Reset Board"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>
      </div>
    </div>
  );
};

