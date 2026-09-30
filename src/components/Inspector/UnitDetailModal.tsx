import React from 'react';
import { X, ArrowRight, Sparkles, Volume2, MapPin, ExternalLink, Equal } from 'lucide-react';
import { UnitDefinition } from '../../types/unit';
import {
  unitsById,
  getUnitDim,
  formatDimSI,
  formatDimBrackets,
  getUnitFactor,
  sameFactor,
  getAncestors,
  getDescendants,
  getSameDimensionUnits,
} from '../../data/unitsData';
import { sounds } from '../../utils/sound';
import { uSym, uName, uQty, uConv, subjLabel, SUBJ_TAG_CLASS, bySymLength } from '../../utils/i18n';
import { UnitTriviaQuizCard } from './UnitTriviaQuizCard';

interface UnitDetailModalProps {
  unit: UnitDefinition | null;
  onClose: () => void;
  onSelectUnit: (unit: UnitDefinition) => void;
  onSendToLab?: (unit: UnitDefinition, slot: 'num' | 'den') => void;
  onFocusOnMap?: (unit: UnitDefinition) => void;
  lang: 'ja' | 'en';
}

export const UnitDetailModal: React.FC<UnitDetailModalProps> = ({
  unit,
  onClose,
  onSelectUnit,
  onSendToLab,
  onFocusOnMap,
  lang,
}) => {
  if (!unit) return null;

  const dim = getUnitDim(unit);
  const ancestors = getAncestors(unit);
  const descendants = getDescendants(unit);
  const sameDimUnits = getSameDimensionUnits(unit);

  const handleSound = () => {
    sounds.playPop(580);
  };

  const getSubjColor = (subj: string) =>
    SUBJ_TAG_CLASS[subj] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';

  const getKindLabel = (kind: string) => {
    if (lang === 'ja') {
      switch (kind) {
        case 'base':
          return 'SI基本単位';
        case 'derived':
          return 'SI組立単位';
        case 'scale':
          return '目盛り (単位ではない)';
        default:
          return '非SI単位';
      }
    } else {
      switch (kind) {
        case 'base':
          return 'SI Base Unit';
        case 'derived':
          return 'SI Derived Unit';
        case 'scale':
          return 'Scale (Not an SI unit)';
        default:
          return 'Non-SI Unit';
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-amber-100 dark:border-slate-800 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Hero */}
        <div className="relative px-6 pt-6 pb-5 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-indigo-500/10 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-indigo-950/30 border-b border-amber-100/60 dark:border-slate-800">
          <button
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-750 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors shadow-xs"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-start gap-4 pr-10">
            {/* Big Unit Icon Badge */}
            <div className="min-w-16 h-16 sm:min-w-20 sm:h-20 px-2.5 rounded-2xl bg-white dark:bg-slate-800 shadow-md border border-amber-200/80 dark:border-slate-700 flex items-center justify-center shrink-0">
              <span className={`font-serif font-bold whitespace-nowrap text-amber-600 dark:text-amber-400 select-none ${bySymLength(uSym(unit, lang), 'text-2xl sm:text-3xl', 'text-xl sm:text-2xl', 'text-lg sm:text-xl')}`}>
                {uSym(unit, lang)}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300">
                  {getKindLabel(unit.kind)}
                </span>
                {unit.subj.map((s) => (
                  <span key={s} className={`text-xs font-medium px-2 py-0.5 rounded-md ${getSubjColor(s)}`}>
                    {subjLabel(s, lang)}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 truncate">
                  {lang === 'ja' ? unit.name : unit.nameEn || unit.name}
                </h2>
                <button
                  onClick={handleSound}
                  className="w-7 h-7 rounded-full bg-amber-100 dark:bg-slate-800 hover:bg-amber-200 text-amber-700 dark:text-amber-300 flex items-center justify-center transition-transform active:scale-90"
                  title="Sound"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                {lang === 'ja' ? `量: ${unit.qty}` : `Quantity: ${uQty(unit, lang)}`}
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto px-6 py-5 space-y-6 text-slate-700 dark:text-slate-200 text-sm">
          {/* Section 1: The Connections Highway (What it comes from -> This Unit -> What it creates) */}
          <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-slate-800/60 border border-amber-200/50 dark:border-slate-700/60">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
              <span>{lang === 'ja' ? '単位のつながりルート' : 'Unit Connection Journey'}</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
              {/* Left: Ingredients */}
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  {lang === 'ja' ? '何からできているか (材料)' : 'Made from'}
                </div>
                {unit.kind === 'base' ? (
                  <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                    {lang === 'ja' ? '⭐ 根源となる7大基本単位' : '⭐ Fundamental SI Base Unit'}
                  </p>
                ) : unit.kind === 'scale' ? (
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {lang === 'ja' ? '単位ではなく対数・階級の指標' : 'Logarithmic scale (No SI base units)'}
                  </p>
                ) : ancestors.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {ancestors.map(({ unit: anc, exp }) => (
                      <button
                        key={anc.id}
                        onClick={() => {
                          sounds.playPop();
                          onSelectUnit(anc);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200/80 dark:border-slate-600 font-medium text-xs shadow-2xs transition-all hover:scale-105 active:scale-95"
                      >
                        <span className="font-serif font-bold text-amber-600 dark:text-amber-400">{uSym(anc, lang)}</span>
                        <span className="text-[11px] text-slate-600 dark:text-slate-400">
                          {exp < 0 ? `(÷)` : exp > 1 ? `(×${exp})` : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-600 dark:text-slate-400">{uConv(unit, lang) || '—'}</p>
                )}
              </div>

              {/* Middle: Current Target */}
              <div className="text-center p-2 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-400/40">
                <span className="font-serif font-bold text-lg text-amber-700 dark:text-amber-300 block">
                  {uSym(unit, lang)}
                </span>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 block">
                  {lang === 'ja' ? unit.name : unit.nameEn || unit.name}
                </span>
              </div>

              {/* Right: What it makes */}
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  {lang === 'ja' ? '何をつくれるか (発展)' : 'Helps to Make'}
                </div>
                {descendants.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {descendants.slice(0, 6).map((desc) => (
                      <button
                        key={desc.id}
                        onClick={() => {
                          sounds.playPop();
                          onSelectUnit(desc);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200/80 dark:border-slate-600 font-medium text-xs shadow-2xs transition-all hover:scale-105 active:scale-95"
                      >
                        <span className="font-serif font-bold text-emerald-600 dark:text-emerald-400">{uSym(desc, lang)}</span>
                        <span className="text-[11px] text-slate-600 dark:text-slate-400 truncate max-w-[60px]">{uQty(desc, lang)}</span>
                      </button>
                    ))}
                    {descendants.length > 6 && (
                      <span className="text-xs text-slate-500 dark:text-slate-400 self-center">
                        +{descendants.length - 6}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {lang === 'ja' ? 'この単位を直接材料にする単位は帳にはありません' : 'No downstream units in collection'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Formulations / How it is built */}
          {unit.forms && unit.forms.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <span>{lang === 'ja' ? '組み立て方・定義式' : 'How it is built'}</span>
                {unit.forms.length > 1 && (
                  <span className="text-[11px] font-normal text-amber-600">
                    ({unit.forms.length} {lang === 'ja' ? '通り' : 'ways'})
                  </span>
                )}
              </h3>
              <div className="space-y-1.5">
                {unit.forms.map((form, fIdx) => (
                  <div
                    key={fIdx}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700 flex items-center gap-2 flex-wrap text-base font-serif"
                  >
                    <span className="font-bold text-amber-600 dark:text-amber-400">{uSym(unit, lang)}</span>
                    <Equal className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    {/* 式どおりだと係数が合わない単位（kWh = 10³ × W·h など）は係数を添える */}
                    {(() => {
                      const ratio =
                        getUnitFactor(unit) /
                        form.reduce((acc, [id, e]) => acc * Math.pow(getUnitFactor(unitsById[id]), e), 1);
                      if (sameFactor(ratio, 1)) return null;
                      const e = Math.round(Math.log10(ratio));
                      const sup = String(e).replace('-', '⁻').replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d]);
                      return <span className="text-slate-600 dark:text-slate-300">10{sup} ×</span>;
                    })()}
                    {form.map(([srcId, exp], pIdx) => {
                      const u = unitsById[srcId];
                      if (!u) return null;
                      return (
                        <button
                          key={pIdx}
                          onClick={() => {
                            sounds.playPop();
                            onSelectUnit(u);
                          }}
                          className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:border-amber-400 hover:text-amber-600 font-bold transition-colors"
                        >
                          {uSym(u, lang)}
                          {exp !== 1 && (
                            <sup className="text-xs ml-0.5">{exp < 0 ? `⁻${Math.abs(exp)}` : exp}</sup>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 3: SI Dimensions */}
          {unit.kind !== 'scale' && (
            <div className="space-y-1.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {lang === 'ja' ? 'SI基本単位・次元表現' : 'SI Base Units & Dimensions'}
              </h3>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700 flex items-baseline gap-3 flex-wrap">
                <span className="font-serif font-bold text-lg text-slate-800 dark:text-slate-100">
                  {formatDimSI(dim, lang)}
                </span>
                <span className="font-mono text-sm text-slate-600 dark:text-slate-400">
                  {formatDimBrackets(dim)}
                </span>
              </div>
            </div>
          )}

          {/* Section 4: Physical Formulas */}
          {unit.formulas && unit.formulas.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {lang === 'ja' ? 'この単位が登場する高校理科の公式' : 'High School Science Formulas'}
              </h3>
              <div className="flex flex-wrap gap-2">
                {unit.formulas.map((f, i) => (
                  <span
                    key={i}
                    className="font-serif text-base px-3 py-1.5 rounded-xl bg-amber-50/80 dark:bg-slate-800 text-amber-900 dark:text-amber-200 border border-amber-200/60 dark:border-slate-700 font-medium"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Section 5: Same Dimension Twins */}
          {sameDimUnits.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {lang === 'ja' ? '同じ次元をもつ「ふたご」の単位' : 'Units Sharing Same Dimensions'}
              </h3>
              <div className="flex flex-wrap gap-2">
                {sameDimUnits.map((same) => (
                  <button
                    key={same.id}
                    onClick={() => {
                      sounds.playPop();
                      onSelectUnit(same);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 font-medium transition-colors"
                  >
                    <span className="font-serif font-bold text-amber-600 dark:text-amber-400">{uSym(same, lang)}</span>
                    <span className="text-xs text-slate-600 dark:text-slate-300">
                      {uName(same, lang)} ({uQty(same, lang)})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Section 6: Interactive Science Trivia & Unexpected Applications Quiz Card */}
          <UnitTriviaQuizCard unit={unit} lang={lang} />

          {/* Section 7: Note & Conversion */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {lang === 'ja' ? '探検メモ・一口解説' : 'Field Notes & Trivia'}
            </h3>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {lang === 'ja' ? unit.note : unit.noteEn || unit.note}
            </p>
            {unit.conv && (
              <p className="text-xs font-mono p-2 rounded-lg bg-amber-50 dark:bg-slate-800/80 text-amber-800 dark:text-amber-300 border border-amber-200/40">
                {lang === 'ja' ? `換算: ${unit.conv}` : `Conversion: ${unit.convEn || unit.conv}`}
              </p>
            )}
          </div>
        </div>

        {/* Action Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-3">
          {onFocusOnMap && (
            <button
              onClick={() => {
                sounds.playWhoosh();
                onFocusOnMap(unit);
                onClose();
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 shadow-2xs transition-colors"
            >
              <MapPin className="w-3.5 h-3.5 text-amber-500" />
              <span>{lang === 'ja' ? '地図上の位置へ' : 'Show on Map'}</span>
            </button>
          )}

          {onSendToLab && unit.kind !== 'scale' && (
            <button
              onClick={() => {
                sounds.playSuccess();
                onSendToLab(unit, 'num');
                onClose();
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-sm shadow-amber-500/30 transition-all hover:scale-102 active:scale-98"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{lang === 'ja' ? '⚗️ ラボでこの単位を使う' : 'Synthesize in Lab'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
