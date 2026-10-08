import React from 'react';
import { BingoCardModel, CardCell } from '../types';
import { BINGO_LETTERS, LETTER_RANGES } from '../utils/bingoLogic';
import { translations } from '../utils/translations';
import { Sparkles, Trophy, CheckCircle2 } from 'lucide-react';

interface BingoCardViewProps {
  card: BingoCardModel;
  onCellClick: (cardIndex: number, row: number, col: number) => void;
  onClaimBingo: (card: BingoCardModel) => void;
  canClaimBingo: boolean;
  language: 'am' | 'en';
}

export const BingoCardView: React.FC<BingoCardViewProps> = ({
  card,
  onCellClick,
  onClaimBingo,
  canClaimBingo,
  language
}) => {
  const t = translations[language];

  return (
    <div
      className={`bg-slate-900 border rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 flex flex-col ${
        card.hasWon
          ? 'border-amber-400 ring-4 ring-amber-400/30 shadow-amber-500/20'
          : canClaimBingo
          ? 'border-emerald-400 ring-2 ring-emerald-400/40 animate-pulse'
          : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* Card Header Bar */}
      <div className="bg-slate-950/80 px-3 py-2 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black tracking-wider text-amber-400 font-mono">
            {t.card} #{card.cardIndex + 1}
          </span>
          {card.hasWon && (
            <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/40 flex items-center gap-1">
              <Trophy className="w-3 h-3 text-amber-400" />
              {card.winningPatternName || 'WINNER'}
            </span>
          )}
        </div>

        <div className="text-[11px] font-mono font-semibold">
          {card.hasWon ? (
            <span className="text-emerald-400 font-bold">BINGO! 🎉</span>
          ) : (
            <span className="text-slate-400">
              {t.needsNumbers(card.numbersNeeded)}
            </span>
          )}
        </div>
      </div>

      {/* B-I-N-G-O Column Titles */}
      <div className="grid grid-cols-5 bg-slate-950 border-b border-slate-800/80 text-center font-black py-1.5 text-xs sm:text-sm">
        {BINGO_LETTERS.map((letter) => {
          const range = LETTER_RANGES[letter];
          return (
            <div key={letter} className={`${range.colorClass} tracking-wider`}>
              {letter}
            </div>
          );
        })}
      </div>

      {/* 5x5 Bingo Cells */}
      <div className="p-2 sm:p-3 grid grid-cols-5 gap-1.5 sm:gap-2 flex-1 bg-slate-900/50">
        {card.cells.map((rowCells, rIdx) =>
          rowCells.map((cell, cIdx) => {
            const isWinningCell = cell.isWinningCell;

            if (cell.isFree) {
              return (
                <div
                  key={`free-${rIdx}-${cIdx}`}
                  className="aspect-square rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-slate-950 flex flex-col items-center justify-center font-black p-1 shadow-md border border-amber-300 transform scale-100 animate-pulse-glow"
                >
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-slate-950 animate-spin" />
                  <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-tight leading-none mt-0.5">
                    {t.freeSpace}
                  </span>
                </div>
              );
            }

            return (
              <button
                key={`cell-${cell.number}-${rIdx}-${cIdx}`}
                onClick={() => onCellClick(card.cardIndex, rIdx, cIdx)}
                className={`aspect-square rounded-xl flex flex-col items-center justify-center font-mono font-bold text-sm sm:text-lg transition-all duration-200 relative select-none ${
                  isWinningCell
                    ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-slate-950 shadow-lg shadow-emerald-500/40 ring-2 ring-white scale-105 z-10 font-black'
                    : cell.isDaubed
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black ring-1 ring-amber-300'
                    : 'bg-slate-950 text-slate-200 hover:bg-slate-800 border border-slate-800/80 active:scale-95'
                }`}
              >
                {cell.number}
                {cell.isDaubed && !isWinningCell && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-slate-900"></span>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Claim Bingo Button Footer */}
      {canClaimBingo && !card.hasWon && (
        <div className="p-2 bg-slate-950/80 border-t border-slate-800">
          <button
            onClick={() => onClaimBingo(card)}
            className="w-full py-2.5 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2 transform active:scale-98 transition-all animate-bounce"
          >
            <Trophy className="w-4 h-4" />
            {t.bingoButton}
          </button>
        </div>
      )}
    </div>
  );
};
