export type MoveClassification = 
  | 'best' 
  | 'excellent' 
  | 'good' 
  | 'inaccuracy' 
  | 'mistake' 
  | 'blunder' 
  | 'book';

export type EngineStatus = 'uninitialized' | 'initializing' | 'ready' | 'analyzing' | 'error';

export interface ScoreInfo {
  type: 'cp' | 'mate';
  value: number; // centipawns or moves to mate (+ for white, - for black)
  text: string;
}

export interface CandidateMove {
  uci: string;
  san: string;
  from: string;
  to: string;
  promotion?: string;
  score: ScoreInfo;
  depth: number;
  multipv: number;
  pv: string[]; // UCI moves
  pvSan?: string[]; // SAN moves
  classification?: MoveClassification;
  explanation?: string;
  tacticalTheme?: string;
  winChance?: number; // 0 to 100%
}

export interface PositionAnalysis {
  fen: string;
  normalizedFen: string;
  positionKey?: string;
  depth: number;
  timeMs: number;
  nodes: number;
  nps: number;
  candidates: CandidateMove[];
  bestMove?: CandidateMove;
  humanPrediction?: HumanPredictionResult;
  timestamp: number;
  isComplete: boolean;
}

export type HumanDifficultyLevel = 
  | 'beginner'    // 400 - 700
  | 'casual'      // 800 - 1100
  | 'intermediate'// 1200 - 1500
  | 'advanced'    // 1600 - 1900
  | 'expert'      // 2000+
  | 'stockfish';  // Max strength

export interface DifficultyConfig {
  id: HumanDifficultyLevel;
  name: string;
  targetRating: number;
  ratingRange: string;
  skillLevel: number; // 0 to 20
  depthLimit: number;
  movetimeLimit: number;
  blunderProbability: number;
  maxBlunderCpLoss: number;
  description: string;
}

export type AppMode = 
  | 'play-bot'
  | 'position-trainer'
  | 'game-analysis'
  | 'opening-trainer'
  | 'engine-analysis';

export interface GameMetadata {
  event?: string;
  site?: string;
  date?: string;
  round?: string;
  white?: string;
  black?: string;
  whiteElo?: number;
  blackElo?: number;
  result?: string;
  opening?: string;
  eco?: string;
}

export interface HistoryMove {
  uci: string;
  san: string;
  fenBefore: string;
  fenAfter: string;
  color: 'w' | 'b';
  captured?: string;
  check?: boolean;
  checkmate?: boolean;
  classification?: MoveClassification;
  evalBefore?: ScoreInfo;
  evalAfter?: ScoreInfo;
  explanation?: string;
}

export interface TrainingPuzzle {
  id: string;
  fen: string;
  solution: string[]; // sequence of UCIs
  rating: number;
  themes: string[];
  description: string;
  playedMoves?: string[];
}

// Side-specific suggestion filtering
export type SideFilter = 'both' | 'white' | 'black';

// Quality filter thresholds
export type QualityFilter = 'best_only' | 'best_and_excellent' | 'good_or_better' | 'top_3_good';

export type HumanReasoningCategory = 
  | 'development' 
  | 'attack' 
  | 'defense' 
  | 'capture' 
  | 'king_safety' 
  | 'pawn_structure' 
  | 'tactical_threat' 
  | 'positional_improvement' 
  | 'possible_idea';

export interface HumanThinkingCandidate {
  candidate: CandidateMove;
  humanLikelihoodPercent: number;
  humanReasoningCategory: HumanReasoningCategory;
  humanReasoningText: string;
  isEngineBest: boolean;
  confidence: 'high' | 'medium' | 'low';
}

export interface HumanPredictionResult {
  sideToMove: 'w' | 'b';
  humanLikelyMove: HumanThinkingCandidate;
  engineBestMove: CandidateMove;
  comparisonAnalysis: string;
  candidates: HumanThinkingCandidate[];
  level: HumanDifficultyLevel;
}
