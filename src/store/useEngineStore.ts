import { create } from 'zustand';
import {
  PositionAnalysis,
  EngineStatus,
  SideFilter,
  QualityFilter,
  HumanDifficultyLevel,
  CandidateMove,
} from '../types/chess';
import { instantSuggestionEngine } from '../engine/InstantSuggestionEngine';
import { engineManager } from '../engine/EngineManager';
import { AnalysisCache } from '../engine/AnalysisCache';

interface EngineState {
  status: EngineStatus;
  analysis: PositionAnalysis | null;
  isAnalyzing: boolean;
  showArrows: boolean;
  showEvalBar: boolean;
  autoAnalyze: boolean;
  analysisDepth: number;
  multipvCount: number;

  // Position and move tracking to prevent duplicate / repeated suggestion loops
  lastAnalyzedPositionKey: string | null;
  lastSuggestionPositionKey: string | null;
  lastAppliedMove: string | null;
  lastAppliedPly: number;

  // Side-specific suggestion settings
  sideFilter: SideFilter;
  qualityFilter: QualityFilter;

  // Human Thinking prediction settings
  humanThinkingLevel: HumanDifficultyLevel;
  humanCandidateCount: number;
  activeAnalysisTab: 'engine' | 'human-thinking';

  // Actions
  setStatus: (status: EngineStatus) => void;
  setAnalysis: (analysis: PositionAnalysis | null) => void;
  setShowArrows: (show: boolean) => void;
  setShowEvalBar: (show: boolean) => void;
  setAutoAnalyze: (auto: boolean) => void;
  setAnalysisDepth: (depth: number) => void;
  setMultipvCount: (count: number) => void;
  setSideFilter: (filter: SideFilter) => void;
  setQualityFilter: (filter: QualityFilter) => void;
  setHumanThinkingLevel: (level: HumanDifficultyLevel) => void;
  setHumanCandidateCount: (count: number) => void;
  setActiveAnalysisTab: (tab: 'engine' | 'human-thinking') => void;
  setLastAppliedMove: (move: string | null, ply: number) => void;
  requestAnalysis: (fen: string) => Promise<void>;
  cancelAnalysis: () => void;

  // Filtered candidate getter
  getFilteredCandidates: (sideToMove: 'w' | 'b') => {
    isFilteredOutBySide: boolean;
    sideFilterReason?: string;
    targetSide?: 'White' | 'Black';
    candidates: CandidateMove[];
  };
}

