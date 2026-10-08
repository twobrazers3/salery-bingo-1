import React from 'react';
import { Trophy, Medal, Flame, Sparkles } from 'lucide-react';
import { UserProfile } from '../types';

interface ScoresViewProps {
  user: UserProfile;
}

const LEADERBOARD_DATA = [
  { rank: 1, name: 'Dawit G.', avatar: '⚡', wins: 42, wonAmount: 28500, winRate: '68%' },
  { rank: 2, name: 'Tigist M.', avatar: '🌸', wins: 36, wonAmount: 21200, winRate: '62%' },
  { rank: 3, name: 'Abebe B.', avatar: '🦁', wins: 31, wonAmount: 18450, winRate: '59%' },
  { rank: 4, name: 'Selamawit K.', avatar: '✨', wins: 28, wonAmount: 15300, winRate: '55%' },
  { rank: 5, name: 'Yared A.', avatar: '👑', wins: 24, wonAmount: 12900, winRate: '51%' },
  { rank: 6, name: 'Marta T.', avatar: '💎', wins: 19, wonAmount: 9800, winRate: '48%' },
  { rank: 7, name: 'Ephrem S.', avatar: '🎯', wins: 15, wonAmount: 7600, winRate: '45%' },
];

export const ScoresView: React.FC<ScoresViewProps> = ({ user }) => {
  return (
    <div className="max-w-md mx-auto px-4 py-4 space-y-5 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            Hall of Fame
          </h2>
          <p className="text-xs text-slate-400">Weekly Dil Bingo Champions</p>
        </div>
        <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-full border border-emerald-500/20">
          ● LIVE
        </span>
      </div>

      {/* User's current standing */}
      <div className="bg-gradient-to-r from-amber-500/20 via-amber-600/10 to-transparent border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-base shadow">
            ⭐
          </div>
          <div>
            <span className="text-xs text-amber-300 font-bold block">Your Score</span>
            <span className="text-sm font-black text-white">{user.firstName}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-400">Total Wins</div>
          <div className="text-base font-mono font-black text-amber-400">{user.totalWins} Wins</div>
        </div>
      </div>

      {/* Top 3 Podium Cards */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        {LEADERBOARD_DATA.slice(0, 3).map((player, idx) => (
          <div
            key={player.rank}
            className={`p-3 rounded-2xl border text-center relative flex flex-col items-center justify-between ${
              idx === 0
                ? 'bg-gradient-to-b from-amber-500/20 to-slate-900 border-amber-400/60 shadow-lg shadow-amber-500/10 order-2 -translate-y-2'
                : idx === 1
                ? 'bg-slate-900/90 border-slate-700 order-1'
                : 'bg-slate-900/90 border-slate-700 order-3'
            }`}
          >
            <div className="text-lg">{player.avatar}</div>
            <div className="my-1">
              <div className="text-xs font-bold text-white truncate max-w-[80px]">{player.name}</div>
              <div className="text-[10px] font-mono text-emerald-400 font-black">{player.wonAmount} ETB</div>
            </div>
            <div
              className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                idx === 0
                  ? 'bg-amber-400 text-slate-950'
                  : idx === 1
                  ? 'bg-slate-300 text-slate-950'
                  : 'bg-amber-700 text-white'
              }`}
            >
              #{player.rank}
            </div>
          </div>
        ))}
      </div>

      {/* Rest of Leaderboard */}
      <div className="space-y-2 bg-slate-900/70 border border-slate-800 rounded-2xl p-3">
        {LEADERBOARD_DATA.slice(3).map((item) => (
          <div
            key={item.rank}
            className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-5 text-center font-mono text-xs font-bold text-slate-500">
                #{item.rank}
              </span>
              <span className="text-base">{item.avatar}</span>
              <span className="text-xs font-bold text-slate-200">{item.name}</span>
            </div>
            <div className="text-right">
              <span className="font-mono text-xs font-bold text-emerald-400 block">
                {item.wonAmount.toLocaleString()} ETB
              </span>
              <span className="text-[10px] text-slate-500">{item.wins} wins ({item.winRate})</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
