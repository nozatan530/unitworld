import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Trash2,
  ArrowUpDown,
  CheckCircle2,
  Search,
  GitBranch,
  Target,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import { UnitDefinition } from '../../types/unit';
import {
  RAW_UNITS,
  unitsById,
  getUnitDim,
  getDimKey,
  formatDimSI,
  formatDimBrackets,
  getUnitFactor,
  sameFactor,
  isCraftable,
  BASE_ORDER,
} from '../../data/unitsData';
import { COMMON_INGREDIENTS, INGREDIENT_GROUPS, addCraftedUnits, getCraftedUnits } from '../../data/crafting';
import { uSym, uName, uQty, realmName, unitSearchText } from '../../utils/i18n';
import { sounds } from '../../utils/sound';
import { saveAlchemyRecord } from '../../utils/alchemyHistory';
import { SynthesisSuccessModal } from './SynthesisSuccessModal';
import { FlaskBubblesCanvas } from './FlaskBubblesCanvas';
import { TargetPicker } from './TargetPicker';

interface AlchemyLabProps {
  onSelectUnit: (unit: UnitDefinition) => void;
  onOpenTree?: () => void;
  initialUnit?: UnitDefinition | null;
  initialSlot?: 'num' | 'den';
  initialRecipe?: Array<{ id: string; exp: number }> | null;
  targetId: string | null;
  onChangeTarget: (id: string | null) => void;
  lang: 'ja' | 'en';
}

// 係数の表示：10 の累乗ならそのまま、そうでなければ有効数字3桁（例：10⁻²、3.60×10³）
const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
const supNum = (n: number) => String(n).split('').map((c) => SUP[c]).join('');
const formatFactor = (f: number) => {
  const e = Math.floor(Math.log10(f) + 1e-9);
  const m = f / Math.pow(10, e);
  const pow = `10${supNum(e)}`;
  if (Math.abs(m - 1) < 1e-6) return pow;
  return e === 0 ? m.toPrecision(3) : `${m.toPrecision(3)}×${pow}`;
};

const COMPLETED_KEY = 'unit_completed_targets';

