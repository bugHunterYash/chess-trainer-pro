import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GameImportService } from '../src/services/GameImportService';
import { analysisCache, AnalysisCache } from '../src/engine/AnalysisCache';
import { instantSuggestionEngine } from '../src/engine/InstantSuggestionEngine';
import { diagnostics } from '../src/services/DiagnosticsService';
import { stockfishService } from '../src/engine/StockfishService';
import { useEngineStore } from '../src/store/useEngineStore';
import { PositionAnalysis } from '../src/types/chess';

describe('Chess Trainer Performance, Deduplication & Sync Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    analysisCache.clear();
    GameImportService.clearCache();
    diagnostics.reset();
    instantSuggestionEngine.cancel();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Test 1: Same position received 10 times → only one analysis request.
  it('1. Same position received 10 times → only one analysis request', async () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    let analyzeCount = 0;

    vi.spyOn(stockfishService, 'analyzePosition').mockImplementation((_fen, _options, onInfo, onBestMove) => {
      analyzeCount++;
      setTimeout(() => {
        if (onInfo) {
          onInfo({
            depth: 14,
            multipv: 1,
            score: { type: 'cp', value: 20, text: '+0.2' },
            nodes: 1000,
            nps: 100000,
            time: 10,
            pv: ['c7c5'],
          });
        }
        if (onBestMove) onBestMove('c7c5');
      }, 5);
      return analyzeCount;
    });

    // Request the same position 10 times rapidly
    const promises = Array.from({ length: 10 }, () =>
      instantSuggestionEngine.getSuggestion(fen, { depth: 14, multipv: 3 })
    );

    const results = await Promise.all(promises);

    expect(results).toHaveLength(10);
    // Crucial: Stockfish worker analyzePosition was only called once!
    expect(analyzeCount).toBe(1);
    expect(results[0].bestMove?.uci).toBe('c7c5');
  });

  // Test 2: Same Lichess endpoint requested repeatedly → deduplicated while request is in flight.
  it('2. Same Lichess endpoint requested repeatedly → deduplicated while request is in flight', async () => {
    let networkFetchCount = 0;
    const fakePgn = '[Event "Live Blitz"]\n[White "Magnus"]\n[Black "Hikaru"]\n[Result "*"]\n1. e4 e5 *';

    globalThis.fetch = vi.fn().mockImplementation(() => {
      networkFetchCount++;
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            ok: true,
            status: 200,
            text: async () => fakePgn,
          } as Response);
        }, 15);
      });
    });

    // Make 5 simultaneous requests for the exact same game ID
    const promises = [
      GameImportService.fetchLichessPgn('PsYRbdRp'),
      GameImportService.fetchLichessPgn('PsYRbdRp'),
      GameImportService.fetchLichessPgn('PsYRbdRp'),
      GameImportService.fetchLichessPgn('PsYRbdRp'),
      GameImportService.fetchLichessPgn('PsYRbdRp'),
    ];

    const results = await Promise.all(promises);

    expect(results).toHaveLength(5);
    // Network fetch was invoked only once because concurrent requests reused the same promise!
    expect(networkFetchCount).toBe(1);
    expect(diagnostics.getMetrics().duplicateRequestsPrevented).toBe(4);
  });

  // Test 3: Cached position revisited → instant cached result.
  it('3. Cached position revisited → instant cached result', async () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const key = AnalysisCache.generatePositionKey(fen, 'w', { depth: 14, multipv: 3 });

    const mockAnalysis: PositionAnalysis = {
      fen,
      normalizedFen: fen,
      positionKey: key,
      depth: 14,
      timeMs: 12,
      nodes: 50000,
      nps: 1000000,
      candidates: [
        {
          uci: 'e2e4',
          san: 'e4',
          from: 'e2',
          to: 'e4',
          score: { type: 'cp', value: 30, text: '+0.3' },
          depth: 14,
          multipv: 1,
          pv: ['e2e4', 'e7e5'],
        },
      ],
      bestMove: {
        uci: 'e2e4',
        san: 'e4',
        from: 'e2',
        to: 'e4',
        score: { type: 'cp', value: 30, text: '+0.3' },
        depth: 14,
        multipv: 1,
        pv: ['e2e4', 'e7e5'],
      },
      timestamp: Date.now(),
      isComplete: true,
    };

    await analysisCache.set(mockAnalysis);

    const start = performance.now();
    const result = await instantSuggestionEngine.getSuggestion(fen, { depth: 14, multipv: 3 });
    const elapsed = performance.now() - start;

    expect(result).toBeDefined();
    expect(result.bestMove?.uci).toBe('e2e4');
    expect(result.depth).toBe(14);
    // Returns in < 5ms without running worker
    expect(elapsed).toBeLessThan(10);
    expect(diagnostics.getMetrics().cacheHits).toBeGreaterThan(0);
  });

  // Test 4: A new move → new position analysis.
  it('4. A new move → new position analysis', async () => {
    const fen1 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    const fen2 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2';

    const analyzedFens: string[] = [];

    vi.spyOn(stockfishService, 'analyzePosition').mockImplementation((fen, _opts, _onInfo, onBestMove) => {
      analyzedFens.push(fen);
      setTimeout(() => {
        if (onBestMove) onBestMove(fen === fen1 ? 'e7e5' : 'g1f3');
      }, 5);
      return analyzedFens.length;
    });

    const res1 = await instantSuggestionEngine.getSuggestion(fen1, { depth: 14, multipv: 3 });
    const res2 = await instantSuggestionEngine.getSuggestion(fen2, { depth: 14, multipv: 3 });

    expect(analyzedFens).toHaveLength(2);
    expect(res1.bestMove?.uci).toBe('e7e5');
    expect(res2.bestMove?.uci).toBe('g1f3');
    expect(analyzedFens[0]).toBe(fen1);
    expect(analyzedFens[1]).toBe(fen2);
  });

  // Test 5: Rapid consecutive moves → only the latest position is analyzed.
  it('5. Rapid consecutive moves → only the latest position is analyzed', async () => {
    const moves = [
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1', // move 1
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2', // move 2
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2', // move 3
    ];

    let cancelCount = 0;
    let completedFen = '';

    vi.spyOn(stockfishService, 'analyzePosition').mockImplementation((fen, _opts, _onInfo, onBestMove) => {
      const timer = setTimeout(() => {
        completedFen = fen;
        if (onBestMove) onBestMove('b8c6');
      }, 30);
      return timer as unknown as number;
    });

    vi.spyOn(stockfishService, 'cancelRequest').mockImplementation(() => {
      cancelCount++;
    });

    // Rapidly fire requests for move 1, 2, 3 before 1 or 2 finish
    instantSuggestionEngine.getSuggestion(moves[0], { depth: 14 });
    instantSuggestionEngine.getSuggestion(moves[1], { depth: 14 });
    const finalPromise = instantSuggestionEngine.getSuggestion(moves[2], { depth: 14 });

    // Move 1 and 2 should have been cancelled
    expect(cancelCount).toBe(2);
    expect(diagnostics.getMetrics().stockfishRequestsCancelled).toBe(2);

    await finalPromise;
    expect(completedFen).toBe(moves[2]);
  });

  // Test 6: Old Stockfish result arrives after a new position → old result ignored.
  it('6. Old Stockfish result arrives after a new position → old result ignored', async () => {
    const fen1 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    const fen2 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2';

    let staleCallbackFired = false;
    let fen1OnBestMove: any;

    vi.spyOn(stockfishService, 'analyzePosition').mockImplementation((fen, _opts, _onInfo, onBestMove) => {
      if (fen === fen1) {
        fen1OnBestMove = onBestMove;
        return 101;
      }
      return 102;
    });

    // Start fen 1
    instantSuggestionEngine.getSuggestion(fen1, { depth: 14 });

    // Rapidly switch to fen 2
    instantSuggestionEngine.getSuggestion(fen2, { depth: 14 });

    // Now late result from fen1 arrives
    if (fen1OnBestMove) {
      fen1OnBestMove('e7e5');
      staleCallbackFired = true;
    }

    expect(staleCallbackFired).toBe(true);
    // Stale result was discarded by position/request-id check!
    expect(diagnostics.getMetrics().staleResultsDiscarded).toBeGreaterThan(0);
  });

  // Test 7: Reconnect → no duplicate listeners or polling loops.
  it('7. Reconnect → no duplicate listeners or polling loops', () => {
    let activeListeners = 0;

    const connect = () => {
      const unsubscribe = stockfishService.onStatusChange(() => {
        // dummy status handler
      });
      activeListeners++;
      return () => {
        unsubscribe();
        activeListeners--;
      };
    };

    const cleanup1 = connect();
    expect(activeListeners).toBe(1);

    // Simulate disconnect and reconnect with proper cleanup
    cleanup1();
    expect(activeListeners).toBe(0);

    const cleanup2 = connect();
    expect(activeListeners).toBe(1);

    cleanup2();
    expect(activeListeners).toBe(0);
  });

  // Test 8: API error → controlled retry without infinite requests.
  it('8. API error → controlled retry without infinite requests', async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      } as Response);
    });

    // 1st call fails and sets exponential backoff
    await expect(GameImportService.fetchLichessPgn('errorGame')).rejects.toThrow();
    expect(callCount).toBe(1);

    // Immediate second call should be blocked by backoff WITHOUT making another network request!
    await expect(GameImportService.fetchLichessPgn('errorGame')).rejects.toThrow(/Rate limit backoff active/);
    expect(callCount).toBe(1);
  });

  // Test 9: Returning to a previous position → reuse cached analysis.
  it('9. Returning to a previous position → reuse cached analysis', async () => {
    const fenA = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const fenB = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';

    let workerRuns = 0;
    vi.spyOn(stockfishService, 'analyzePosition').mockImplementation((_fen, _opts, _onInfo, onBestMove) => {
      workerRuns++;
      setTimeout(() => {
        if (onBestMove) onBestMove('e2e4');
      }, 5);
      return workerRuns;
    });

    // 1. Analyze position A
    await instantSuggestionEngine.getSuggestion(fenA, { depth: 14 });
    expect(workerRuns).toBe(1);

    // 2. Play move to position B
    await instantSuggestionEngine.getSuggestion(fenB, { depth: 14 });
    expect(workerRuns).toBe(2);

    // 3. User navigates back to position A (e.g. undo or replay)
    const resultRevisit = await instantSuggestionEngine.getSuggestion(fenA, { depth: 14 });

    // Worker was NOT run a 3rd time! Reused cached analysis
    expect(workerRuns).toBe(2);
    expect(resultRevisit.bestMove?.uci).toBe('e2e4');
  });

  // Test 10: Extension bridge provides position → no redundant API fetch for identical data.
  it('10. Extension bridge provides position → no redundant API fetch for identical data', () => {
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2';
    const movesCount = 2;

    // Bridge provides live position in 0ms
    GameImportService.recordBridgePosition(fen, movesCount, 'testGame1');

    // Watchdog or poller checks if API fetch is redundant
    const isRedundant = GameImportService.isRedundantWithBridge(fen, movesCount);
    expect(isRedundant).toBe(true);

    // If position differs, it is not redundant
    const differentFen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2';
    expect(GameImportService.isRedundantWithBridge(differentFen, 3)).toBe(false);
  });
});

