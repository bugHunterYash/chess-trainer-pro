import React, { useEffect } from 'react';
import { Header } from './components/common/Header';
import { ChessBoardContainer } from './components/board/ChessBoardContainer';
import { BoardControls } from './components/controls/BoardControls';
import { MoveHistoryList } from './components/controls/MoveHistoryList';
import { CandidateMovesList } from './components/analysis/CandidateMovesList';
import { HumanThinkingPanel } from './components/analysis/HumanThinkingPanel';
import { SuggestionFilterControls } from './components/analysis/SuggestionFilterControls';
import { BotPlayMode } from './components/modes/BotPlayMode';
import { PositionTrainerMode } from './components/modes/PositionTrainerMode';
import { GameAnalysisMode } from './components/modes/GameAnalysisMode';
import { OpeningTrainerMode } from './components/modes/OpeningTrainerMode';
import { EngineAnalysisMode } from './components/modes/EngineAnalysisMode';
import { useChessStore } from './store/useChessStore';
import { useEngineStore } from './store/useEngineStore';
import { engineManager } from './engine/EngineManager';

export const App: React.FC = () => {
  const { mode } = useChessStore();
  const { activeAnalysisTab } = useEngineStore();

  // Initialize engine on app load
  useEffect(() => {
    engineManager.initialize();
  }, []);

  return (
    <div className="min-h-screen bg-[#0b0f15] text-slate-100 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Chessboard & Controls (7 Cols) - Sticky so board never leaves screen */}
        <div className="lg:col-span-7 flex flex-col items-center gap-4 lg:sticky lg:top-4 self-start">
          <div className="w-full flex justify-center">
            <ChessBoardContainer />
          </div>

          <div className="w-full max-w-[560px]">
            <BoardControls />
          </div>
        </div>

        {/* Right Column: Active Mode & Suggestions (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Active Mode Panel */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-xl">
            {mode === 'play-bot' && <BotPlayMode />}
            {mode === 'position-trainer' && <PositionTrainerMode />}
            {mode === 'game-analysis' && <GameAnalysisMode />}
            {mode === 'opening-trainer' && <OpeningTrainerMode />}
            {mode === 'engine-analysis' && <EngineAnalysisMode />}
          </div>

          {/* Move Suggestion & Filter Controls Card */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
            <SuggestionFilterControls />

            {/* Content Tab: Engine Candidates vs Human Thinking */}
            {activeAnalysisTab === 'engine' ? (
              <CandidateMovesList />
            ) : (
              <HumanThinkingPanel />
            )}
          </div>

          {/* Move History Log */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-xl">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Game Notation
            </div>
            <MoveHistoryList />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
