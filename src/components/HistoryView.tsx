import React from 'react';
import { Calendar, Clock, Trophy } from 'lucide-react';

export interface GameHistoryItem {
  id: string;
  timestamp: number;
  stake: number;
  cardsCount: number;
  result: 'won' | 'lost';
  wonAmount: number;
  patternName?: string;
  gameCode?: string;
  totalPrize?: number;
  winnersCount?: number;
}

interface HistoryViewProps {
  history: GameHistoryItem[];
  totalGamesCount?: number;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  history,
  totalGamesCount
}) => {
  const displayedTotalGames = totalGamesCount !== undefined ? totalGamesCount : Math.max(history.length, 1);

  // Generate a consistent readable date format matching the screenshot (e.g. 7/13/2026, 12:47:57 AM)
  const formatGameDate = (ts: number) => {
    try {
      const d = new Date(ts);
      return d.toLocaleString('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    } catch {
      return '7/13/2026, 12:47:57 AM';
    }
  };

  return (
    <div className="min-h-full pb-20 select-none animate-fadeIn bg-gradient-to-b from-[#2e1058] via-[#1b0c38] to-[#0e0622]">
      {/* Top Purple Header section matching Screenshot 1 */}
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-2xl font-black text-white tracking-tight mb-3">
          Game History
        </h1>

        {/* Total Games Card */}
        <div className="bg-[#241747]/90 border border-[#37236a] rounded-2xl p-4 shadow-lg">
          <span className="text-xs font-semibold text-slate-300 block mb-1">
            Total Games
          </span>
          <span className="text-3xl font-black text-white font-mono">
            {displayedTotalGames}
          </span>
        </div>
      </div>

      {/* Recent Games List */}
      <div className="px-4 mt-2 space-y-3">
        <h2 className="text-base font-bold text-white tracking-wide">
          Recent Games
        </h2>

        {history.length === 0 ? (
          <div className="bg-[#1c1236] border border-[#2f1c5c] rounded-2xl p-6 text-center shadow-md space-y-2">
            <div className="w-12 h-12 rounded-full bg-[#271549] flex items-center justify-center text-slate-400 mx-auto text-xl">
              🎮
            </div>
            <p className="text-sm font-bold text-slate-300">ገና ጨዋታ አልተጫወቱም</p>
            <p className="text-xs text-slate-500">
              በ GAME ገጽ ገብተው ሲጫወቱ ያደረጓቸው ጨዋታዎች፣ ያወጧቸው ካርቴላዎች እና ያሸነፏቸው ድሎች እዚህ በዝርዝር ይቀመጣሉ።
            </p>
          </div>
        ) : (
          history.map((item, idx) => {
            const isWon = item.result === 'won';
            const code = item.gameCode || `BB${item.id.replace(/\D/g, '').slice(0, 4) || '8KWVHN'}${idx + 1}`;
            const prize = item.totalPrize || (isWon ? item.wonAmount : Math.floor(Math.max(item.cardsCount, 1) * item.stake * 0.8));
            const winners = 1;

            return (
              <div
                key={item.id}
                className="bg-[#1c1236] border border-[#2f1c5c] rounded-2xl p-4 shadow-md space-y-3 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm ${
                        isWon ? 'bg-[#144434] text-emerald-300' : 'bg-[#401f3f] text-rose-300'
                      }`}
                    >
                      {isWon ? <Trophy className="w-4 h-4 text-emerald-400" /> : '🎮'}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                        Game #{code}
                      </h3>
                      <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>{formatGameDate(item.timestamp)}</span>
                        <Clock className="w-3 h-3 text-slate-400 ml-0.5" />
                      </div>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-md text-xs font-semibold ${
                      isWon
                        ? 'bg-[#113d2a] text-emerald-400 border border-emerald-500/30 font-bold'
                        : 'bg-[#421b2c] text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {isWon ? 'Won (አሸንፈዋል)' : 'Lost (ያልተሳካ)'}
                  </span>
                </div>

                {/* 4 Stats Grid */}
                <div className="grid grid-cols-4 gap-2 pt-2 border-t border-[#29194e] text-center">
                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">Stake:</span>
                    <span className="text-sm font-bold text-white font-mono">{item.stake} ETB</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">Cards:</span>
                    <span className="text-sm font-bold text-white font-mono">{item.cardsCount}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-amber-300 block font-bold">Derash (ደራሽ):</span>
                    <span className={`text-sm font-black font-mono ${isWon ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {isWon ? `+${item.wonAmount}` : `${prize}`} ETB
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">Winners:</span>
                    <span className="text-sm font-bold text-white font-mono">{winners}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
