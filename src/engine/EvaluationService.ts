import { ScoreInfo, MoveClassification } from '../types/chess';

export class EvaluationService {
  /**
   * Converts centipawns or mate into a winning percentage (0% to 100%) from White's perspective.
   */
  public static calculateWinChance(score: ScoreInfo): number {
    if (score.type === 'mate') {
      return score.value > 0 ? 100 : 0;
    }
    // Sigmoid formula used by modern engines (Lichess/Stockfish):
    // winChance = 50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1)
    const cp = score.value;
    const winProb = 1 / (1 + Math.pow(10, -cp / 400));
    return Math.round(winProb * 100);
  }

  /**
   * Calculates centipawn loss from the moving player's perspective.
   */
  public static calculateCpLoss(
    bestScore: ScoreInfo,
    playedScore: ScoreInfo,
    activeColor: 'w' | 'b'
  ): number {
    const mult = activeColor === 'w' ? 1 : -1;
    const bestCp = bestScore.type === 'mate' 
      ? (bestScore.value > 0 ? 10000 : -10000) 
      : bestScore.value;
    const playedCp = playedScore.type === 'mate'
      ? (playedScore.value > 0 ? 10000 : -10000)
      : playedScore.value;

    const diff = (bestCp - playedCp) * mult;
    return Math.max(0, diff);
  }

  /**
   * Classifies a move based on win chance loss and centipawn loss.
   */
  public static classifyMove(
    bestScore: ScoreInfo,
    playedScore: ScoreInfo,
    activeColor: 'w' | 'b',
    isBookMove: boolean = false
  ): MoveClassification {
    if (isBookMove) return 'book';

    const winBefore = this.calculateWinChance(bestScore);
    const winAfter = this.calculateWinChance(playedScore);

    // Win chance drop from player's perspective
    const winDrop = activeColor === 'w' 
      ? (winBefore - winAfter) 
      : (winAfter - winBefore);

    const cpLoss = this.calculateCpLoss(bestScore, playedScore, activeColor);

    if (cpLoss <= 10 || winDrop <= 1.0) {
      return 'best';
    } else if (cpLoss <= 30 || winDrop <= 3.5) {
      return 'excellent';
    } else if (cpLoss <= 80 || winDrop <= 7.0) {
      return 'good';
    } else if (cpLoss <= 160 || winDrop <= 15.0) {
      return 'inaccuracy';
    } else if (cpLoss <= 300 || winDrop <= 28.0) {
      return 'mistake';
    } else {
      return 'blunder';
    }
  }

  /**
   * Calculates overall game accuracy percentage (CAPS score 0-100%).
   */
  public static calculateAccuracy(winDrops: number[]): number {
    if (winDrops.length === 0) return 100;
    const avgLoss = winDrops.reduce((acc, curr) => acc + curr, 0) / winDrops.length;
    // Standard harmonic formula: accuracy drops as average win loss increases
    const accuracy = 100 * Math.exp(-0.04 * avgLoss);
    return Math.max(0, Math.min(100, Math.round(accuracy * 10) / 10));
  }
}

