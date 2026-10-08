import React from 'react';
import { UserProfile } from '../types';
import { translations } from '../utils/translations';
import { X, BarChart3, Trophy, Flame, Coins, Percent } from 'lucide-react';

interface StatsModalProps {
  user: UserProfile;
  language: 'am' | 'en' | 'om';
  onClose: () => void;
}

export const StatsModal: React.FC<StatsModalProps> = ({ user, language, onClose }) => {
  const t = translations[language];
  const winRate = user.totalGames > 0 ? Math.round((user.totalWins / user.totalGames) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white">{t.stats}</h3>
            <p className="text-xs text-slate-400">Lifetime Player Performance</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5 text-amber-400" /> Total Wins
            </span>
            <div className="text-xl font-mono font-black text-amber-400">{user.totalWins}</div>
          </div>

          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-rose-400" /> Total Rounds
            </span>
            <div className="text-xl font-mono font-black text-white">{user.totalGames}</div>
          </div>

          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <Percent className="w-3.5 h-3.5 text-sky-400" /> Win Rate
            </span>
            <div className="text-xl font-mono font-black text-sky-400">{winRate}%</div>
          </div>

          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <Coins className="w-3.5 h-3.5 text-emerald-400" /> Total Won
            </span>
            <div className="text-xl font-mono font-black text-emerald-400">
              {user.totalWonAmount.toLocaleString()} <span className="text-xs font-sans">ETB</span>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-colors"
        >
          {t.close}
        </button>
      </div>
    </div>
  );
};
