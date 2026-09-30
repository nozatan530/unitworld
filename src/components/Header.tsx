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

  const navItems: Array<{ id: ActiveTab; labelJa: string; labelEn: string; shortJa: string; shortEn: string; Icon: typeof Compass }> = [
    { id: 'map', labelJa: 'ワールドマップ', labelEn: 'World Map', shortJa: 'マップ', shortEn: 'Map', Icon: Compass },
    { id: 'lab', labelJa: '錬成ラボ', labelEn: 'Alchemy Lab', shortJa: 'ラボ', shortEn: 'Lab', Icon: Sparkles },
    { id: 'tree', labelJa: '錬成ツリー図', labelEn: 'Alchemy Tree', shortJa: 'ツリー図', shortEn: 'Tree', Icon: GitBranch },
    { id: 'catalog', labelJa: '単位図鑑', labelEn: 'Unit Index', shortJa: '図鑑', shortEn: 'Units', Icon: BookOpen },
    { id: 'quiz', labelJa: 'クイズ', labelEn: 'Quiz', shortJa: 'クイズ', shortEn: 'Quiz', Icon: HelpCircle },
    { id: 'scale', labelJa: '接頭語・尺度', labelEn: 'Prefixes', shortJa: '接頭語', shortEn: 'Prefix', Icon: Ruler },
  ];
  const ja = lang === 'ja';

  // 設定ボタンは指で押しやすい 44px 角
  const iconBtn =
    'w-11 h-11 rounded-xl flex items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-cyan-500';

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-amber-200/60 dark:border-slate-800 transition-colors">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
          {/* ロゴ */}
          <button
            onClick={() => handleTabChange('map')}
            className="flex items-center gap-2 sm:gap-2.5 text-left shrink-0 min-w-0 transition-transform active:scale-95"
            aria-label={ja ? 'ワールドマップへ' : 'Go to World Map'}
          >
            {/* ロゴ：単位のタイルが線でつながったマーク（OGP画像のネットワーク図と同じモチーフ） */}
            <img src="/favicon.svg" alt="" className="w-9 h-9 rounded-xl shadow-sm select-none shrink-0" draggable={false} />
            <div className="min-w-0">
              <span className="font-bold text-[15px] sm:text-lg tracking-tight text-slate-800 dark:text-slate-100 block leading-tight">
                {ja ? (
                  <>
                    単位のつながり<br className="sm:hidden" />ワールド
                  </>
                ) : (
                  'Unit World'
                )}
              </span>
              <span className="hidden sm:block text-xs text-cyan-700 dark:text-cyan-300 font-medium leading-tight">
                {ja ? '高校理科 87単位のつながり' : '87 high school science units'}
              </span>
            </div>
          </button>

          {/* PC：上のタブ */}
          <nav aria-label={ja ? '画面の切り替え' : 'Sections'} className="hidden xl:flex items-center gap-1 p-1 bg-amber-100/70 dark:bg-slate-800/80 rounded-xl">
            {navItems.map(({ id, labelJa, labelEn, Icon }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => handleTabChange(id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center gap-1.5 px-3.5 h-10 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-white dark:bg-slate-700 text-cyan-700 dark:text-cyan-300 shadow-sm'
                      : 'text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-700/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{ja ? labelJa : labelEn}</span>
                </button>
              );
            })}
          </nav>

          {/* 設定：効果音・言語・明るさ */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={toggleSound}
              className={`${iconBtn} ${
                soundEnabled
                  ? 'bg-cyan-100 dark:bg-slate-800 text-cyan-800 dark:text-cyan-300 hover:bg-cyan-200'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
              title={soundEnabled ? (ja ? '効果音: オン' : 'Sound: ON') : ja ? '効果音: オフ' : 'Sound: OFF'}
              aria-label={ja ? '効果音' : 'Sound'}
              aria-pressed={soundEnabled}
            >
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>

            <div role="group" aria-label={ja ? '言語' : 'Language'} className="flex items-center h-11 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              {(['ja', 'en'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => {
                    sounds.playClick();
                    setLang(l);
                  }}
                  aria-pressed={lang === l}
                  className={`h-full px-2.5 min-w-9 text-sm font-bold rounded-lg transition-colors ${
                    lang === l
                      ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {l === 'ja' ? 'JP' : 'EN'}
                </button>
              ))}
            </div>

            <button
              onClick={toggleTheme}
              className={`${iconBtn} text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700`}
              title={isDark ? (ja ? 'ライトモード' : 'Light Mode') : ja ? 'ダークモード' : 'Dark Mode'}
              aria-label={ja ? '明るさの切り替え' : 'Toggle theme'}
            >
              {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* スマホ・タブレット：画面下のタブバー（親指で届く位置） */}
      <nav
        aria-label={ja ? '画面の切り替え' : 'Sections'}
        className="xl:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_16px_rgba(15,23,42,0.06)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="max-w-2xl mx-auto grid grid-cols-6">
          {navItems.map(({ id, shortJa, shortEn, Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => handleTabChange(id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative h-16 flex flex-col items-center justify-center gap-1 text-xs font-bold transition-colors ${
                  isActive ? 'text-cyan-700 dark:text-cyan-300' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {isActive && <span aria-hidden className="absolute top-0 inset-x-3 h-1 rounded-b-full bg-cyan-600 dark:bg-cyan-400" />}
                <span className={`flex items-center justify-center w-11 h-7 rounded-full ${isActive ? 'bg-cyan-100 dark:bg-cyan-900/60' : ''}`}>
                  <Icon className="w-5 h-5" />
                </span>
                <span className="leading-none whitespace-nowrap">{ja ? shortJa : shortEn}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
