import { EngineStatus } from '../types/chess';
import { stockfishService } from './StockfishService';

export class EngineManager {
  private static instance: EngineManager;
  private isAutoInitialized = false;

  private constructor() {}

  public static getInstance(): EngineManager {
    if (!EngineManager.instance) {
      EngineManager.instance = new EngineManager();
    }
    return EngineManager.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isAutoInitialized) return;
    this.isAutoInitialized = true;
    try {
      await stockfishService.init();
    } catch (err) {
      console.error('EngineManager: Failed to initialize Stockfish worker:', err);
    }
  }

  public getStatus(): EngineStatus {
    return stockfishService.getStatus();
  }

  public onStatusChange(callback: (status: EngineStatus) => void): () => void {
    return stockfishService.onStatusChange(callback);
  }

  public async restart(): Promise<void> {
    await stockfishService.restart();
  }

  public setHashMemory(mb: number): void {
    stockfishService.sendCommand(`setoption name Hash value ${mb}`);
  }

  public setThreads(threads: number): void {
    stockfishService.sendCommand(`setoption name Threads value ${threads}`);
  }
}

export const engineManager = EngineManager.getInstance();

