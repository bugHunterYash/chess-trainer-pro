import { Chess } from 'chess.js';
import { GameMetadata } from '../types/chess';
import { diagnostics } from './DiagnosticsService';

export interface ImportedGame {
  id?: string;
  fen: string;
  pgn: string;
  metadata: GameMetadata;
  moves: string[]; // SAN list
  fens: string[];  // FEN after each move
  isLive?: boolean;
}

export interface StreamMoveEvent {
  fen: string;
  lastMove?: string;
  whiteClock?: string;
  blackClock?: string;
  isEnd?: boolean;
}

export function formatSecondsToClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

interface CacheEntry {
  data: string;
  timestamp: number;
  ttlMs: number;
}

export class GameImportService {
  // In-flight request deduplication map
  private static inFlightRequests = new Map<string, Promise<string>>();

  // Short-lived response cache
  private static responseCache = new Map<string, CacheEntry>();

  // Exponential backoff tracking
  private static failureCounts = new Map<string, number>();
  private static backoffUntil = new Map<string, number>();

  // Extension sync bridge tracking
  private static lastBridgeData: {
    gameId?: string;
    fen?: string;
    movesCount?: number;
    timestamp: number;
  } = { timestamp: 0 };

  /**
   * Resets all internal caches, in-flight maps, and backoff states (for tests and teardown).
   */
  public static clearCache(): void {
    this.inFlightRequests.clear();
    this.responseCache.clear();
    this.failureCounts.clear();
    this.backoffUntil.clear();
    this.lastBridgeData = { timestamp: 0 };
  }

  /**
   * Records that extension bridge has provided a live position.
   */
  public static recordBridgePosition(fen: string, movesCount: number, gameId?: string): void {
    this.lastBridgeData = {
      gameId,
      fen,
      movesCount,
      timestamp: Date.now(),
    };
  }

  /**
   * Checks if an API fetch is redundant because the extension bridge recently
   * (within 5 seconds) provided the exact same position and move count.
   */
  public static isRedundantWithBridge(fen: string, movesCount?: number): boolean {
    const now = Date.now();
    if (now - this.lastBridgeData.timestamp > 5000) {
      return false;
    }
    const fenMatch = this.lastBridgeData.fen && this.lastBridgeData.fen.split(' ')[0] === fen.split(' ')[0];
    const movesMatch = movesCount === undefined || this.lastBridgeData.movesCount === movesCount;
    return !!(fenMatch && movesMatch);
  }

  /**
   * Returns base URL for Lichess API requests (uses /lichess-api proxy to bypass CORS/COEP).
   */
  public static getBaseApiUrl(): string {
    if (typeof window !== 'undefined') {
      return '/lichess-api';
    }
    return 'https://lichess.org';
  }

  /**
   * Extracts clean 8-character game ID from any Lichess URL or ID string.
   */
  public static extractLichessId(input: string): string | null {
    const clean = input.trim().split('?')[0].split('#')[0];

    // 1. URL pattern: lichess.org/(game/)?(ID)
    const urlMatch = clean.match(/lichess\.org\/(?:game\/|game\/export\/)?([a-zA-Z0-9]{8,12})/i);
    if (urlMatch) {
      return urlMatch[1].substring(0, 8);
    }

    // 2. Direct ID pattern: e.g. 7jN1WNHg or 7jN1WNHg2zkV
    const directMatch = clean.match(/^([a-zA-Z0-9]{8,12})(?:\/.*)?$/);
    if (directMatch) {
      return directMatch[1].substring(0, 8);
    }

    // 3. Fallback: search for any 8-alphanumeric token in the input
    const anyMatch = clean.match(/([a-zA-Z0-9]{8})/);
    return anyMatch ? anyMatch[1] : null;
  }

  /**
   * Detects player perspective / orientation from Lichess URL (e.g. /black or /white).
   */
  public static extractOrientation(input: string): 'white' | 'black' | null {
    const clean = input.toLowerCase().trim();
    if (clean.includes('/black') || clean.includes('#black')) return 'black';
    if (clean.includes('/white') || clean.includes('#white')) return 'white';
    return null;
  }

