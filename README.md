# Chess Trainer Pro — Instant Engine-Powered Learning Platform

A fully functional, browser-based chess training and practice platform inspired by Chess.com and Lichess. Built with React, Vite, TypeScript, Tailwind CSS, Zustand, and the official Stockfish 19 WebAssembly chess engine.

---

## 🌟 Key Features

### 1. ⚡ Instant Move Suggestion System (`InstantSuggestionEngine`)
- **0ms Instant Cache Hits**: Previously calculated positions return analysis immediately from in-memory LRU and persistent IndexedDB storage.
- **Progressive Calculation**: Legal candidate moves display immediately; evaluations refine progressively as engine depth advances without blocking the UI.
- **Auto-cancellation**: Automatically halts previous calculations when navigating to a new position to prevent stale evaluations.

### 2. 🧠 Stockfish 19 WebAssembly Engine (`StockfishService`)
- Runs in a dedicated Web Worker using the standard UCI protocol.
- MultiPV support (top 1–5 candidate lines).
- Computes centipawn and mate evaluations with side-to-move perspective normalization.
- Live performance metrics: NPS (Nodes Per Second), depth, elapsed calculation time, and total nodes.

### 3. 👤 Human-Like Opponent Difficulty (`HumanSkillEngine`)
Six calibrated difficulty tiers:
| Level | Target Rating | Behavior |
|---|---|---|
| **Beginner** | 400–700 | Basic development, simple threats, occasional tactical slips. |
| **Casual** | 800–1100 | Solid opening moves, misses complex pins/forks. |
| **Intermediate** | 1200–1500 | Sound tactical vision, standard opening plans, rare blunders. |
| **Advanced** | 1600–1900 | Coordinated pieces, strong tactical defense, pawn break awareness. |
| **Expert** | 2000+ | Master-level precision and deep endgame calculation. |
| **Stockfish** | 3500+ (Max) | Maximum search depth and calculation strength. |

### 4. 🎯 5 Core Training Modes
- **Mode A: Play Against Bot**: Choose difficulty, play as White or Black, takeback moves, resign, with realistic thinking time.
- **Mode B: Position Trainer & Puzzles**: Solve interactive tactical puzzles (forks, pins, back-rank mates, endgames) with hints and instant solution checks.
- **Mode C: Game Analysis & Review**: Import games via **Lichess URL**, **PGN**, or **FEN**. Get player accuracy percentages and move classifications.
- **Mode D: Opening Trainer**: Practice master opening repertoires (Italian Game, Sicilian Najdorf, Queen's Gambit, Ruy Lopez, Caro-Kann) with step-by-step guidance.
- **Mode E: Engine Analysis Board**: Full sandbox with adjustable depth (8–22 ply), MultiPV count, eval bar, and candidate arrows.

### 5. 🔍 Move Classification System (`EvaluationService`)
- Classifies moves using centipawn loss and win probability change:
  - **Best** (Green Checkmark)
  - **Excellent** (Sky Star)
  - **Good** (Teal)
  - **Inaccuracy** (Amber Warning)
  - **Mistake** (Orange Triangle)
  - **Blunder** (Red Cross)
  - **Book** (Purple Book)

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+) & npm

### Development
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

Or double-click [`start_trainer.bat`](file:///c:/Users/F(x)ash/Documents/chess%20model/start_trainer.bat) to launch the dev server and open your browser automatically.

### Running Tests
```bash
npm test
```
Runs the Vitest suite covering legal moves, castling, en passant, promotions, checkmate, stalemate, UCI protocol parsing, evaluation formulas, difficulty calibrations, and PGN/FEN imports.

### Production Build
```bash
npm run build
```
Creates an optimized, minified production bundle in `dist/`.

---

## 📁 Architecture Overview
```
src/
├── engine/
│   ├── StockfishService.ts           # UCI Worker communication bridge
│   ├── stockfish.worker.ts           # Dedicated Web Worker hosting Stockfish WASM
│   ├── UCIParser.ts                  # Parser for depth, cp/mate, multipv, pv, bestmove
│   ├── EngineManager.ts              # Lifecycle, restarts, crash recovery, configuration
│   ├── AnalysisCache.ts              # In-memory LRU + IndexedDB cache by normalized FEN
│   ├── CandidateMoveService.ts       # MultiPV extraction, move ranking, tactical classifications
│   ├── EvaluationService.ts          # Normalization (cp to win%, centipawn loss, accuracy)
│   ├── InstantSuggestionEngine.ts    # Instant cache-first suggestion with progressive refinement
│   └── HumanSkillEngine.ts           # Rating-calibrated opponent bot (400 to 2000+ Elo)
├── services/
│   ├── GameImportService.ts          # Lichess URL parser, PGN parser, FEN validator
│   ├── StorageService.ts             # IndexedDB game history and repertoire storage
│   └── SoundService.ts               # Procedural Web Audio API chess sound effects
├── store/
│   ├── useChessStore.ts              # Global game state, active board, move history
│   └── useEngineStore.ts             # Engine status, eval, candidate moves, suggestion state
├── components/
│   ├── board/                        # ChessBoardContainer, EvalBar
│   ├── analysis/                     # CandidateMovesList, MoveClassificationBadge
│   ├── controls/                     # BoardControls, MoveHistoryList
│   ├── modes/                        # BotPlay, PositionTrainer, GameReview, Openings, EngineAnalysis
│   └── common/                       # Header, Icons
└── App.tsx
```
