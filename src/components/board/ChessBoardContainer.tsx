import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Chessboard } from 'react-chessboard';
import { useChessStore } from '../../store/useChessStore';
import { useEngineStore } from '../../store/useEngineStore';
import { HumanThinkingService } from '../../engine/HumanThinkingService';
import { EvalBar } from './EvalBar';

export const ChessBoardContainer: React.FC = () => {
  const {
    chess,
    fen,
    orientation,
    makeMove,
    isBotThinking,
    mode,
    playerColor,
  } = useChessStore();

  const {
    analysis,
    showArrows,
    showEvalBar,
    requestAnalysis,
    sideFilter,
    activeAnalysisTab,
    humanThinkingLevel,
  } = useEngineStore();

  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [boardWidth, setBoardWidth] = useState<number>(560);
  const containerRef = useRef<HTMLDivElement>(null);

  const sideToMove = chess.turn(); // 'w' | 'b'

  // Resize listener for responsive board
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const availableWidth = containerRef.current.clientWidth - 40;
        const availableHeight = window.innerHeight - 200;
        const target = Math.min(availableWidth, availableHeight, 620);
        setBoardWidth(Math.max(300, target));
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Request engine analysis on FEN change
  useEffect(() => {
    requestAnalysis(fen);
  }, [fen, requestAnalysis]);

  // Compute custom arrows from top candidates (respecting sideFilter, active tab, and current FEN)
  const customArrows = useMemo(() => {
    if (!showArrows || !analysis || !analysis.candidates || chess.isGameOver() || (analysis.fen && analysis.fen !== fen)) return [];

    // Check side filter
    if (sideFilter === 'white' && sideToMove !== 'w') return [];
    if (sideFilter === 'black' && sideToMove !== 'b') return [];

    const arrows: { startSquare: string; endSquare: string; color: string }[] = [];

    // If viewing Human Thinking tab, draw the Human-Likely move arrow in Amber!
    if (activeAnalysisTab === 'human-thinking') {
      const prediction = HumanThinkingService.predictHumanMoves(
        fen,
        analysis.candidates,
        humanThinkingLevel,
        1
      );
      if (prediction && prediction.humanLikelyMove) {
        arrows.push({
          startSquare: prediction.humanLikelyMove.candidate.from,
          endSquare: prediction.humanLikelyMove.candidate.to,
          color: 'rgb(245, 158, 11)', // Warm Amber
        });
      }
      return arrows;
    }

    // Default: Engine arrows
    analysis.candidates.forEach((cand, idx) => {
      if (idx === 0) {
        // Best move: Vibrant Emerald Green
        arrows.push({ startSquare: cand.from, endSquare: cand.to, color: 'rgb(16, 185, 129)' });
      } else if (idx === 1) {
        // 2nd Candidate: Cyan / Light Blue
        arrows.push({ startSquare: cand.from, endSquare: cand.to, color: 'rgba(56, 189, 248, 0.75)' });
      } else if (idx === 2) {
        // 3rd Candidate: Amber
        arrows.push({ startSquare: cand.from, endSquare: cand.to, color: 'rgba(245, 158, 11, 0.65)' });
      }
    });

    return arrows;
  }, [analysis, showArrows, chess, sideFilter, sideToMove, activeAnalysisTab, fen, humanThinkingLevel]);

  // Highlight squares (legal targets, selected, check)
  const customSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};

    // Check highlight
    if (chess.inCheck()) {
      const turn = chess.turn();
      const board = chess.board();
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = board[r][c];
          if (p && p.type === 'k' && p.color === turn) {
            const sq = `${String.fromCharCode(97 + c)}${8 - r}`;
            styles[sq] = {
              backgroundColor: 'rgba(239, 68, 68, 0.65)',
              boxShadow: 'inset 0 0 10px rgba(185, 28, 28, 0.8)',
            };
          }
        }
      }
    }

    // Selected square
    if (selectedSquare) {
      styles[selectedSquare] = {
        backgroundColor: 'rgba(20, 184, 166, 0.6)',
      };

      // Legal moves for selected piece
      const legalMoves = chess.moves({ square: selectedSquare as any, verbose: true });
      legalMoves.forEach((m) => {
        styles[m.to] = {
          background: m.captured
            ? 'radial-gradient(circle, rgba(239,68,68,0.7) 40%, transparent 42%)'
            : 'radial-gradient(circle, rgba(16,185,129,0.75) 25%, transparent 26%)',
          borderRadius: '50%',
        };
      });
    }

    return styles;
  }, [chess, selectedSquare]);

  const handlePieceDrop = ({
    sourceSquare,
    targetSquare,
    piece,
  }: {
    sourceSquare: string;
    targetSquare: string | null;
    piece: any;
  }): boolean => {
    if (!targetSquare) return false;

    // If playing bot and it's not player's turn, prevent move
    if (mode === 'play-bot') {
      const turnColor = chess.turn() === 'w' ? 'white' : 'black';
      if (turnColor !== playerColor || isBotThinking) {
        return false;
      }
    }

    const pieceType = piece?.pieceType || '';
    const promotion =
      pieceType.toLowerCase() === 'p' && (targetSquare[1] === '8' || targetSquare[1] === '1')
        ? 'q'
        : undefined;
    const success = makeMove(sourceSquare, targetSquare, promotion);
    setSelectedSquare(null);
    return success;
  };

  const handleSquareClick = ({ square }: { square: string }) => {
    if (mode === 'play-bot') {
      const turnColor = chess.turn() === 'w' ? 'white' : 'black';
      if (turnColor !== playerColor || isBotThinking) return;
    }

    if (!selectedSquare) {
      const piece = chess.get(square as any);
      if (piece && piece.color === chess.turn()) {
        setSelectedSquare(square);
      }
    } else {
      if (selectedSquare === square) {
        setSelectedSquare(null);
        return;
      }
      const success = makeMove(selectedSquare, square, 'q');
      setSelectedSquare(null);
      if (!success) {
        const piece = chess.get(square as any);
        if (piece && piece.color === chess.turn()) {
          setSelectedSquare(square);
        }
      }
    }
  };

  return (
    <div ref={containerRef} className="flex flex-col items-center w-full select-none">
      <div className="flex items-center justify-center gap-3 w-full">
        {/* Live Eval Bar */}
        {showEvalBar && (
          <EvalBar
            score={analysis?.bestMove?.score}
            orientation={orientation}
            height={boardWidth}
          />
        )}

        {/* Chessboard */}
        <div
          className="relative rounded-lg overflow-hidden shadow-2xl border border-slate-700/80 bg-slate-900"
          style={{ width: `${boardWidth}px`, height: `${boardWidth}px` }}
        >
          <Chessboard
            options={{
              position: fen,
              boardOrientation: orientation,
              onPieceDrop: handlePieceDrop,
              onSquareClick: handleSquareClick,
              arrows: customArrows,
              squareStyles: customSquareStyles,
              darkSquareStyle: { backgroundColor: '#779556' },
              lightSquareStyle: { backgroundColor: '#ebecd0' },
              animationDurationInMs: 180,
              boardStyle: {
                width: `${boardWidth}px`,
                height: `${boardWidth}px`,
              },
            }}
          />

          {/* Bot Thinking Banner */}
          {isBotThinking && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-slate-900/90 border border-emerald-500/50 backdrop-blur-md rounded-full shadow-lg flex items-center gap-2 z-20">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xs font-semibold text-emerald-300 tracking-wide">
                Opponent thinking...
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Visual Arrow Color Legend */}
      {showArrows && customArrows.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5 py-1.5 px-4 bg-slate-900/90 border border-slate-800 rounded-lg text-[11px] text-slate-300 shadow-sm mt-3 max-w-[560px] w-full">
          {activeAnalysisTab === 'human-thinking' ? (
            <div className="flex items-center gap-1.5 font-semibold text-amber-300">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50" />
              <span>Amber: Human-Likely Move ({humanThinkingLevel})</span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                <span>Green: Best Engine Move (#1)</span>
              </div>
              {customArrows.length > 1 && (
                <div className="flex items-center gap-1.5 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shadow-sm shadow-sky-400/50" />
                  <span>Blue: Strong Alternative (#2)</span>
                </div>
              )}
              {customArrows.length > 2 && (
                <div className="flex items-center gap-1.5 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50" />
                  <span>Amber: Good Candidate (#3)</span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
