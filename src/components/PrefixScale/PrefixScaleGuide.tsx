import React, { useState } from 'react';
import { Ruler, Sparkles, Scale, Info } from 'lucide-react';
import { PREFIXES, PrefixItem } from '../../data/unitsData';
import { sounds } from '../../utils/sound';

interface PrefixScaleGuideProps {
  lang: 'ja' | 'en';
}

export const PrefixScaleGuide: React.FC<PrefixScaleGuideProps> = ({ lang }) => {
  const [selectedExp, setSelectedExp] = useState<number>(3); // default kilo (10^3)

  const activePrefix = PREFIXES.find((p) => p.exp === selectedExp) || PREFIXES[3];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      {/* Hero Header */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-amber-100 dark:border-slate-800 shadow-sm space-y-2">
        <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Ruler className="w-6 h-6 text-amber-500" />
          <span>{lang === 'ja' ? '接頭語・スケール早見表' : 'SI Prefixes & Scale Guide'}</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          {lang === 'ja'
            ? '10の何乗倍を表すSI接頭語（k, m, μ など）のスライダーと、単位ではない特別な目盛り（pH、マグニチュード等）の解説です。'
            : 'Interactive slider for powers of 10 prefixes, and explanations for logarithmic non-unit scales (pH, magnitude).'}
        </p>
      </div>

      {/* Part 1: Interactive Scale Slider */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-slate-800 shadow-md space-y-6">
        <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>{lang === 'ja' ? '10の何乗？ インタラクティブ接頭語スライダー' : 'Interactive Powers of 10 Slider'}</span>
        </h2>

        {/* Selected Highlight Card */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-indigo-500/10 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-indigo-950/30 border border-amber-200/60 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-800 border border-amber-300 dark:border-slate-600 shadow-xs flex items-center justify-center font-serif font-black text-3xl text-amber-600 dark:text-amber-400">
              {activePrefix.sym}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-slate-800 dark:text-slate-100">
                  {lang === 'ja' ? activePrefix.name : activePrefix.nameEn}
                </span>
                <span className="font-serif font-black text-xl text-amber-600 dark:text-amber-400">
                  {activePrefix.factor}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                {lang === 'ja' ? activePrefix.example : activePrefix.exampleEn}
              </p>
            </div>
          </div>
        </div>

        {/* Prefix Chips Timeline */}
        <div className="flex items-center justify-between gap-1 overflow-x-auto pb-2 scrollbar-none">
          {PREFIXES.map((p) => {
            const isSelected = p.exp === selectedExp;
            return (
              <button
                key={p.sym}
                onClick={() => {
                  sounds.playPop();
                  setSelectedExp(p.exp);
                }}
                className={`flex-1 min-w-[56px] py-2.5 px-1.5 rounded-xl border text-center transition-all ${
                  isSelected
                    ? 'bg-amber-500 text-white border-amber-500 shadow-sm scale-105'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-amber-300'
                }`}
              >
                <div className="font-serif font-bold text-base">{p.sym}</div>
                <div className="text-[10px] opacity-80">{p.factor}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Part 2: "Not units, but scales!" Educational Guide */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-amber-100 dark:border-slate-800 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Scale className="w-5 h-5 text-amber-500" />
          <span>{lang === 'ja' ? '「単位」ではなく「目盛り（スケール）」の仲間たち' : 'Scales that are NOT SI Units'}</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {lang === 'ja'
            ? '高校理科のテストでよく単位と混同されがちですが、これらは単位ではなく対数目盛りや離散的な階級です。'
            : 'Often confused with physical units, these are logarithmic mathematical scales or discrete intensity ranks.'}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* pH */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-serif font-bold text-lg text-amber-600 dark:text-amber-400">pH</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300">
                {lang === 'ja' ? '対数の目盛り（化学・生物）' : 'Log scale (chemistry, biology)'}
              </span>
            </div>
            <h3 className="font-bold text-xs text-slate-800 dark:text-slate-200">
              {lang === 'ja' ? '水素イオン濃度指数' : 'Hydrogen Ion Index'}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {lang === 'ja'
                ? 'pH = −log₁₀[H⁺]。単位ではなく濃度の「常用対数」の目盛りです。pHが1変わると水素イオン濃度は10倍、2変わると100倍変化します。'
                : 'pH = −log₁₀[H⁺]. A logarithmic index of [H⁺] concentration. A difference of 1 represents a 10-fold change in concentration.'}
            </p>
          </div>

          {/* Magnitude */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-serif font-bold text-lg text-indigo-600 dark:text-indigo-400">M</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                {lang === 'ja' ? '対数の目盛り（地学）' : 'Log scale (earth science)'}
              </span>
            </div>
            <h3 className="font-bold text-xs text-slate-800 dark:text-slate-200">
              {lang === 'ja' ? '地震の規模 (マグニチュード)' : 'Earthquake Magnitude'}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {lang === 'ja'
                ? '地震そのもののエネルギーの対数。Mが1増えるとエネルギーは約31.6倍(√1000倍)、Mが2増えるとちょうど1000倍になります。'
                : 'Logarithmic scale of released energy. +1 magnitude is ≈ 31.6× energy; +2 is exactly a 1000-fold increase.'}
            </p>
          </div>

          {/* Shindo */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-serif font-bold text-lg text-emerald-600 dark:text-emerald-400">{lang === 'ja' ? '震度' : 'Shindo'}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                {lang === 'ja' ? '10段階の階級（地学）' : '10-step scale (earth science)'}
              </span>
            </div>
            <h3 className="font-bold text-xs text-slate-800 dark:text-slate-200">
              {lang === 'ja' ? '気象庁震度階級' : 'Seismic Intensity (Shindo)'}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {lang === 'ja'
                ? '0〜7の10段階で定められた「その地点での揺れの激しさ」の階級。マグニチュードが地震自体の絶対値であるのに対し、震度は場所ごとの測定値です。'
                : 'A 10-step rank (0–7) measuring local ground shaking intensity at a specific observation station.'}
            </p>
          </div>

          {/* Stellar Magnitude */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-serif font-bold text-lg text-purple-600 dark:text-purple-400">{lang === 'ja' ? '等級' : 'mag'}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                {lang === 'ja' ? '対数の目盛り（天文）' : 'Log scale (astronomy)'}
              </span>
            </div>
            <h3 className="font-bold text-xs text-slate-800 dark:text-slate-200">
              {lang === 'ja' ? '恒星の明るさ (視等級・絶対等級)' : 'Stellar Magnitude'}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {lang === 'ja'
                ? '5等級小さくなると明るさがちょうど100倍になる対数スケール。1等級の差は約 2.512 倍の明るさの違いに相当します。'
                : 'Logarithmic scale where a 5-magnitude difference corresponds to a factor of exactly 100 in luminosity.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