export const AlchemyLab: React.FC<AlchemyLabProps> = ({
  onSelectUnit,
  onOpenTree,
  initialUnit,
  initialSlot = 'num',
  initialRecipe,
  targetId,
  onChangeTarget,
  lang,
}) => {
  const ja = lang === 'ja';
  // フラスコの中身：単位id → 指数（+ は分子、- は分母）
  const [expr, setExpr] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [paletteTab, setPaletteTab] = useState<string>('common');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(true);
  const [crafted, setCrafted] = useState<Set<string>>(() => getCraftedUnits());
  const [completedTargets, setCompletedTargets] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(COMPLETED_KEY);
      return new Set(saved ? (JSON.parse(saved) as string[]) : []);
    } catch {
      return new Set();
    }
  });
  const [successCelebration, setSuccessCelebration] = useState<{ unit: UnitDefinition; formulaDesc: string } | null>(null);

  // 図鑑やツリー図から材料・レシピを受け取る
  useEffect(() => {
    if (initialRecipe && initialRecipe.length > 0) {
      const next: Record<string, number> = {};
      initialRecipe.forEach((ing) => (next[ing.id] = (next[ing.id] || 0) + ing.exp));
      setExpr(next);
    } else if (initialUnit) {
      setExpr((prev) => ({ ...prev, [initialUnit.id]: (prev[initialUnit.id] || 0) + (initialSlot === 'num' ? 1 : -1) }));
    }
  }, [initialUnit, initialSlot, initialRecipe]);

  const addPiece = (id: string, sign: 1 | -1) => {
    sounds.playPop(sign > 0 ? 540 : 440);
    setExpr((prev) => {
      const next = { ...prev };
      next[id] = (next[id] || 0) + sign;
      if (next[id] === 0) delete next[id];
      return next;
    });
  };
  const removePiece = (id: string) => {
    sounds.playClick();
    setExpr((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };
  const flipPiece = (id: string) => {
    sounds.playClick();
    setExpr((prev) => ({ ...prev, [id]: -prev[id] }));
  };
  const clearFlask = () => {
    sounds.playClick();
    setExpr({});
  };

  // ===== 計算 =====
  const entries = Object.entries(expr);
  const hasItems = entries.length > 0;
  const currentDim = useMemo(() => {
    const dim: Record<string, number> = {};
    for (const [id, exp] of entries) {
      const d = getUnitDim(unitsById[id]);
      for (const k in d) {
        dim[k] = (dim[k] || 0) + d[k] * exp;
        if (dim[k] === 0) delete dim[k];
      }
    }
    return dim;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expr]);
  const currentFactor = useMemo(
    () => entries.reduce((f, [id, exp]) => f * Math.pow(getUnitFactor(unitsById[id]), exp), 1),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expr]
  );
  const currentDimKey = getDimKey(currentDim);
  // 「材料を1つそのまま入れただけ」ではないか（1/s → Hz、m² は錬成に数える）
  const isRealCraft = !(entries.length === 1 && entries[0][1] === 1);

  // 次元も係数も一致し、かけ算・わり算で作れる単位
  const matchedUnits = useMemo(() => {
    if (!hasItems) return [];
    return RAW_UNITS.filter(
      (u) =>
        isCraftable(u) &&
        getDimKey(getUnitDim(u)) === currentDimKey &&
        sameFactor(getUnitFactor(u), currentFactor) &&
        !(entries.length === 1 && expr[u.id] === 1)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expr, currentDimKey, currentFactor]);

  // 次元は同じだが係数が違う単位（kg に対する g など）
  const sameDimOtherFactor = useMemo(() => {
    if (!hasItems) return [];
    return RAW_UNITS.filter(
      (u) =>
        u.kind !== 'scale' &&
        !(entries.length === 1 && expr[u.id] === 1) &&
        getDimKey(getUnitDim(u)) === currentDimKey &&
        !sameFactor(getUnitFactor(u), currentFactor)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expr, currentDimKey, currentFactor]);

  const target = targetId ? unitsById[targetId] : null;
  const targetDim = target ? getUnitDim(target) : null;
  const targetDone = !!target && matchedUnits.some((u) => u.id === target.id);

  // 目標まであと何が足りないか（基本単位ごとの指数の差）
  const hints = useMemo(() => {
    if (!targetDim) return [];
    return BASE_ORDER.filter((k) => (targetDim[k] || 0) !== 0 || (currentDim[k] || 0) !== 0).map((k) => ({
      base: k,
      diff: (targetDim[k] || 0) - (currentDim[k] || 0),
    }));
  }, [targetDim, currentDim]);
  const dimOk = !!target && hints.every((h) => h.diff === 0);

  // 式の表示（例：kg·m / s²）
  const formulaDesc = useCallback(() => {
    const fmt = (list: Array<[string, number]>) =>
      list
        .map(([id, e]) => {
          const n = Math.abs(e);
          return `${uSym(unitsById[id], lang)}${n === 1 ? '' : supNum(n)}`;
        })
        .join('·');
    const num = entries.filter(([, e]) => e > 0);
    const den = entries.filter(([, e]) => e < 0);
    const top = num.length ? fmt(num) : '1';
    return den.length ? `${top} / ${den.length > 1 ? `(${fmt(den)})` : fmt(den)}` : top;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expr, lang]);

  // 目標を初めて達成したときだけ演出する
  useEffect(() => {
    if (!target || !targetDone || !isRealCraft || completedTargets.has(target.id)) return;
    setCompletedTargets((prev) => {
      const next = new Set(prev).add(target.id);
      try {
        localStorage.setItem(COMPLETED_KEY, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
    setSuccessCelebration({ unit: target, formulaDesc: formulaDesc() });
  }, [target, targetDone, isRealCraft, completedTargets, formulaDesc]);

  // 正しくできた組み合わせを記録する（ツリー図に色がつく）
  useEffect(() => {
    if (matchedUnits.length === 0 || !isRealCraft) return;
    setCrafted(addCraftedUnits(matchedUnits.map((u) => u.id)));
    const primary = target && matchedUnits.some((u) => u.id === target.id) ? target : matchedUnits[0];
    saveAlchemyRecord({
      ingredients: entries.map(([id, exp]) => ({ id, exp })),
      resultDimSI: formatDimSI(currentDim, 'ja'),
      resultDimKey: currentDimKey,
      resultUnitId: primary.id,
      resultUnitName: primary.name,
      resultUnitSym: primary.sym,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchedUnits, isRealCraft]);

  // ===== 材料パレット =====
  const paletteUnits = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (q) return RAW_UNITS.filter((u) => u.kind !== 'scale' && unitSearchText(u).includes(q));
    if (paletteTab === 'common') return COMMON_INGREDIENTS.map((id) => unitsById[id]).filter(Boolean);
    return INGREDIENT_GROUPS.find((g) => g.realm.id === paletteTab)?.units || [];
  }, [searchQuery, paletteTab]);

  const numItems = entries.filter(([, e]) => e > 0);
  const denItems = entries.filter(([, e]) => e < 0);

  const hintText = (h: { base: string; diff: number }) => {
    const n = Math.abs(h.diff);
    if (h.diff === 0) return '✓';
    if (ja) return h.diff > 0 ? `あと${n}回かける` : `あと${n}回わる`;
    return h.diff > 0 ? `multiply ${n} more` : `divide ${n} more`;
  };

  const piece = ([id, e]: [string, number]) => {
    const u = unitsById[id];
    const n = Math.abs(e);
    return (
      <span
        key={id}
        className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 shadow-2xs"
      >
        <span className="font-serif font-bold text-base whitespace-nowrap">
          {uSym(u, lang)}
          {n > 1 && <sup>{n}</sup>}
        </span>
        <button
          onClick={() => flipPiece(id)}
          className="p-1 rounded-md text-slate-400 hover:text-cyan-600 hover:bg-slate-100 dark:hover:bg-slate-700"
          title={ja ? '分子と分母を入れかえる' : 'Move to the other side'}
          aria-label={ja ? `${uSym(u, lang)} を反対側へ` : `Move ${uSym(u, lang)} to the other side`}
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => removePiece(id)}
          className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-700"
          title={ja ? '取り出す' : 'Remove'}
          aria-label={ja ? `${uSym(u, lang)} を取り出す` : `Remove ${uSym(u, lang)}`}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5 pb-[50vh] lg:pb-6">
      {/* ===== 1. 目標 ===== */}
      <section className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="p-2 rounded-xl bg-cyan-600 text-white shrink-0">
              <Target className="w-5 h-5" />
            </span>
            {target ? (
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{ja ? '目標' : 'Target'}</div>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-serif font-black text-2xl text-cyan-700 dark:text-cyan-300 whitespace-nowrap">
                    {uSym(target, lang)}
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{uName(target, lang)}</span>
                  <span className="text-xs text-slate-500">{uQty(target, lang)}</span>
                  {completedTargets.has(target.id) && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-serif">
                  = {formatDimSI(getUnitDim(target), lang)}
                </div>
              </div>
            ) : (
              <div>
                <div className="font-bold text-slate-800 dark:text-slate-100">{ja ? '目標なし（自由に錬成）' : 'No target (free play)'}</div>
                <div className="text-xs text-slate-500">
                  {ja ? '単位をかけたりわったりして、何ができるか試してみよう。' : 'Multiply and divide units to see what you can make.'}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPickerOpen(!pickerOpen)}
              className="flex items-center gap-1 px-3 py-2 rounded-xl border border-cyan-300 dark:border-cyan-800 text-cyan-800 dark:text-cyan-200 text-xs font-bold hover:bg-cyan-50 dark:hover:bg-slate-800"
            >
              {pickerOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {ja ? '目標を変える' : 'Change target'}
            </button>
            {onOpenTree && target && (
              <button
                onClick={() => {
                  sounds.playClick();
                  onOpenTree();
                }}
                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                <GitBranch className="w-4 h-4" />
                {ja ? '作り方の図を見る' : 'See the recipe'}
              </button>
            )}
          </div>
        </div>

        {pickerOpen && (
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
            <TargetPicker
              targetId={targetId}
              crafted={completedTargets}
              lang={lang}
              allowNone
              onPick={(id) => {
                onChangeTarget(id);
                setPickerOpen(false);
              }}
            />
          </div>
        )}

        {/* あと何が足りないか */}
        {target && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-500 dark:text-slate-400 mr-1">{ja ? 'ヒント：' : 'Hint:'}</span>
            {!hasItems ? (
              <span className="text-slate-500">{ja ? '材料を入れると、目標まであと何が足りないかが出ます。' : 'Add ingredients to see what is still missing.'}</span>
            ) : targetDone ? (
              <span className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold">
                {ja ? `できた！ ${uSym(target, lang)} になりました` : `Done! This is ${uSym(target, lang)}`}
              </span>
            ) : dimOk ? (
              <span className="px-2 py-1 rounded-lg bg-yellow-50 dark:bg-yellow-950/40 text-yellow-800 dark:text-yellow-300">
                {ja ? '次元は合っていますが、係数（大きさ）がちがいます。g ではなく kg のように、SIの単位を使ってみよう。' : 'The dimensions match but the size (factor) differs. Try SI units, e.g. kg instead of g.'}
              </span>
            ) : (
              hints.map((h) => (
                <span
                  key={h.base}
                  className={`px-2 py-1 rounded-lg border ${
                    h.diff === 0
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <span className="font-serif font-bold">{h.base}</span> {hintText(h)}
                </span>
              ))
            )}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ===== 2. フラスコ（分数の形） ===== */}
        <section className="lg:col-span-7 lg:order-2 relative overflow-hidden p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <FlaskBubblesCanvas hasItems={hasItems} hasMatch={matchedUnits.length > 0} />
          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">⚗️ {ja ? 'フラスコ' : 'Flask'}</h2>
              {hasItems && (
                <button
                  onClick={clearFlask}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-slate-800"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {ja ? '空にする' : 'Empty'}
                </button>
              )}
            </div>

            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-3">
              <div className="min-h-[44px] flex flex-wrap items-center justify-center gap-1.5">
                {numItems.length ? (
                  numItems.map(piece)
                ) : denItems.length ? (
                  <span className="font-serif font-bold text-xl text-slate-500">1</span>
                ) : (
                  <span className="text-xs text-slate-400">
                    {ja ? '材料の「× かける」で、ここ（分子）に入ります' : '“× multiply” puts a unit here (top)'}
                  </span>
                )}
              </div>
              <div className="h-0.5 bg-slate-700 dark:bg-slate-300 my-2 rounded-full" />
              <div className="min-h-[44px] flex flex-wrap items-center justify-center gap-1.5">
                {denItems.length ? (
                  denItems.map(piece)
                ) : (
                  <span className="text-xs text-slate-400">
                    {ja ? '「÷ わる」で、ここ（分母）に入ります' : '“÷ divide” puts a unit here (bottom)'}
                  </span>
                )}
              </div>
            </div>

            {/* 結果 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
                <span>{ja ? 'SI基本単位で書くと' : 'In SI base units'}</span>
                {hasItems && <span className="font-mono">{formatDimBrackets(currentDim)}</span>}
              </div>
              <div className="font-serif font-bold text-xl sm:text-2xl text-slate-800 dark:text-slate-100">
                {hasItems
                  ? `${sameFactor(currentFactor, 1) ? '' : `${formatFactor(currentFactor)} × `}${formatDimSI(currentDim, lang)}`
                  : '—'}
              </div>

              {matchedUnits.length > 0 && isRealCraft && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div className="text-xs font-bold text-cyan-700 dark:text-cyan-300 mb-1.5">
                    {ja ? 'この組み合わせでできる単位' : 'You have made'}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {matchedUnits.map((m) => (
                      <div
                        key={m.id}
                        className={`flex items-center gap-2 pl-3 pr-1 py-1 rounded-2xl border-2 bg-white dark:bg-slate-800 ${
                          target?.id === m.id ? 'border-emerald-500' : 'border-cyan-400'
                        }`}
                      >
                        <span className="font-serif font-black text-lg text-cyan-700 dark:text-cyan-300 whitespace-nowrap">{uSym(m, lang)}</span>
                        <span className="text-xs">
                          <span className="font-bold text-slate-800 dark:text-slate-100 block leading-tight">{uName(m, lang)}</span>
                          <span className="text-[10px] text-slate-500">{uQty(m, lang)}</span>
                        </span>
                        <button
                          onClick={() => setSuccessCelebration({ unit: m, formulaDesc: formulaDesc() })}
                          className="p-1.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-300"
                          title={ja ? '錬成する' : 'Craft it'}
                        >
                          <Sparkles className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            sounds.playPop();
                            onSelectUnit(m);
                          }}
                          className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-xs"
                          title={ja ? '図鑑で見る' : 'Details'}
                        >
                          📖
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {sameDimOtherFactor.length > 0 && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
                  <div className="font-bold mb-1">{ja ? '次元は同じでも、係数（大きさ）がちがう単位' : 'Same dimensions, different size (factor)'}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {sameDimOtherFactor.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => onSelectUnit(u)}
                        className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-cyan-400"
                      >
                        <span className="font-serif font-bold">{uSym(u, lang)}</span>
                        <span className="text-[10px] text-slate-500 ml-1">{uQty(u, lang)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ===== 3. 材料（スマホでは画面下から引き出すパネル） ===== */}
        <section
          className={`lg:col-span-5 lg:order-1 fixed lg:static inset-x-0 bottom-0 z-30 lg:z-auto bg-white dark:bg-slate-900 border-t lg:border border-slate-200 dark:border-slate-800 rounded-t-3xl lg:rounded-3xl shadow-[0_-8px_24px_rgba(15,23,42,0.12)] lg:shadow-sm p-3 sm:p-4 flex flex-col ${
            sheetOpen ? 'max-h-[48vh]' : 'max-h-[5.5rem]'
          } lg:max-h-none overflow-hidden`}
        >
          <button
            onClick={() => setSheetOpen(!sheetOpen)}
            className="lg:hidden shrink-0 flex items-center justify-center gap-1 -mt-1 mb-1 text-xs font-bold text-slate-500"
          >
            {sheetOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            {ja ? '材料' : 'Ingredients'}
          </button>
          {/* スマホ：フラスコが隠れても中身がわかるよう、1行で表示する */}
          <div className="lg:hidden shrink-0 flex items-center gap-2 mb-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
            <span className="text-slate-500 shrink-0">⚗️</span>
            <span className="font-serif font-bold text-slate-800 dark:text-slate-100 truncate">
              {hasItems ? formulaDesc() : ja ? '空のフラスコ' : 'Empty flask'}
            </span>
            {hasItems && (
              <>
                <span className="text-slate-400 shrink-0">=</span>
                <span className="font-serif text-slate-600 dark:text-slate-300 truncate">{formatDimSI(currentDim, lang)}</span>
              </>
            )}
            {targetDone && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 ml-auto" />}
          </div>
          <div className="hidden lg:flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">{ja ? '材料' : 'Ingredients'}</h2>
          </div>

          <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm mb-2">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={ja ? '材料をさがす（例：m、時間、ボルト）' : 'Find an ingredient (e.g. m, time, volt)'}
              className="flex-1 min-w-0 bg-transparent outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
            />
          </div>

          {!searchQuery.trim() && (
            <div className="shrink-0 flex gap-1 overflow-x-auto scrollbar-none pb-2 -mx-1 px-1" role="tablist">
              {[{ id: 'common', label: ja ? '⭐ よく使う' : '⭐ Common' }, ...INGREDIENT_GROUPS.map((g) => ({ id: g.realm.id, label: `${g.realm.icon} ${realmName(g.realm, lang)}` }))].map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={paletteTab === t.id}
                  onClick={() => setPaletteTab(t.id)}
                  className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${
                    paletteTab === t.id
                      ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-2 overflow-y-auto pr-1 flex-1 min-h-0 lg:max-h-[560px]">
            {paletteUnits.map((u) => {
              const count = expr[u.id];
              return (
                <div
                  key={u.id}
                  className={`rounded-2xl border p-2 flex flex-col gap-1.5 ${
                    count
                      ? 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-400 dark:border-cyan-700'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <button onClick={() => onSelectUnit(u)} className="text-left min-w-0" title={ja ? '図鑑で見る' : 'Details'}>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-serif font-bold text-base text-slate-800 dark:text-slate-100 whitespace-nowrap">{uSym(u, lang)}</span>
                      {count ? (
                        <span className="text-[10px] font-bold px-1.5 rounded-full bg-cyan-600 text-white">
                          {count > 0 ? `×${count}` : `÷${-count}`}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{uQty(u, lang)}</div>
                  </button>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      onClick={() => addPiece(u.id, 1)}
                      className="py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-100 hover:border-cyan-500 hover:text-cyan-700"
                      aria-label={ja ? `${uSym(u, lang)} をかける` : `Multiply by ${uSym(u, lang)}`}
                    >
                      × {ja ? 'かける' : 'mult.'}
                    </button>
                    <button
                      onClick={() => addPiece(u.id, -1)}
                      className="py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-100 hover:border-sky-500 hover:text-sky-700"
                      aria-label={ja ? `${uSym(u, lang)} でわる` : `Divide by ${uSym(u, lang)}`}
                    >
                      ÷ {ja ? 'わる' : 'div.'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {successCelebration && (
        <SynthesisSuccessModal
          unit={successCelebration.unit}
          formulaDesc={successCelebration.formulaDesc}
          onClose={() => setSuccessCelebration(null)}
          onInspect={onSelectUnit}
          onOpenTree={onOpenTree}
          lang={lang}
        />
      )}
    </div>
  );
};
