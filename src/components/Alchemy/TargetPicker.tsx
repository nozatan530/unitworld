import React, { useMemo, useState } from 'react';
import { Search, CheckCircle2 } from 'lucide-react';
import { unitsById } from '../../data/unitsData';
import { SUGGESTED_TARGETS, TARGET_UNITS } from '../../data/crafting';
import { REALMS } from '../../data/unitsData';
import { uSym, uQty, realmName, unitSearchText } from '../../utils/i18n';
import { sounds } from '../../utils/sound';

interface TargetPickerProps {
  targetId: string | null;
  crafted: Set<string>;
  onPick: (id: string | null) => void;
  lang: 'ja' | 'en';
  allowNone?: boolean;
}

// 作りたい単位（目標）を選ぶ。おすすめ → 検索 → 分野ごとの一覧
export const TargetPicker: React.FC<TargetPickerProps> = ({ targetId, crafted, onPick, lang, allowNone }) => {
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);

  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    return q ? TARGET_UNITS.filter((u) => unitSearchText(u).includes(q)) : [];
  }, [query]);

  const chip = (id: string) => {
    const u = unitsById[id];
    if (!u) return null;
    const selected = targetId === id;
    const done = crafted.has(id);
    return (
      <button
        key={id}
        onClick={() => {
          sounds.playPop();
          onPick(id);
          setQuery('');
        }}
        aria-pressed={selected}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-left transition-colors ${
          selected
            ? 'bg-cyan-600 border-cyan-600 text-white'
            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-cyan-400 text-slate-800 dark:text-slate-100'
        }`}
      >
        <span className="font-serif font-bold text-base whitespace-nowrap">{uSym(u, lang)}</span>
        <span className={`text-[11px] ${selected ? 'text-cyan-50' : 'text-slate-500 dark:text-slate-400'}`}>{uQty(u, lang).split(/[（(・,]/)[0]}</span>
        {done && <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${selected ? 'text-white' : 'text-emerald-500'}`} />}
      </button>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={lang === 'ja' ? '作りたい単位をさがす（例：J、圧力、ohm）' : 'Find a unit to make (e.g. J, pressure, ohm)'}
          className="flex-1 min-w-0 bg-transparent outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
        />
      </div>

      {query.trim() ? (
        <div className="flex flex-wrap gap-1.5">
          {results.length ? results.map((u) => chip(u.id)) : (
            <p className="text-xs text-slate-500">{lang === 'ja' ? '見つかりませんでした。' : 'Nothing found.'}</p>
          )}
        </div>
      ) : (
        <>
          <div>
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">
              {lang === 'ja' ? 'おすすめのお題' : 'Suggested'}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_TARGETS.map(chip)}
              {allowNone && (
                <button
                  onClick={() => {
                    sounds.playClick();
                    onPick(null);
                  }}
                  className={`px-2.5 py-1.5 rounded-xl border text-xs ${
                    targetId === null
                      ? 'bg-slate-700 border-slate-700 text-white'
                      : 'border-dashed border-slate-300 dark:border-slate-600 text-slate-500'
                  }`}
                >
                  {lang === 'ja' ? '目標なし（自由に錬成）' : 'No target (free play)'}
                </button>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-xs font-semibold text-cyan-700 dark:text-cyan-400 hover:underline"
          >
            {showAll
              ? lang === 'ja' ? '▲ ほかの単位をとじる' : '▲ Hide other units'
              : lang === 'ja' ? `▼ ほかの単位から選ぶ（${TARGET_UNITS.length}）` : `▼ Choose from all units (${TARGET_UNITS.length})`}
          </button>
          {showAll && (
            <div className="space-y-2.5">
              {REALMS.map((r) => {
                const units = TARGET_UNITS.filter((u) => u.realmId === r.id);
                if (!units.length) return null;
                return (
                  <div key={r.id}>
                    <div className="text-[11px] font-bold mb-1" style={{ color: r.color }}>
                      {r.icon} {realmName(r, lang)}
                    </div>
                    <div className="flex flex-wrap gap-1.5">{units.map((u) => chip(u.id))}</div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};
