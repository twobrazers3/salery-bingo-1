import React from 'react';
import { Volume2, VolumeX, Mic, MicOff, Globe, Sparkles, PlusCircle, ArrowUpRight, HelpCircle, BarChart3 } from 'lucide-react';
import { UserProfile } from '../types';
import { translations } from '../utils/translations';

interface HeaderProps {
  user: UserProfile;
  language: 'am' | 'en' | 'om';
  soundEnabled: boolean;
  voiceEnabled: boolean;
  onToggleSound: () => void;
  onToggleVoice: () => void;
  onToggleLanguage: () => void;
  onOpenDeposit: () => void;
  onOpenWithdraw: () => void;
  onOpenRules: () => void;
  onOpenStats: () => void;
  onOpenAdmin?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  language,
  soundEnabled,
  voiceEnabled,
  onToggleSound,
  onToggleVoice,
  onToggleLanguage,
  onOpenDeposit,
  onOpenWithdraw,
  onOpenRules,
  onOpenStats,
  onOpenAdmin
}) => {
  const t = translations[language];
  const isAdmin = user.role === 'admin' || String(user.telegramId) === '908336796';

  return (
    <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 px-3 py-2.5 sm:px-6 shadow-xl">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Brand & User Info */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 flex items-center justify-center font-black text-slate-950 text-base shadow-lg shadow-amber-500/20 border border-amber-300">
              🎱
            </div>
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border border-slate-900"></span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-extrabold text-sm sm:text-base tracking-tight text-white flex items-center gap-1">
                {t.appName}
              </h1>
              {isAdmin ? (
                <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-1.5 py-0.2 rounded shadow">
                  👑 ADMIN
                </span>
              ) : (
                <span className="bg-amber-500/10 text-amber-400 text-[10px] font-bold px-1.5 py-0.2 rounded border border-amber-500/30">
                  LIVE
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="truncate max-w-[100px] sm:max-w-[140px] font-medium text-slate-300">
                {user.firstName || user.username || 'Player'}
              </span>
            </div>
          </div>
        </div>

        {/* Balance Display */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="bg-slate-950 border border-amber-500/30 px-3 py-1 rounded-xl flex items-center gap-2 shadow-inner">
            <div>
              <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block leading-none">
                {t.balance}
              </span>
              <span className="font-mono text-sm sm:text-base font-extrabold text-amber-400 leading-tight">
                {user.balance.toLocaleString()} <span className="text-[10px] text-amber-300/80 font-sans">ETB</span>
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls & Utilities */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {isAdmin && onOpenAdmin && (
            <button
              onClick={onOpenAdmin}
              title="Open Admin Control Panel"
              className="px-2 py-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-lg text-xs flex items-center gap-1 shadow-md shadow-amber-500/20 active:scale-95 transition-all"
            >
              <span>👑</span>
              <span className="hidden sm:inline">Admin</span>
            </button>
          )}

          <button
            onClick={onToggleLanguage}
            title="Toggle Language"
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold flex items-center gap-1"
          >
            <Globe className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px]">{language === 'am' ? 'EN' : 'አማ'}</span>
          </button>

          <button
            onClick={onToggleSound}
            title={soundEnabled ? 'Mute Sound' : 'Enable Sound'}
            className={`p-1.5 rounded-lg border transition-colors ${
              soundEnabled
                ? 'bg-slate-800 border-slate-700 text-amber-400'
                : 'bg-slate-950 border-slate-800 text-slate-600'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            onClick={onToggleVoice}
            title={voiceEnabled ? 'Mute Voice Caller' : 'Enable Voice Caller'}
            className={`p-1.5 rounded-lg border transition-colors hidden sm:block ${
              voiceEnabled
                ? 'bg-slate-800 border-slate-700 text-emerald-400'
                : 'bg-slate-950 border-slate-800 text-slate-600'
            }`}
          >
            {voiceEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </button>

          <button
            onClick={onOpenStats}
            title={t.stats}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300"
          >
            <BarChart3 className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenRules}
            title={t.rules}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
