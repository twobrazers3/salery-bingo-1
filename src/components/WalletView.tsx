import React, { useState } from 'react';
import { UserProfile } from '../types';
import { Check, RotateCw, Link2, Trophy, Calendar, ShieldCheck } from 'lucide-react';
import { GameHistoryItem } from './HistoryView';

interface WalletViewProps {
  user: UserProfile;
  history?: GameHistoryItem[];
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const WalletView: React.FC<WalletViewProps> = ({
  user,
  history = [],
  onRefresh,
  isRefreshing,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'balance' | 'history'>('balance');

  const playerUniqueId = user.playerCode || ('SB-' + (((Math.abs(Number(user.telegramId)) * 17) % 90000) + 10000));
  const userHandle = user.username ? (user.username.startsWith('@') ? user.username : `@${user.username}`) : `@player_${String(user.telegramId).slice(-4)}`;

  return (
    <div className="min-h-full pb-20 select-none animate-fadeIn bg-gradient-to-b from-[#2e1058] via-[#1b0c38] to-[#0e0622]">
      {/* Top Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <h1 className="text-2xl font-black text-white tracking-tight">
          Wallet (ዋሌት)
        </h1>

        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-white rounded-full transition-all active:scale-95 disabled:opacity-50"
            title="Refresh balance"
          >
            <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#38bdf8]' : ''}`} />
          </button>
        )}
      </div>

      <div className="px-4 space-y-4">
        {/* Verified User Identification Card with distinct ID */}
        <div className="bg-[#241747]/90 border border-[#37236a] rounded-2xl p-3.5 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#3b2575] to-[#5b3da8] flex items-center justify-center text-white font-black text-sm shadow">
              {(user.firstName || user.username || 'P').charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-white">{user.firstName || 'Player'}</span>
                <span className="text-xs text-sky-400 font-mono font-semibold">{userHandle}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-amber-300 font-mono font-bold mt-0.5">
                <span>መለያ ID: {playerUniqueId}</span>
                <span className="text-slate-400">· TG: {user.telegramId}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#0c3c2b] text-[#10b981] border border-[#10b981]/30 text-xs font-bold">
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            <span>Verified</span>
          </div>
        </div>

        {/* Balance vs History Sub-Tabs Segmented Bar */}
        <div className="bg-[#180f2d] p-1 rounded-2xl flex border border-[#2d1b54]">
          <button
            onClick={() => setActiveSubTab('balance')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === 'balance'
                ? 'bg-[#291b4f] text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Balance (ቀሪ ሒሳብ)
          </button>
          <button
            onClick={() => setActiveSubTab('history')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === 'history'
                ? 'bg-[#291b4f] text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            History (እንቅስቃሴ)
          </button>
        </div>

        {activeSubTab === 'balance' ? (
          <div className="space-y-3">
            {/* Main Wallet Card */}
            <div className="bg-[#1c1236] border border-[#2f1c5c] rounded-2xl p-4 flex items-center justify-between shadow-md">
              <span className="text-sm font-semibold text-slate-300">
                Main Wallet (ዋና ሒሳብ)
              </span>
              <span className="text-2xl font-black text-white font-mono">
                {(user.mainWallet ?? user.balance).toLocaleString()} <span className="text-xs font-normal text-slate-400">ETB</span>
              </span>
            </div>

            {/* Play Wallet Card */}
            <div className="bg-[#1c1236] border border-[#2f1c5c] rounded-2xl p-4 flex items-center justify-between shadow-md">
              <div className="flex items-center gap-2 text-slate-300">
                <Link2 className="w-4 h-4 text-emerald-400 rotate-45" />
                <span className="text-sm font-semibold">Play Wallet (የቦነስ ሒሳብ)</span>
              </div>
              <span className="text-2xl font-black text-[#10b981] font-mono">
                {(user.playWallet ?? 0).toLocaleString()} <span className="text-xs font-normal text-slate-400">ETB</span>
              </span>
            </div>

            {/* Security Notice Card: Deposits & Withdrawals via Official Telegram Bot */}
            <div className="pt-2 space-y-2.5">
              <div className="bg-[#1c1236] border border-[#2f1c5c] rounded-2xl p-5 text-center space-y-3 shadow-md">
                <div className="w-12 h-12 rounded-full bg-[#271549] text-emerald-400 flex items-center justify-center mx-auto text-xl font-bold shadow-inner">
                  <ShieldCheck className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 className="text-sm font-bold text-white">
                  ደህንነቱ የተጠበቀ የገንዘብ እንቅስቃሴ
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  ገንዘብ ማስገባት (Deposit) እንዲሁም ያሸነፉትን ገንዘብ ማውጣት (Withdraw) የሚቻለው በዋናው የቴሌግራም ቦት (@salerybingo_bot) በኩል ብቻ ነው።
                </p>
                {onRefresh && (
                  <button
                    onClick={onRefresh}
                    disabled={isRefreshing}
                    className="mt-2 w-full py-2.5 bg-[#281850] hover:bg-[#342066] text-[#38bdf8] text-xs font-bold rounded-xl border border-[#3b2474] flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span>ሒሳብ ያድሱ (Sync Balance)</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Transaction and Game Winnings history subtab */
          <div className="space-y-2.5 py-1">
            {history.length === 0 ? (
              <div className="bg-[#1c1236] border border-[#2f1c5c] rounded-2xl p-6 text-center text-slate-400 text-xs space-y-2">
                <div className="text-2xl">📋</div>
                <p className="font-bold text-white">እስካሁን ምንም የገንዘብ እንቅስቃሴ የለም</p>
                <p className="text-slate-400">ሲጫወቱና ሲያሸንፉ ያገኙት ደራሽ ሽልማት እና የገንዘብ እንቅስቃሴዎች እዚህ ይቀመጣሉ።</p>
              </div>
            ) : (
              history.map((item, idx) => {
                const isWon = item.result === 'won';
                const prize = item.totalPrize || (isWon ? item.wonAmount : Math.floor(Math.max(item.cardsCount + 1, 2) * item.stake * 0.8));
                const dateStr = new Date(item.timestamp).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                });

                return (
                  <div
                    key={item.id || idx}
                    className="bg-[#1c1236] border border-[#2f1c5c] rounded-2xl p-3.5 flex items-center justify-between shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm ${
                          isWon ? 'bg-[#144434] text-emerald-300' : 'bg-[#401f3f] text-slate-400'
                        }`}
                      >
                        {isWon ? <Trophy className="w-4 h-4 text-emerald-400" /> : '🎮'}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>{isWon ? 'የቢንጎ ደራሽ ድል (Bingo Won)' : 'የጨዋታ ተሳትፎ (Round Played)'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5 font-mono">
                          <span className="flex items-center gap-1"><Calendar className="w-2.5 h-2.5" />{dateStr}</span>
                          <span>· Stake: {item.stake} ETB</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className={`text-sm font-black font-mono ${isWon ? 'text-emerald-400' : 'text-slate-300'}`}>
                        {isWon ? `+${item.wonAmount} ETB` : `ደራሽ: ${prize} ETB`}
                      </div>
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${isWon ? 'bg-emerald-950 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                        {isWon ? 'የተከፈለ' : 'ተጠናቋል'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};
