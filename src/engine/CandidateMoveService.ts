import { Chess } from 'chess.js';
import { CandidateMove } from '../types/chess';
import { ParsedInfo } from './UCIParser';
import { EvaluationService } from './EvaluationService';

export class CandidateMoveService {
  /**
   * Transforms raw MultiPV parsed engine info lines into structured CandidateMoves.
   */
  public static processCandidates(
    fen: string,
    rawInfos: Map<number, ParsedInfo>
  ): CandidateMove[] {
    const tempChess = new Chess(fen);
    const activeColor = tempChess.turn();
    const sortedInfos = Array.from(rawInfos.values()).sort((a, b) => a.multipv - b.multipv);

    if (sortedInfos.length === 0) return [];

    const bestScore = sortedInfos[0].score;

    const candidates: CandidateMove[] = [];

    for (const info of sortedInfos) {
      if (info.pv.length === 0) continue;
      const uciMove = info.pv[0];
      const from = uciMove.substring(0, 2);
      const to = uciMove.substring(2, 4);
      const promo = uciMove.length > 4 ? uciMove[4] : undefined;

      let san = uciMove;
      let pvSan: string[] = [];

      try {
        const board = new Chess(fen);
        const m = board.move({ from, to, promotion: promo });
        if (!m || m.color !== activeColor) {
          // Discard illegal moves or moves belonging to the wrong side
          continue;
        }

        san = m.san;
        pvSan.push(m.san);
        // Play out remaining PV moves for clean SAN display
        for (let i = 1; i < Math.min(info.pv.length, 5); i++) {
          const nextUci = info.pv[i];
          const nFrom = nextUci.substring(0, 2);
          const nTo = nextUci.substring(2, 4);
          const nPromo = nextUci.length > 4 ? nextUci[4] : undefined;
          const nm = board.move({ from: nFrom, to: nTo, promotion: nPromo });
          if (nm) pvSan.push(nm.san);
          else break;
        }
      } catch (e) {
        // Discard any move that fails chess validation
        continue;
      }

      const classification = EvaluationService.classifyMove(bestScore, info.score, activeColor);
      const winChance = EvaluationService.calculateWinChance(info.score);
      const { explanation, theme } = this.generateExplanation(fen, uciMove, san, classification);

      candidates.push({
        uci: uciMove,
        san,
        from,
        to,
        promotion: promo,
        score: info.score,
        depth: info.depth,
        multipv: info.multipv,
        pv: info.pv,
        pvSan,
        classification,
        explanation,
        tacticalTheme: theme,
        winChance,
      });
    }

    return candidates;
  }

  /**
   * Generates human-readable explanations based on move impact.
   */
  private static generateExplanation(
    fen: string,
    uci: string,
    san: string,
    classification: string
  ): { explanation: string; theme: string } {
    const board = new Chess(fen);
    const from = uci.substring(0, 2);
    const to = uci.substring(2, 4);
    const piece = board.get(from as any);
    const captured = board.get(to as any);

    let theme = 'Positional';
    let explanation = 'Maintains steady piece coordination and board balance.';

    if (san.includes('#')) {
      return { theme: 'Checkmate', explanation: 'Forces checkmate!' };
    }
    if (san.includes('+')) {
      theme = 'Check';
      explanation = 'Delivers check, applying direct pressure on the opponent king.';
    } else if (captured) {
      theme = 'Tactical Capture';
      explanation = `Captures on ${to}, winning material or relieving positional tension.`;
    } else if (san === 'O-O' || san === 'O-O-O') {
      theme = 'King Safety';
      explanation = 'Tucks the king safely away and activates the rook.';
    } else if (piece?.type === 'p') {
      if (['e4', 'd4', 'e5', 'd5'].includes(to)) {
        theme = 'Center Control';
        explanation = `Claims key space in the center on ${to}.`;
      } else {
        theme = 'Pawn Play';
        explanation = `Advances pawn structure toward ${to}.`;
      }
    } else if (piece?.type === 'n' || piece?.type === 'b') {
      theme = 'Piece Development';
      explanation = `Develops the ${piece.type === 'n' ? 'knight' : 'bishop'} to an active post on ${to}.`;
    } else if (piece?.type === 'r') {
      theme = 'Rook Activity';
      explanation = `Positions rook on ${to} for open-file control and penetration.`;
    }

    if (classification === 'best') {
      explanation = `Top engine recommendation: ${explanation}`;
    }

    return { explanation, theme };
  }
}

