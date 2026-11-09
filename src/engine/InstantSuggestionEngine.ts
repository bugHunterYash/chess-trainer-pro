import { Chess } from 'chess.js';
import { PositionAnalysis, CandidateMove } from '../types/chess';
import { stockfishService } from './StockfishService';
import { analysisCache, AnalysisCache } from './AnalysisCache';
import { CandidateMoveService } from './CandidateMoveService';
import { ParsedInfo } from './UCIParser';
import { diagnostics } from '../services/DiagnosticsService';

export type SuggestionProgressCallback = (analysis: PositionAnalysis) => void;

export class InstantSuggestionEngine {
  private activeRequestId: number | null = null;
  private activePositionKey: string | null = null;
  private lastAnalyzedPositionKey: string = '';
  private lastSuggestionPositionKey: string = '';
  private inFlightPromises: Map<string, Promise<PositionAnalysis>> = new Map();

  /**
   * Request instant suggestions for a position.
   * If cached: returns immediately and invokes onUpdate immediately (0ms).
   * If an analysis for this exact position is already in-flight: reuses promise.
   * If new: returns preliminary legal candidates immediately, starts engine worker,
   * cancels any outdated analysis synchronously, and progressively updates.
   */
  public async getSuggestion(
    fen: string,
    options: {
      depth?: number;
      timeMs?: number;
      multipv?: number;
      mode?: string;
    } = {},
    onUpdate?: SuggestionProgressCallback
  ): Promise<PositionAnalysis> {
    const targetDepth = options.depth ?? 14;
    const targetMultipv = Math.max(options.multipv ?? 3, 3);
    const positionKey = AnalysisCache.generatePositionKey(fen, undefined, {
      depth: targetDepth,
      multipv: targetMultipv,
      mode: options.mode,
    });

    this.lastAnalyzedPositionKey = positionKey;
    diagnostics.recordPositionKey(positionKey);

    // 1. Check synchronous instant memory cache first (0ms)
    const instant = analysisCache.getInstant(positionKey, targetDepth);
    if (instant && instant.depth >= targetDepth) {
      this.lastSuggestionPositionKey = positionKey;
      if (onUpdate) onUpdate(instant);
      return instant;
    }

    // 2. Deduplicate in-flight analysis for exact same position
    if (this.inFlightPromises.has(positionKey)) {
      diagnostics.recordDuplicateRequestPrevented(`engine:${positionKey}`);
      const promise = this.inFlightPromises.get(positionKey)!;
      if (onUpdate && instant) onUpdate(instant);
      return promise;
    }

    // 3. Cancel any running calculation for older/different positions synchronously
    if (this.activeRequestId !== null && this.activePositionKey !== positionKey) {
      stockfishService.cancelRequest(this.activeRequestId);
      diagnostics.recordEngineCancel(this.activeRequestId);
      this.activeRequestId = null;
      this.activePositionKey = null;
    }

    // 4. Construct preliminary legal candidates (depth 0, uncalculated)
    const preliminaryAnalysis = instant || this.createPreliminaryAnalysis(fen, positionKey);
    if (onUpdate) onUpdate(preliminaryAnalysis);

    // 5. Start progressive engine analysis
    const rawInfos: Map<number, ParsedInfo> = new Map();
    const startTime = performance.now();

    const analysisPromise = new Promise<PositionAnalysis>((resolve) => {
      this.activePositionKey = positionKey;
      const reqId = stockfishService.analyzePosition(
        fen,
        { depth: targetDepth, multipv: targetMultipv, timeMs: options.timeMs },
        (info: ParsedInfo) => {
          // Verify request is still relevant to active position & request ID
          if (this.activePositionKey !== positionKey || this.activeRequestId !== reqId) {
            diagnostics.recordStaleResultDiscarded(`Info received for req #${reqId} vs active #${this.activeRequestId}`);
            return;
          }

          rawInfos.set(info.multipv, info);
          const updatedCandidates = CandidateMoveService.processCandidates(fen, rawInfos);

          const liveAnalysis: PositionAnalysis = {
            fen,
            normalizedFen: fen,
            positionKey,
            depth: info.depth,
            timeMs: Math.round(performance.now() - startTime),
            nodes: info.nodes,
            nps: info.nps,
            candidates: updatedCandidates,
            bestMove: updatedCandidates[0],
            timestamp: Date.now(),
            isComplete: false,
          };

          if (onUpdate && this.activePositionKey === positionKey) {
            onUpdate(liveAnalysis);
          }
        },
        (bestMoveUci: string) => {
          if (this.activePositionKey !== positionKey || this.activeRequestId !== reqId) {
            diagnostics.recordStaleResultDiscarded(`BestMove received for req #${reqId} vs active #${this.activeRequestId}`);
            return;
          }

          const elapsedMs = Math.round(performance.now() - startTime);
          diagnostics.recordAnalysisLatency(elapsedMs);

          let finalCandidates = CandidateMoveService.processCandidates(fen, rawInfos);

          // If candidates list is empty but bestMove was parsed, build fallback candidate
          if (finalCandidates.length === 0 && bestMoveUci) {
            try {
              const b = new Chess(fen);
              const from = bestMoveUci.substring(0, 2);
              const to = bestMoveUci.substring(2, 4);
              const promo = bestMoveUci.length > 4 ? bestMoveUci[4] : undefined;
              const m = b.move({ from, to, promotion: promo });
              if (m) {
                finalCandidates = [
                  {
                    uci: bestMoveUci,
                    san: m.san,
                    from,
                    to,
                    promotion: promo,
                    score: { type: 'cp', value: 0, text: '0.0' },
                    depth: targetDepth,
                    multipv: 1,
                    pv: [bestMoveUci],
                    classification: 'best',
                  },
                ];
              }
            } catch {
              // ignore
            }
          }

          const bestMove = finalCandidates.find((c) => c.uci === bestMoveUci) || finalCandidates[0];

          const finalAnalysis: PositionAnalysis = {
            fen,
            normalizedFen: fen,
            positionKey,
            depth: targetDepth,
            timeMs: elapsedMs,
            nodes: Array.from(rawInfos.values()).reduce((acc, curr) => acc + curr.nodes, 0),
            nps: rawInfos.get(1)?.nps ?? 0,
            candidates: finalCandidates,
            bestMove,
            timestamp: Date.now(),
            isComplete: true,
          };

          // Store in cache for future instant access
          analysisCache.set(finalAnalysis, { depth: targetDepth, multipv: targetMultipv });
          this.lastSuggestionPositionKey = positionKey;

          if (onUpdate && this.activePositionKey === positionKey) {
            onUpdate(finalAnalysis);
          }

          this.inFlightPromises.delete(positionKey);
          if (this.activeRequestId === reqId) {
            this.activeRequestId = null;
            this.activePositionKey = null;
          }
          resolve(finalAnalysis);
        }
      );

      this.activeRequestId = reqId;
      diagnostics.recordEngineStart(reqId);
    });

    this.inFlightPromises.set(positionKey, analysisPromise);
    return analysisPromise;
  }

