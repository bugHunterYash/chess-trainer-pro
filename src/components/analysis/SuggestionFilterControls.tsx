import React from 'react';
import { useEngineStore } from '../../store/useEngineStore';
import { SideFilter, QualityFilter } from '../../types/chess';
import { Filter, UserCheck, ShieldCheck, Cpu } from 'lucide-react';

export const SuggestionFilterControls: React.FC = () => {
  const {
    sideFilter,
    setSideFilter,
    qualityFilter,
    setQualityFilter,
    activeAnalysisTab,
    setActiveAnalysisTab,
  } = useEngineStore();

  return (
    <div className="flex flex-col gap-2.5 p-3 rounded-xl bg-slate-950/70 border border-slate-800">
      {/* Top row: Analysis View Switcher (Engine vs Human Thinking) */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
        <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setActiveAnalysisTab('engine')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition ${
              activeAnalysisTab === 'engine'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" /> Engine Moves
          </button>
          <button
            onClick={() => setActiveAnalysisTab('human-thinking')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition ${
              activeAnalysisTab === 'human-thinking'
                ? 'bg-amber-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" /> Human Thinking
          </button>
        </div>

        <span className="text-[11px] font-mono text-slate-500 hidden sm:inline">
          Filter Active
        </span>
      </div>

      {/* Bottom controls: Side selection & Quality threshold */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        {/* Side filter */}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
            <Filter className="w-3 h-3 text-emerald-400" /> Suggest For
          </span>
          <div className="grid grid-cols-3 gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setSideFilter('both')}
              className={`py-1 px-1.5 rounded text-[11px] font-semibold transition ${
                sideFilter === 'both'
                  ? 'bg-slate-700 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Both
            </button>
            <button
              onClick={() => setSideFilter('white')}
              className={`py-1 px-1.5 rounded text-[11px] font-semibold transition ${
                sideFilter === 'white'
                  ? 'bg-slate-100 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              White
            </button>
            <button
              onClick={() => setSideFilter('black')}
              className={`py-1 px-1.5 rounded text-[11px] font-semibold transition ${
                sideFilter === 'black'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Black
            </button>
          </div>
        </div>

        {/* Quality threshold filter */}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-400" /> Quality Filter
          </span>
          <select
            value={qualityFilter}
            onChange={(e) => setQualityFilter(e.target.value as QualityFilter)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg py-1.5 px-2 text-xs font-medium text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="good_or_better">Good or better (Default)</option>
            <option value="top_3_good">Top 3 good candidates</option>
            <option value="best_and_excellent">Best & Excellent only</option>
            <option value="best_only">Best only</option>
          </select>
        </div>
      </div>
    </div>
  );
};

