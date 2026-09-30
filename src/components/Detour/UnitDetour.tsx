import React, { useMemo, useState } from 'react';
import { Footprints, ArrowDownUp } from 'lucide-react';
import { DETOUR_KINDS, DETOUR_SYSTEMS, DETOUR_UNITS, DetourKind, DetourSystem, DetourUnit } from '../../data/detourUnits';
import { sounds } from '../../utils/sound';

interface UnitDetourProps {
  lang: 'ja' | 'en';
}

const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };

// 数の見せ方：ふだんの大きさはそのまま、とても大きい・小さい数は「×10の何乗」
const formatNum = (n: number, lang: 'ja' | 'en') => {
  if (!isFinite(n)) return '—';
  if (n === 0) return '0';
  const a = Math.abs(n);
  if (a >= 1e-4 && a < 1e9) return n.toLocaleString(lang === 'ja' ? 'ja-JP' : 'en-US', { maximumSignificantDigits: 6 });
  const [m, e] = n.toExponential(4).split('e');
  const mant = String(parseFloat(m));
  return `${mant}×10${String(parseInt(e, 10)).split('').map((c) => SUP[c] || c).join('')}`;
};

const SYSTEM_ORDER: DetourSystem[] = ['si', 'imperial', 'shakkan', 'daily'];
const SYSTEM_DOT: Record<DetourSystem, string> = { si: '#0891B2', imperial: '#7C3AED', shakkan: '#B45309', daily: '#16A34A' };

export const UnitDetour: React.FC<UnitDetourProps> = ({ lang }) => {
  const ja = lang === 'ja';
  const [kind, setKind] = useState<DetourKind>('length');
  const [fromId, setFromId] = useState<Record<DetourKind, string>>({ length: 'ft', area: 'tsubo', volume: 'sho', mass: 'lb' });
  const [amount, setAmount] = useState('1');

  const units = DETOUR_UNITS[kind];
  const from = units.find((u) => u.id === fromId[kind]) || units[0];
  const value = parseFloat(amount.replace(/,/g, ''));
  const valid = amount.trim() !== '' && isFinite(value);
  const baseValue = valid ? value * from.factor : NaN;
  const kindInfo = DETOUR_KINDS.find((k) => k.id === kind)!;
  const baseUnit = units.find((u) => u.id === kindInfo.base)!;

  const grouped = useMemo(
    () => SYSTEM_ORDER.map((s) => ({ system: s, list: units.filter((u) => u.system === s) })).filter((g) => g.list.length),
    [units]
  );

  const pickFrom = (u: DetourUnit) => {
    sounds.playPop();
    setFromId((prev) => ({ ...prev, [kind]: u.id }));
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {}
  };

  const unitLabel = (u: DetourUnit) => (ja ? u.name : u.nameEn);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* 見出し */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-cyan-600 text-white flex items-center justify-center shrink-0">
          <Footprints className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 leading-tight">{ja ? '単位のよりみち' : 'Unit Detours'}</h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            {ja
              ? 'ヤード・ポンド法や日本の尺貫法など、教科書の外でよく出会う単位を、メートル法に換算してみよう。'
              : 'Imperial, US and traditional Japanese units you meet outside the textbook — converted to metric.'}
          </p>
        </div>
      </div>

      {/* 量の種類 */}
      <div role="tablist" className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
        {DETOUR_KINDS.map((k) => {
          const on = kind === k.id;
          return (
            <button
              key={k.id}
              role="tab"
              aria-selected={on}
              onClick={() => {
                sounds.playClick();
                setKind(k.id);
              }}
              className={`shrink-0 flex items-center gap-1.5 px-4 min-h-11 rounded-xl border text-sm font-bold transition-colors ${
                on
                  ? 'bg-cyan-600 border-cyan-600 text-white'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-cyan-400'
              }`}
            >
              <span aria-hidden>{k.icon}</span>
              {ja ? k.ja : k.en}
            </button>
          );
        })}
      </div>

      {/* 入力 */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label={ja ? '数' : 'Amount'}
            className="w-32 sm:w-40 min-h-12 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-2xl font-bold font-serif text-slate-900 dark:text-slate-100 outline-none focus:border-cyan-500"
          />
          <select
            value={from.id}
            onChange={(e) => {
              sounds.playClick();
              setFromId((prev) => ({ ...prev, [kind]: e.target.value }));
            }}
            aria-label={ja ? '単位' : 'Unit'}
            className="flex-1 min-w-[160px] min-h-12 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-base font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-cyan-500"
          >
            {grouped.map((g) => (
              <optgroup key={g.system} label={ja ? DETOUR_SYSTEMS[g.system].ja : DETOUR_SYSTEMS[g.system].en}>
                {g.list.map((u) => (
                  <option key={u.id} value={u.id}>
                    {unitLabel(u).includes(u.sym) ? unitLabel(u) : `${unitLabel(u)}（${u.sym}）`}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* メートル法にすると */}
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <ArrowDownUp className="w-4 h-4" />
          <span className="text-xs font-bold">{ja ? `${baseUnit.name}にすると` : `In ${baseUnit.nameEn}s`}</span>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-serif font-black text-3xl sm:text-4xl text-cyan-700 dark:text-cyan-300 break-all">
            {valid ? formatNum(baseValue / baseUnit.factor, lang) : '—'}
          </span>
          <span className="font-serif font-bold text-xl text-slate-700 dark:text-slate-200">{baseUnit.sym}</span>
        </div>
        <p className="text-sm text-slate-700 dark:text-slate-300">
          <span className="font-bold">{ja ? '決まり：' : 'Definition: '}</span>
          {ja ? from.def : from.defEn}
        </p>
        {(ja ? from.note : from.noteEn) && <p className="text-sm text-slate-600 dark:text-slate-400">{ja ? from.note : from.noteEn}</p>}
      </div>

      {/* ほかの単位にすると */}
      <div className="space-y-4">
        <p className="text-xs text-slate-600 dark:text-slate-400">
          {ja ? 'ほかの単位で表すと…（タップすると、その単位から換算します）' : 'In other units… (tap one to convert from it)'}
        </p>
        {grouped.map((g) => (
          <section key={g.system} className="space-y-2">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
              <span aria-hidden className="w-1.5 h-5 rounded-full" style={{ background: SYSTEM_DOT[g.system] }} />
              {ja ? DETOUR_SYSTEMS[g.system].ja : DETOUR_SYSTEMS[g.system].en}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {g.list.map((u) => {
                const isFrom = u.id === from.id;
                return (
                  <button
                    key={u.id}
                    onClick={() => pickFrom(u)}
                    aria-pressed={isFrom}
                    className={`text-left p-3 rounded-xl border transition-colors ${
                      isFrom
                        ? 'border-2 border-cyan-600 bg-cyan-50 dark:bg-cyan-950/50'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-cyan-400'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-bold text-sm text-slate-800 dark:text-slate-100">{unitLabel(u)}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">{ja ? u.def : u.defEn}</span>
                    </div>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="font-serif font-black text-xl text-slate-900 dark:text-slate-50 break-all">
                        {valid ? formatNum(baseValue / u.factor, lang) : '—'}
                      </span>
                      <span className="font-serif font-bold text-slate-600 dark:text-slate-300">{u.sym}</span>
                    </div>
                    {(ja ? u.note : u.noteEn) && (
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{ja ? u.note : u.noteEn}</p>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};
