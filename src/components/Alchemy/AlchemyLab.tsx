import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Sparkles,
  Trash2,
  ArrowUpDown,
  CheckCircle2,
  Search,
  BookMarked,
  Award,
  Plus,
  RefreshCw,
  GitBranch,
  Play,
  Zap,
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
} from '../../data/unitsData';
import { uSym, uName, uQty, unitSearchText } from '../../utils/i18n';
import { sounds } from '../../utils/sound';
import { saveAlchemyRecord } from '../../utils/alchemyHistory';
import { SynthesisSuccessModal } from './SynthesisSuccessModal';
import { FlaskBubblesCanvas } from './FlaskBubblesCanvas';

interface AlchemyLabProps {
  onSelectUnit: (unit: UnitDefinition) => void;
  onOpenTree?: () => void;
  initialUnit?: UnitDefinition | null;
  initialSlot?: 'num' | 'den';
  initialRecipe?: Array<{ id: string; exp: number }> | null;
  lang: 'ja' | 'en';
}

interface Quest {
  id: string;
  targetId: string;
  titleJa: string;
  titleEn: string;
  hintJa: string;
  hintEn: string;
}

const QUESTS: Quest[] = [
  { id: 'q_N', targetId: 'N', titleJa: '力 (N) を錬成せよ！', titleEn: 'Craft Force (N)', hintJa: '質量 (kg) と 加速度 (m/s²) を掛け合わせよう', hintEn: 'Multiply mass (kg) and acceleration (m/s²)' },
  { id: 'q_J', targetId: 'J', titleJa: 'エネルギー (J) を作れ！', titleEn: 'Craft Joule (J)', hintJa: '力 (N) × 距離 (m) または 電力 (W) × 時間 (s)', hintEn: 'Force (N) × distance (m) or Power (W) × time (s)' },
  { id: 'q_W', targetId: 'W', titleJa: '仕事率・電力 (W) を作れ！', titleEn: 'Craft Watt (W)', hintJa: 'エネルギー (J) ÷ 時間 (s) または 電圧 (V) × 電流 (A)', hintEn: 'Energy (J) ÷ time (s) or Voltage (V) × Current (A)' },
  { id: 'q_Pa', targetId: 'Pa', titleJa: '圧力 (Pa) を錬成せよ！', titleEn: 'Craft Pascal (Pa)', hintJa: '力 (N) ÷ 面積 (m²)', hintEn: 'Force (N) ÷ Area (m²)' },
  { id: 'q_C', targetId: 'C', titleJa: '電荷 (C) を作れ！', titleEn: 'Craft Coulomb (C)', hintJa: '電流 (A) × 時間 (s)', hintEn: 'Current (A) × time (s)' },
  { id: 'q_V', targetId: 'V', titleJa: '電圧 (V) を錬成せよ！', titleEn: 'Craft Volt (V)', hintJa: 'エネルギー (J) ÷ 電荷 (C)', hintEn: 'Energy (J) ÷ Charge (C)' },
  { id: 'q_ohm', targetId: 'ohm', titleJa: '電気抵抗 (Ω) を作れ！', titleEn: 'Craft Ohm (Ω)', hintJa: 'オームの法則: 電圧 (V) ÷ 電流 (A)', hintEn: 'Ohm\'s Law: Voltage (V) ÷ Current (A)' },
  { id: 'q_F', targetId: 'F', titleJa: '静電容量 (F) を作れ！', titleEn: 'Craft Farad (F)', hintJa: '電荷 (C) ÷ 電圧 (V)', hintEn: 'Charge (C) ÷ Voltage (V)' },
  { id: 'q_T', targetId: 'T', titleJa: '磁束密度 (T) を作れ！', titleEn: 'Craft Tesla (T)', hintJa: '磁束 (Wb) ÷ 面積 (m²)', hintEn: 'Magnetic flux (Wb) ÷ Area (m²)' },
  { id: 'q_Wb', targetId: 'Wb', titleJa: '磁束 (Wb) を作れ！', titleEn: 'Craft Weber (Wb)', hintJa: '磁束密度 (T) × 面積 (m²) または 電圧 (V) × 時間 (s)', hintEn: 'Tesla (T) × Area (m²) or Volt (V) × time (s)' },
  { id: 'q_H', targetId: 'H', titleJa: 'インダクタンス (H) を作れ！', titleEn: 'Craft Henry (H)', hintJa: '磁束 (Wb) ÷ 電流 (A)', hintEn: 'Magnetic flux (Wb) ÷ Current (A)' },
  { id: 'q_Hz', targetId: 'Hz', titleJa: '振動数 (Hz) を作れ！', titleEn: 'Craft Hertz (Hz)', hintJa: '周期の逆数: 1 ÷ 秒 (s)', hintEn: 'Reciprocal of period: 1 ÷ second (s)' },
  { id: 'q_mol_L', targetId: 'mol_L', titleJa: 'モル濃度 (mol/L) を作れ！', titleEn: 'Craft Molarity (mol/L)', hintJa: '物質量 (mol) ÷ 体積 (L)', hintEn: 'Amount of substance (mol) ÷ volume (L)' },
  { id: 'q_kg_m3', targetId: 'kg_m3', titleJa: '密度 (kg/m³) を作れ！', titleEn: 'Craft Density (kg/m³)', hintJa: '質量 (kg) ÷ 体積 (m³)', hintEn: 'Mass (kg) ÷ Volume (m³)' },
];

