import React from 'react';
import { GameSettings, UserProfile } from '../types';
import { Play } from 'lucide-react';

interface LobbyViewProps {
  user: UserProfile;
  settings: GameSettings;
  onUpdateSettings?: (newSettings: Partial<GameSettings>) => void;
  onStartGame: () => void;
  onOpenRules: () => void;
  onRefreshBalance?: () => void;
  isRefreshingBalance?: boolean;
  onLinkTelegramId?: (id: number, customBalance?: number) => void;
  onOpenAdmin?: () => void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  user,
  settings,
  onStartGame,
  onOpenRules,
  onOpenAdmin,
}) => {
  const isAdmin = user.role === 'admin' || String(user.telegramId) === '908336796';

  return (
    <div className="min-h-full flex flex-col justify-between max-w-md mx-auto px-4 py-3 select-none animate-fadeIn">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1.5">
          <span className="font-black text-base sm:text-lg tracking-wider text-white">
            SALERY BINGO
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenRules}
            className="px-4 py-1 bg-[#251e44] hover:bg-[#2e2654] text-slate-200 border border-[#3c3268] rounded-full text-xs font-semibold shadow-md transition-all active:scale-95"
          >
            Rules
          </button>
        </div>
      </div>

      {/* Main Hero Section: "Welcome to SALERY BINGO" (Exact match to Screenshot 2440) */}
      <div className="text-center my-6 space-y-1">
        <p className="text-slate-300 text-sm font-medium tracking-wide">
          Welcome to
        </p>
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-[#fef08a] via-[#facc15] to-[#eab308] drop-shadow-[0_4px_16px_rgba(234,179,8,0.4)]">
          SALERY BINGO
        </h1>
      </div>

      {/* Center Main Stake Card (Exact match to Screenshot 2440) */}
      <div className="relative bg-[#16112d] border border-[#2b2253] rounded-[28px] py-8 px-6 shadow-[0_16px_50px_rgba(0,0,0,0.6)] space-y-6">
        {/* Card Title & Glowing Golden Accent Line */}
        <div className="text-center space-y-2">
          <h2 className="text-xs sm:text-sm font-black tracking-[0.2em] uppercase text-slate-200">
            CHOOSE YOUR STAKE
          </h2>
          {/* Subtle glowing golden center line */}
          <div className="w-16 h-[2px] mx-auto bg-gradient-to-r from-transparent via-[#f59e0b] to-transparent shadow-[0_0_10px_#f59e0b]"></div>
        </div>

        {/* Big Emerald Green Play Button */}
        <div>
          <button
            onClick={onStartGame}
            className="w-full py-3.5 bg-gradient-to-r from-[#10b981] via-[#059669] to-[#10b981] hover:brightness-110 active:scale-[0.98] text-slate-950 font-black text-lg sm:text-xl rounded-2xl shadow-[0_6px_25px_rgba(16,185,129,0.45)] flex items-center justify-center gap-2.5 uppercase tracking-wider transition-all border-t border-emerald-300/40"
          >
            <Play className="w-5 h-5 fill-slate-950 stroke-none" />
            <span>PLAY {settings.selectedStake || 10}</span>
          </button>
        </div>

        {/* Wallet Balance Section */}
        <div className="text-center pt-1 space-y-1">
          <p className="text-[11px] font-bold tracking-[0.18em] text-slate-400 uppercase">
            WALLET BALANCE
          </p>
          <div className="font-mono text-3xl sm:text-4xl font-black text-white tracking-tight">
            {user.balance.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Space filler for bottom alignment */}
      <div className="py-2"></div>
    </div>
  );
};
