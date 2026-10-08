import React from 'react';
import { Gamepad2, History as HistoryIcon, Wallet, User } from 'lucide-react';

export type NavTab = 'game' | 'history' | 'wallet' | 'profile';

interface BottomNavProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  botUsername?: string;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onSelectTab,
  botUsername = '@betesebbingo_bot'
}) => {
  const tabs = [
    {
      id: 'game' as NavTab,
      label: 'Game',
      icon: Gamepad2,
    },
    {
      id: 'history' as NavTab,
      label: 'History',
      icon: HistoryIcon,
    },
    {
      id: 'wallet' as NavTab,
      label: 'Wallet',
      icon: Wallet,
    },
    {
      id: 'profile' as NavTab,
      label: 'Profile',
      icon: User,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#120b24]/95 backdrop-blur-md border-t border-[#26174a] shadow-[0_-8px_30px_rgba(0,0,0,0.8)] pb-1">
      <div className="max-w-md mx-auto grid grid-cols-4 py-2 px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className="relative flex flex-col items-center justify-center py-1 transition-all group"
            >
              <Icon
                className={`w-5 h-5 transition-all duration-200 ${
                  isActive
                    ? 'text-[#38bdf8] scale-110 drop-shadow-[0_0_8px_rgba(56,189,248,0.6)]'
                    : 'text-slate-400 group-hover:text-slate-200'
                }`}
              />
              <span
                className={`text-[11px] font-medium tracking-wide mt-1 transition-colors ${
                  isActive ? 'text-[#38bdf8] font-bold' : 'text-slate-400'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

