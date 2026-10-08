import React from 'react';
import { CompetitorPlayer } from '../types';
import { translations } from '../utils/translations';
import { Users, Flame } from 'lucide-react';

interface CompetitorListProps {
  competitors: CompetitorPlayer[];
  language: 'am' | 'en';
}

export const CompetitorList: React.FC<CompetitorListProps> = ({ competitors, language }) => {
  const t = translations[language];

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
      <div className="flex items-center justify-between text-xs font-bold text-slate-300">
        <span className="flex items-center gap-1.5">
          <Users className="w-4 h-4 text-emerald-400" />
          {t.opponents} ({competitors.length + 1})
        </span>
        <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          LIVE ROOM
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {competitors.map((player) => (
          <div
            key={player.id}
            className={`p-2 rounded-xl border transition-all ${
              player.hasWon
                ? 'bg-amber-500/20 border-amber-500/50 shadow-md shadow-amber-500/20'
                : player.remainingToWin === 1
                ? 'bg-rose-950/30 border-rose-500/40'
                : 'bg-slate-950/60 border-slate-800/80'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-sm shadow-inner shrink-0">
                {player.avatar}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-200 truncate">{player.name}</div>
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <span>{player.cardsCount} {t.card}</span>
                </div>
              </div>
            </div>

            <div className="mt-1.5 pt-1.5 border-t border-slate-800/60 flex items-center justify-between text-[10px]">
              {player.hasWon ? (
                <span className="text-amber-400 font-bold flex items-center gap-0.5">
                  <Flame className="w-3 h-3 text-amber-400 fill-amber-400" /> WON!
                </span>
              ) : player.remainingToWin === 1 ? (
                <span className="text-rose-400 font-black animate-pulse">1 to Win! 🔥</span>
              ) : (
                <span className="text-slate-400 font-mono">{t.needsNumbers(player.remainingToWin)}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