// 係数の表示：10 の累乗ならそのまま、そうでなければ有効数字3桁（例：10⁻²、3.60×10⁶）
const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
const formatFactor = (f: number) => {
  const e = Math.floor(Math.log10(f) + 1e-9);
  const m = f / Math.pow(10, e);
  const pow = `10${String(e).split('').map((c) => SUP[c]).join('')}`;
  if (Math.abs(m - 1) < 1e-6) return pow;
  return e === 0 ? m.toPrecision(3) : `${m.toPrecision(3)}×${pow}`;
};

export const AlchemyLab: React.FC<AlchemyLabProps> = ({
  onSelectUnit,
  onOpenTree,
  initialUnit,
  initialSlot = 'num',
  initialRecipe,
  lang,
}) => {
  // Synthesizer Kettle state: unitId -> exponent (+ for num, - for den)
  const [expr, setExpr] = useState<Record<string, number>>({});
  const [activeSlot, setActiveSlot] = useState<'num' | 'den'>('num');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedQuestId, setSelectedQuestId] = useState<string | null>('q_N');
  const [completedQuests, setCompletedQuests] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('unit_completed_quests');
      return saved ? new Set(JSON.parse(saved)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  // Track discovered units recipe book
  const [discoveredUnits, setDiscoveredUnits] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('unit_discovered_alchemy');
      return saved ? new Set(JSON.parse(saved)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  // Celebratory Synthesis Success Modal state
  const [successCelebration, setSuccessCelebration] = useState<{
    unit: UnitDefinition;
    formulaDesc: string;
  } | null>(null);

  // Handle external initial unit insertion or full recipe loading
  useEffect(() => {
    if (initialRecipe && initialRecipe.length > 0) {
      const newExpr: Record<string, number> = {};
      initialRecipe.forEach((ing) => {
        newExpr[ing.id] = (newExpr[ing.id] || 0) + ing.exp;
      });
      setExpr(newExpr);
    } else if (initialUnit) {
      setExpr((prev) => ({
        ...prev,
        [initialUnit.id]: (prev[initialUnit.id] || 0) + (initialSlot === 'num' ? 1 : -1),
      }));
    }
  }, [initialUnit, initialSlot, initialRecipe]);

  // Add unit piece into synthesizer
  const handleAddPiece = (id: string) => {
    sounds.playPop(540);
    const sign = activeSlot === 'num' ? 1 : -1;
    setExpr((prev) => {
      const next = { ...prev };
      next[id] = (next[id] || 0) + sign;
      if (next[id] === 0) delete next[id];
      return next;
    });
  };

  const handleRemovePiece = (id: string) => {
    sounds.playClick();
    setExpr((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleFlipPiece = (id: string) => {
    sounds.playClick();
    setExpr((prev) => {
      const next = { ...prev };
      if (next[id]) next[id] = -next[id];
      return next;
    });
  };

  const handleClearKettle = () => {
    sounds.playBonk();
    setExpr({});
  };

  // Calculate live combined SI dimensions of kettle
  const currentDim = useMemo(() => {
    const dim: Record<string, number> = {};
    for (const [id, exp] of Object.entries(expr)) {
      const u = unitsById[id];
      if (u) {
        const uDim = getUnitDim(u);
        for (const k in uDim) {
          dim[k] = (dim[k] || 0) + uDim[k] * exp;
          if (dim[k] === 0) delete dim[k];
        }
      }
    }
    return dim;
  }, [expr]);

  const hasItems = Object.keys(expr).length > 0;
  const currentDimKey = getDimKey(currentDim);

  // 係数（g と kg のように次元が同じでも大きさが違う）も含めて計算する
  const currentFactor = useMemo(() => {
    let f = 1;
    for (const [id, exp] of Object.entries(expr)) {
      const u = unitsById[id];
      if (u) f *= Math.pow(getUnitFactor(u), exp);
    }
    return f;
  }, [expr]);

  // 「材料を1つそのまま入れただけ」ではないか（1/s → Hz のような逆数や、m² のような2乗は錬成に数える）
  const exprEntries = Object.entries(expr);
  const isRealCraft = !(exprEntries.length === 1 && exprEntries[0][1] === 1);

  // 次元も係数も一致し、かけ算・わり算で作れる単位だけを「できた単位」とする
  const matchedUnits = useMemo(() => {
    if (!hasItems) return [];
    const keys = Object.keys(expr);
    const isSingleSelf = keys.length === 1 && expr[keys[0]] === 1;
    return RAW_UNITS.filter(
      (u) =>
        isCraftable(u) &&
        getDimKey(getUnitDim(u)) === currentDimKey &&
        sameFactor(getUnitFactor(u), currentFactor) &&
        !(isSingleSelf && u.id === keys[0])
    );
  }, [hasItems, expr, currentDimKey, currentFactor]);

  // 次元は同じだが係数が違う単位（例：kg に対する g、m に対する cm）
  const sameDimOtherFactor = useMemo(() => {
    if (!hasItems) return [];
    return RAW_UNITS.filter(
      (u) =>
        u.kind !== 'scale' &&
        !(expr[u.id] === 1 && Object.keys(expr).length === 1) &&
        getDimKey(getUnitDim(u)) === currentDimKey &&
        !sameFactor(getUnitFactor(u), currentFactor)
    );
  }, [hasItems, expr, currentDimKey, currentFactor]);

  // Check if current quest is satisfied
  const activeQuest = selectedQuestId ? QUESTS.find((q) => q.id === selectedQuestId) : null;
  const isQuestCompleted = useMemo(() => {
    if (!activeQuest || !hasItems) return false;
    return matchedUnits.some((u) => u.id === activeQuest.targetId);
  }, [activeQuest, hasItems, matchedUnits]);

  // 式の表示：分子・分母に分けて書く（例：kg·m / s²）
  const getFormulaDesc = useCallback(() => {
    const fmt = (entries: Array<[string, number]>) =>
      entries
        .map(([id, e]) => {
          const u = unitsById[id];
          const sy = u ? uSym(u, lang) : id;
          const n = Math.abs(e);
          return n === 1 ? sy : `${sy}${n === 2 ? '²' : n === 3 ? '³' : `^${n}`}`;
        })
        .join('·');
    const entries = Object.entries(expr);
    const num = entries.filter(([, e]) => e > 0);
    const den = entries.filter(([, e]) => e < 0);
    const top = num.length ? fmt(num) : '1';
    return den.length ? `${top} / ${den.length > 1 ? `(${fmt(den)})` : fmt(den)}` : top;
  }, [expr, lang]);

  // 演出はお題の達成時（初回）と、ボタンを押したときだけ
  const handleTriggerCelebration = useCallback(
    (targetUnit?: UnitDefinition) => {
      const unitToCelebrate = targetUnit || (matchedUnits.length > 0 ? matchedUnits[0] : null);
      if (!unitToCelebrate) return;
      setSuccessCelebration({
        unit: unitToCelebrate,
        formulaDesc: getFormulaDesc(),
      });
    },
    [matchedUnits, getFormulaDesc]
  );

  useEffect(() => {
    if (isQuestCompleted && activeQuest && !completedQuests.has(activeQuest.id)) {
      setCompletedQuests((prev) => {
        const next = new Set(prev).add(activeQuest.id);
        try {
          localStorage.setItem('unit_completed_quests', JSON.stringify(Array.from(next)));
        } catch {}
        return next;
      });
      const target = unitsById[activeQuest.targetId];
      if (target) {
        setSuccessCelebration({ unit: target, formulaDesc: getFormulaDesc() });
      }
    }
  }, [isQuestCompleted, activeQuest, completedQuests, getFormulaDesc]);

  // 正しくできた組み合わせだけを図鑑とツリー図に記録する
  useEffect(() => {
    if (matchedUnits.length === 0 || !isRealCraft) return;
    const primaryMatch = matchedUnits[0];

    setDiscoveredUnits((prev) => {
      let changed = false;
      const next = new Set(prev);
      matchedUnits.forEach((u) => {
        if (!next.has(u.id)) {
          next.add(u.id);
          changed = true;
        }
      });
      if (changed) {
        try {
          localStorage.setItem('unit_discovered_alchemy', JSON.stringify(Array.from(next)));
        } catch {}
      }
      return changed ? next : prev;
    });

    const ingredients = Object.entries(expr).map(([id, exp]) => ({ id, exp }));
    saveAlchemyRecord({
      ingredients,
      resultDimSI: formatDimSI(currentDim, 'ja'),
      resultDimKey: currentDimKey,
      resultUnitId: primaryMatch.id,
      resultUnitName: primaryMatch.name,
      resultUnitSym: primaryMatch.sym,
    });
  }, [matchedUnits, expr, currentDim, currentDimKey, isRealCraft]);

  // Filter palette units
  const filteredPalette = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return RAW_UNITS.filter((u) => u.kind !== 'scale' && (!q || unitSearchText(u).includes(q)));
  }, [searchQuery]);

  const numItems = Object.entries(expr).filter(([, e]) => e > 0);
  const denItems = Object.entries(expr).filter(([, e]) => e < 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Hero Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-3xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-indigo-500/10 dark:from-amber-950/20 dark:via-orange-950/20 dark:to-indigo-950/20 border border-amber-200/60 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-xl bg-amber-500 text-white shadow-xs">
              <Sparkles className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100">
              {lang === 'ja' ? '単位錬成ラボ (Alchemy Lab)' : 'Unit Crafter & Alchemy Lab'}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
            {lang === 'ja'
              ? '単位を掛けたり割ったりして、新しい単位を合成しよう！お題クエストに挑戦して星を集めよう。'
              : 'Combine units by multiplying and dividing to discover derived units and complete challenges!'}
          </p>
        </div>

        {/* Actions: View Tree Dashboard & Quest Stars Tally */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {onOpenTree && (
            <button
              onClick={() => {
                sounds.playPop(560);
                onOpenTree();
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-slate-750 border border-amber-300 dark:border-slate-700 shadow-sm text-slate-800 dark:text-slate-100 text-xs font-bold transition-all hover:scale-102 active:scale-98"
            >
              <GitBranch className="w-4 h-4 text-amber-500" />
              <span>{lang === 'ja' ? '🌳 錬成ツリー図を見る' : 'View Alchemy Tree'}</span>
            </button>
          )}

          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-amber-200/80 dark:border-slate-700">
            <Award className="w-5 h-5 text-amber-500" />
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {lang === 'ja' ? 'クエスト達成' : 'Quests Cleared'}
              </div>
              <div className="font-serif font-black text-amber-600 dark:text-amber-400 text-base leading-none">
                {completedQuests.size} / {QUESTS.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Two-Zone Studio Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Palette of Ingredients (lg:col-span-5) */}
        <div className="lg:col-span-5 p-5 rounded-3xl bg-white dark:bg-slate-900 border border-amber-100 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <span>{lang === 'ja' ? '単位パレット (材料)' : 'Unit Palette'}</span>
              <span className="text-xs text-slate-400 font-normal">({filteredPalette.length})</span>
            </h2>

            {/* Quick Search */}
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={lang === 'ja' ? '単位名・記号で絞り込み' : 'Filter units...'}
                className="w-28 sm:w-36 bg-transparent outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400 text-xs"
              />
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            {lang === 'ja'
              ? 'タップすると現在選択中の「分子」または「分母」に入ります。同じ単位を2回押すと2乗になります。'
              : 'Tap to add to the active slot (Top or Bottom). Tap again to square it.'}
          </p>

          {/* Palette Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[480px] overflow-y-auto pr-1">
            {filteredPalette.map((u) => {
              const inKettle = expr[u.id];
              return (
                <button
                  key={u.id}
                  onClick={() => handleAddPiece(u.id)}
                  className={`relative p-2.5 rounded-2xl border text-left transition-all hover:scale-103 active:scale-95 flex flex-col justify-between min-h-[64px] ${
                    inKettle
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600 shadow-2xs'
                      : 'bg-slate-50/70 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/80 hover:border-amber-300'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-serif font-bold text-base text-slate-800 dark:text-slate-100">
                      {uSym(u, lang)}
                    </span>
                    {inKettle && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-500 text-white leading-none">
                        {inKettle > 0 ? `×${inKettle}` : `÷${Math.abs(inKettle)}`}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-1">
                    {uQty(u, lang)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Synthesizer Kettle & Quests (lg:col-span-7) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Synthesizer Flask Workstation */}
          <div className="relative overflow-hidden p-6 rounded-3xl bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-slate-800 shadow-md space-y-5">
            {/* Background Canvas: Rising Alchemy bubbles & glow */}
            <FlaskBubblesCanvas hasItems={hasItems} hasMatch={matchedUnits.length > 0} />

            <div className="relative z-10 space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <span>⚗️ {lang === 'ja' ? '調合フラスコ (Synthesizer)' : 'Mixing Flask'}</span>
                </h2>

                <div className="flex items-center gap-2">
                  {/* Active Slot Selector */}
                  <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <button
                      onClick={() => {
                        sounds.playClick();
                        setActiveSlot('num');
                      }}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                        activeSlot === 'num'
                          ? 'bg-amber-500 text-white shadow-2xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                      }`}
                    >
                      {lang === 'ja' ? '× かける (分子)' : '× Multiply (Top)'}
                    </button>
                    <button
                      onClick={() => {
                        sounds.playClick();
                        setActiveSlot('den');
                      }}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                        activeSlot === 'den'
                          ? 'bg-amber-500 text-white shadow-2xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                      }`}
                    >
                      {lang === 'ja' ? '÷ わる (分母)' : '÷ Divide (Bottom)'}
                    </button>
                  </div>

                  {/* Clear Button */}
                  {hasItems && (
                    <button
                      onClick={handleClearKettle}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-slate-800 transition-colors"
                      title={lang === 'ja' ? 'フラスコをリセット' : 'Clear flask'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Visual Fraction Workstation */}
              <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-slate-800/50 border border-amber-200/60 dark:border-slate-700 space-y-3 backdrop-blur-2xs">
                {/* Numerator Slot */}
                <div
                  onClick={() => setActiveSlot('num')}
                  className={`p-3 rounded-2xl min-h-[52px] flex items-center gap-2 flex-wrap transition-all cursor-pointer ${
                    activeSlot === 'num'
                      ? 'bg-white dark:bg-slate-800 ring-2 ring-amber-400 shadow-xs'
                      : 'bg-white/70 dark:bg-slate-800/70 hover:bg-white'
                  }`}
                >
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-amber-100/60 dark:bg-amber-950/40 shrink-0">
                    {lang === 'ja' ? '分子 (×)' : 'Top (×)'}
                  </span>

                  {numItems.length > 0 ? (
                    numItems.map(([id, exp]) => {
                      const u = unitsById[id];
                      return (
                        <div
                          key={id}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-100/80 dark:bg-slate-700 border border-amber-300/80 dark:border-slate-600 font-serif font-bold text-sm text-slate-800 dark:text-slate-100 animate-in fade-in"
                        >
                          <span>{u ? uSym(u, lang) : id}</span>
                          {exp > 1 && <sup className="text-xs text-amber-700">{exp}</sup>}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFlipPiece(id);
                            }}
                            className="text-slate-400 hover:text-amber-600 p-0.5"
                            title="Flip"
                          >
                            <ArrowUpDown className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemovePiece(id);
                            }}
                            className="text-slate-400 hover:text-rose-500 p-0.5"
                            title="Remove"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <span className="text-xs text-slate-400">
                      {lang === 'ja' ? 'パレットから単位を選んで追加' : 'Select units from palette to multiply'}
                    </span>
                  )}
                </div>

                {/* Fraction Divider Bar */}
                <div className="h-0.5 bg-amber-300 dark:bg-slate-700 rounded-full w-full" />

                {/* Denominator Slot */}
                <div
                  onClick={() => setActiveSlot('den')}
                  className={`p-3 rounded-2xl min-h-[52px] flex items-center gap-2 flex-wrap transition-all cursor-pointer ${
                    activeSlot === 'den'
                      ? 'bg-white dark:bg-slate-800 ring-2 ring-amber-400 shadow-xs'
                      : 'bg-white/70 dark:bg-slate-800/70 hover:bg-white'
                  }`}
                >
                  <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-sky-100/60 dark:bg-sky-950/40 shrink-0">
                    {lang === 'ja' ? '分母 (÷)' : 'Bottom (÷)'}
                  </span>

                  {denItems.length > 0 ? (
                    denItems.map(([id, exp]) => {
                      const u = unitsById[id];
                      const absExp = Math.abs(exp);
                      return (
                        <div
                          key={id}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-sky-100/80 dark:bg-slate-700 border border-sky-300/80 dark:border-slate-600 font-serif font-bold text-sm text-slate-800 dark:text-slate-100 animate-in fade-in"
                        >
                          <span>{u ? uSym(u, lang) : id}</span>
                          {absExp > 1 && <sup className="text-xs text-sky-700">{absExp}</sup>}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFlipPiece(id);
                            }}
                            className="text-slate-400 hover:text-sky-600 p-0.5"
                            title="Flip"
                          >
                            <ArrowUpDown className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemovePiece(id);
                            }}
                            className="text-slate-400 hover:text-rose-500 p-0.5"
                            title="Remove"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <span className="text-xs text-slate-400">
                      {lang === 'ja' ? '割りたい単位があればここに投入' : 'Select units from palette to divide by'}
                    </span>
                  )}
                </div>
              </div>

              {/* Live Synthesis Reaction Banner */}
              <div
                className={`relative p-4 sm:p-5 rounded-2xl border transition-all overflow-hidden ${
                  matchedUnits.length > 0
                    ? 'bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-yellow-500/15 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-yellow-950/40 border-amber-400 dark:border-amber-500/60 shadow-md shadow-amber-500/10 ring-1 ring-amber-400/50'
                    : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700'
                }`}
              >
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    {matchedUnits.length > 0 && (
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    )}
                    <span>{lang === 'ja' ? '現在の調合結果 (SI基本単位)' : 'Synthesis Result in SI'}</span>
                  </span>
                  {hasItems && (
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400 bg-white/70 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                      {formatDimBrackets(currentDim)}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 flex-wrap my-1.5">
                  <div className="font-serif font-bold text-xl sm:text-2xl text-slate-800 dark:text-slate-100">
                    {hasItems
                      ? `${sameFactor(currentFactor, 1) ? '' : `${formatFactor(currentFactor)} × `}${formatDimSI(currentDim, lang)}`
                      : lang === 'ja'
                      ? '—（空のフラスコ）'
                      : '— (empty flask)'}
                  </div>

                  {/* Big Pop "Play Synthesis Effect" Action Button */}
                  {matchedUnits.length > 0 && (
                    <button
                      onClick={() => handleTriggerCelebration(matchedUnits[0])}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs shadow-md shadow-amber-500/25 transition-transform hover:scale-104 active:scale-95"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{lang === 'ja' ? '錬成する' : 'Craft it'}</span>
                    </button>
                  )}
                </div>

                {/* Matched Named Units Badge */}
                {matchedUnits.length > 0 && (
                  <div className="pt-3 border-t border-amber-200/80 dark:border-slate-700/80">
                    <div className="text-xs font-black text-amber-600 dark:text-amber-400 mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>
                          {lang === 'ja' ? 'この組み合わせでできる単位' : 'Units you have made'}
                        </span>
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                        {lang === 'ja' ? '✨で錬成、📖で図鑑' : '✨ craft · 📖 details'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {matchedUnits.map((match) => (
                        <div
                          key={match.id}
                          className="flex items-center gap-2 p-1.5 pl-3 rounded-2xl bg-white dark:bg-slate-800 border-2 border-amber-400 dark:border-amber-500/70 shadow-xs transition-all hover:scale-103"
                        >
                          <span className="font-serif font-black text-xl text-amber-600 dark:text-amber-400 select-none">
                            {uSym(match, lang)}
                          </span>
                          <div className="text-left pr-1">
                            <span className="font-black text-xs text-slate-800 dark:text-slate-100 block leading-tight">
                              {uName(match, lang)}
                            </span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block leading-none">
                              {uQty(match, lang)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 pl-1 border-l border-slate-200 dark:border-slate-700">
                            <button
                              onClick={() => handleTriggerCelebration(match)}
                              className="p-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-600 dark:text-amber-400 text-[10px] font-bold transition-colors"
                              title={lang === 'ja' ? '錬成エフェクトを発動' : 'Play FX'}
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                sounds.playPop();
                                onSelectUnit(match);
                              }}
                              className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-650 text-slate-600 dark:text-slate-300 text-[10px] font-bold transition-colors"
                              title={lang === 'ja' ? '図鑑を開く' : 'Inspect'}
                            >
                              📖
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 次元は同じでも係数が違う単位（錬成成功にはしない） */}
                {sameDimOtherFactor.length > 0 && (
                  <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
                    <div className="font-bold mb-1.5">
                      {lang === 'ja'
                        ? '次元は同じでも、係数（大きさ）がちがう単位'
                        : 'Same dimensions, different size (factor)'}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {sameDimOtherFactor.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => {
                            sounds.playPop();
                            onSelectUnit(u);
                          }}
                          className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-amber-400"
                        >
                          <span className="font-serif font-bold">{uSym(u, lang)}</span>
                          <span className="text-[10px] text-slate-500 ml-1">{uQty(u, lang)}</span>
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                      {lang === 'ja'
                        ? '例：g と kg は同じ「質量」ですが、1 kg = 1000 g。かけ算・わり算だけでは別の単位になります。'
                        : 'e.g. g and kg both measure mass, but 1 kg = 1000 g, so multiplying and dividing alone does not turn one into the other.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Adventure Quests Board */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-amber-100 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-500" />
                <span>{lang === 'ja' ? '錬成お題クエスト' : 'Adventure Quests'}</span>
              </h2>
              <span className="text-xs text-slate-400">
                {lang === 'ja' ? 'タップして目標を設定' : 'Select quest to challenge'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
              {QUESTS.map((q) => {
                const isSelected = selectedQuestId === q.id;
                const isDone = completedQuests.has(q.id);
                const targetU = unitsById[q.targetId];

                return (
                  <button
                    key={q.id}
                    onClick={() => {
                      sounds.playPop();
                      setSelectedQuestId(q.id);
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all flex items-start justify-between gap-2 ${
                      isSelected
                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600 ring-1 ring-amber-400'
                        : isDone
                        ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60'
                        : 'bg-slate-50/60 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/80 hover:border-amber-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-100">
                          {lang === 'ja' ? q.titleJa : q.titleEn}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                        {lang === 'ja' ? q.hintJa : q.hintEn}
                      </p>
                    </div>

                    {targetU && (
                      <span className="font-serif font-bold text-base text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-lg bg-white dark:bg-slate-700 border border-amber-200 dark:border-slate-600 shadow-2xs shrink-0">
                        {uSym(targetU, lang)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Synthesis Celebration Success Modal */}
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
