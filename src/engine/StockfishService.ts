import { EngineStatus } from '../types/chess';
import { UCIParser, ParsedInfo } from './UCIParser';

export interface AnalysisOptions {
  depth?: number;
  timeMs?: number;
  multipv?: number;
  skillLevel?: number;
  limitStrength?: boolean;
  elo?: number;
}

export type InfoCallback = (info: ParsedInfo) => void;
export type BestMoveCallback = (bestMove: string, ponder?: string) => void;

export class StockfishService {
  private worker: Worker | null = null;
  private status: EngineStatus = 'uninitialized';
  private currentRequestId: number = 0;
  private activeRequestId: number | null = null;
  private isStopping: boolean = false;
  private pendingAnalysis: (() => void) | null = null;
  private infoCallbacks: Map<number, InfoCallback> = new Map();
  private bestMoveCallbacks: Map<number, BestMoveCallback> = new Map();
  private isReadyPromise: Promise<void> | null = null;
  private isReadyResolve: (() => void) | null = null;
  private activeColor: 'w' | 'b' = 'w';
  private statusListeners: Set<(status: EngineStatus) => void> = new Set();

  constructor() {}

  public getStatus(): EngineStatus {
    return this.status;
  }

  public onStatusChange(listener: (status: EngineStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  private setStatus(status: EngineStatus): void {
    this.status = status;
    this.statusListeners.forEach((fn) => fn(status));
  }

  /**
   * Initializes the Stockfish Web Worker and configures UCI.
   */
  public async init(): Promise<void> {
    if (this.status === 'ready' || this.status === 'analyzing') {
      return;
    }

    this.setStatus('initializing');

    try {
      if (this.worker) {
        this.worker.terminate();
        this.worker = null;
      }

      // First try standard worker pointing to /engine/stockfish-19-lite-single.js
      try {
        this.worker = new Worker('/engine/stockfish-19-lite-single.js');
      } catch (e) {
        console.warn('Native worker creation for WASM failed, falling back to ASM.js worker:', e);
        this.worker = new Worker('/engine/stockfish-19-asm.js');
      }

      this.worker.onmessage = this.handleWorkerMessage.bind(this);
      this.worker.onerror = (err) => {
        console.error('Stockfish Worker Error:', err);
        this.setStatus('error');
      };

      // Send UCI initialization commands
      this.sendCommand('uci');
      this.sendCommand('setoption name Hash value 32');
      this.sendCommand('setoption name Threads value 1');

      await this.waitForReady();
      this.setStatus('ready');
      console.log('StockfishService: Engine initialized and ready.');
    } catch (err) {
      console.error('StockfishService init failed:', err);
      this.setStatus('error');
      throw err;
    }
  }

  public sendCommand(cmd: string): void {
    if (!this.worker) {
      console.warn('Cannot send command to uninitialized worker:', cmd);
      return;
    }
    this.worker.postMessage(cmd);
  }

  private handleWorkerMessage(event: MessageEvent): void {
    const rawLine = typeof event.data === 'string' ? event.data : String(event.data);
    const line = rawLine.trim();

    if (!line) return;

    if (line === 'uciok' || line === 'readyok') {
      if (this.isReadyResolve) {
        this.isReadyResolve();
        this.isReadyResolve = null;
        this.isReadyPromise = null;
      }
      return;
    }

    if (line.startsWith('info')) {
      // Discard info lines belonging to stopped calculations
      if (this.isStopping) return;

      const parsed = UCIParser.parseInfoLine(line, this.activeColor);
      if (parsed && this.activeRequestId !== null) {
        const cb = this.infoCallbacks.get(this.activeRequestId);
        if (cb) cb(parsed);
      }
    } else if (line.startsWith('bestmove')) {
      if (this.isStopping) {
        // Stopped calculation finished flushing its bestmove
        this.isStopping = false;
        this.activeRequestId = null;

        // If there's a queued search waiting to start, fire it now
        if (this.pendingAnalysis) {
          const nextSearch = this.pendingAnalysis;
          this.pendingAnalysis = null;
          nextSearch();
        } else {
          this.setStatus('ready');
        }
        return;
      }

      const parsed = UCIParser.parseBestMove(line);
      if (parsed && this.activeRequestId !== null) {
        const currentId = this.activeRequestId;
        const cb = this.bestMoveCallbacks.get(currentId);
        if (cb) cb(parsed.bestMove, parsed.ponder);

        this.infoCallbacks.delete(currentId);
        this.bestMoveCallbacks.delete(currentId);
        this.activeRequestId = null;
        this.setStatus('ready');
      }
    }
  }

  public async waitForReady(): Promise<void> {
    if (!this.isReadyPromise) {
      this.isReadyPromise = new Promise<void>((resolve) => {
        this.isReadyResolve = resolve;
        this.sendCommand('isready');
      });
    }
    return this.isReadyPromise;
  }

  /**
   * Starts position analysis. Returns a request ID that can be used to track or cancel it.
   */
  public analyzePosition(
    fen: string,
    options: AnalysisOptions = {},
    onInfo?: InfoCallback,
    onBestMove?: BestMoveCallback
  ): number {
    this.currentRequestId++;
    const reqId = this.currentRequestId;

    const startSearch = () => {
      this.activeRequestId = reqId;
      this.isStopping = false;

      // Detect active color from FEN
      const fenTokens = fen.trim().split(/\s+/);
      this.activeColor = fenTokens.length > 1 && fenTokens[1] === 'b' ? 'b' : 'w';

      if (onInfo) this.infoCallbacks.set(reqId, onInfo);
      if (onBestMove) this.bestMoveCallbacks.set(reqId, onBestMove);

      this.setStatus('analyzing');

      // Configure options
      const multipv = options.multipv ?? 3;
      this.sendCommand(`setoption name MultiPV value ${multipv}`);

      if (options.skillLevel !== undefined) {
        this.sendCommand(`setoption name Skill Level value ${options.skillLevel}`);
      } else {
        this.sendCommand('setoption name Skill Level value 20');
      }

      if (options.limitStrength && options.elo) {
        this.sendCommand('setoption name UCI_LimitStrength value true');
        this.sendCommand(`setoption name UCI_Elo value ${options.elo}`);
      } else {
        this.sendCommand('setoption name UCI_LimitStrength value false');
      }

      this.sendCommand(`position fen ${fen}`);

      // Build go command
      let goCmd = 'go';
      if (options.depth) {
        goCmd += ` depth ${options.depth}`;
      } else if (options.timeMs) {
        goCmd += ` movetime ${options.timeMs}`;
      } else {
        goCmd += ' depth 14';
      }

      this.sendCommand(goCmd);
    };

    if (this.activeRequestId !== null || this.isStopping) {
      // Clear callbacks for outdated calculation
      if (this.activeRequestId !== null) {
        this.infoCallbacks.delete(this.activeRequestId);
        this.bestMoveCallbacks.delete(this.activeRequestId);
      }
      this.isStopping = true;
      this.sendCommand('stop');
      this.pendingAnalysis = startSearch;
    } else {
      startSearch();
    }

    return reqId;
  }

  /**
   * Stops current calculation immediately.
   */
  public stop(): void {
    if (this.activeRequestId !== null || this.status === 'analyzing') {
      if (this.activeRequestId !== null) {
        this.infoCallbacks.delete(this.activeRequestId);
        this.bestMoveCallbacks.delete(this.activeRequestId);
      }
      this.isStopping = true;
      this.pendingAnalysis = null;
      this.sendCommand('stop');
      this.setStatus('ready');
    }
  }

  /**
   * Cancels a specific request ID and discards its callbacks.
   */
  public cancelRequest(requestId: number): void {
    if (this.activeRequestId === requestId) {
      this.stop();
    }
    this.infoCallbacks.delete(requestId);
    this.bestMoveCallbacks.delete(requestId);
  }

  /**
   * Restarts the engine if it enters an error or unresponsive state.
   */
  public async restart(): Promise<void> {
    console.warn('StockfishService: Restarting engine...');
    this.stop();
    this.infoCallbacks.clear();
    this.bestMoveCallbacks.clear();
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.setStatus('uninitialized');
    await this.init();
  }

  public terminate(): void {
    this.stop();
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.setStatus('uninitialized');
  }
}

export const stockfishService = new StockfishService();

