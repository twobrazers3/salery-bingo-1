import React from 'react';
import { translations } from '../utils/translations';
import { X, HelpCircle, Check, Award, Flame } from 'lucide-react';

interface RulesModalProps {
  language: 'am' | 'en' | 'om';
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ language, onClose }) => {
  const t = translations[language];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white">{t.rules}</h3>
            <p className="text-xs text-slate-400">Lucky Bingo Rules & Multipliers</p>
          </div>
        </div>

        <div className="space-y-4 text-xs text-slate-300">
          {/* Rules in selected language */}
          {language === 'am' ? (
            <div className="space-y-3 leading-relaxed">
              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800">
                <span className="font-bold text-amber-400 block mb-1">1. የጨዋታው ዓላማ (How to Play)</span>
                <p>
                  የዕድል ቢንጎ ጨዋታ 75 ቁጥሮችን ይጠቀማል። የደዋዩ ቁጥሮች በቅደም ተከተል ሲወጡ፣ በካርድዎ ላይ ያሉትን ተዛማጅ ቁጥሮች ይጫኑ (ወይም Auto-Daub ን ያብሩ)።
                </p>
              </div>

              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800">
                <span className="font-bold text-amber-400 block mb-1">2. የማሸነፊያ ቅጦችና ክፍያዎች (Patterns & Multipliers)</span>
                <ul className="space-y-2 mt-2">
                  <li className="flex items-center justify-between bg-slate-900 p-2 rounded-xl border border-slate-800">
                    <span className="font-semibold text-white">አንድ መስመር (Horizontal/Vertical/Diagonal Line)</span>
                    <span className="text-emerald-400 font-mono font-bold">1.8x Multiplier</span>
                  </li>
                  <li className="flex items-center justify-between bg-slate-900 p-2 rounded-xl border border-slate-800">
                    <span className="font-semibold text-white">አራት ማዕዘናት (4 Corners)</span>
                    <span className="text-emerald-400 font-mono font-bold">2.2x Multiplier</span>
                  </li>
                  <li className="flex items-center justify-between bg-slate-900 p-2 rounded-xl border border-slate-800">
                    <span className="font-semibold text-white">ሙሉ ካርድ (Full House / Blackout)</span>
                    <span className="text-amber-400 font-mono font-bold">3.5x Multiplier</span>
                  </li>
                </ul>
              </div>

              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800">
                <span className="font-bold text-amber-400 block mb-1">3. ነጻ ቦታ (FREE Space)</span>
                <p>
                  በእያንዳንዱ ካርድ መሃል ላይ ያለችው ⭐ ነጻ ቦታ ሁልጊዜ የበራች (Daubed) ሆና ትጀምራለች።
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 leading-relaxed">
              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800">
                <span className="font-bold text-amber-400 block mb-1">1. How to Play</span>
                <p>
                  Lucky Bingo uses standard 75 numbered balls (B 1-15, I 16-30, N 31-45, G 46-60, O 61-75). As numbers are drawn, tap to daub them or turn on Auto-Daub.
                </p>
              </div>

              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800">
                <span className="font-bold text-amber-400 block mb-1">2. Winning Patterns & Multipliers</span>
                <ul className="space-y-2 mt-2">
                  <li className="flex items-center justify-between bg-slate-900 p-2 rounded-xl border border-slate-800">
                    <span className="font-semibold text-white">Any Single Line (Row, Column, Diagonal)</span>
                    <span className="text-emerald-400 font-mono font-bold">1.8x Multiplier</span>
                  </li>
                  <li className="flex items-center justify-between bg-slate-900 p-2 rounded-xl border border-slate-800">
                    <span className="font-semibold text-white">4 Corners (Outer vertices)</span>
                    <span className="text-emerald-400 font-mono font-bold">2.2x Multiplier</span>
                  </li>
                  <li className="flex items-center justify-between bg-slate-900 p-2 rounded-xl border border-slate-800">
                    <span className="font-semibold text-white">Full House (All 25 cells blackout)</span>
                    <span className="text-amber-400 font-mono font-bold">3.5x Multiplier</span>
                  </li>
                </ul>
              </div>

              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800">
                <span className="font-bold text-amber-400 block mb-1">3. Center FREE Space</span>
                <p>
                  The center star ⭐ on every card is always free and counts towards all valid winning lines and patterns.
                </p>
              </div>
            </div>
          )}
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
