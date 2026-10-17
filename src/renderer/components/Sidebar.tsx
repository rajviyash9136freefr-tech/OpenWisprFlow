import React from 'react';
import { useStore } from '../store/useStore';
import {
  Mic,
  BarChart3,
  BookA,
  Scissors,
  Type,
  Sparkles,
  FileText,
  Settings,
  HelpCircle,
} from 'lucide-react';
import { OpenWisprLogo } from './OpenWisprLogo';
import { BRANDING } from '../../shared/branding';

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, openSettings } = useStore();

  interface NavItem {
    id: any;
    label: string;
    icon: any;
  }

  const navItems: NavItem[] = [
    { id: 'dictation', label: 'Dictation', icon: Mic },
    { id: 'insights', label: 'Insights', icon: BarChart3 },
    { id: 'dictionary', label: 'Dictionary', icon: BookA },
    { id: 'snippets', label: 'Snippets', icon: Scissors },
    { id: 'style', label: 'Style', icon: Type },
    { id: 'scratchpad', label: 'Scratchpad', icon: FileText },
  ];

  return (
    <aside className="w-56 bg-[#F2F1ED] dark:bg-[#1E1D1B] border-r border-[#E5E4DE] dark:border-white/10 flex flex-col justify-between h-full select-none shrink-0 transition-colors">
      <div>
        {/* App Branding */}
        <div className="h-14 px-4 flex items-center space-x-2.5">
          <OpenWisprLogo size={24} />
          <span className="font-bold text-base tracking-tight text-[#1A1917] dark:text-[#F2F1ED] flex items-center space-x-1.5">
            <span>{BRANDING.appName}</span>
          </span>
        </div>

        {/* Navigation List */}
        <nav className="px-2.5 space-y-0.5 mt-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-white dark:bg-[#2A2925] text-[#1A1917] dark:text-[#F2F1ED] shadow-sm shadow-black/5 font-bold'
                    : 'text-[#64635D] dark:text-[#A8A7A0] hover:text-[#1A1917] dark:hover:text-white hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#1A1917] dark:text-amber-400' : 'text-[#7A7973] dark:text-[#7A7973]'}`} />
                  <span>{item.label}</span>
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Actions */}
      <div className="p-3 space-y-1 border-t border-[#E5E4DE]/60 dark:border-white/10">
        <button
          onClick={() => openSettings('general')}
          className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#64635D] dark:text-[#A8A7A0] hover:text-[#1A1917] dark:hover:text-white hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors"
        >
          <Settings className="w-4 h-4 text-[#7A7973]" />
          <span>Settings</span>
        </button>
        <button
          onClick={() => openSettings('languages')}
          className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#64635D] dark:text-[#A8A7A0] hover:text-[#1A1917] dark:hover:text-white hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors"
        >
          <HelpCircle className="w-4 h-4 text-[#7A7973]" />
          <span>Languages & Tone</span>
        </button>
      </div>
    </aside>
  );
};
