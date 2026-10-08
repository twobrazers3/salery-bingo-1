import React, { useState } from 'react';
import { BingoBall, BingoLetter } from '../types';
import { BINGO_LETTERS, LETTER_RANGES } from '../utils/bingoLogic';
import { translations } from '../utils/translations';
import { LayoutGrid, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

interface CallerBoardProps {
  currentBall: BingoBall | null;
  recentBalls: BingoBall[];
  calledSet: Set<number>;
  language: 'am' | 'en';
  isCalling: boolean;
  totalCalled: number;
}

export const CallerBoard: React.FC<CallerBoardProps> = ({
  currentBall,
  recentBalls,
  calledSet,
  language,
  isCalling,
  totalCalled
}) => {
  const [showMasterBoard, setShowMasterBoard] = useState(false);
  const t = translations[language];

  const getLetterColor = (letter: BingoLetter) => {
    switch (letter) {
      case 'B':
        return 'from-sky-500 to-blue-600 text-white border-sky-300';
      case 'I':
        return 'from-rose-500 to-red-600 text-white border-rose-300';
      case 'N':
        return 'from-amber-400 to-amber-600 text-slate-950 border-amber-200';
      case 'G':
        return 'from-emerald-500 to-teal-600 text-white border-emerald-300';
      case 'O':
        return 'from-purple-500 to-violet-600 text-white border-purple-300';
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-2xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Current Big Ball Announcement */}
        <div className="flex items-center gap-4">
          <div className="relative">
            {currentBall ? (
              <div
                key={currentBall.number}
                className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br ${getLetterColor(
                  currentBall.letter
                )} flex flex-col items-center justify-center font-black shadow-2xl border-4 transform transition-all duration-300 animate-stamp`}
              >
                <span className="text-xs sm:text-sm tracking-widest uppercase opacity-90">
                  {currentBall.letter}
                </span>
                <span className="text-2xl sm:text-4xl font-mono leading-none tracking-tight">
                  {currentBall.number}
                </span>
              </div>
            ) : (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-slate-950 border-2 border-dashed border-slate-800 flex flex-col items-center justify-center text-slate-600">
                <Sparkles className="w-6 h-6 animate-pulse" />
                <span className="text-[10px] uppercase font-bold mt-1 tracking-wider">
                  {isCalling ? 'Starting...' : 'Waiting'}
                </span>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-slate-400 font-bold">
                {t.currentBall}
              </span>
              {isCalling && (
                <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  CALLING
                </span>
              )}
            </div>
            <div className="text-lg sm:text-2xl font-black text-white mt-0.5">
              {currentBall ? (
                <span>
                  {currentBall.letter} -{' '}
                  <span className="text-amber-400 font-mono">{currentBall.number}</span>
                </span>
              ) : (
                <span className="text-slate-500 font-normal text-sm sm:text-base">
                  {t.gameStartsIn}
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400 font-mono mt-1">
              {totalCalled} / 75 Balls Drawn ({Math.round((totalCalled / 75) * 100)}%)
            </div>
          </div>
        </div>

        {/* Recent Called Balls Tray */}
        <div className="flex-1 sm:max-w-md">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-2">
            <span>{t.recentBalls}</span>
            <button
              onClick={() => setShowMasterBoard(!showMasterBoard)}
              className="text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>{showMasterBoard ? 'Hide Board' : '75 Board'}</span>
              {showMasterBoard ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 min-h-[46px]">
            {recentBalls.length === 0 ? (
              <span className="text-xs text-slate-600 italic">No balls called yet</span>
            ) : (
              recentBalls.map((ball, idx) => (
                <div
                  key={`${ball.number}-${idx}`}
                  className={`flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-b ${getLetterColor(
                    ball.letter
                  )} flex flex-col items-center justify-center font-bold text-xs shadow-md border border-white/20`}
                >
                  <span className="text-[8px] uppercase leading-none opacity-80">{ball.letter}</span>
                  <span className="text-sm font-mono leading-none mt-0.5">{ball.number}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Collapsible 75-Ball Master Board */}
      {showMasterBoard && (
        <div className="pt-3 border-t border-slate-800 space-y-2 animate-fadeIn">
          <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
            <span>{t.allBalls}</span>
            <span className="text-emerald-400 font-mono text-[11px]">{calledSet.size} / 75 called</span>
          </div>

          <div className="space-y-1.5 overflow-x-auto">
            {BINGO_LETTERS.map((letter) => {
              const range = LETTER_RANGES[letter];
              const numbers: number[] = [];
              for (let n = range.min; n <= range.max; n++) numbers.push(n);

              return (
                <div key={letter} className="flex items-center gap-1.5">
                  <div
                    className={`w-6 h-6 rounded-lg ${range.bgClass} text-slate-950 font-black text-xs flex items-center justify-center shrink-0 shadow`}
                  >
                    {letter}
                  </div>
                  <div className="grid grid-cols-15 gap-1 flex-1 min-w-[360px]">
                    {numbers.map((num) => {
                      const isDrawn = calledSet.has(num);
                      const isCurrent = currentBall?.number === num;
                      return (
                        <div
                          key={num}
                          className={`h-6 rounded flex items-center justify-center font-mono text-[11px] font-bold transition-all ${
                            isCurrent
                              ? 'bg-amber-400 text-slate-950 scale-110 shadow-lg shadow-amber-400/40 ring-2 ring-amber-300 z-10'
                              : isDrawn
                              ? 'bg-slate-700 text-emerald-300 border border-emerald-500/40 font-black'
                              : 'bg-slate-950 text-slate-600 border border-slate-900'
                          }`}
                        >
                          {num}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
