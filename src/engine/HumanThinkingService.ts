import { Chess } from 'chess.js';
import {
  CandidateMove,
  HumanDifficultyLevel,
  HumanThinkingCandidate,
  HumanPredictionResult,
  HumanReasoningCategory,
} from '../types/chess';

export class HumanThinkingService {
  /**
   * Predicts and ranks moves according to estimated human thinking for a given rating level.
   */
  public static predictHumanMoves(
    fen: string,
    candidates: CandidateMove[],
    level: HumanDifficultyLevel = 'intermediate',
    maxCandidates: number = 4
  ): HumanPredictionResult | null {
    if (candidates.length === 0) return null;

    const chess = new Chess(fen);
    const sideToMove = chess.turn();
    const engineBest = candidates[0];

    // Score each candidate by human appeal at this rating level
    const scoredCandidates: HumanThinkingCandidate[] = candidates.map((cand) => {
      const { category, reasoning, confidence, humanBiasScore } = this.analyzeMovePsychology(
        chess,
        cand,
        level
      );

      return {
        candidate: cand,
        humanLikelihoodPercent: 0, // will normalize below
        humanReasoningCategory: category,
        humanReasoningText: reasoning,
        isEngineBest: cand.uci === engineBest.uci,
        confidence,
        _biasScore: humanBiasScore,
      } as any;
    });

    // Sort by human bias score (not purely engine evaluation)
    scoredCandidates.sort((a: any, b: any) => b._biasScore - a._biasScore);

    // Apply softmax-like normalization to compute humanLikelihoodPercent
    const topCandidates = scoredCandidates.slice(0, Math.max(1, maxCandidates));
    const scores = topCandidates.map((c: any) => c._biasScore);
    const maxScore = Math.max(...scores);
    const expScores = scores.map((s) => Math.exp((s - maxScore) / 25));
    const totalExp = expScores.reduce((acc, curr) => acc + curr, 0);

    topCandidates.forEach((c: any, i) => {
      c.humanLikelihoodPercent = Math.round((expScores[i] / totalExp) * 100);
      delete c._biasScore;
    });

    // Ensure sum equals 100 or close
    const humanLikely = topCandidates[0];

    // Generate comparison analysis between human likely move and Stockfish best
    const comparisonAnalysis = this.generateComparison(
      humanLikely,
      engineBest,
      level,
      sideToMove
    );

    return {
      sideToMove,
      humanLikelyMove: humanLikely,
      engineBestMove: engineBest,
      comparisonAnalysis,
      candidates: topCandidates,
      level,
    };
  }