  /**
   * Fetches latest PGN for a Lichess game ID with in-flight deduplication, caching, and backoff.
   */
  public static async fetchLichessPgn(
    gameId: string,
    signal?: AbortSignal,
    forceRefresh = false
  ): Promise<string> {
    const cacheKey = `game:${gameId}`;
    const now = Date.now();

    // Check backoff
    const backoffTime = this.backoffUntil.get(cacheKey) || 0;
    if (now < backoffTime) {
      const waitMs = backoffTime - now;
      throw new Error(`Rate limit backoff active for ${gameId}. Try again in ${Math.ceil(waitMs / 1000)}s`);
    }

    // Check cached response
    if (!forceRefresh) {
      const cached = this.responseCache.get(cacheKey);
      if (cached && now - cached.timestamp < cached.ttlMs) {
        diagnostics.recordCacheHit(cacheKey);
        return cached.data;
      }
    }

    // Check in-flight request deduplication
    if (this.inFlightRequests.has(cacheKey)) {
      diagnostics.recordDuplicateRequestPrevented(cacheKey);
      return this.inFlightRequests.get(cacheKey)!;
    }

    diagnostics.recordLichessRequest(cacheKey);

    const fetchPromise = (async () => {
      const base = this.getBaseApiUrl();
      const apiUrl = `${base}/game/export/${gameId}?moves=true&tags=true&clocks=true&evals=false&_=${Date.now()}`;

      try {
        const response = await fetch(apiUrl, {
          cache: 'no-store',
          signal,
          headers: {
            Accept: 'application/x-chess-pgn',
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Lichess game "${gameId}" not found or was aborted before moves were played.`);
          }
          if (response.status === 429) {
            // Apply exponential backoff for rate limit
            const count = (this.failureCounts.get(cacheKey) || 0) + 1;
            this.failureCounts.set(cacheKey, count);
            const backoffMs = Math.min(8000, 1000 * Math.pow(2, count));
            this.backoffUntil.set(cacheKey, Date.now() + backoffMs);
            throw new Error(`Lichess API rate limit (429). Backing off for ${backoffMs}ms`);
          }
          throw new Error(`Lichess API returned status ${response.status}`);
        }

        const pgnText = await response.text();

        // Success: reset failures and cache
        this.failureCounts.delete(cacheKey);
        this.backoffUntil.delete(cacheKey);

        const isFinished = pgnText.includes('[Result "1-0"]') || pgnText.includes('[Result "0-1"]') || pgnText.includes('[Result "1/2-1/2"]');
        const ttlMs = isFinished ? 600000 : 2500; // 10 min for completed games, 2.5s for live games
        this.responseCache.set(cacheKey, { data: pgnText, timestamp: Date.now(), ttlMs });

        return pgnText;
      } catch (err: any) {
        if (err.name === 'AbortError') {
          throw err;
        }

        // Try direct fallback if proxy failed
        if (base === '/lichess-api') {
          try {
            const directUrl = `https://lichess.org/game/export/${gameId}?moves=true&tags=true&clocks=true&evals=false&_=${Date.now()}`;
            const directRes = await fetch(directUrl, {
              cache: 'no-store',
              signal,
              headers: { Accept: 'application/x-chess-pgn' },
            });
            if (directRes.ok) {
              const text = await directRes.text();
              this.responseCache.set(cacheKey, { data: text, timestamp: Date.now(), ttlMs: 2500 });
              return text;
            }
          } catch {
            // continue with error
          }
        }

        const count = (this.failureCounts.get(cacheKey) || 0) + 1;
        this.failureCounts.set(cacheKey, count);
        if (count >= 2) {
          const backoffMs = Math.min(8000, 1000 * Math.pow(2, count - 1));
          this.backoffUntil.set(cacheKey, Date.now() + backoffMs);
        }
        throw err;
      } finally {
        this.inFlightRequests.delete(cacheKey);
      }
    })();

    this.inFlightRequests.set(cacheKey, fetchPromise);
    return fetchPromise;
  }

  /**
   * Fetches the current live game for any Lichess username with deduplication.
   */
  public static async fetchUserCurrentGame(
    username: string,
    signal?: AbortSignal,
    forceRefresh = false
  ): Promise<string> {
    const cleanUser = username.replace(/^@/, '').trim().toLowerCase();
    const cacheKey = `user:${cleanUser}`;
    const now = Date.now();

    // Check backoff
    const backoffTime = this.backoffUntil.get(cacheKey) || 0;
    if (now < backoffTime) {
      const waitMs = backoffTime - now;
      throw new Error(`Rate limit backoff active for ${cleanUser}. Try again in ${Math.ceil(waitMs / 1000)}s`);
    }

    // Check cached response
    if (!forceRefresh) {
      const cached = this.responseCache.get(cacheKey);
      if (cached && now - cached.timestamp < cached.ttlMs) {
        diagnostics.recordCacheHit(cacheKey);
        return cached.data;
      }
    }

    // Check in-flight request deduplication
    if (this.inFlightRequests.has(cacheKey)) {
      diagnostics.recordDuplicateRequestPrevented(cacheKey);
      return this.inFlightRequests.get(cacheKey)!;
    }

    diagnostics.recordLichessRequest(cacheKey);

    const fetchPromise = (async () => {
      const base = this.getBaseApiUrl();
      const apiUrl = `${base}/api/user/${cleanUser}/current-game?_=${Date.now()}`;

      try {
        const response = await fetch(apiUrl, {
          cache: 'no-store',
          signal,
          headers: {
            Accept: 'application/x-chess-pgn',
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`No active or recent game found for user "${cleanUser}".`);
          }
          if (response.status === 429) {
            const count = (this.failureCounts.get(cacheKey) || 0) + 1;
            this.failureCounts.set(cacheKey, count);
            const backoffMs = Math.min(8000, 1000 * Math.pow(2, count));
            this.backoffUntil.set(cacheKey, Date.now() + backoffMs);
            throw new Error(`Lichess API rate limit (429). Backing off for ${backoffMs}ms`);
          }
          throw new Error(`Lichess API returned status ${response.status}`);
        }

        const pgnText = await response.text();
        this.failureCounts.delete(cacheKey);
        this.backoffUntil.delete(cacheKey);
        this.responseCache.set(cacheKey, { data: pgnText, timestamp: Date.now(), ttlMs: 2000 });
        return pgnText;
      } catch (err: any) {
        if (err.name === 'AbortError') {
          throw err;
        }

        if (base === '/lichess-api') {
          try {
            const directUrl = `https://lichess.org/api/user/${cleanUser}/current-game?_=${Date.now()}`;
            const directRes = await fetch(directUrl, {
              cache: 'no-store',
              signal,
              headers: { Accept: 'application/x-chess-pgn' },
            });
            if (directRes.ok) {
              const text = await directRes.text();
              this.responseCache.set(cacheKey, { data: text, timestamp: Date.now(), ttlMs: 2000 });
              return text;
            }
          } catch {
            // ignore
          }
        }

        const count = (this.failureCounts.get(cacheKey) || 0) + 1;
        this.failureCounts.set(cacheKey, count);
        if (count >= 2) {
          const backoffMs = Math.min(8000, 1000 * Math.pow(2, count - 1));
          this.backoffUntil.set(cacheKey, Date.now() + backoffMs);
        }
        throw err;
      } finally {
        this.inFlightRequests.delete(cacheKey);
      }
    })();

    this.inFlightRequests.set(cacheKey, fetchPromise);
    return fetchPromise;
  }

  /**
   * Connects to official real-time Lichess game stream (NDJSON).
   */
  public static async streamLichessGame(
    gameId: string,
    onEvent: (event: StreamMoveEvent) => void,
    signal: AbortSignal
  ): Promise<void> {
    let url = `https://lichess.org/api/stream/game/${gameId}`;
    let response: Response;

    try {
      response = await fetch(url, { signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch {
      if (signal.aborted) return;
      const base = this.getBaseApiUrl();
      url = `${base}/api/stream/game/${gameId}`;
      response = await fetch(url, { signal });
      if (!response.ok) {
        throw new Error(`Lichess stream error: HTTP ${response.status}`);
      }
    }

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';

    while (!signal.aborted) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          if (data.fen) {
            onEvent({
              fen: data.fen,
              lastMove: data.lm,
              whiteClock: data.wc !== undefined ? formatSecondsToClock(data.wc) : undefined,
              blackClock: data.bc !== undefined ? formatSecondsToClock(data.bc) : undefined,
              isEnd: !!(data.status && data.status.name && data.status.name !== 'started'),
            });
          }
        } catch {
          // ignore chunk
        }
      }
    }
  }

  /**
   * Checks if input looks like a Lichess username.
   */
  public static isUsernameInput(input: string): boolean {
    const clean = input.trim();
    if (clean.startsWith('@')) return true;
    if (clean.includes('lichess.org/@/')) return true;
    if (!clean.includes('/') && !clean.includes('.') && clean.length > 3 && clean.length <= 30) {
      if (clean.includes('-') || clean.includes('_') || clean.length !== 8) {
        return true;
      }
    }
    return false;
  }

  /**
   * Extracts clean username from input.
   */
  public static extractUsername(input: string): string {
    const clean = input.trim();
    const match = clean.match(/(?:lichess\.org\/@\/)?@?([a-zA-Z0-9_-]+)/);
    return match ? match[1] : clean;
  }

  /**
   * Extracts remaining clock times for White and Black from PGN move comments.
   */
  public static extractClocks(pgnText: string): { whiteClock?: string; blackClock?: string } {
    const clkMatches = Array.from(pgnText.matchAll(/\{\s*\[%clk\s+([0-9:]+)\]\s*\}/g));
    if (clkMatches.length === 0) return {};

    let whiteClock: string | undefined;
    let blackClock: string | undefined;

    for (let i = 0; i < clkMatches.length; i++) {
      const clk = clkMatches[i][1];
      if (i % 2 === 0) {
        whiteClock = clk;
      } else {
        blackClock = clk;
      }
    }

    return { whiteClock, blackClock };
  }

  /**
   * Imports a game from a Lichess URL, Game ID, or Username.
   */
  public static async importFromLichess(
    urlOrIdOrUser: string,
    signal?: AbortSignal
  ): Promise<ImportedGame> {
    const clean = urlOrIdOrUser.trim();

    // 1. Check if user provided a Lichess username
    if (this.isUsernameInput(clean)) {
      const username = this.extractUsername(clean);
      try {
        const pgnText = await this.fetchUserCurrentGame(username, signal);
        const imported = this.parsePgn(pgnText);
        const idMatch =
          pgnText.match(/\[GameId "([a-zA-Z0-9]+)"\]/) ||
          pgnText.match(/\[Site "https:\/\/lichess\.org\/(?:game\/)?([a-zA-Z0-9]+)"\]/);
        if (idMatch) imported.id = idMatch[1];
        imported.isLive = imported.metadata.result === '*' || !imported.metadata.result;
        return imported;
      } catch (err: any) {
        throw new Error(err.message || `Failed to fetch current game for ${username}`);
      }
    }

    // 2. Otherwise extract game ID
    const gameId = this.extractLichessId(clean);
    if (!gameId) {
      throw new Error('Invalid Lichess URL, Game ID, or Username. Example: https://lichess.org/PsYRbdRp or @VictorWernervonDo');
    }

    try {
      const pgnText = await this.fetchLichessPgn(gameId, signal);
      const imported = this.parsePgn(pgnText);
      imported.id = gameId;
      imported.isLive = imported.metadata.result === '*' || !imported.metadata.result;
      return imported;
    } catch (err: any) {
      const knownUser = typeof window !== 'undefined' ? localStorage.getItem('chess_lichess_user') : null;
      if (knownUser) {
        try {
          const userPgn = await this.fetchUserCurrentGame(knownUser, signal);
          const imported = this.parsePgn(userPgn);
          const idMatch =
            userPgn.match(/\[GameId "([a-zA-Z0-9]+)"\]/) ||
            userPgn.match(/\[Site "https:\/\/lichess\.org\/(?:game\/)?([a-zA-Z0-9]+)"\]/);
          if (idMatch) imported.id = idMatch[1];
          imported.isLive = imported.metadata.result === '*' || !imported.metadata.result;
          return imported;
        } catch {
          // ignore fallback
        }
      }
      throw new Error(`Failed to import from Lichess: ${err.message || 'Network error'}`);
    }
  }

  /**
   * Parses standard PGN text.
   */
  public static parsePgn(pgnText: string): ImportedGame {
    const chess = new Chess();
    try {
      chess.loadPgn(pgnText);
    } catch (e: any) {
      throw new Error(`Invalid PGN content: ${e.message}`);
    }

    const metadata: GameMetadata = {};
    const headers = chess.header();
    if (headers.Event) metadata.event = headers.Event;
    if (headers.Site) metadata.site = headers.Site;
    if (headers.Date) metadata.date = headers.Date;
    if (headers.White) metadata.white = headers.White;
    if (headers.Black) metadata.black = headers.Black;
    if (headers.WhiteElo) metadata.whiteElo = parseInt(headers.WhiteElo, 10);
    if (headers.BlackElo) metadata.blackElo = parseInt(headers.BlackElo, 10);
    if (headers.Result) metadata.result = headers.Result;
    if (headers.Opening) metadata.opening = headers.Opening;
    if (headers.ECO) metadata.eco = headers.ECO;

    const historyMoves = chess.history();
    const replayChess = new Chess();
    const fens: string[] = [replayChess.fen()];

    for (const san of historyMoves) {
      replayChess.move(san);
      fens.push(replayChess.fen());
    }

    const isLive = metadata.result === '*' || !metadata.result;

    return {
      fen: chess.fen(),
      pgn: pgnText,
      metadata,
      moves: historyMoves,
      fens,
      isLive,
    };
  }

  /**
   * Validates and imports a raw FEN string.
   */
  public static parseFen(fenText: string): { isValid: boolean; fen: string; error?: string } {
    try {
      const trimmed = fenText.trim();
      const testChess = new Chess(trimmed);
      return {
        isValid: true,
        fen: testChess.fen(),
      };
    } catch (e: any) {
      return {
        isValid: false,
        fen: '',
        error: `Invalid FEN syntax: ${e.message}`,
      };
    }
  }
}
