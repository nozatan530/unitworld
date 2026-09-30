import React, { useState, useEffect } from 'react';
import { Header, ActiveTab } from './components/Header';
import { UnitMap } from './components/Map/UnitMap';
import { AlchemyLab } from './components/Alchemy/AlchemyLab';
import { AlchemyTreeDashboard } from './components/Alchemy/AlchemyTreeDashboard';
import { UnitCatalog } from './components/Catalog/UnitCatalog';
import { QuizAdventure } from './components/Quiz/QuizAdventure';
import { PrefixScaleGuide } from './components/PrefixScale/PrefixScaleGuide';
import { UnitDetailModal } from './components/Inspector/UnitDetailModal';
import { UnitDefinition } from './types/unit';
import { sounds } from './utils/sound';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('map');
  const [selectedUnit, setSelectedUnit] = useState<UnitDefinition | null>(null);
  const [focusedUnit, setFocusedUnit] = useState<UnitDefinition | null>(null);

  // Lab transfer state
  const [labInitialUnit, setLabInitialUnit] = useState<UnitDefinition | null>(null);
  const [labInitialSlot, setLabInitialSlot] = useState<'num' | 'den'>('num');
  const [labInitialRecipe, setLabInitialRecipe] = useState<Array<{ id: string; exp: number }> | null>(null);

  // 錬成の目標（ツリー図とラボで共有する）
  const [targetId, setTargetId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem('unit_craft_target');
      return saved === 'none' ? null : saved || 'N';
    } catch {
      return 'N';
    }
  });
  const changeTarget = (id: string | null) => {
    setTargetId(id);
    try {
      localStorage.setItem('unit_craft_target', id ?? 'none');
    } catch {}
  };

  // Language state
  const [lang, setLang] = useState<'ja' | 'en'>(() => {
    try {
      return (localStorage.getItem('unit_app_lang') as 'ja' | 'en') || 'ja';
    } catch {
      return 'ja';
    }
  });

  const handleSetLang = (newLang: 'ja' | 'en') => {
    setLang(newLang);
    try {
      localStorage.setItem('unit_app_lang', newLang);
    } catch {}
  };

  // Dark mode state
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('unit_app_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('unit_app_theme', isDark ? 'dark' : 'light');
    } catch {}
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
      document.body.style.backgroundColor = '#0B1015';
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
      document.body.style.backgroundColor = '#F6F8FA';
    }
  }, [isDark]);

  // Sound enabled state
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => sounds.enabled);

  // Jump from anywhere to map and focus on unit
  const handleFocusOnMap = (unit: UnitDefinition) => {
    setFocusedUnit({ ...unit });
    setActiveTab('map');
    setSelectedUnit(null);
  };

  // Transfer unit to alchemy synthesizer
  const handleSendToLab = (unit: UnitDefinition, slot: 'num' | 'den' = 'num') => {
    setLabInitialUnit(unit);
    setLabInitialSlot(slot);
    setActiveTab('lab');
  };

  return (
    <div
      className={`min-h-dvh pb-(--tabbar-h) bg-[#F6F8FA] dark:bg-[#0B1015] text-slate-800 dark:text-slate-100 flex flex-col transition-colors selection:bg-cyan-200 dark:selection:bg-cyan-900/50`}
    >
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        lang={lang}
        setLang={handleSetLang}
        isDark={isDark}
        setIsDark={setIsDark}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
      />

      {/* Main View Area */}
      <main className="flex-1">
        {activeTab === 'map' && (
          <UnitMap
            onSelectUnit={setSelectedUnit}
            selectedUnit={selectedUnit}
            focusedUnit={focusedUnit}
            onOpenTree={(id) => {
              changeTarget(id);
              setActiveTab('tree');
            }}
            lang={lang}
            isDark={isDark}
          />
        )}

        {activeTab === 'lab' && (
          <AlchemyLab
            onSelectUnit={setSelectedUnit}
            onOpenTree={() => setActiveTab('tree')}
            initialUnit={labInitialUnit}
            initialSlot={labInitialSlot}
            initialRecipe={labInitialRecipe}
            targetId={targetId}
            onChangeTarget={changeTarget}
            lang={lang}
          />
        )}

        {activeTab === 'tree' && (
          <AlchemyTreeDashboard
            onSelectUnit={setSelectedUnit}
            onLoadRecipe={(ingredients) => {
              setLabInitialRecipe(ingredients);
              setActiveTab('lab');
            }}
            targetId={targetId}
            onChangeTarget={changeTarget}
            onCraftInLab={() => {
              setLabInitialRecipe(null);
              setLabInitialUnit(null);
              setActiveTab('lab');
            }}
            lang={lang}
            isDark={isDark}
          />
        )}

        {activeTab === 'catalog' && (
          <UnitCatalog
            onSelectUnit={setSelectedUnit}
            onFocusOnMap={handleFocusOnMap}
            lang={lang}
          />
        )}

        {activeTab === 'quiz' && (
          <QuizAdventure
            onSelectUnit={setSelectedUnit}
            lang={lang}
          />
        )}

        {activeTab === 'scale' && (
          <PrefixScaleGuide lang={lang} />
        )}
      </main>

      {/* Detail Inspector Modal */}
      {selectedUnit && (
        <UnitDetailModal
          unit={selectedUnit}
          onClose={() => setSelectedUnit(null)}
          onSelectUnit={(u) => {
            sounds.playPop();
            setSelectedUnit(u);
          }}
          onSendToLab={handleSendToLab}
          onFocusOnMap={handleFocusOnMap}
          lang={lang}
        />
      )}

      {/* フッター：すべての画面に表示 */}
      <footer
        className={`mt-auto py-6 px-4 text-center text-xs text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 bg-[#F6F8FA] dark:bg-[#0B1015]`}
      >
        <p>
          {lang === 'ja' ? '制作：のざたん' : 'Made by Nozatan'} ／{' '}
          <a href="https://meetupsensei.com" className="text-cyan-700 dark:text-cyan-400 hover:underline font-medium">
            meetupsensei.com
          </a>
          {' '}／{' '}
          <a href="https://unit.meetupsensei.com/" className="hover:underline">
            {lang === 'ja' ? '単位のつながり帳' : 'Unit Connections'}
          </a>
        </p>
      </footer>
    </div>
  );
}
