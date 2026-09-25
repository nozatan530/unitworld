import React, { useState, useMemo } from 'react';
import { Search, Compass, BookOpen, ExternalLink, Sparkles } from 'lucide-react';
import { UnitDefinition, SubjectType } from '../../types/unit';
import {
  RAW_UNITS,
  unitsById,
  getUnitDim,
  formatDimSI,
  getDescendants,
  getAncestors,
} from '../../data/unitsData';
import { sounds } from '../../utils/sound';
import { uSym, uQty, subjLabel, unitSearchText, bySymLength } from '../../utils/i18n';

interface UnitCatalogProps {
  onSelectUnit: (unit: UnitDefinition) => void;
  onFocusOnMap: (unit: UnitDefinition) => void;
  lang: 'ja' | 'en';
}

const FIELDS_ORDER = [
  '基本単位',
  '力学',
  '熱',
  '波・光',
  '電磁気',
  '原子',
  '化学',
  '生物',
  '地学',
  '天文',
];

const SUBJ_LIST: SubjectType[] = ['基本', '物理', '化学', '生物', '地学'];

export const UnitCatalog: React.FC<UnitCatalogProps> = ({
  onSelectUnit,
  onFocusOnMap,
  lang,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeSubj, setActiveSubj] = useState<SubjectType | 'all'>('all');
  const [activeKind, setActiveKind] = useState<string>('all');

  const filteredUnits = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return RAW_UNITS.filter((u) => {
      if (activeSubj !== 'all' && !u.subj.includes(activeSubj)) return false;
      if (activeKind !== 'all' && u.kind !== activeKind) return false;
      if (q && !unitSearchText(u).includes(q)) return false;
      return true;
    });
  }, [searchQuery, activeSubj, activeKind]);

  // Group by field
  const groupedByField = useMemo(() => {
    const groups: Record<string, UnitDefinition[]> = {};
    filteredUnits.forEach((u) => {
      groups[u.field] = groups[u.field] || [];
      groups[u.field].push(u);
    });
    return groups;
  }, [filteredUnits]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header & Controls */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-amber-100 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-amber-500" />
              <span>{lang === 'ja' ? '単位大図鑑 (87項目)' : 'Unit Compendium (87 Units)'}</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              {lang === 'ja'
                ? '高校理科の全範囲に登場する単位の定義、次元、つながりを網羅した一覧図鑑です。'
                : 'Browse all 87 units from high school physics, chemistry, biology, and earth science.'}
            </p>
          </div>

          {/* Search Box */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === 'ja' ? '記号・単位名・量で探す...' : 'Search symbol, name, quantity...'}
              className="bg-transparent outline-none text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 w-full"
            />
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          {/* Subject Filter Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-slate-400 mr-1">
              {lang === 'ja' ? '教科:' : 'Subject:'}
            </span>
            <button
              onClick={() => {
                sounds.playClick();
                setActiveSubj('all');
              }}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-colors ${
                activeSubj === 'all'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {lang === 'ja' ? 'すべて' : 'All'}
            </button>
            {SUBJ_LIST.map((subj) => (
              <button
                key={subj}
                onClick={() => {
                  sounds.playClick();
                  setActiveSubj(subj);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-colors ${
                  activeSubj === subj
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {subjLabel(subj, lang)}
              </button>
            ))}
          </div>

          {/* Result Count */}
          <span className="text-xs font-mono text-slate-400">
            {filteredUnits.length} / {RAW_UNITS.length} units
          </span>
        </div>
      </div>

      {/* Field Sections */}
      <div className="space-y-8">
        {FIELDS_ORDER.filter((field) => groupedByField[field] && groupedByField[field].length > 0).map(
          (field) => (
            <div key={field} className="space-y-3">
              <div className="flex items-center gap-2 border-b border-amber-200/60 dark:border-slate-800 pb-2">
                <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100">
                  {lang === 'ja' ? field : groupedByField[field][0].fieldEn || field}
                </h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                  {groupedByField[field].length}
                </span>
              </div>

              {/* Unit Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {groupedByField[field].map((u) => {
                  const dim = getUnitDim(u);
                  const isBase = u.kind === 'base';

                  return (
                    <div
                      key={u.id}
                      onClick={() => {
                        sounds.playPop();
                        onSelectUnit(u);
                      }}
                      className="group p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-500 shadow-2xs hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        {/* Top Symbol & Tags */}
                        <div className="flex items-start justify-between gap-1 mb-2">
                          <span className={`font-serif font-black whitespace-nowrap text-slate-800 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors ${bySymLength(uSym(u, lang), 'text-2xl', 'text-xl', 'text-lg')}`}>
                            {uSym(u, lang)}
                          </span>
                          {isBase && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              BASE
                            </span>
                          )}
                        </div>

                        {/* Name & Quantity */}
                        <div className="space-y-0.5">
                          <h3 className="font-bold text-xs text-slate-700 dark:text-slate-200 truncate">
                            {lang === 'ja' ? u.name : u.nameEn || u.name}
                          </h3>
                          <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium truncate">
                            {uQty(u, lang)}
                          </p>
                        </div>
                      </div>

                      {/* Bottom Footer Action */}
                      <div className="pt-2.5 mt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                        <span className="truncate max-w-[80px]">
                          {u.kind !== 'scale' ? formatDimSI(dim, lang) : lang === 'ja' ? '目盛り（単位ではない）' : 'Scale (not a unit)'}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            sounds.playPop();
                            onFocusOnMap(u);
                          }}
                          className="p-1 rounded-md hover:bg-amber-100 dark:hover:bg-slate-800 text-slate-400 hover:text-amber-600 transition-colors"
                          title="Show on map"
                        >
                          <Compass className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};
