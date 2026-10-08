import React from 'react';
import { GameSettings, GameStatus } from '../types';
import { translations } from '../utils/translations';
import { Play, Pause, RotateCcw, Zap, Coins, CopyCheck, Clock, Sparkles } from 'lucide-react';

interface GameControlsProps {
  status: GameStatus;
  settings: GameSettings;
  onUpdateSettings: (newSettings: Partial<GameSettings>) => void;
  onStartGame: () => void;
  onPauseGame: () => void;
  onResumeGame: () => void;
  onResetGame: () => void;
  prizePool: number;
}

const STAKE_OPTIONS = [10, 25, 50, 100, 250];
const CARDS_OPTIONS = [1, 2, 3, 4];
const SPEED_OPTIONS = [
  { label: 'fast', ms: 2500 },
  { label: 'medium', ms: 3800 },
  { label: 'slow', ms: 5000 }
];

export const GameControls: React.FC<GameControlsProps> = ({
  status,
  settings,
  onUpdateSettings,
  onStartGame,
  onPauseGame,
  onResumeGame,
  onResetGame,
  prizePool
}) => {
  const t = translations[settings.language];
  const isPlaying = status === 'in_progress' || status === 'countdown';
  const isPaused = status === 'paused';

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Stake Selector */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
            <span className="flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              {t.stake}
            </span>
            <span className="text-amber-400 font-mono font-black">{settings.selectedStake} ETB</span>
          </div>
          <div className="flex items-center gap-1">
            {STAKE_OPTIONS.map((val) => (
              <button
                key={val}
                disabled={isPlaying}
                onClick={() => onUpdateSettings({ selectedStake: val })}
                className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                  settings.selectedStake === val
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                } ${isPlaying ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {val}
              </button>
            ))}
          </div>
        </div>

        {/* Cards Count Selector */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
            <span className="flex items-center gap-1.5">
              <CopyCheck className="w-3.5 h-3.5 text-sky-400" />
              {t.cardsCount}
            </span>
            <span className="text-sky-400 font-mono font-black">{settings.cardsCount} {t.card}</span>
          </div>
          <div className="flex items-center gap-1">
            {CARDS_OPTIONS.map((num) => (
              <button
                key={num}
                disabled={isPlaying}
                onClick={() => onUpdateSettings({ cardsCount: num })}
                className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                  settings.cardsCount === num
                    ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                } ${isPlaying ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        {/* Auto-Daub Switch */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-300 font-bold flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              {t.autoDaub}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Auto mark matching balls</span>
          </div>
          <button
            onClick={() => onUpdateSettings({ autoDaub: !settings.autoDaub })}
            className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${
              settings.autoDaub ? 'bg-amber-500' : 'bg-slate-800'
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${
                settings.autoDaub ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Speed Selector */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              {t.speed}
            </span>
            <span className="text-emerald-400 font-mono text-[10px]">
              {(settings.callSpeedMs / 1000).toFixed(1)}s
            </span>
          </div>
          <div className="flex items-center gap-1">
            {SPEED_OPTIONS.map((sp) => (
              <button
                key={sp.label}
                onClick={() => onUpdateSettings({ callSpeedMs: sp.ms })}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                  settings.callSpeedMs === sp.ms
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {t[sp.label as 'fast' | 'medium' | 'slow']}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Primary Action Buttons & Prize Display */}
      <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <div>
              <span className="text-[10px] text-amber-300 font-bold uppercase tracking-wider block leading-none">
                {t.prizePool}
              </span>
              <span className="font-mono text-base font-black text-amber-400 leading-tight">
                {prizePool.toLocaleString()} ETB
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status === 'idle' || status === 'game_over' ? (
            <button
              onClick={onStartGame}
              className="flex-1 sm:flex-none px-6 py-2.5 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2 transition-all transform active:scale-95"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              {t.play} ({settings.selectedStake * settings.cardsCount} ETB)
            </button>
          ) : (
            <>
              {isPaused ? (
                <button
                  onClick={onResumeGame}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <Play className="w-3.5 h-3.5 fill-slate-950" />
                  {t.resume}
                </button>
              ) : (
                <button
                  onClick={onPauseGame}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <Pause className="w-3.5 h-3.5" />
                  {t.pause}
                </button>
              )}

              <button
                onClick={onResetGame}
                className="px-4 py-2 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {t.reset}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
