export interface DiagnosticsMetrics {
  lichessApiRequests: number;
  duplicateRequestsPrevented: number;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRatio: number;
  currentPositionKey: string;
  syncUpdatesReceived: number;
  duplicatePositionUpdatesIgnored: number;
  stockfishRequestsStarted: number;
  stockfishRequestsCancelled: number;
  staleResultsDiscarded: number;
  averageSyncLatencyMs: number;
  averageAnalysisLatencyMs: number;
}

export class DiagnosticsService {
  private static instance: DiagnosticsService;

  private lichessApiRequests = 0;
  private duplicateRequestsPrevented = 0;
  private cacheHits = 0;
  private cacheMisses = 0;
  private currentPositionKey = '';
  private syncUpdatesReceived = 0;
  private duplicatePositionUpdatesIgnored = 0;
  private stockfishRequestsStarted = 0;
  private stockfishRequestsCancelled = 0;
  private staleResultsDiscarded = 0;

  private syncLatencies: number[] = [];
  private analysisLatencies: number[] = [];

  private isDev = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';

  public static getInstance(): DiagnosticsService {
    if (!DiagnosticsService.instance) {
      DiagnosticsService.instance = new DiagnosticsService();
    }
    return DiagnosticsService.instance;
  }

  public recordLichessRequest(endpoint?: string): void {
    this.lichessApiRequests++;
    if (this.isDev && endpoint) {
      console.debug(`[Diagnostics] Lichess API request (#${this.lichessApiRequests}):`, endpoint);
    }
  }

  public recordDuplicateRequestPrevented(endpoint?: string): void {
    this.duplicateRequestsPrevented++;
    if (this.isDev && endpoint) {
      console.debug(`[Diagnostics] Duplicate request PREVENTED (#${this.duplicateRequestsPrevented}):`, endpoint);
    }
  }

  public recordCacheHit(key?: string): void {
    this.cacheHits++;
    if (this.isDev && key) {
      console.debug(`[Diagnostics] Position Cache HIT (#${this.cacheHits}):`, key.substring(0, 30));
    }
  }

  public recordCacheMiss(key?: string): void {
    this.cacheMisses++;
    if (this.isDev && key) {
      console.debug(`[Diagnostics] Position Cache MISS (#${this.cacheMisses}):`, key.substring(0, 30));
    }
  }

  public recordPositionKey(key: string): void {
    this.currentPositionKey = key;
  }

  public recordSyncUpdate(latencyMs?: number): void {
    this.syncUpdatesReceived++;
    if (latencyMs !== undefined && latencyMs >= 0) {
      this.syncLatencies.push(latencyMs);
      if (this.syncLatencies.length > 50) this.syncLatencies.shift();
    }
  }

  public recordDuplicatePositionIgnored(key?: string): void {
    this.duplicatePositionUpdatesIgnored++;
    if (this.isDev && key) {
      console.debug(`[Diagnostics] Duplicate position update IGNORED (#${this.duplicatePositionUpdatesIgnored}):`, key.substring(0, 30));
    }
  }

  public recordEngineStart(reqId?: number): void {
    this.stockfishRequestsStarted++;
    if (this.isDev && reqId) {
      console.debug(`[Diagnostics] Stockfish analysis STARTED (req #${reqId})`);
    }
  }

  public recordEngineCancel(reqId?: number): void {
    this.stockfishRequestsCancelled++;
    if (this.isDev && reqId) {
      console.debug(`[Diagnostics] Stockfish analysis CANCELLED (req #${reqId})`);
    }
  }

  public recordStaleResultDiscarded(reason?: string): void {
    this.staleResultsDiscarded++;
    if (this.isDev && reason) {
      console.debug(`[Diagnostics] Stale engine result DISCARDED:`, reason);
    }
  }

  public recordAnalysisLatency(latencyMs: number): void {
    if (latencyMs >= 0) {
      this.analysisLatencies.push(latencyMs);
      if (this.analysisLatencies.length > 50) this.analysisLatencies.shift();
    }
  }

  public getMetrics(): DiagnosticsMetrics {
    const totalCache = this.cacheHits + this.cacheMisses;
    const cacheHitRatio = totalCache > 0 ? Number((this.cacheHits / totalCache).toFixed(3)) : 0;

    const avgSync =
      this.syncLatencies.length > 0
        ? Math.round(this.syncLatencies.reduce((a, b) => a + b, 0) / this.syncLatencies.length)
        : 0;

    const avgAnalysis =
      this.analysisLatencies.length > 0
        ? Math.round(this.analysisLatencies.reduce((a, b) => a + b, 0) / this.analysisLatencies.length)
        : 0;

    return {
      lichessApiRequests: this.lichessApiRequests,
      duplicateRequestsPrevented: this.duplicateRequestsPrevented,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheHitRatio,
      currentPositionKey: this.currentPositionKey,
      syncUpdatesReceived: this.syncUpdatesReceived,
      duplicatePositionUpdatesIgnored: this.duplicatePositionUpdatesIgnored,
      stockfishRequestsStarted: this.stockfishRequestsStarted,
      stockfishRequestsCancelled: this.stockfishRequestsCancelled,
      staleResultsDiscarded: this.staleResultsDiscarded,
      averageSyncLatencyMs: avgSync,
      averageAnalysisLatencyMs: avgAnalysis,
    };
  }

  public reset(): void {
    this.lichessApiRequests = 0;
    this.duplicateRequestsPrevented = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.currentPositionKey = '';
    this.syncUpdatesReceived = 0;
    this.duplicatePositionUpdatesIgnored = 0;
    this.stockfishRequestsStarted = 0;
    this.stockfishRequestsCancelled = 0;
    this.staleResultsDiscarded = 0;
    this.syncLatencies = [];
    this.analysisLatencies = [];
  }
}

export const diagnostics = DiagnosticsService.getInstance();

