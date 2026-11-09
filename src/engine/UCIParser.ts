import { ScoreInfo, CandidateMove } from '../types/chess';

export interface ParsedInfo {
  depth: number;
  seldepth?: number;
  multipv: number;
  score: ScoreInfo;
  nodes: number;
  nps: number;
  time: number;
  pv: string[];
}

export class UCIParser {
  /**
   * Normalizes FEN to only include piece layout, active color, castling rights, and en passant.
   * Strips halfmove clock and fullmove number to optimize caching.
   */
  public static normalizeFen(fen: string): string {
    const parts = fen.trim().split(/\s+/);
    if (parts.length < 4) return fen.trim();
    return `${parts[0]} ${parts[1]} ${parts[2]} ${parts[3]}`;
  }

  /**
   * Parses an engine "info" output line.
   */
  public static parseInfoLine(line: string, activeColor: 'w' | 'b' = 'w'): ParsedInfo | null {
    if (!line.startsWith('info') || !line.includes('pv')) {
      return null;
    }

    const tokens = line.split(/\s+/);
    let depth = 0;
    let seldepth = 0;
    let multipv = 1;
    let nodes = 0;
    let nps = 0;
    let time = 0;
    let score: ScoreInfo = { type: 'cp', value: 0, text: '0.0' };
    const pv: string[] = [];

    for (let i = 1; i < tokens.length; i++) {
      const token = tokens[i];
      if (token === 'depth' && i + 1 < tokens.length) {
        depth = parseInt(tokens[++i], 10);
      } else if (token === 'seldepth' && i + 1 < tokens.length) {
        seldepth = parseInt(tokens[++i], 10);
      } else if (token === 'multipv' && i + 1 < tokens.length) {
        multipv = parseInt(tokens[++i], 10);
      } else if (token === 'nodes' && i + 1 < tokens.length) {
        nodes = parseInt(tokens[++i], 10);
      } else if (token === 'nps' && i + 1 < tokens.length) {
        nps = parseInt(tokens[++i], 10);
      } else if (token === 'time' && i + 1 < tokens.length) {
        time = parseInt(tokens[++i], 10);
      } else if (token === 'score' && i + 2 < tokens.length) {
        const scoreType = tokens[++i];
        const val = parseInt(tokens[++i], 10);

        // UCI gives score from perspective of side to move.
        // We normalize so positive (+) is ALWAYS White advantage, negative (-) is Black advantage.
        const multiplier = activeColor === 'w' ? 1 : -1;

        if (scoreType === 'cp') {
          const normalizedVal = val * multiplier;
          const displayCp = (normalizedVal / 100).toFixed(2);
          score = {
            type: 'cp',
            value: normalizedVal,
            text: normalizedVal > 0 ? `+${displayCp}` : displayCp,
          };
        } else if (scoreType === 'mate') {
          const normalizedMate = val * multiplier;
          score = {
            type: 'mate',
            value: normalizedMate,
            text: normalizedMate > 0 ? `+M${Math.abs(normalizedMate)}` : `-M${Math.abs(normalizedMate)}`,
          };
        }
      } else if (token === 'pv') {
        for (let j = i + 1; j < tokens.length; j++) {
          if (tokens[j].length >= 4 && !tokens[j].startsWith('info')) {
            pv.push(tokens[j]);
          } else {
            break;
          }
        }
        break; // PV is always at the end
      }
    }

    if (pv.length === 0) return null;

    return {
      depth,
      seldepth,
      multipv,
      score,
      nodes,
      nps,
      time,
      pv,
    };
  }

  /**
   * Parses a "bestmove" output line.
   */
  public static parseBestMove(line: string): { bestMove: string; ponder?: string } | null {
    if (!line.startsWith('bestmove')) return null;
    const tokens = line.split(/\s+/);
    const bestMove = tokens[1];
    let ponder: string | undefined;

    const ponderIdx = tokens.indexOf('ponder');
    if (ponderIdx !== -1 && ponderIdx + 1 < tokens.length) {
      ponder = tokens[ponderIdx + 1];
    }

    return { bestMove, ponder };
  }
}

