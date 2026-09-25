import React from 'react';
import { Volume2, VolumeX, Sun, Moon, Compass, Sparkles, BookOpen, HelpCircle, Ruler, GitBranch } from 'lucide-react';
import { sounds } from '../utils/sound';

export type ActiveTab = 'map' | 'lab' | 'tree' | 'catalog' | 'quiz' | 'scale';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  lang: 'ja' | 'en';
  setLang: (lang: 'ja' | 'en') => void;
  isDark: boolean;
  setIsDark: (dark: boolean) => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  lang,
  setLang,
  isDark,
  setIsDark,
  soundEnabled,
  setSoundEnabled,
}) => {
  const toggleSound = () => {
    const next = sounds.toggle();
    setSoundEnabled(next);
  };

  const toggleTheme = () => {
    sounds.playClick();
    setIsDark(!isDark);
  };

  const handleTabChange = (tab: ActiveTab) => {
    sounds.playPop(560);
    setActiveTab(tab);
  };

  const navItems: Array<{ id: ActiveTab; labelJa: string; labelEn: string; icon: React.ReactNode }> = [
    { id: 'map', labelJa: 'ワールドマップ', labelEn: 'World Map', icon: <Compass className="w-4 h-4" /> },
    { id: 'lab', labelJa: '錬成ラボ', labelEn: 'Alchemy Lab', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'tree', labelJa: '錬成ツリー図', labelEn: 'Alchemy Tree', icon: <GitBranch className="w-4 h-4" /> },
    { id: 'catalog', labelJa: '単位図鑑', labelEn: 'Unit Index', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'quiz', labelJa: 'クイズ', labelEn: 'Quiz', icon: <HelpCircle className="w-4 h-4" /> },
    { id: 'scale', labelJa: '接頭語・尺度', labelEn: 'Prefixes', icon: <Ruler className="w-4 h-4" /> },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-amber-200/60 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 lg:py-0 lg:h-16 flex flex-wrap lg:flex-nowrap items-center justify-between gap-x-2 gap-y-2 sm:gap-x-4">
        {/* Zone 1: Wordmark */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => handleTabChange('map')}
            className="flex items-center gap-2.5 text-left group transition-transform active:scale-95"
            aria-label="Home"
          >
            {/* ロゴ：単位のタイルが線でつながったマーク（OGP画像のネットワーク図と同じモチーフ） */}
            <img src="/favicon.svg" alt="" className="w-9 h-9 rounded-xl shadow-sm select-none" draggable={false} />
            <div>
              <span className="font-bold text-base sm:text-lg tracking-tight text-slate-800 dark:text-slate-100 block leading-tight">
                {lang === 'ja' ? '単位のつながりワールド' : 'Unit World'}
              </span>
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium block leading-none">
                {lang === 'ja' ? '高校理科 87単位のつながり' : '87 high school science units'}
              </span>
            </div>
          </button>
        </div>

        {/* Zone 2: Navigation Links (Single-row clean tabs) */}
        {/* スマホ・タブレットでは2段目に6つのタブを均等に並べる */}
        <nav className="order-last lg:order-none w-full lg:w-auto grid grid-cols-6 lg:flex items-center gap-0.5 lg:gap-1.5 p-1 bg-amber-100/70 dark:bg-slate-800/80 rounded-xl">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-col lg:flex-row items-center justify-center gap-0.5 lg:gap-1.5 px-1 lg:px-3.5 py-1 lg:py-1.5 rounded-lg text-[10px] leading-tight lg:text-sm font-semibold transition-all lg:whitespace-nowrap text-center ${
                  isActive
                    ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/40'
                }`}
              >
                {item.icon}
                <span>{lang === 'ja' ? item.labelJa : item.labelEn}</span>
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Actions (Sound, Lang, Theme) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs transition-colors ${
              soundEnabled
                ? 'bg-amber-100/80 dark:bg-slate-800 text-amber-700 dark:text-amber-300 hover:bg-amber-200'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-slate-200'
            }`}
            title={soundEnabled ? (lang === 'ja' ? '効果音: オン' : 'Sound: ON') : (lang === 'ja' ? '効果音: オフ' : 'Sound: OFF')}
            aria-label="Toggle Sound"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Language Switch */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200/60 dark:border-slate-700">
            <button
              onClick={() => {
                sounds.playClick();
                setLang('ja');
              }}
              className={`px-2 py-1 text-[11px] font-bold rounded-md transition-colors ${
                lang === 'ja' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              JP
            </button>
            <button
              onClick={() => {
                sounds.playClick();
                setLang('en');
              }}
              className={`px-2 py-1 text-[11px] font-bold rounded-md transition-colors ${
                lang === 'en' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              EN
            </button>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            title={isDark ? (lang === 'ja' ? 'ライトモード' : 'Light Mode') : (lang === 'ja' ? 'ダークモード' : 'Dark Mode')}
            aria-label="Toggle Theme"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>
        </div>
      </div>
    </header>
  );
};
