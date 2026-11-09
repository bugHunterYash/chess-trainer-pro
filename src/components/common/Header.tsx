import React from 'react';
import { useChessStore } from '../../store/useChessStore';
import { useEngineStore } from '../../store/useEngineStore';
import { SoundService } from '../../services/SoundService';
import { AppMode } from '../../types/chess';
import {
  Bot,
  Target,
  BarChart2,
  BookOpen,
  Cpu,
  Volume2,
  VolumeX,
  Download,
} from 'lucide-react';

export const Header: React.FC = () => {
  const { mode, setMode } = useChessStore();
  const { status } = useEngineStore();
  const [soundOn, setSoundOn] = React.useState(true);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    SoundService.setEnabled(next);
  };

  const navItems: { mode: AppMode; label: string; icon: React.ReactNode }[] = [
    { mode: 'play-bot', label: 'Play Bot', icon: <Bot className="w-4 h-4" /> },
    { mode: 'position-trainer', label: 'Trainer & Puzzles', icon: <Target className="w-4 h-4" /> },
    { mode: 'game-analysis', label: 'Game Review', icon: <BarChart2 className="w-4 h-4" /> },
    { mode: 'opening-trainer', label: 'Openings', icon: <BookOpen className="w-4 h-4" /> },
    { mode: 'engine-analysis', label: 'Engine Board', icon: <Cpu className="w-4 h-4" /> },
  ];

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 py-3 px-6 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md sticky top-0 z-50">
      {/* Brand logo */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-sky-500 flex items-center justify-center shadow-lg shadow-emerald-500/10 text-white font-extrabold text-lg select-none">
          ♞
        </div>
        <div>
          <h1 className="text-base font-extrabold tracking-tight text-slate-100 flex items-center gap-2">
            Chess Trainer <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono">PRO</span>
          </h1>
          <p className="text-[11px] text-slate-400">Offline-First Engine Learning Platform</p>
        </div>
      </div>

      {/* Mode navigation tabs */}
      <nav className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
        {navItems.map((item) => {
          const isActive = mode === item.mode;
          return (
            <button
              key={item.mode}
              onClick={() => setMode(item.mode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                isActive
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Right utilities */}
      <div className="flex items-center gap-3">
        {/* Extension Download Link */}
        <a
          href="/chess-trainer-extension.zip"
          download="chess-trainer-pro-extension.zip"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900/90 border border-emerald-600/40 text-[11px] font-semibold text-emerald-300 transition shadow-sm"
          title="Download Chrome Extension (.zip) for 0ms Live Lichess Sync"
        >
          <Download className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden lg:inline">Extension (.zip)</span>
        </a>

        {/* Engine status indicator */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300"
          title={`Stockfish Engine: ${status}`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              status === 'ready'
                ? 'bg-emerald-500 shadow-sm shadow-emerald-500'
                : status === 'analyzing'
                ? 'bg-sky-400 animate-ping'
                : 'bg-amber-400'
            }`}
          />
          <span className="capitalize">{status === 'analyzing' ? 'evaluating' : status}</span>
        </div>

        {/* Audio Toggle */}
        <button
          onClick={toggleSound}
          className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition"
          title={soundOn ? 'Mute Sounds' : 'Unmute Sounds'}
        >
          {soundOn ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
        </button>
      </div>
    </header>
  );
};

