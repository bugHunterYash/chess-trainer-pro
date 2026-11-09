import React from 'react';
import { useEngineStore } from '../../store/useEngineStore';
import { useChessStore } from '../../store/useChessStore';
import { engineManager } from '../../engine/EngineManager';
import { Sliders, Cpu, Activity, Eye, Zap } from 'lucide-react';

export const EngineAnalysisMode: React.FC = () => {
  const {
    analysis,
    isAnalyzing,
    status,
    showArrows,
    setShowArrows,
    showEvalBar,
    setShowEvalBar,
    autoAnalyze,
    setAutoAnalyze,
    analysisDepth,
    setAnalysisDepth,
    multipvCount,
    setMultipvCount,
    requestAnalysis,
  } = useEngineStore();

  const { fen } = useChessStore();

  const handleDepthChange = (depth: number) => {
    setAnalysisDepth(depth);
    requestAnalysis(fen);
  };

  const handleMultipvChange = (count: number) => {
    setMultipvCount(count);
    requestAnalysis(fen);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Engine Metrics Card */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <h3 className="font-bold text-sm text-slate-100">Stockfish 19 Engine</h3>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                status === 'analyzing'
                  ? 'bg-emerald-400 animate-ping'
                  : status === 'ready'
                  ? 'bg-emerald-500'
                  : 'bg-amber-500'
              }`}
            />
            <span className="text-[11px] font-mono text-slate-300 capitalize">
              {status}
            </span>
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] text-slate-500 block uppercase">Nodes</span>
            <span className="text-xs font-mono font-bold text-slate-200">
              {analysis?.nodes ? `${(analysis.nodes / 1000).toFixed(0)}k` : '—'}
            </span>
          </div>
          <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] text-slate-500 block uppercase">NPS</span>
            <span className="text-xs font-mono font-bold text-slate-200">
              {analysis?.nps ? `${(analysis.nps / 1000).toFixed(0)}k/s` : '—'}
            </span>
          </div>
          <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] text-slate-500 block uppercase">Time</span>
            <span className="text-xs font-mono font-bold text-slate-200">
              {analysis?.timeMs ? `${analysis.timeMs}ms` : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Engine Sliders & Controls */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5 text-emerald-400" /> Calculation Controls
        </h4>

        {/* Depth Slider */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-medium">
            <span className="text-slate-300">Target Depth</span>
            <span className="font-mono text-emerald-400 font-bold">{analysisDepth} ply</span>
          </div>
          <input
            type="range"
            min={8}
            max={22}
            value={analysisDepth}
            onChange={(e) => handleDepthChange(parseInt(e.target.value, 10))}
            className="w-full accent-emerald-500 h-1.5 bg-slate-950 rounded-lg cursor-pointer"
          />
        </div>

        {/* MultiPV Slider */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-medium">
            <span className="text-slate-300">Candidate Lines (MultiPV)</span>
            <span className="font-mono text-emerald-400 font-bold">{multipvCount} lines</span>
          </div>
          <input
            type="range"
            min={1}
            max={5}
            value={multipvCount}
            onChange={(e) => handleMultipvChange(parseInt(e.target.value, 10))}
            className="w-full accent-emerald-500 h-1.5 bg-slate-950 rounded-lg cursor-pointer"
          />
        </div>

        {/* Toggles */}
        <div className="pt-2 border-t border-slate-800/80 space-y-2.5">
          <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
            <span className="flex items-center gap-2">
              <Eye className="w-3.5 h-3.5 text-slate-400" /> Show Candidate Arrows
            </span>
            <input
              type="checkbox"
              checked={showArrows}
              onChange={(e) => setShowArrows(e.target.checked)}
              className="accent-emerald-500 rounded"
            />
          </label>

          <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
            <span className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-slate-400" /> Show Evaluation Bar
            </span>
            <input
              type="checkbox"
              checked={showEvalBar}
              onChange={(e) => setShowEvalBar(e.target.checked)}
              className="accent-emerald-500 rounded"
            />
          </label>

          <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
            <span className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-slate-400" /> Real-time Auto-Analysis
            </span>
            <input
              type="checkbox"
              checked={autoAnalyze}
              onChange={(e) => setAutoAnalyze(e.target.checked)}
              className="accent-emerald-500 rounded"
            />
          </label>
        </div>
      </div>
    </div>
  );
};

