import { create } from 'zustand';
import { Chess } from 'chess.js';
import { AppMode, HumanDifficultyLevel, HistoryMove, GameMetadata } from '../types/chess';
import { SoundService } from '../services/SoundService';

interface ChessState {
  chess: Chess;
  fen: string;
  history: HistoryMove[];
  currentMoveIndex: number;
  orientation: 'white' | 'black';
  mode: AppMode;
  botDifficulty: HumanDifficultyLevel;
  playerColor: 'white' | 'black';
  isBotThinking: boolean;
  gameMetadata: GameMetadata;
  isPlayingReplay: boolean;
  replaySpeedMs: number;

  // Actions
  setMode: (mode: AppMode) => void;
  setBotDifficulty: (diff: HumanDifficultyLevel) => void;
  setPlayerColor: (color: 'white' | 'black') => void;
  flipBoard: () => void;
  makeMove: (from: string, to: string, promotion?: string) => boolean;
  goToMove: (index: number) => void;
  goToStart: () => void;
  goToEnd: () => void;
  goToNext: () => void;
  goToPrev: () => void;
  resetGame: () => void;
  loadFen: (fen: string) => boolean;
  loadPgn: (pgn: string, metadata?: GameMetadata) => boolean;
  setBotThinking: (thinking: boolean) => void;
  setIsPlayingReplay: (playing: boolean) => void;
  setReplaySpeedMs: (speed: number) => void;
}

export const useChessStore = create<ChessState>((set, get) => ({
  chess: new Chess(),
  fen: new Chess().fen(),
  history: [],
  currentMoveIndex: -1,
  orientation: 'white',
  mode: 'engine-analysis',
  botDifficulty: 'intermediate',
  playerColor: 'white',
  isBotThinking: false,
  gameMetadata: {},
  isPlayingReplay: false,
  replaySpeedMs: 1000,

  setMode: (mode) => set({ mode }),
  setBotDifficulty: (botDifficulty) => set({ botDifficulty }),
  setPlayerColor: (playerColor) => set({ playerColor, orientation: playerColor }),
  flipBoard: () => set((state) => ({ orientation: state.orientation === 'white' ? 'black' : 'white' })),

  makeMove: (from, to, promotion = 'q') => {
    const { chess, history, currentMoveIndex } = get();

    // If navigating in past history, truncate future moves
    if (currentMoveIndex < history.length - 1) {
      const replayChess = new Chess();
      for (let i = 0; i <= currentMoveIndex; i++) {
        replayChess.move(history[i].san);
      }
      chess.load(replayChess.fen());
    }

    const fenBefore = chess.fen();
    try {
      const moveResult = chess.move({ from, to, promotion });
      if (!moveResult) return false;

      const fenAfter = chess.fen();

      // Procedural audio
      if (moveResult.captured) {
        SoundService.playCapture();
      } else if (moveResult.san.includes('+') || moveResult.san.includes('#')) {
        SoundService.playCheck();
      } else {
        SoundService.playMove();
      }

      const historyMove: HistoryMove = {
        uci: moveResult.from + moveResult.to + (moveResult.promotion || ''),
        san: moveResult.san,
        fenBefore,
        fenAfter,
        color: moveResult.color,
        captured: moveResult.captured,
        check: moveResult.san.includes('+'),
        checkmate: moveResult.san.includes('#'),
      };

      const newHistory = [...history.slice(0, currentMoveIndex + 1), historyMove];

      set({
        fen: fenAfter,
        history: newHistory,
        currentMoveIndex: newHistory.length - 1,
      });

      return true;
    } catch {
      return false;
    }
  },

  goToMove: (index) => {
    const { history } = get();
    if (index < -1 || index >= history.length) return;

    if (index === -1) {
      const startChess = new Chess();
      set({
        chess: startChess,
        fen: startChess.fen(),
        currentMoveIndex: -1,
      });
      return;
    }

    const replayChess = new Chess();
    for (let i = 0; i <= index; i++) {
      replayChess.move(history[i].san);
    }

    set({
      chess: replayChess,
      fen: replayChess.fen(),
      currentMoveIndex: index,
    });
  },

  goToStart: () => get().goToMove(-1),
  goToEnd: () => get().goToMove(get().history.length - 1),
  goToPrev: () => get().goToMove(get().currentMoveIndex - 1),
  goToNext: () => get().goToMove(get().currentMoveIndex + 1),

  resetGame: () => {
    const fresh = new Chess();
    set({
      chess: fresh,
      fen: fresh.fen(),
      history: [],
      currentMoveIndex: -1,
      isPlayingReplay: false,
    });
  },

  loadFen: (fen) => {
    try {
      const test = new Chess(fen);
      set({
        chess: test,
        fen: test.fen(),
        history: [],
        currentMoveIndex: -1,
      });
      return true;
    } catch {
      return false;
    }
  },

  loadPgn: (pgn, metadata = {}) => {
    try {
      const temp = new Chess();
      temp.loadPgn(pgn);
      const moves = temp.history({ verbose: true });

      const replay = new Chess();
      const historyList: HistoryMove[] = [];

      for (const m of moves) {
        const fenBefore = replay.fen();
        replay.move(m.san);
        const fenAfter = replay.fen();
        historyList.push({
          uci: m.from + m.to + (m.promotion || ''),
          san: m.san,
          fenBefore,
          fenAfter,
          color: m.color,
          captured: m.captured,
          check: m.san.includes('+'),
          checkmate: m.san.includes('#'),
        });
      }

      set({
        chess: replay,
        fen: replay.fen(),
        history: historyList,
        currentMoveIndex: historyList.length - 1,
        gameMetadata: metadata,
      });

      return true;
    } catch {
      return false;
    }
  },

  setBotThinking: (isBotThinking) => set({ isBotThinking }),
  setIsPlayingReplay: (isPlayingReplay) => set({ isPlayingReplay }),
  setReplaySpeedMs: (replaySpeedMs) => set({ replaySpeedMs }),
}));

