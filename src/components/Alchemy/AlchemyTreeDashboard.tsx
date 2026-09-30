import React, { useMemo, useState } from 'react';
import * as d3 from 'd3';
import { GitBranch, Clock, Trash2, FlaskConical, BookOpen } from 'lucide-react';
import { UnitDefinition } from '../../types/unit';
import { getAlchemyHistory, clearAlchemyHistory } from '../../utils/alchemyHistory';
import { unitsById, getUnitDim, formatDimSI } from '../../data/unitsData';
import { buildRecipeTree, getCraftedUnits, isStarter, RecipeNode, TARGET_UNITS } from '../../data/crafting';
import { uSym, uName, uQty } from '../../utils/i18n';
import { sounds } from '../../utils/sound';
import { TargetPicker } from './TargetPicker';

interface AlchemyTreeDashboardProps {
  onSelectUnit: (unit: UnitDefinition) => void;
  onLoadRecipe?: (ingredients: Array<{ id: string; exp: number }>) => void;
  targetId: string | null;
  onChangeTarget: (id: string | null) => void;
  onCraftInLab: () => void;
  lang: 'ja' | 'en';
  isDark?: boolean;
}

const COL_W = 150; // 列（深さ）の間隔
const ROW_H = 64; // 行の間隔
const BOX_H = 40;
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';

// 枠の幅は記号の長さから決める
const boxWidth = (sym: string) =>
  Math.max(52, Math.round([...sym].reduce((w, ch) => w + (/[぀-鿿]/.test(ch) ? 1 : 0.6), 0) * 17 + 24));

