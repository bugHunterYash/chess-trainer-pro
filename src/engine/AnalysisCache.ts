import { get, set } from 'idb-keyval';
import { PositionAnalysis } from '../types/chess';
import { UCIParser } from './UCIParser';
import { diagnostics } from '../services/DiagnosticsService';

const IDB_PREFIX = 'chess_analysis_v2_';
const MAX_MEMORY_ENTRIES = 200;

export interface AnalysisSettingsKey {
  depth?: number;
  multipv?: number;
  mode?: string;
}

export class AnalysisCache {
  private memoryCache: Map<string, PositionAnalysis> = new Map();

  /**
   * Generates a stable position key: FEN position + side to move + relevant analysis settings
   */
  public static generatePositionKey(
    fen: string,
    sideToMove?: 'w' | 'b',
    settings?: AnalysisSettingsKey
  ): string {
    const norm = UCIParser.normalizeFen(fen);
    const parts = norm.split(' ');
    const activeSide = sideToMove || (parts.length > 1 ? parts[1] : 'w');
    const d = settings?.depth !== undefined ? settings.depth : 14;
    const mpv = settings?.multipv !== undefined ? settings.multipv : 4;
    const m = settings?.mode || 'engine';
    return `${norm}|turn=${activeSide}|d=${d}|mpv=${mpv}|m=${m}`;
  }

  /**
   * Generates a base position key ignoring depth/settings (for position matching across depths).
   */
  public static generateBaseKey(fen: string, sideToMove?: 'w' | 'b'): string {
    const norm = UCIParser.normalizeFen(fen);
    const parts = norm.split(' ');
    const activeSide = sideToMove || (parts.length > 1 ? parts[1] : 'w');
    return `${norm}|turn=${activeSide}`;
  }

  /**
   * Checks if an analysis exists in memory synchronously.
   */
  public has(keyOrFen: string): boolean {
    const key = keyOrFen.includes('|turn=') ? keyOrFen : AnalysisCache.generateBaseKey(keyOrFen);
    if (this.memoryCache.has(key)) return true;

    // Also check prefix matches (e.g. any depth for this position)
    for (const k of this.memoryCache.keys()) {
      if (k.startsWith(key)) return true;
    }
    return false;
  }

  /**
   * Synchronous check in memory only (for instant 0ms check).
   */
  public getInstant(keyOrFen: string, minDepth = 1): PositionAnalysis | null {
    const baseKey = keyOrFen.includes('|turn=') ? keyOrFen.split('|d=')[0] : AnalysisCache.generateBaseKey(keyOrFen);

    // Exact key match first
    if (this.memoryCache.has(keyOrFen)) {
      const entry = this.memoryCache.get(keyOrFen)!;
      if (entry.depth >= minDepth) {
        this.touch(keyOrFen, entry);
        diagnostics.recordCacheHit(keyOrFen);
        return entry;
      }
    }

    // Best matching entry for base position key with depth >= minDepth
    let bestMatch: PositionAnalysis | null = null;
    let bestKey = '';
    for (const [k, v] of this.memoryCache.entries()) {
      if (k.startsWith(baseKey)) {
        if (!bestMatch || v.depth > bestMatch.depth) {
          bestMatch = v;
          bestKey = k;
        }
      }
    }

    if (bestMatch && bestMatch.depth >= minDepth) {
      this.touch(bestKey, bestMatch);
      diagnostics.recordCacheHit(bestKey);
      return bestMatch;
    }

    return null;
  }

  /**
   * Gets analysis from memory cache (instant) or IndexedDB (fast persistent fallback).
   */
  public async get(keyOrFen: string, minDepth = 1): Promise<PositionAnalysis | null> {
    const instant = this.getInstant(keyOrFen, minDepth);
    if (instant) return instant;

    // Check IndexedDB
    const lookupKey = keyOrFen.includes('|turn=') ? keyOrFen : AnalysisCache.generateBaseKey(keyOrFen);
    try {
      const idbEntry = await get<PositionAnalysis>(`${IDB_PREFIX}${lookupKey}`);
      if (idbEntry && idbEntry.depth >= minDepth) {
        this.setMemory(lookupKey, idbEntry);
        diagnostics.recordCacheHit(lookupKey);
        return idbEntry;
      }
    } catch {
      // IndexedDB might not be available in all test or worker environments
    }

    diagnostics.recordCacheMiss(keyOrFen);
    return null;
  }

  /**
   * Stores analysis in both memory and IndexedDB.
   * If an existing entry has higher depth, preserves the higher depth analysis.
   */
  public async set(analysis: PositionAnalysis, settings?: AnalysisSettingsKey): Promise<void> {
    const key =
      analysis.positionKey ||
      AnalysisCache.generatePositionKey(analysis.fen, undefined, {
        depth: analysis.depth,
        multipv: analysis.candidates?.length,
        mode: settings?.mode,
      });

    analysis.positionKey = key;
    analysis.normalizedFen = UCIParser.normalizeFen(analysis.fen);

    // If existing analysis has strictly greater depth, keep the better one unless this is complete
    const existing = this.memoryCache.get(key);
    if (existing && existing.depth > analysis.depth && existing.isComplete) {
      return;
    }

    // 1. In-memory LRU
    this.setMemory(key, analysis);

    // Also store by base key so any lookup by FEN finds it
    const baseKey = AnalysisCache.generateBaseKey(analysis.fen);
    if (baseKey !== key) {
      const existingBase = this.memoryCache.get(baseKey);
      if (!existingBase || analysis.depth >= existingBase.depth) {
        this.setMemory(baseKey, analysis);
      }
    }

    // 2. IndexedDB async write (fire and forget)
    try {
      await set(`${IDB_PREFIX}${key}`, analysis);
    } catch {
      // IndexedDB optional
    }
  }

  private touch(key: string, entry: PositionAnalysis): void {
    this.memoryCache.delete(key);
    this.memoryCache.set(key, entry);
  }

  private setMemory(key: string, entry: PositionAnalysis): void {
    if (this.memoryCache.has(key)) {
      this.memoryCache.delete(key);
    } else if (this.memoryCache.size >= MAX_MEMORY_ENTRIES) {
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey) this.memoryCache.delete(firstKey);
    }
    this.memoryCache.set(key, entry);
  }

  public clear(): void {
    this.memoryCache.clear();
  }

  public size(): number {
    return this.memoryCache.size;
  }
}

export const analysisCache = new AnalysisCache();