  /**
   * Pre-analyzes likely next legal moves (proactive caching).
   */
  public async preAnalyzeNextMoves(fen: string, topUciMoves: string[]): Promise<void> {
    try {
      for (const uci of topUciMoves.slice(0, 2)) {
        const from = uci.substring(0, 2);
        const to = uci.substring(2, 4);
        const promo = uci.length > 4 ? uci[4] : undefined;

        const nextChess = new Chess(fen);
        const m = nextChess.move({ from, to, promotion: promo });
        if (m) {
          const nextFen = nextChess.fen();
          const existing = await analysisCache.get(nextFen, 8);
          if (!existing && stockfishService.getStatus() === 'ready') {
            this.getSuggestion(nextFen, { depth: 8, multipv: 1 });
          }
        }
      }
    } catch {
      // ignore
    }
  }

  private createPreliminaryAnalysis(fen: string, positionKey?: string): PositionAnalysis {
    const chess = new Chess(fen);
    const legalMoves = chess.moves({ verbose: true });

    const candidates: CandidateMove[] = legalMoves.slice(0, 3).map((m, idx) => ({
      uci: m.from + m.to + (m.promotion || ''),
      san: m.san,
      from: m.from,
      to: m.to,
      promotion: m.promotion,
      score: { type: 'cp', value: 0, text: '...' },
      depth: 0,
      multipv: idx + 1,
      pv: [m.from + m.to],
      pvSan: [m.san],
      explanation: 'Calculating tactical evaluation...',
      tacticalTheme: 'Pending',
      winChance: 50,
    }));

    return {
      fen,
      normalizedFen: fen,
      positionKey,
      depth: 0,
      timeMs: 0,
      nodes: 0,
      nps: 0,
      candidates,
      bestMove: undefined,
      timestamp: Date.now(),
      isComplete: false,
    };
  }

  public cancel(): void {
    if (this.activeRequestId !== null) {
      stockfishService.cancelRequest(this.activeRequestId);
      diagnostics.recordEngineCancel(this.activeRequestId);
      this.activeRequestId = null;
      this.activePositionKey = null;
    }
    this.inFlightPromises.clear();
  }

  public getLastAnalyzedKey(): string {
    return this.lastAnalyzedPositionKey;
  }

  public getLastSuggestionKey(): string {
    return this.lastSuggestionPositionKey;
  }
}

export const instantSuggestionEngine = new InstantSuggestionEngine();
