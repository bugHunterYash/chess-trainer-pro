import React, { useState, useEffect, useRef } from 'react';
import { useChessStore } from '../../store/useChessStore';
import { useEngineStore } from '../../store/useEngineStore';
import { GameImportService } from '../../services/GameImportService';
import { StorageService } from '../../services/StorageService';
import { stockfishService } from '../../engine/StockfishService';
import { EvaluationService } from '../../engine/EvaluationService';
import { SoundService } from '../../services/SoundService';
import { EvalGraph } from '../analysis/EvalGraph';
import { diagnostics } from '../../services/DiagnosticsService';
import {
  Upload,
  CheckCircle2,
  XCircle,
  Radio,
  Sparkles,
  StopCircle,
  Info,
  Download,
  Clock,
} from 'lucide-react';

export const GameAnalysisMode: React.FC = () => {
  const { loadPgn, loadFen, history, gameMetadata, flipBoard, orientation } = useChessStore();
  const [importType, setImportType] = useState<'lichess' | 'pgn' | 'fen'>('lichess');
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewProgress, setReviewProgress] = useState(0);

  // Live Lichess Sync state
  const [isLiveSyncActive, setIsLiveSyncActive] = useState(false);
  const [liveGameId, setLiveGameId] = useState<string | null>(null);
  const [liveUsername, setLiveUsername] = useState<string | null>(null);
  const [lastMoveCount, setLastMoveCount] = useState(0);
  const lastMoveCountRef = useRef(0);
  const lastBridgeSyncRef = useRef<number>(0);
  const [clocks, setClocks] = useState<{ whiteClock?: string; blackClock?: string }>({});
  const streamAbortRef = useRef<AbortController | null>(null);

  const [isExtensionConnected, setIsExtensionConnected] = useState(false);
  const [showExtensionHelp, setShowExtensionHelp] = useState(false);

  // Real-Time Bridge Listener: Receives 0ms instant moves from Lichess extension/bridge
  useEffect(() => {
    let lastHandledTimestamp = 0;

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/live-sync');
        if (!res.ok) return;
        const data = await res.json();

        if (data.timestamp && data.timestamp > 0) {
          setIsExtensionConnected(true);
        }

        if (data.timestamp && data.timestamp > lastHandledTimestamp) {
          lastHandledTimestamp = data.timestamp;
          lastBridgeSyncRef.current = Date.now();
          diagnostics.recordSyncUpdate();

          if (data.fen) {
            GameImportService.recordBridgePosition(data.fen, data.moves?.length, liveGameId || undefined);
          }

          const currentFen = useChessStore.getState().fen;
          const currentMovesCount = useChessStore.getState().history.length;

          // Only reload board if a real move was played or position actually changed!
          const hasNewMoves = Array.isArray(data.moves) && data.moves.length > 0 && data.moves.length !== currentMovesCount;
          const hasNewFen = data.fen && data.fen.split(' ')[0] !== currentFen.split(' ')[0];

          if (hasNewMoves) {
            const pgnString = data.moves
              .map((m: string, i: number) => (i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ${m}` : `${m}`))
              .join(' ');

            try {
              const parsed = GameImportService.parsePgn(pgnString);
              loadPgn(parsed.pgn, {
                white: data.orientation === 'black' ? 'Opponent' : (localStorage.getItem('chess_lichess_user') || 'You'),
                black: data.orientation === 'black' ? (localStorage.getItem('chess_lichess_user') || 'You') : 'Opponent',
                result: '*',
              });
              setSuccessMsg(`⚡ Live Board Synced in 0ms! (${data.orientation.toUpperCase()})`);
            } catch {
              if (hasNewFen) {
                loadFen(data.fen);
              }
            }
          } else if (hasNewFen && (!data.moves || data.moves.length === 0)) {
            loadFen(data.fen);
            setSuccessMsg(`⚡ Live Board Synced in 0ms! (${data.orientation.toUpperCase()})`);
          } else {
            diagnostics.recordDuplicatePositionIgnored(data.fen);
          }

          // 2. Sync board orientation ONLY if changed
          if (data.orientation && useChessStore.getState().orientation !== data.orientation) {
            useChessStore.setState({ orientation: data.orientation });
          }

          // 3. Smooth clocks update (pure state update - never re-animates pieces or reloads board!)
          if (data.whiteClock || data.blackClock) {
            setClocks((prev) => {
              if (prev.whiteClock === data.whiteClock && prev.blackClock === data.blackClock) {
                return prev;
              }
              return {
                whiteClock: data.whiteClock,
                blackClock: data.blackClock,
              };
            });
          }

          setIsLiveSyncActive(true);
        }
      } catch {
        // Dev server busy
      }
    }, 200);

    return () => clearInterval(interval);
  }, [liveGameId, loadFen, loadPgn]);

  const handleImport = async () => {
    if (!inputValue.trim()) return;
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (importType === 'lichess') {
        const game = await GameImportService.importFromLichess(inputValue);
        loadPgn(game.pgn, game.metadata);
        await StorageService.saveGame(game);
        setSuccessMsg(`Successfully imported ${game.metadata.white || 'White'} vs ${game.metadata.black || 'Black'}`);

        // Automatically match player perspective (e.g. if URL is /black)
        let knownUser = localStorage.getItem('chess_lichess_user') || '';
        if (GameImportService.isUsernameInput(inputValue)) {
          knownUser = GameImportService.extractUsername(inputValue);
          localStorage.setItem('chess_lichess_user', knownUser);
        }

        const perspective = GameImportService.extractOrientation(inputValue);
        if (perspective) {
          useChessStore.setState({ orientation: perspective });
        } else if (knownUser) {
          // Auto-match perspective by user's username
          const userClean = knownUser.toLowerCase();
          if (game.metadata.black && game.metadata.black.toLowerCase() === userClean) {
            useChessStore.setState({ orientation: 'black' });
          } else if (game.metadata.white && game.metadata.white.toLowerCase() === userClean) {
            useChessStore.setState({ orientation: 'white' });
          }
        }

        const parsedClocks = GameImportService.extractClocks(game.pgn);
        setClocks(parsedClocks);

        const knownUserFromStorage = localStorage.getItem('chess_lichess_user') || 'VictorWernervonDo';
        if (GameImportService.isUsernameInput(inputValue)) {
          const u = GameImportService.extractUsername(inputValue);
          setLiveUsername(u);
          localStorage.setItem('chess_lichess_user', u);
          setLiveGameId(game.id || null);
        } else {
          setLiveGameId(game.id || null);
          setLiveUsername(knownUserFromStorage);
        }

        lastMoveCountRef.current = game.moves.length;
        setLastMoveCount(game.moves.length);
        setIsLiveSyncActive(true); // Auto-start live sync
      } else if (importType === 'pgn') {
        const game = GameImportService.parsePgn(inputValue);
        loadPgn(game.pgn, game.metadata);
        await StorageService.saveGame(game);
        setSuccessMsg(`Imported ${game.moves.length} moves from PGN`);

        const parsedClocks = GameImportService.extractClocks(game.pgn);
        setClocks(parsedClocks);
      } else if (importType === 'fen') {
        const parsed = GameImportService.parseFen(inputValue);
        if (!parsed.isValid) throw new Error(parsed.error);
        loadFen(parsed.fen);
        setSuccessMsg('Loaded custom FEN position');
        setClocks({});
      }
      setInputValue('');
    } catch (err: any) {
      if (err.message && err.message.includes('404')) {
        setErrorMsg('Lichess 404: Game not found or was aborted before moves were played. Tip: You can enter your Lichess username (e.g. @VictorWernervonDo) to auto-stream any active game!');
      } else if (err.message && err.message.includes('Failed to fetch')) {
        setErrorMsg('Connection Error (Failed to fetch): Lichess blocked cross-origin request or game was aborted. Tip: Enter username @VictorWernervonDo or paste PGN directly.');
      } else {
        setErrorMsg(err.message || 'Import failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSyncMyGame = async () => {
    const user = '@VictorWernervonDo';
    setInputValue(user);
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const game = await GameImportService.importFromLichess(user);
      loadPgn(game.pgn, game.metadata);
      await StorageService.saveGame(game);
      setSuccessMsg(`Streaming live game for ${user}: ${game.metadata.white || 'White'} vs ${game.metadata.black || 'Black'}`);

      setLiveUsername('VictorWernervonDo');
      localStorage.setItem('chess_lichess_user', 'VictorWernervonDo');
      setLiveGameId(game.id || null);

      if (game.metadata.black && game.metadata.black.toLowerCase() === 'victorwernervondo') {
        useChessStore.setState({ orientation: 'black' });
      } else if (game.metadata.white && game.metadata.white.toLowerCase() === 'victorwernervondo') {
        useChessStore.setState({ orientation: 'white' });
      }

      const parsedClocks = GameImportService.extractClocks(game.pgn);
      setClocks(parsedClocks);
      lastMoveCountRef.current = game.moves.length;
      setLastMoveCount(game.moves.length);
      setIsLiveSyncActive(true);
      setInputValue('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not find an active game for @VictorWernervonDo');
    } finally {
      setLoading(false);
    }
  };

  // Live Lichess Real-Time Stream (0ms push stream + resilient safety watchdog sync)
  useEffect(() => {
    if (!isLiveSyncActive || (!liveGameId && !liveUsername)) {
      if (streamAbortRef.current) {
        streamAbortRef.current.abort();
        streamAbortRef.current = null;
      }
      return;
    }

    const abortController = new AbortController();
    streamAbortRef.current = abortController;
    let isTerminated = false;

    const startStreaming = async () => {
      let activeId = liveGameId;

      try {
        // If username provided and no game ID yet, resolve current game ID
        if (!activeId && liveUsername) {
          const pgnText = await GameImportService.fetchUserCurrentGame(liveUsername);
          const idMatch =
            pgnText.match(/\[GameId "([a-zA-Z0-9]+)"\]/) ||
            pgnText.match(/\[Site "https:\/\/lichess\.org\/(?:game\/)?([a-zA-Z0-9]+)"\]/);
          if (idMatch) {
            activeId = idMatch[1];
          }
        }

        if (!activeId || abortController.signal.aborted) return;

        // Auto-reconnecting streaming loop
        while (!abortController.signal.aborted && !isTerminated) {
          try {
            await GameImportService.streamLichessGame(
              activeId,
              (event) => {
                if (abortController.signal.aborted || isTerminated) return;

                // 1. Update clocks
                if (event.whiteClock || event.blackClock) {
                  setClocks({
                    whiteClock: event.whiteClock,
                    blackClock: event.blackClock,
                  });
                }

                // 2. Play move or sync position
                const currentFen = useChessStore.getState().fen;
                if (currentFen !== event.fen) {
                  if (event.lastMove && event.lastMove.length >= 4) {
                    const from = event.lastMove.substring(0, 2);
                    const to = event.lastMove.substring(2, 4);
                    const promo = event.lastMove.length > 4 ? event.lastMove[4] : undefined;
                    const ok = useChessStore.getState().makeMove(from, to, promo);
                    if (!ok) {
                      // Fallback: fast full PGN resync
                      GameImportService.fetchLichessPgn(activeId!).then((pgn) => {
                        const parsed = GameImportService.parsePgn(pgn);
                        loadPgn(parsed.pgn, parsed.metadata);
                      }).catch(() => {});
                    }
                  } else if (useChessStore.getState().history.length === 0) {
                    // Only load initial fen if game hasn't started yet
                    useChessStore.getState().loadFen(event.fen);
                  }
                }

                // 3. Handle game termination
                if (event.isEnd) {
                  isTerminated = true;
                  setIsLiveSyncActive(false);
                  setSuccessMsg('Game ended on Lichess. Live sync completed.');
                }
              },
              abortController.signal
            );
          } catch (streamErr) {
            // Stream disconnected or timed out; wait 1.2s then retry connection
            if (abortController.signal.aborted || isTerminated) break;
            await new Promise((r) => setTimeout(r, 1200));
          }
        }
      } catch (err: any) {
        if (!abortController.signal.aborted) {
          console.warn('Lichess live stream closed/error:', err);
        }
      }
    };

    // Resilient safety watchdog: polls only when extension bridge is inactive
    const watchdogInterval = setInterval(async () => {
      if (abortController.signal.aborted || isTerminated) return;

      // If extension bridge is actively syncing in 0ms, suppress watchdog API polling
      // to avoid redundant requests and prevent spectator delay rollbacks!
      if (Date.now() - lastBridgeSyncRef.current < 8000) {
        return;
      }

      let targetId = liveGameId;
      const targetUser = liveUsername || (typeof window !== 'undefined' ? localStorage.getItem('chess_lichess_user') : null);

      try {
        let latestPgn: string | null = null;
        if (targetId) {
          try {
            latestPgn = await GameImportService.fetchLichessPgn(targetId, abortController.signal);
          } catch {
            latestPgn = null;
          }
        }

        // If targetId failed or not found, try username lookup
        if (!latestPgn && targetUser) {
          try {
            latestPgn = await GameImportService.fetchUserCurrentGame(targetUser, abortController.signal);
            const idMatch =
              latestPgn.match(/\[GameId "([a-zA-Z0-9]+)"\]/) ||
              latestPgn.match(/\[Site "https:\/\/lichess\.org\/(?:game\/)?([a-zA-Z0-9]+)"\]/);
            if (idMatch && idMatch[1] !== targetId) {
              setLiveGameId(idMatch[1]);
            }
          } catch {
            latestPgn = null;
          }
        }

        if (!latestPgn || abortController.signal.aborted || isTerminated) return;

        // Sync clocks from PGN comments
        const parsedClocks = GameImportService.extractClocks(latestPgn);
        if (parsedClocks.whiteClock || parsedClocks.blackClock) {
          setClocks(parsedClocks);
        }

        const latestGame = GameImportService.parsePgn(latestPgn);
        const currentMovesCount = useChessStore.getState().history.length;
        const currentFen = useChessStore.getState().fen;

        // Suppress redundant update if bridge already delivered this exact position
        if (GameImportService.isRedundantWithBridge(latestGame.fen, latestGame.moves.length)) {
          return;
        }

        // Never rollback moves due to delayed spectator API
        if (latestGame.moves.length < currentMovesCount) {
          return;
        }

        if (latestGame.moves.length > currentMovesCount || (latestGame.moves.length === currentMovesCount && latestGame.fen !== currentFen)) {
          loadPgn(latestGame.pgn, latestGame.metadata);
        }

        // Check if game has ended
        if (latestGame.metadata.result && latestGame.metadata.result !== '*') {
          isTerminated = true;
          setIsLiveSyncActive(false);
          setSuccessMsg(`Game ended: ${latestGame.metadata.result}. Live sync completed.`);
        }
      } catch {
        // Ignore watchdog network hiccups
      }
    }, 2000);

    startStreaming();

    return () => {
      isTerminated = true;
      clearInterval(watchdogInterval);
      abortController.abort();
    };
  }, [isLiveSyncActive, liveGameId, liveUsername]);

  /**
   * Runs an automated background review of all moves in the game.
   */
  const handleRunFullReview = async () => {
    if (history.length === 0 || isReviewing) return;
    setIsReviewing(true);
    setReviewProgress(0);

    const updatedHistory = [...history];
    const totalMoves = updatedHistory.length;

    for (let i = 0; i < totalMoves; i++) {
      const moveItem = updatedHistory[i];
      await new Promise<void>((resolve) => {
        stockfishService.analyzePosition(
          moveItem.fenAfter,
          { depth: 8, multipv: 1 },
          (info) => {
            moveItem.evalAfter = info.score;
          },
          () => {
            resolve();
          }
        );
      });

      setReviewProgress(Math.round(((i + 1) / totalMoves) * 100));
    }

    for (let i = 0; i < totalMoves; i++) {
      const current = updatedHistory[i];
      const prevScore = i > 0 ? updatedHistory[i - 1].evalAfter : { type: 'cp' as const, value: 0, text: '0.0' };
      const currentScore = current.evalAfter || { type: 'cp' as const, value: 0, text: '0.0' };

      current.classification = EvaluationService.classifyMove(
        prevScore || { type: 'cp', value: 0, text: '0.0' },
        currentScore,
        current.color
      );
    }

    useChessStore.setState({ history: updatedHistory });
    setIsReviewing(false);
    setSuccessMsg('Game Review Complete! Timeline and move classifications updated.');
  };

  /**
   * Exports the current game as an annotated PGN with evaluation and classifications.
   */
  const handleExportAnnotatedPgn = () => {
    if (history.length === 0) return;

    let pgn = '';
    pgn += `[Event "${gameMetadata.event || 'Chess Trainer Practice Review'}"]\n`;
    pgn += `[Site "Chess Trainer Pro"]\n`;
    pgn += `[Date "${gameMetadata.date || new Date().toISOString().slice(0, 10).replace(/-/g, '.')}"]\n`;
    pgn += `[White "${gameMetadata.white || 'White'}"]\n`;
    pgn += `[Black "${gameMetadata.black || 'Black'}"]\n`;
    pgn += `[Result "${gameMetadata.result || '*'}"]\n\n`;

    let moveText = '';
    for (let i = 0; i < history.length; i++) {
      const item = history[i];
      if (item.color === 'w') {
        const moveNum = Math.floor(i / 2) + 1;
        moveText += `${moveNum}. `;
      }
      moveText += `${item.san} `;

      const evalStr = item.evalAfter
        ? item.evalAfter.type === 'mate'
          ? `[%eval #${item.evalAfter.value}]`
          : `[%eval ${(item.evalAfter.value / 100).toFixed(2)}]`
        : '';
      const classStr = item.classification ? `[${item.classification.toUpperCase()}]` : '';

      if (evalStr || classStr) {
        moveText += `{ ${[evalStr, classStr].filter(Boolean).join(' ')} } `;
      }
    }
    moveText += `${gameMetadata.result || '*'}`;
    pgn += moveText;

    const blob = new Blob([pgn], { type: 'application/x-chess-pgn' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const whiteClean = (gameMetadata.white || 'White').replace(/\s+/g, '_');
    const blackClean = (gameMetadata.black || 'Black').replace(/\s+/g, '_');
    a.download = `${whiteClean}_vs_${blackClean}_annotated.pgn`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const whiteMoves = history.filter((m) => m.color === 'w');
  const blackMoves = history.filter((m) => m.color === 'b');

  const countClass = (moves: typeof history, cls: string) =>
    moves.filter((m) => m.classification === cls).length;

  const whiteStats = {
    best: countClass(whiteMoves, 'best'),
    excellent: countClass(whiteMoves, 'excellent'),
    inaccuracy: countClass(whiteMoves, 'inaccuracy'),
    mistake: countClass(whiteMoves, 'mistake'),
    blunder: countClass(whiteMoves, 'blunder'),
  };

  const blackStats = {
    best: countClass(blackMoves, 'best'),
    excellent: countClass(blackMoves, 'excellent'),
    inaccuracy: countClass(blackMoves, 'inaccuracy'),
    mistake: countClass(blackMoves, 'mistake'),
    blunder: countClass(blackMoves, 'blunder'),
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Import Box */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
            <Upload className="w-4 h-4 text-emerald-400" /> Import Game / Position
          </h3>
          <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setImportType('lichess')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                importType === 'lichess' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Lichess URL
            </button>
            <button
              onClick={() => setImportType('pgn')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                importType === 'pgn' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              PGN
            </button>
            <button
              onClick={() => setImportType('fen')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                importType === 'fen' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              FEN
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          {importType === 'pgn' ? (
            <textarea
              rows={3}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Paste complete PGN here [Event ...] 1. e4 e5..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          ) : (
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={
                importType === 'lichess'
                  ? 'https://lichess.org/PsYRbdRp or @VictorWernervonDo'
                  : 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
              }
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          )}

          <button
            onClick={handleImport}
            disabled={loading || !inputValue.trim()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded-lg disabled:opacity-40 transition flex items-center gap-1.5 self-end"
          >
            {loading ? 'Importing...' : 'Load'}
          </button>
        </div>

        {importType === 'lichess' && (
          <div className="flex items-center justify-between pt-0.5">
            <button
              type="button"
              onClick={handleQuickSyncMyGame}
              disabled={loading}
              className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-950/80 border border-emerald-600/50 text-emerald-300 hover:bg-emerald-900/60 transition flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
            >
              <Radio className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
              1-Click Live Sync: @VictorWernervonDo
            </button>
            <span className="text-[10px] text-slate-500 font-mono">Auto-detects active game &amp; side</span>
          </div>
        )}

        {importType === 'lichess' && (
          <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-800/60 mt-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isExtensionConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                <span className="text-[11px] font-medium text-slate-300">
                  {isExtensionConnected ? 'Extension Sync Bridge: Connected ⚡ (0ms lag)' : 'Extension Sync Bridge: Ready'}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <a
                  href="/chess-trainer-extension.zip"
                  download="chess-trainer-pro-extension.zip"
                  className="text-[10px] text-emerald-300 bg-emerald-950/70 border border-emerald-600/40 px-2 py-0.5 rounded hover:bg-emerald-900 transition flex items-center gap-1 font-semibold"
                  title="Download Chrome Extension (.zip)"
                >
                  <Download className="w-3 h-3 text-emerald-400" /> Download .zip
                </a>
                <button
                  type="button"
                  onClick={() => setShowExtensionHelp(!showExtensionHelp)}
                  className="text-[10px] text-emerald-400 hover:text-emerald-300 underline font-medium cursor-pointer"
                >
                  {showExtensionHelp ? 'Hide Setup' : 'How to install (10 sec)'}
                </button>
              </div>
            </div>

            {showExtensionHelp && (
              <div className="p-3 rounded-lg bg-slate-950 border border-emerald-900/40 text-[11px] text-slate-300 space-y-2 mt-1 font-sans">
                <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                  <p className="font-semibold text-emerald-300 flex items-center gap-1.5">
                    🚀 Install 0ms Lichess Sync Extension:
                  </p>
                  <a
                    href="/chess-trainer-extension.zip"
                    download="chess-trainer-pro-extension.zip"
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-[10px] rounded transition flex items-center gap-1 shadow"
                  >
                    <Download className="w-3 h-3" /> Download Extension (.zip)
                  </a>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-slate-400 text-[10px]">
                  <li>Click the <strong>"Download Extension (.zip)"</strong> button above and extract it.</li>
                  <li>Open <code className="text-sky-300">chrome://extensions</code> in your browser.</li>
                  <li>Enable <strong>"Developer mode"</strong> (toggle at the top-right corner).</li>
                  <li>Click <strong>"Load unpacked"</strong> (top-left) and select the extracted extension folder.</li>
                  <li>Done! Any move played on Lichess will instantly sync here in 0ms without delay.</li>
                </ol>
              </div>
            )}
          </div>
        )}

        {/* Live Sync Banner if Lichess Game Loaded */}
        {(liveGameId || liveUsername) && (
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-3">
              <span className={`w-2.5 h-2.5 rounded-full ${isLiveSyncActive ? 'bg-rose-500 animate-ping' : 'bg-slate-600'}`} />
              <div className="flex flex-col">
                <span className="text-xs text-slate-300 font-medium">
                  {isLiveSyncActive
                    ? `Live Sync Active (${liveUsername ? `@${liveUsername}` : liveGameId})`
                    : `Lichess Game (${liveUsername ? `@${liveUsername}` : liveGameId})`}
                </span>
                {(clocks.whiteClock || clocks.blackClock) && (
                  <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400 mt-0.5">
                    <span className="flex items-center gap-1 text-slate-200">
                      <Clock className="w-3 h-3 text-emerald-400" />
                      W: <strong className="text-emerald-300">{clocks.whiteClock || '—'}</strong>
                    </span>
                    <span className="flex items-center gap-1 text-slate-200">
                      B: <strong className="text-sky-300">{clocks.blackClock || '—'}</strong>
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={flipBoard}
                title="Flip board perspective to match Lichess"
                className="px-2.5 py-1 rounded text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              >
                Flip ({orientation === 'white' ? 'White' : 'Black'})
              </button>

              <button
                onClick={() => setIsLiveSyncActive(!isLiveSyncActive)}
                className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-1.5 ${
                  isLiveSyncActive
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-slate-950'
                }`}
              >
                {isLiveSyncActive ? (
                  <>
                    <StopCircle className="w-3.5 h-3.5" /> Stop Sync
                  </>
                ) : (
                  <>
                    <Radio className="w-3.5 h-3.5" /> Start Live Sync
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-rose-200">
              <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            {errorMsg.includes('Anonymous') && (
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => {
                    setErrorMsg('');
                    setImportType('pgn');
                  }}
                  className="px-2.5 py-1 bg-rose-900/60 hover:bg-rose-800/80 text-rose-100 rounded text-[11px] font-medium transition border border-rose-700/60"
                >
                  Paste Moves instead (PGN)
                </button>
                <button
                  onClick={() => setErrorMsg('')}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-medium transition"
                >
                  Play on Board
                </button>
              </div>
            )}
          </div>
        )}
        {successMsg && (
          <p className="text-xs text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> {successMsg}
          </p>
        )}

        <div className="flex items-start gap-1.5 text-[11px] text-slate-500 pt-1 border-t border-slate-800/80">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
          <span>
            Live Sync is designed for spectating broadcasts, master games, and study. Using live engine suggestions during your own live rated games violates platform Fair Play rules.
          </span>
        </div>
      </div>

      {/* Game Review Summary Header */}
      {history.length > 0 && (
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div>
              <h4 className="text-sm font-bold text-slate-100">
                {gameMetadata.white || 'White'} ({gameMetadata.whiteElo || '?'}) vs{' '}
                {gameMetadata.black || 'Black'} ({gameMetadata.blackElo || '?'})
              </h4>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {gameMetadata.opening || gameMetadata.event || 'Standard Game'} • Result: {gameMetadata.result || '*'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportAnnotatedPgn}
                title="Download annotated PGN with engine evaluations"
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1.5 transition border border-slate-700"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                PGN
              </button>

              <button
                onClick={handleRunFullReview}
                disabled={isReviewing}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {isReviewing ? `Reviewing (${reviewProgress}%)` : 'Run Game Review'}
              </button>
            </div>
          </div>

          {isReviewing && (
            <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-emerald-500 transition-all duration-200"
                style={{ width: `${reviewProgress}%` }}
              />
            </div>
          )}

          {/* Interactive Advantage Graph */}
          <EvalGraph />

          {/* Detailed Move Quality Comparison Table */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="flex justify-between font-semibold border-b border-slate-800 pb-1 text-slate-200">
                <span>White Stats</span>
                <span className="font-mono">{whiteMoves.length} moves</span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-400 font-mono">
                <div>Best/Exc: <span className="text-emerald-400 font-bold">{whiteStats.best + whiteStats.excellent}</span></div>
                <div>Inacc: <span className="text-amber-400 font-bold">{whiteStats.inaccuracy}</span></div>
                <div>Mistakes: <span className="text-orange-400 font-bold">{whiteStats.mistake}</span></div>
                <div>Blunders: <span className="text-rose-400 font-bold">{whiteStats.blunder}</span></div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="flex justify-between font-semibold border-b border-slate-800 pb-1 text-slate-200">
                <span>Black Stats</span>
                <span className="font-mono">{blackMoves.length} moves</span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-400 font-mono">
                <div>Best/Exc: <span className="text-emerald-400 font-bold">{blackStats.best + blackStats.excellent}</span></div>
                <div>Inacc: <span className="text-amber-400 font-bold">{blackStats.inaccuracy}</span></div>
                <div>Mistakes: <span className="text-orange-400 font-bold">{blackStats.mistake}</span></div>
                <div>Blunders: <span className="text-rose-400 font-bold">{blackStats.blunder}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
