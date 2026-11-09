import React, { useEffect, useRef } from 'react';
import { useChessStore } from '../../store/useChessStore';
import { humanSkillEngine, DIFFICULTY_CONFIGS } from '../../engine/HumanSkillEngine';
import { HumanDifficultyLevel } from '../../types/chess';
import { Bot, User, Flag, RotateCcw, Award } from 'lucide-react';

export const BotPlayMode: React.FC = () => {
  const {
    chess,
    fen,
    botDifficulty,
    setBotDifficulty,
    playerColor,
    setPlayerColor,
    isBotThinking,
    setBotThinking,
    makeMove,
    resetGame,
    goToPrev,
  } = useChessStore();

  const isBotTurn = chess.turn() === (playerColor === 'white' ? 'b' : 'w');
  const isGameOver = chess.isGameOver();
  const botTurnRef = useRef(false);

  // Trigger bot move when it's bot's turn
  useEffect(() => {
    if (isBotTurn && !isGameOver && !botTurnRef.current) {
      botTurnRef.current = true;
      setBotThinking(true);

      const timer = setTimeout(async () => {
        try {
          const res = await humanSkillEngine.getBotMove(fen, botDifficulty);
          const from = res.uci.substring(0, 2);
          const to = res.uci.substring(2, 4);
          const promo = res.uci.length > 4 ? res.uci[4] : undefined;
          makeMove(from, to, promo);
        } catch (err) {
          console.error('Bot move failed:', err);
        } finally {
          setBotThinking(false);
          botTurnRef.current = false;
        }
      }, 400);

      return () => clearTimeout(timer);
    }
  }, [fen, isBotTurn, isGameOver, botDifficulty, playerColor, makeMove, setBotThinking]);

  const activeConfig = DIFFICULTY_CONFIGS[botDifficulty];

  // Game over message
  let gameOverText = '';
  if (chess.isCheckmate()) {
    const winner = chess.turn() === 'w' ? 'Black' : 'White';
    gameOverText = `Checkmate! ${winner} wins.`;
  } else if (chess.isDraw()) {
    if (chess.isStalemate()) gameOverText = 'Draw by stalemate.';
    else if (chess.isThreefoldRepetition()) gameOverText = 'Draw by threefold repetition.';
    else if (chess.isInsufficientMaterial()) gameOverText = 'Draw by insufficient material.';
    else gameOverText = 'Game drawn.';
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Bot Profile Card */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-slate-100">{activeConfig.name} Bot</h3>
              <span className="text-xs px-2 py-0.5 rounded font-mono bg-slate-800 text-emerald-400 border border-slate-700">
                ~{activeConfig.targetRating} Elo
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 max-w-sm line-clamp-2">
              {activeConfig.description}
            </p>
          </div>
        </div>
      </div>

      {/* Game status alert */}
      {isGameOver && (
        <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/50 flex items-center gap-2 text-emerald-300 text-sm font-semibold">
          <Award className="w-4 h-4 text-emerald-400" />
          {gameOverText}
        </div>
      )}

      {/* Difficulty Selector */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Difficulty Tier
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(DIFFICULTY_CONFIGS) as HumanDifficultyLevel[]).map((lvl) => {
            const conf = DIFFICULTY_CONFIGS[lvl];
            const isActive = botDifficulty === lvl;

            return (
              <button
                key={lvl}
                onClick={() => setBotDifficulty(lvl)}
                className={`p-2.5 rounded-lg border text-left transition ${
                  isActive
                    ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300 shadow-sm'
                    : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="font-bold text-xs">{conf.name}</div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  {conf.ratingRange}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Playing Color & Controls */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Play As
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              setPlayerColor('white');
              resetGame();
            }}
            className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition ${
              playerColor === 'white'
                ? 'bg-slate-100 text-slate-950 border-white shadow'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            <User className="w-3.5 h-3.5" /> White
          </button>
          <button
            onClick={() => {
              setPlayerColor('black');
              resetGame();
            }}
            className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition ${
              playerColor === 'black'
                ? 'bg-slate-800 text-slate-100 border-emerald-500 shadow'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            <User className="w-3.5 h-3.5" /> Black
          </button>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
        <button
          onClick={goToPrev}
          className="flex-1 py-2 px-3 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-medium text-slate-300 flex items-center justify-center gap-1.5 transition"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Takeback
        </button>
        <button
          onClick={resetGame}
          className="flex-1 py-2 px-3 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-medium text-rose-300 hover:border-rose-900/60 flex items-center justify-center gap-1.5 transition"
        >
          <Flag className="w-3.5 h-3.5" /> Resign / New
        </button>
      </div>
    </div>
  );
};