export const AlchemyTreeDashboard: React.FC<AlchemyTreeDashboardProps> = ({
  onSelectUnit,
  onLoadRecipe,
  targetId,
  onChangeTarget,
  onCraftInLab,
  lang,
  isDark = false,
}) => {
  const ja = lang === 'ja';
  const [history, setHistory] = useState(() => getAlchemyHistory());
  const crafted = useMemo(() => getCraftedUnits(), []);
  const [formIndex, setFormIndex] = useState(0);

  const target = targetId ? unitsById[targetId] : null;
  const forms = target?.forms || [];
  const fi = formIndex < forms.length ? formIndex : 0;

  // レシピの木を、目標が右端・材料が左へ広がる形に並べる
  const layout = useMemo(() => {
    if (!target) return null;
    const tree = buildRecipeTree(target.id, fi);
    if (!tree) return null;
    const root = d3.hierarchy<RecipeNode>(tree, (n) => n.children);
    d3.tree<RecipeNode>().nodeSize([ROW_H, COL_W])(root);
    const nodes = root.descendants();
    const maxDepth = d3.max(nodes, (n) => n.depth) || 0;
    const minX = d3.min(nodes, (n) => n.x!) || 0;
    const maxX = d3.max(nodes, (n) => n.x!) || 0;
    const pad = 70;
    const pos = (n: d3.HierarchyPointNode<RecipeNode>) => ({
      x: pad + (maxDepth - n.depth) * COL_W,
      y: pad / 2 + (n.x - minX) + BOX_H / 2,
    });
    return {
      nodes: nodes as d3.HierarchyPointNode<RecipeNode>[],
      links: root.links() as d3.HierarchyPointLink<RecipeNode>[],
      pos,
      width: pad * 2 + maxDepth * COL_W,
      height: pad + (maxX - minX) + BOX_H,
    };
  }, [target, fi]);

  const isAvailable = (u: UnitDefinition) => isStarter(u) || crafted.has(u.id);
  const craftedCount = TARGET_UNITS.filter((u) => crafted.has(u.id)).length;

  const pickTarget = (id: string | null) => {
    setFormIndex(0);
    onChangeTarget(id);
  };

  const formText = (form: Array<[string, number]>) => {
    const part = (list: Array<[string, number]>) =>
      list
        .map(([id, e]) => {
          const n = Math.abs(e);
          return `${uSym(unitsById[id], lang)}${n > 1 ? SUP[n] : ''}`;
        })
        .join('·');
    const num = form.filter(([, e]) => e > 0);
    const den = form.filter(([, e]) => e < 0);
    return `${num.length ? part(num) : '1'}${den.length ? ` / ${den.length > 1 ? `(${part(den)})` : part(den)}` : ''}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5">
      {/* 見出し */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-cyan-600 text-white">
            <GitBranch className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl font-black text-slate-800 dark:text-slate-100">{ja ? '錬成ツリー図' : 'Crafting Tree'}</h1>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {ja
                ? '作りたい単位を選ぶと、基本単位からの作り方が木の形で出ます。'
                : 'Pick a unit to see how it is built up from the base units.'}
            </p>
          </div>
        </div>
        <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
          <span className="text-slate-600 dark:text-slate-400">{ja ? '作れた単位' : 'Crafted'}</span>{' '}
          <span className="font-serif font-black text-cyan-700 dark:text-cyan-300 text-base">{craftedCount}</span>
          <span className="text-slate-500 dark:text-slate-400"> / {TARGET_UNITS.length}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ① 作りたい単位を選ぶ */}
        <section className="lg:col-span-4 p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
            <span className="inline-flex items-center justify-center w-5 h-5 mr-1.5 rounded-full bg-cyan-600 text-white text-xs">1</span>
            {ja ? '作りたい単位を選ぶ' : 'Choose a unit to make'}
          </h2>
          <TargetPicker targetId={targetId} crafted={crafted} onPick={pickTarget} lang={lang} />
        </section>

        {/* ② 作り方の木 */}
        <section className="lg:col-span-8 p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
            <span className="inline-flex items-center justify-center w-5 h-5 mr-1.5 rounded-full bg-cyan-600 text-white text-xs">2</span>
            {ja ? '作り方' : 'How to make it'}
          </h2>

          {!target || !layout ? (
            <p className="text-sm text-slate-600 dark:text-slate-400 py-10 text-center">
              {ja ? '左のリストから、作りたい単位を選んでください。' : 'Choose a unit from the list.'}
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-serif font-black text-2xl text-cyan-700 dark:text-cyan-300 whitespace-nowrap">{uSym(target, lang)}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100">{uName(target, lang)}</span>
                    <span className="text-xs text-slate-600 dark:text-slate-400">{uQty(target, lang)}</span>
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 font-serif">= {formatDimSI(getUnitDim(target), lang)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      sounds.playPop();
                      onSelectUnit(target);
                    }}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    <BookOpen className="w-4 h-4" />
                    {ja ? '図鑑' : 'Details'}
                  </button>
                  <button
                    onClick={() => {
                      sounds.playPop();
                      onCraftInLab();
                    }}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold"
                  >
                    <FlaskConical className="w-4 h-4" />
                    {ja ? 'ラボでこの単位を作る' : 'Make it in the lab'}
                  </button>
                </div>
              </div>

              {forms.length > 1 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-slate-600 dark:text-slate-400">{ja ? '作り方：' : 'Recipe:'}</span>
                  {forms.map((f, i) => (
                    <button
                      key={i}
                      onClick={() => setFormIndex(i)}
                      aria-pressed={fi === i}
                      className={`px-2.5 py-1 rounded-lg border font-serif ${
                        fi === i
                          ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-100 dark:text-slate-900'
                          : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-cyan-400'
                      }`}
                    >
                      {uSym(target, lang)} = {formText(f)}
                    </button>
                  ))}
                </div>
              )}

              <div className="overflow-auto rounded-2xl bg-slate-50 dark:bg-[#070B0E] border border-slate-200 dark:border-slate-800">
                <svg width={layout.width} height={layout.height} className="block mx-auto" role="img" aria-label={ja ? `${uSym(target, lang)} の作り方の図` : `Recipe tree for ${uSym(target, lang)}`}>
                  <defs>
                    <marker id="recipe-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto">
                      <path d="M0,0 L10,5 L0,10 z" fill={isDark ? '#94A3B8' : '#64748B'} />
                    </marker>
                  </defs>

                  {/* 線：材料（左）→ できる単位（右） */}
                  {layout.links.map((l, i) => {
                    const s = layout.pos(l.target); // 材料
                    const t = layout.pos(l.source); // できる単位
                    const sw = boxWidth(uSym(l.target.data.unit, lang));
                    const tw = boxWidth(uSym(l.source.data.unit, lang));
                    const x1 = s.x + sw / 2 + 2;
                    const x2 = t.x - tw / 2 - 3;
                    const mx = (x1 + x2) / 2;
                    const exp = l.target.data.exp;
                    const n = Math.abs(exp);
                    const label = `${exp > 0 ? '×' : '÷'}${n > 1 ? ` ${n}${ja ? '回' : 'x'}` : ''}`;
                    return (
                      <g key={i}>
                        <path
                          d={`M ${x1} ${s.y} C ${mx} ${s.y}, ${mx} ${t.y}, ${x2} ${t.y}`}
                          fill="none"
                          stroke={exp > 0 ? (isDark ? '#22D3EE' : '#0891B2') : isDark ? '#38BDF8' : '#0369A1'}
                          strokeWidth={1.8}
                          strokeDasharray={exp > 0 ? undefined : '5 4'}
                          markerEnd="url(#recipe-arrow)"
                        />
                        <g transform={`translate(${x1 + 18}, ${s.y - 9})`}>
                          <rect x={-13} y={-9} width={n > 1 ? 44 : 26} height={17} rx={8} fill={isDark ? '#0F172A' : 'white'} stroke={isDark ? '#334155' : '#CBD5E1'} />
                          <text x={n > 1 ? 9 : 0} y={4} textAnchor="middle" fontSize="12" fontWeight="bold" fill={exp > 0 ? '#0891B2' : '#0369A1'}>
                            {label}
                          </text>
                        </g>
                      </g>
                    );
                  })}

                  {/* 単位の枠 */}
                  {layout.nodes.map((n, i) => {
                    const u = n.data.unit;
                    const p = layout.pos(n);
                    const sym = uSym(u, lang);
                    const w = boxWidth(sym);
                    const isRoot = n.depth === 0;
                    const available = isAvailable(u);
                    const canRetarget = !isRoot && !isStarter(u);
                    return (
                      <g
                        key={i}
                        transform={`translate(${p.x}, ${p.y})`}
                        className="cursor-pointer"
                        onClick={() => {
                          sounds.playPop();
                          if (canRetarget) pickTarget(u.id);
                          else onSelectUnit(u);
                        }}
                      >
                        <title>
                          {canRetarget
                            ? ja ? `${sym} の作り方を見る` : `See how to make ${sym}`
                            : ja ? `${sym} の詳細を見る` : `Details for ${sym}`}
                        </title>
                        <rect
                          x={-w / 2}
                          y={-BOX_H / 2}
                          width={w}
                          height={BOX_H}
                          rx={BOX_H / 2}
                          fill={isDark ? (available ? '#0E2A33' : '#111827') : available ? (u.kind === 'base' ? '#F1F5F9' : '#ECFEFF') : 'white'}
                          stroke={isRoot ? '#0891B2' : available ? (u.kind === 'base' ? '#475569' : '#06B6D4') : isDark ? '#475569' : '#94A3B8'}
                          strokeWidth={isRoot ? 3 : u.kind === 'base' ? 2.5 : 1.8}
                          strokeDasharray={available || isRoot ? undefined : '4 3'}
                        />
                        <text
                          y={6}
                          textAnchor="middle"
                          fontFamily="STIX Two Text, Georgia, serif"
                          fontWeight="bold"
                          fontSize="17"
                          fill={available || isRoot ? (isDark ? '#E2E8F0' : '#0F172A') : isDark ? '#64748B' : '#94A3B8'}
                        >
                          {sym}
                        </text>
                        <text y={BOX_H / 2 + 13} textAnchor="middle" fontSize="10.5" fill={isDark ? '#94A3B8' : '#64748B'}>
                          {uQty(u, lang).split(/\s*[（(]/)[0].split(/[・,]/)[0]}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* 凡例 */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-6 h-3.5 rounded-full border-[2.5px] border-slate-600 bg-slate-100" />
                  {ja ? '基本単位・材料' : 'Base unit / ingredient'}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-6 h-3.5 rounded-full border-2 border-cyan-500 bg-cyan-50" />
                  {ja ? 'ラボで作れた単位' : 'Crafted in the lab'}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-6 h-3.5 rounded-full border-2 border-dashed border-slate-400 bg-white" />
                  {ja ? 'まだ作っていない単位（タップで作り方へ）' : 'Not crafted yet (tap for its recipe)'}
                </span>
                <span>{ja ? '実線 × かける ／ 点線 ÷ わる' : 'Solid × multiply / dashed ÷ divide'}</span>
              </div>
            </>
          )}
        </section>
      </div>

      {/* ③ 自分の錬成記録 */}
      <section className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-cyan-600" />
            {ja ? 'あなたの錬成記録' : 'Your recipes'}
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">({history.length})</span>
          </h2>
          {history.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm(ja ? '錬成の記録を消しますか？' : 'Clear your recipe history?')) {
                  clearAlchemyHistory();
                  setHistory(getAlchemyHistory());
                }
              }}
              className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-rose-500"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {ja ? '記録を消す' : 'Clear'}
            </button>
          )}
        </div>
        {history.length === 0 ? (
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {ja ? 'まだ記録はありません。錬成ラボで単位を作ると、ここに並びます。' : 'No recipes yet. Units you make in the lab will appear here.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {history.map((rec) => {
              const u = rec.resultUnitId ? unitsById[rec.resultUnitId] : null;
              if (!u) return null;
              return (
                <div key={rec.id} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
                  <div className="font-serif text-sm min-w-0">
                    <span className="text-slate-700 dark:text-slate-200">{formText(rec.ingredients.map((i) => [i.id, i.exp] as [string, number]))}</span>
                    <span className="text-slate-500 dark:text-slate-400 mx-1.5">→</span>
                    <span className="font-bold text-cyan-700 dark:text-cyan-300 whitespace-nowrap">{uSym(u, lang)}</span>
                  </div>
                  {onLoadRecipe && (
                    <button
                      onClick={() => {
                        sounds.playPop();
                        onLoadRecipe(rec.ingredients);
                      }}
                      className="shrink-0 text-xs font-bold px-2 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:border-cyan-400"
                    >
                      {ja ? 'フラスコに戻す' : 'Load'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
