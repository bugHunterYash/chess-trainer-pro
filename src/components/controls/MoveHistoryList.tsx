import React, { useRef, useEffect } from 'react';
import { useChessStore } from '../../store/useChessStore';

export const MoveHistoryList: React.FC = () => {
  const { history, currentMoveIndex, goToMove } = useChessStore();
  const activeMoveRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the move list container internally WITHOUT scrolling the entire window or moving the board
  useEffect(() => {
    if (activeMoveRef.current && containerRef.current) {
      const container = containerRef.current;
      const el = activeMoveRef.current;
      const elTop = el.offsetTop;
      const containerScroll = container.scrollTop;
      const containerHeight = container.clientHeight;

      if (elTop < containerScroll || elTop > containerScroll + containerHeight - 40) {
        container.scrollTo({ top: Math.max(0, elTop - 60), behavior: 'smooth' });
      }
    }
  }, [currentMoveIndex]);

  if (history.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-slate-500 italic bg-slate-900/40 rounded-lg border border-slate-800">
        Move history will appear here...
      </div>
    );
  }

  // Pair moves into turns
  const turns: { turnNum: number; white?: { san: string; idx: number }; black?: { san: string; idx: number } }[] = [];

  for (let i = 0; i < history.length; i += 2) {
    turns.push({
      turnNum: Math.floor(i / 2) + 1,
      white: { san: history[i].san, idx: i },
      black: history[i + 1] ? { san: history[i + 1].san, idx: i + 1 } : undefined,
    });
  }

  return (
    <div ref={containerRef} className="max-h-56 overflow-y-auto pr-1 text-xs font-mono space-y-1">
      {turns.map((turn) => {
        const isWhiteActive = currentMoveIndex === turn.white?.idx;
        const isBlackActive = currentMoveIndex === turn.black?.idx;

        return (
          <div key={turn.turnNum} className="grid grid-cols-7 items-center gap-1 px-2 py-1 rounded hover:bg-slate-800/40 transition">
            <span className="col-span-1 text-slate-500 select-none">{turn.turnNum}.</span>

            {/* White move */}
            {turn.white && (
              <button
                ref={isWhiteActive ? activeMoveRef : null}
                onClick={() => goToMove(turn.white!.idx)}
                className={`col-span-3 text-left px-2 py-0.5 rounded transition ${
                  isWhiteActive
                    ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40'
                    : 'text-slate-200 hover:text-white'
                }`}
              >
                {turn.white.san}
              </button>
            )}

            {/* Black move */}
            {turn.black ? (
              <button
                ref={isBlackActive ? activeMoveRef : null}
                onClick={() => goToMove(turn.black!.idx)}
                className={`col-span-3 text-left px-2 py-0.5 rounded transition ${
                  isBlackActive
                    ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40'
                    : 'text-slate-200 hover:text-white'
                }`}
              >
                {turn.black.san}
              </button>
            ) : (
              <span className="col-span-3" />
            )}
          </div>
        );
      })}
    </div>
  );
};