  /**
   * Evaluates the human psychological appeal of a move based on chess motifs and rating level.
   */
  private static analyzeMovePsychology(
    board: Chess,
    cand: CandidateMove,
    level: HumanDifficultyLevel
  ): {
    category: HumanReasoningCategory;
    reasoning: string;
    confidence: 'high' | 'medium' | 'low';
    humanBiasScore: number;
  } {
    const from = cand.from;
    const to = cand.to;
    const piece = board.get(from as any);
    const captured = board.get(to as any);
    const san = cand.san;

    let category: HumanReasoningCategory = 'positional_improvement';
    let reasoning = '';
    let confidence: 'high' | 'medium' | 'low' = 'high';
    let humanBiasScore = 50;

    // Tactical checks
    const isCheck = san.includes('+') || san.includes('#');
    const isCastling = san === 'O-O' || san === 'O-O-O';
    const isCapture = !!captured || san.includes('x');

    const centerSquares = ['e4', 'd4', 'e5', 'd5', 'c4', 'f4', 'c5', 'f5'];
    const isCenterSquare = centerSquares.includes(to);

    // Base score influenced by engine quality (humans still mostly play reasonable moves)
    const cpLoss = cand.classification === 'best' ? 0 : cand.classification === 'excellent' ? 25 : cand.classification === 'good' ? 60 : 150;
    humanBiasScore -= cpLoss * 0.25;

    // 1. Checks
    if (isCheck) {
      category = 'attack';
      reasoning = `Forces an immediate check against the king on ${to}.`;
      // Lower ratings love checks disproportionately
      if (level === 'beginner' || level === 'casual') {
        humanBiasScore += 45;
      } else {
        humanBiasScore += 25;
      }
    }
    // 2. Captures
    else if (isCapture) {
      category = 'capture';
      const capName = captured?.type ? this.pieceName(captured.type) : 'piece';
      reasoning = `Directly takes the ${capName} on ${to}, resolving tension.`;
      if (level === 'beginner' || level === 'casual') {
        humanBiasScore += 40;
      } else {
        humanBiasScore += 25;
      }
    }
    // 3. King Safety / Castling
    else if (isCastling) {
      category = 'king_safety';
      reasoning = 'Standard king safety: castles the king and connects the rooks.';
      humanBiasScore += 45;
    }
    // 4. Piece Development (Knights & Bishops)
    else if (piece?.type === 'n' || piece?.type === 'b') {
      const isFromBackRank = from[1] === '1' || from[1] === '8';
      if (isFromBackRank) {
        category = 'development';
        reasoning = `Develops the ${this.pieceName(piece.type)} from the home rank toward active play on ${to}.`;
        humanBiasScore += 35;
      } else {
        category = 'positional_improvement';
        reasoning = `Maneuvers the ${this.pieceName(piece.type)} to improve square control.`;
        humanBiasScore += 20;
      }
    }
    // 5. Center Pawn Expansion
    else if (piece?.type === 'p' && isCenterSquare) {
      category = 'pawn_structure';
      reasoning = `Claims space in the central sector with the pawn on ${to}.`;
      humanBiasScore += 30;
    }
    // 6. Rook to Open/Semi-open File
    else if (piece?.type === 'r') {
      category = 'positional_improvement';
      reasoning = `Activates rook on the ${to[0]}-file for vertical pressure.`;
      if (level === 'advanced' || level === 'expert') {
        humanBiasScore += 30;
      } else {
        humanBiasScore += 15;
      }
    }
    // 7. Queen activity
    else if (piece?.type === 'q') {
      category = 'attack';
      reasoning = `Positions queen on ${to} to coordinate diagonal and rank pressure.`;
      if (level === 'beginner') {
        humanBiasScore += 25; // Beginners love moving the queen early
      } else {
        humanBiasScore += 10;
      }
    } else {
      category = 'possible_idea';
      reasoning = 'Possible idea: A subtle waiting or maneuvering move preparing future tactical plans.';
      confidence = 'medium';
      humanBiasScore += 10;
    }

    // Level-specific tuning
    if (level === 'beginner') {
      // Beginners prefer high-impact, obvious actions over subtle positional prep
      if (category === 'possible_idea') humanBiasScore -= 20;
    } else if (level === 'expert' || level === 'advanced') {
      // Experts align closer with high-class engine moves
      if (cand.classification === 'best') humanBiasScore += 25;
      if (cand.classification === 'excellent') humanBiasScore += 15;
    }

    return {
      category,
      reasoning,
      confidence,
      humanBiasScore: Math.max(5, humanBiasScore),
    };
  }

  private static pieceName(type: string): string {
    switch (type.toLowerCase()) {
      case 'p': return 'pawn';
      case 'n': return 'knight';
      case 'b': return 'bishop';
      case 'r': return 'rook';
      case 'q': return 'queen';
      case 'k': return 'king';
      default: return 'piece';
    }
  }

  private static generateComparison(
    humanLikely: HumanThinkingCandidate,
    engineBest: CandidateMove,
    level: HumanDifficultyLevel,
    sideToMove: 'w' | 'b'
  ): string {
    const sideName = sideToMove === 'w' ? 'White' : 'Black';

    if (humanLikely.candidate.uci === engineBest.uci) {
      return `Agreement: At the ${level} level, ${sideName} would naturally find the engine's best move (${humanLikely.candidate.san}) because it directly aligns with standard human principles (${humanLikely.humanReasoningCategory.replace('_', ' ')}).`;
    }

    const evalDiff = Math.abs(
      humanLikely.candidate.score.value - engineBest.score.value
    );
    const evalDiffStr = (evalDiff / 100).toFixed(2);

    return `Contrast: A human at ${level} level naturally looks toward ${humanLikely.candidate.san} (${humanLikely.humanReasoningText}), whereas Stockfish prefers ${engineBest.san} (+${evalDiffStr} difference) due to deeper tactical calculation and computer prophylaxis.`;
  }
}