export const useEngineStore = create<EngineState>((set, get) => ({
  status: engineManager.getStatus(),
  analysis: null,
  isAnalyzing: false,
  showArrows: true,
  showEvalBar: true,
  autoAnalyze: true,
  analysisDepth: 14,
  multipvCount: 4,

  lastAnalyzedPositionKey: null,
  lastSuggestionPositionKey: null,
  lastAppliedMove: null,
  lastAppliedPly: 0,

  sideFilter: 'both',
  qualityFilter: 'good_or_better',
  humanThinkingLevel: 'intermediate',
  humanCandidateCount: 3,
  activeAnalysisTab: 'engine',

  setStatus: (status) => set({ status }),
  setAnalysis: (analysis) => set({ analysis }),
  setShowArrows: (showArrows) => set({ showArrows }),
  setShowEvalBar: (showEvalBar) => set({ showEvalBar }),
  setAutoAnalyze: (autoAnalyze) => set({ autoAnalyze }),
  setAnalysisDepth: (analysisDepth) => set({ analysisDepth }),
  setMultipvCount: (multipvCount) => set({ multipvCount }),
  setSideFilter: (sideFilter) => set({ sideFilter }),
  setQualityFilter: (qualityFilter) => set({ qualityFilter }),
  setHumanThinkingLevel: (humanThinkingLevel) => set({ humanThinkingLevel }),
  setHumanCandidateCount: (humanCandidateCount) => set({ humanCandidateCount }),
  setActiveAnalysisTab: (activeAnalysisTab) => set({ activeAnalysisTab }),
  setLastAppliedMove: (lastAppliedMove, lastAppliedPly) => set({ lastAppliedMove, lastAppliedPly }),

  requestAnalysis: async (fen: string) => {
    const { autoAnalyze, analysisDepth, multipvCount, activeAnalysisTab } = get();
    if (!autoAnalyze) return;

    const positionKey = AnalysisCache.generatePositionKey(fen, undefined, {
      depth: analysisDepth,
      multipv: multipvCount,
      mode: activeAnalysisTab,
    });

    // Guard: Ignore redundant calls for already analyzed & completed positions
    const currentAnalysis = get().analysis;
    if (
      get().lastAnalyzedPositionKey === positionKey &&
      currentAnalysis &&
      currentAnalysis.isComplete
    ) {
      return;
    }

    set({ lastAnalyzedPositionKey: positionKey });

    // Only clear previous analysis if position has genuinely changed
    if (currentAnalysis && currentAnalysis.fen !== fen) {
      set({ analysis: null, isAnalyzing: true });
    } else {
      set({ isAnalyzing: true });
    }

    await engineManager.initialize();

    try {
      await instantSuggestionEngine.getSuggestion(
        fen,
        { depth: analysisDepth, multipv: Math.max(multipvCount, 4), mode: activeAnalysisTab },
        (liveAnalysis) => {
          // Verify store's active key still matches to prevent stale updates
          if (get().lastAnalyzedPositionKey === positionKey) {
            set({
              analysis: liveAnalysis,
              isAnalyzing: !liveAnalysis.isComplete,
              lastSuggestionPositionKey: liveAnalysis.isComplete ? positionKey : get().lastSuggestionPositionKey,
            });
          }
        }
      );
    } catch (err) {
      console.warn('Engine analysis failed:', err);
      set({ isAnalyzing: false });
    }
  },

  cancelAnalysis: () => {
    instantSuggestionEngine.cancel();
    set({ isAnalyzing: false });
  },

  getFilteredCandidates: (sideToMove: 'w' | 'b') => {
    const { sideFilter, qualityFilter, analysis } = get();

    // 1. Check side filter
    if (sideFilter === 'white' && sideToMove !== 'w') {
      return {
        isFilteredOutBySide: true,
        targetSide: 'White',
        sideFilterReason: "Suggestions are set to White only. It is currently Black's turn to move.",
        candidates: [],
      };
    }

    if (sideFilter === 'black' && sideToMove !== 'b') {
      return {
        isFilteredOutBySide: true,
        targetSide: 'Black',
        sideFilterReason: "Suggestions are set to Black only. It is currently White's turn to move.",
        candidates: [],
      };
    }

    if (!analysis || !analysis.candidates || analysis.candidates.length === 0) {
      return {
        isFilteredOutBySide: false,
        candidates: [],
      };
    }

    // 2. Filter by quality threshold
    let filtered = [...analysis.candidates];

    switch (qualityFilter) {
      case 'best_only':
        filtered = filtered.filter((c) => c.classification === 'best');
        if (filtered.length === 0 && analysis.candidates.length > 0) {
          filtered = [analysis.candidates[0]];
        }
        break;

      case 'best_and_excellent':
        filtered = filtered.filter((c) => c.classification === 'best' || c.classification === 'excellent');
        if (filtered.length === 0 && analysis.candidates.length > 0) {
          filtered = [analysis.candidates[0]];
        }
        break;

      case 'good_or_better':
        filtered = filtered.filter(
          (c) =>
            c.classification === 'best' ||
            c.classification === 'excellent' ||
            c.classification === 'good' ||
            c.classification === 'book' ||
            !c.classification
        );
        break;

      case 'top_3_good':
        filtered = filtered
          .filter((c) => c.classification !== 'blunder' && c.classification !== 'mistake')
          .slice(0, 3);
        break;

      default:
        break;
    }

    return {
      isFilteredOutBySide: false,
      candidates: filtered,
    };
  },
}));
