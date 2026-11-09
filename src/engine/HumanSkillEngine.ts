import { Chess } from 'chess.js';
import { HumanDifficultyLevel, DifficultyConfig, CandidateMove } from '../types/chess';
import { stockfishService } from './StockfishService';
import { CandidateMoveService } from './CandidateMoveService';
import { ParsedInfo } from './UCIParser';

export const DIFFICULTY_CONFIGS: Record<HumanDifficultyLevel, DifficultyConfig> = {
  beginner: {
    id: 'beginner',
    name: 'Beginner',
    targetRating: 600,
    ratingRange: '400–700',
    skillLevel: 1,
    depthLimit: 4,
    movetimeLimit: 300,
    blunderProbability: 0.28,
    maxBlunderCpLoss: 250,
    description: 'Plays basic developing moves, watches direct threats, but occasionally misses tactical replies or undefended pieces.',
  },
  casual: {
    id: 'casual',
    name: 'Casual',
    targetRating: 950,
    ratingRange: '800–1100',
    skillLevel: 5,
    depthLimit: 6,
    movetimeLimit: 500,
    blunderProbability: 0.16,
    maxBlunderCpLoss: 160,
    description: 'Good grasp of basic openings and active pieces; occasionally slips into tactical pins or forks.',
  },
  intermediate: {
    id: 'intermediate',
    name: 'Intermediate',
    targetRating: 1350,
    ratingRange: '1200–1500',
    skillLevel: 10,
    depthLimit: 8,
    movetimeLimit: 800,
    blunderProbability: 0.08,
    maxBlunderCpLoss: 90,
    description: 'Solid tactical vision, creates attacks, avoids one-move blunders, and executes standard plans.',
  },
  advanced: {
    id: 'advanced',
    name: 'Advanced',
    targetRating: 1750,
    ratingRange: '1600–1900',
    skillLevel: 15,
    depthLimit: 12,
    movetimeLimit: 1200,
    blunderProbability: 0.03,
    maxBlunderCpLoss: 50,
    description: 'Strong positional understanding, coordinates pieces smoothly, and calculates multiple steps ahead.',
  },
  expert: {
    id: 'expert',
    name: 'Expert',
    targetRating: 2100,
    ratingRange: '2000+',
    skillLevel: 19,
    depthLimit: 15,
    movetimeLimit: 1800,
    blunderProbability: 0.01,
    maxBlunderCpLoss: 25,
    description: 'Master-level accuracy and tactical discipline with deep endgame understanding.',
  },
  stockfish: {
    id: 'stockfish',
    name: 'Stockfish (Max)',
    targetRating: 3500,
    ratingRange: '3500+',
    skillLevel: 20,
    depthLimit: 18,
    movetimeLimit: 2500,
    blunderProbability: 0.0,
    maxBlunderCpLoss: 0,
    description: 'Maximum calculation power and ruthless precision on every turn.',
  },
};

export class HumanSkillEngine {
  /**
   * Computes a realistic human move at the requested difficulty.
   * Runs Stockfish with calibrated Skill Level / Elo / MultiPV,
   * analyzes real engine candidates, and selects a realistic move.
   */
  public async getBotMove(
    fen: string,
    difficulty: HumanDifficultyLevel = 'intermediate'
  ): Promise<{ uci: string; san: string; candidate: CandidateMove }> {
    const config = DIFFICULTY_CONFIGS[difficulty];
    const rawInfos: Map<number, ParsedInfo> = new Map();

    const options = {
      depth: config.depthLimit,
      timeMs: config.movetimeLimit,
      skillLevel: config.skillLevel,
      limitStrength: difficulty !== 'stockfish',
      elo: config.targetRating >= 1320 ? config.targetRating : 1320,
      multipv: 4,
    };

    return new Promise((resolve, reject) => {
      stockfishService.analyzePosition(
        fen,
        options,
        (info) => {
          rawInfos.set(info.multipv, info);
        },
        (bestMoveUci) => {
          try {
            const candidates = CandidateMoveService.processCandidates(fen, rawInfos);

            if (candidates.length === 0) {
              // fallback: generate first legal move
              const chess = new Chess(fen);
              const legal = chess.moves({ verbose: true });
              if (legal.length === 0) throw new Error('No legal moves');
              const m = legal[0];
              const uci = m.from + m.to + (m.promotion || '');
              resolve({
                uci,
                san: m.san,
                candidate: {
                  uci,
                  san: m.san,
                  from: m.from,
                  to: m.to,
                  score: { type: 'cp', value: 0, text: '0.0' },
                  depth: 1,
                  multipv: 1,
                  pv: [uci],
                  explanation: 'Legal fallback move',
                  tacticalTheme: 'Development',
                  winChance: 50,
                },
              });
              return;
            }

            // Decide move selection based on difficulty
            let chosenCandidate: CandidateMove = candidates[0];

            if (difficulty === 'stockfish') {
              chosenCandidate = candidates[0];
            } else {
              // Calculate probabilities for candidate moves based on target rating
              chosenCandidate = this.selectHumanMove(candidates, config);
            }

            resolve({
              uci: chosenCandidate.uci,
              san: chosenCandidate.san,
              candidate: chosenCandidate,
            });
          } catch (err) {
            reject(err);
          }
        }
      );
    });
  }

  /**
   * Selects a candidate based on calibrated human error weights rather than random noise.
   */
  private selectHumanMove(candidates: CandidateMove[], config: DifficultyConfig): CandidateMove {
    if (candidates.length === 1) return candidates[0];

    const bestScoreVal = candidates[0].score.value;
    const roll = Math.random();

    // Check if a human imperfection should occur
    if (roll < config.blunderProbability && candidates.length > 1) {
      // Find candidate moves that fall within the allowable human imperfection cap
      const humanOptions = candidates.slice(1).filter((c) => {
        const drop = Math.abs(bestScoreVal - c.score.value);
        return drop <= config.maxBlunderCpLoss;
      });

      if (humanOptions.length > 0) {
        // Return a realistic 2nd or 3rd best human choice
        return humanOptions[Math.floor(Math.random() * humanOptions.length)];
      }
    }

    // Default: play the strongest calculated move
    return candidates[0];
  }
}

export const humanSkillEngine = new HumanSkillEngine();

