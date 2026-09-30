import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { Search, Route, ChevronRight, Compass, X, BookOpen, GitBranch, CheckCircle2, Layers, LayoutGrid } from 'lucide-react';
import { UnitDefinition } from '../../types/unit';
import { REALMS, RAW_UNITS, MAP_LINKS, unitsById } from '../../data/unitsData';
import { BUILD_COLUMNS, FIELD_GROUPS, MEMBERS, hostOf, realmById } from '../../data/mapLayout';
import { TARGET_UNITS, getCraftedUnits } from '../../data/crafting';
import { uSym, uName, uQty, uConv, realmName, realmDesc, unitSearchText, bySymLength } from '../../utils/i18n';
import { prefersReducedMotion } from '../../utils/motion';
import { sounds } from '../../utils/sound';

interface UnitMapProps {
  onSelectUnit: (unit: UnitDefinition) => void;
  selectedUnit: UnitDefinition | null;
  focusedUnit: UnitDefinition | null;
  onOpenTree: (unitId: string) => void;
  lang: 'ja' | 'en';
  isDark?: boolean;
}

type View = 'build' | 'field';

// ラベルは括弧の補足を省き、長いものだけ切る
const shortQty = (q: string, lang: 'ja' | 'en') => {
  const base = q.split(/\s*[（(]/)[0].split(/[・,]/)[0];
  const max = lang === 'ja' ? 6 : 12;
  return base.length > max ? base.slice(0, max - 1) + '…' : base;
};

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const supNum = (n: number) => (n === 1 ? '' : String(n).split('').map((c) => SUP[+c]).join(''));

// 組み立て方を「kg × m ÷ s²」の形で
const recipeText = (u: UnitDefinition, lang: 'ja' | 'en') => {
  const form = u.forms?.[0];
  if (!form) return '';
  return form
    .map(([id, exp], i) => {
      const s = uSym(unitsById[id], lang) + supNum(Math.abs(exp));
      if (exp > 0) return i === 0 ? s : `× ${s}`;
      return i === 0 ? `1 ÷ ${s}` : `÷ ${s}`;
    })
    .join(' ');
};

const TARGET_IDS = new Set(TARGET_UNITS.map((u) => u.id));

// 線の色（ツリー図と同じ決まり：実線＝かける、点線＝わる）
const EDGE_COLOR = { in: '#0284C7', out: '#059669', route: '#0891B2' } as const;

interface Edge {
  id: string;
  d: string;
  kind: 'in' | 'out' | 'route';
  dash: string;
  label?: string;
  lx: number;
  ly: number;
}

export const UnitMap: React.FC<UnitMapProps> = ({ onSelectUnit, selectedUnit, focusedUnit, onOpenTree, lang, isDark = false }) => {
  const ja = lang === 'ja';
  const contentRef = useRef<HTMLDivElement>(null);
  const nodeEls = useRef(new Map<string, HTMLElement>());

  const [view, setView] = useState<View>(() => {
    try {
      return localStorage.getItem('unit_map_view') === 'field' ? 'field' : 'build';
    } catch {
      return 'build';
    }
  });
  const [focusId, setFocusId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [realmFilter, setRealmFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showRoute, setShowRoute] = useState(false);
  const [routeStart, setRouteStart] = useState('kg');
  const [routeEnd, setRouteEnd] = useState('V');
  const [edges, setEdges] = useState<Edge[]>([]);
  const [layoutTick, setLayoutTick] = useState(0);
  const crafted = useMemo(() => getCraftedUnits(), []);

  const changeView = (v: View) => {
    sounds.playClick();
    setView(v);
    try {
      localStorage.setItem('unit_map_view', v);
    } catch {}
  };

  const scrollToUnit = useCallback((id: string) => {
    requestAnimationFrame(() => {
      nodeEls.current.get(id)?.scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'center',
        inline: 'center',
      });
    });
  }, []);

  const focusUnit = useCallback(
    (id: string, scroll = false) => {
      setFocusId(id);
      setShowRoute(false);
      if (scroll) scrollToUnit(id);
    },
    [scrollToUnit]
  );

  // ほかの画面（図鑑・詳細）から「地図で見る」で来たとき
  useEffect(() => {
    if (focusedUnit) focusUnit(focusedUnit.id, true);
  }, [focusedUnit, focusUnit]);

  // 詳細画面で別の単位へ移ったら、閉じたあともその単位を選んだままにする
  useEffect(() => {
    if (selectedUnit) setFocusId(selectedUnit.id);
  }, [selectedUnit]);

  // Escape で選択を外す
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !selectedUnit) setFocusId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedUnit]);

  // 画面の大きさが変わったら線を引き直す
  useEffect(() => {
    const el = contentRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setLayoutTick((t) => t + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // つながり探索（組み立て方・換算の向きにたどる最短ルート）
  const route = useMemo(() => {
    if (!showRoute || routeStart === routeEnd) return null;
    const adj: Record<string, string[]> = {};
    MAP_LINKS.forEach((l) => (adj[l.source] = adj[l.source] || []).push(l.target));
    const queue: string[][] = [[routeStart]];
    const visited = new Set([routeStart]);
    while (queue.length) {
      const path = queue.shift()!;
      const cur = path[path.length - 1];
      if (cur === routeEnd) return path;
      for (const n of adj[cur] || []) {
        if (!visited.has(n)) {
          visited.add(n);
          queue.push([...path, n]);
        }
      }
    }
    return null;
  }, [showRoute, routeStart, routeEnd]);

  const activeId = showRoute ? null : focusId ?? hoverId;
  const active = activeId ? unitsById[activeId] : null;

  const related = useMemo(() => {
    if (!activeId) return null;
    const incoming = MAP_LINKS.filter((l) => l.target === activeId);
    const outgoing = MAP_LINKS.filter((l) => l.source === activeId);
    return {
      incoming,
      outgoing,
      inIds: new Set(incoming.map((l) => l.source)),
      outIds: new Set(outgoing.map((l) => l.target)),
    };
  }, [activeId]);

  const routeIds = useMemo(() => new Set(route || []), [route]);

  // 線：DOM 上の単位の位置から、その時だけ引く（全部の線を一度に出すと読めなくなるため）
  useLayoutEffect(() => {
    const box = contentRef.current;
    const pairs: Array<{ from: string; to: string; kind: Edge['kind']; op: string; exp?: number }> = [];
    if (route) {
      for (let i = 0; i < route.length - 1; i++) {
        const l = MAP_LINKS.find((m) => m.source === route[i] && m.target === route[i + 1]);
        pairs.push({ from: route[i], to: route[i + 1], kind: 'route', op: l?.op || 'mul' });
      }
    } else if (related && activeId) {
      const exps: Record<string, number> = {};
      unitsById[activeId].forms?.[0]?.forEach(([id, e]) => (exps[id] = e));
      related.incoming.forEach((l) => pairs.push({ from: l.source, to: activeId, kind: 'in', op: l.op, exp: exps[l.source] }));
      // 作れる単位への線は、狭い画面や数が多いとき（m・s など）は引かず、枠の色だけで示す
      const narrow = window.matchMedia('(max-width: 767px)').matches;
      if (!narrow && related.outgoing.length <= 10)
        related.outgoing.forEach((l) => pairs.push({ from: activeId, to: l.target, kind: 'out', op: l.op }));
    }
    if (!box || pairs.length === 0) {
      setEdges([]);
      return;
    }
    const origin = box.getBoundingClientRect();
    const rectOf = (id: string) => {
      const el = nodeEls.current.get(id);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      // 横にスクロールしても線がずれないよう、中身の左上を原点にする
      return { x: r.left - origin.left + box.scrollLeft, y: r.top - origin.top + box.scrollTop, w: r.width, h: r.height };
    };
    const out: Edge[] = [];
    for (const p of pairs) {
      // 同じ単位の「なかま」（m と cm など）は並んで見えているので線を引かない
      if (view === 'build' && hostOf(p.from) === hostOf(p.to)) continue;
      const a = rectOf(p.from);
      const b = rectOf(p.to);
      if (!a || !b) continue;
      let x1, y1, x2, y2, c1x, c1y, c2x, c2y;
      const G = 3;
      if (b.x >= a.x + a.w - 2 || a.x >= b.x + b.w - 2) {
        const right = b.x >= a.x + a.w - 2;
        x1 = right ? a.x + a.w : a.x;
        x2 = right ? b.x - G : b.x + b.w + G;
        y1 = a.y + a.h / 2;
        y2 = b.y + b.h / 2;
        const c = Math.max(24, Math.abs(x2 - x1) / 2) * (right ? 1 : -1);
        [c1x, c1y, c2x, c2y] = [x1 + c, y1, x2 - c, y2];
      } else {
        const down = b.y >= a.y;
        x1 = a.x + a.w / 2;
        x2 = b.x + b.w / 2;
        y1 = down ? a.y + a.h : a.y;
        y2 = down ? b.y - G : b.y + b.h + G;
        const c = Math.max(20, Math.abs(y2 - y1) / 2) * (down ? 1 : -1);
        [c1x, c1y, c2x, c2y] = [x1, y1 + c, x2, y2 - c];
      }
      const lx = (x1 + 3 * c1x + 3 * c2x + x2) / 8;
      const ly = (y1 + 3 * c1y + 3 * c2y + y2) / 8;
      const isConv = p.op === 'conv' || p.op === 'log';
      let label: string | undefined;
      if (p.kind === 'in' || p.kind === 'route') {
        if (isConv) label = p.op === 'conv' ? (ja ? '換算' : 'conv.') : ja ? '目安' : 'scale';
        else if (p.exp !== undefined) label = (p.exp > 0 ? '×' : '÷') + supNum(Math.abs(p.exp));
        else label = p.op === 'div' ? '÷' : '×';
      }
      out.push({
        id: `${p.from}->${p.to}`,
        d: `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`,
        kind: p.kind,
        dash: isConv ? '2 5' : p.op === 'div' ? '7 5' : '',
        label,
        lx,
        ly,
      });
    }
    setEdges(out);
  }, [related, activeId, route, view, lang, layoutTick, ja]);

  const searchResults = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return q ? RAW_UNITS.filter((u) => unitSearchText(u).includes(q)).slice(0, 6) : [];
  }, [searchQuery]);

  const tapUnit = (u: UnitDefinition) => {
    sounds.playPop();
    if (focusId === u.id) onSelectUnit(u);
    else focusUnit(u.id);
  };

  // 単位のボタン（大きい＝ふつうの単位、小さい＝換算・目盛りのなかま）
  const renderUnit = (u: UnitDefinition, small = false) => {
    const realm = realmById[u.realmId];
    const isActive = activeId === u.id;
    const isIn = related?.inIds.has(u.id);
    const isOut = related?.outIds.has(u.id);
    const inRoute = routeIds.has(u.id);
    const dimmed =
      (route && !inRoute) ||
      (!route && activeId && !isActive && !isIn && !isOut) ||
      (!route && !activeId && realmFilter && !(u.topics || [u.realmId]).includes(realmFilter as UnitDefinition['realmId']));
    const isBase = u.kind === 'base';
    const isScale = u.kind === 'scale';
    const done = crafted.has(u.id);

    let tone = isBase
      ? 'border-slate-500 dark:border-slate-400 border-2 bg-white dark:bg-slate-800'
      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800';
    if (small) tone = isScale ? 'border-dashed border-stone-400 bg-stone-50 dark:bg-stone-900/60' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70';
    if (isActive) tone = 'border-2 border-sky-600 bg-sky-50 dark:bg-sky-950 ring-4 ring-sky-500/20';
    else if (inRoute) tone = 'border-2 border-cyan-500 bg-cyan-50 dark:bg-cyan-950';
    else if (isIn) tone = 'border-2 border-sky-500 bg-sky-50 dark:bg-sky-950/70';
    else if (isOut) tone = 'border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/70';

    const label = `${uSym(u, lang)} ${uName(u, lang)}（${uQty(u, lang)}）`;
    const refCb = (el: HTMLButtonElement | null) => {
      if (el) nodeEls.current.set(u.id, el);
      else nodeEls.current.delete(u.id);
    };
    const common = {
      ref: refCb,
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        tapUnit(u);
      },
      onMouseEnter: () => setHoverId(u.id),
      onMouseLeave: () => setHoverId((h) => (h === u.id ? null : h)),
      'aria-pressed': focusId === u.id,
      title: label,
    };

    if (small) {
      return (
        <button
          key={u.id}
          {...common}
          className={`relative z-10 min-h-7 px-2 py-0.5 rounded-lg border font-serif font-bold text-[13px] leading-none text-slate-700 dark:text-slate-200 whitespace-nowrap transition-opacity ${tone} ${dimmed ? 'opacity-30' : ''}`}
        >
          {uSym(u, lang)}
        </button>
      );
    }
    return (
      <button
        key={u.id}
        {...common}
        className={`relative z-10 flex flex-col items-center justify-center min-w-[72px] w-full min-h-[50px] pl-3 pr-2 py-1.5 rounded-xl border shadow-xs hover:shadow-md transition-[opacity,box-shadow] ${tone} ${dimmed ? 'opacity-30' : ''}`}
      >
        <span aria-hidden className="absolute left-1 top-2 bottom-2 w-1 rounded-full" style={{ background: realm?.color }} />
        <span className={`font-serif font-bold leading-tight text-slate-800 dark:text-slate-100 whitespace-nowrap ${bySymLength(uSym(u, lang), 'text-[17px]', 'text-[15px]', 'text-[13px]')}`}>{uSym(u, lang)}</span>
        <span className="max-w-full truncate text-[11px] leading-tight text-slate-600 dark:text-slate-400">{shortQty(uQty(u, lang), lang)}</span>
        {done && (
          <CheckCircle2 aria-label={ja ? 'ラボで作れた' : 'crafted'} className="absolute -top-1.5 -right-1.5 w-4 h-4 text-emerald-500 bg-white dark:bg-slate-900 rounded-full" />
        )}
      </button>
    );
  };

  // 単位＋なかま（cm・mm…）のまとまり
  const renderGroup = (u: UnitDefinition) => {
    const members = (MEMBERS[u.id] || []).map((id) => unitsById[id]);
    return (
      <div key={u.id} className="flex flex-col gap-1 min-w-0">
        {renderUnit(u)}
        {members.length > 0 && <div className="flex flex-wrap gap-1 pl-1">{members.map((m) => renderUnit(m, true))}</div>}
      </div>
    );
  };

  const craftedCount = TARGET_UNITS.filter((u) => crafted.has(u.id)).length;
  const focus = focusId && !showRoute ? unitsById[focusId] : null;

  const stepTitle = (d: number) => (d === 0 ? (ja ? '基本単位' : 'Base units') : ja ? `${d}段目` : `Step ${d}`);

  return (
    <div className={`max-w-7xl mx-auto px-3 sm:px-6 py-5 sm:py-6 space-y-4 ${focus ? 'pb-56 sm:pb-44' : ''}`} onClick={() => setFocusId(null)}>
      {/* 見出し（ツリー図と同じ形） */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-600 text-white flex items-center justify-center shrink-0">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 leading-tight">{ja ? 'ワールドマップ' : 'World Map'}</h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              {view === 'build'
                ? ja
                  ? `${RAW_UNITS.length}の単位を、7つの基本単位から組み立てられる順に並べた全体図です。`
                  : `All ${RAW_UNITS.length} units, in the order they are built from the seven base units.`
                : ja
                ? `${RAW_UNITS.length}の単位を、教科書の分野ごとに並べています。`
                : `All ${RAW_UNITS.length} units, grouped by textbook topic.`}
            </p>
          </div>
        </div>
        <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
          {ja ? '作れた単位' : 'Crafted'} <span className="font-serif font-bold text-base text-cyan-700 dark:text-cyan-300">{craftedCount}</span> / {TARGET_UNITS.length}
        </div>
      </div>

      {/* 操作：並べ方・検索・つながり探索 */}
      <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <div role="group" aria-label={ja ? '並べ方' : 'Layout'} className="flex p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800">
          {([
            { id: 'build', icon: <Layers className="w-4 h-4" />, ja: '組み立て順', en: 'By build step' },
            { id: 'field', icon: <LayoutGrid className="w-4 h-4" />, ja: '分野別', en: 'By topic' },
          ] as const).map((o) => (
            <button
              key={o.id}
              onClick={() => changeView(o.id)}
              aria-pressed={view === o.id}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                view === o.id ? 'bg-white dark:bg-slate-700 text-cyan-700 dark:text-cyan-300 shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              {o.icon}
              {ja ? o.ja : o.en}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm">
            <Search className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={ja ? '単位をさがす（N、圧力…）' : 'Find a unit (N, pressure…)'}
              aria-label={ja ? '単位をさがす' : 'Find a unit'}
              className="w-full bg-transparent outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
            />
          </div>
          {searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 z-30 p-1 rounded-xl bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700">
              {searchResults.map((u) => (
                <button
                  key={u.id}
                  onClick={() => {
                    sounds.playPop();
                    setSearchQuery('');
                    setRealmFilter(null);
                    focusUnit(u.id, true);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left hover:bg-cyan-50 dark:hover:bg-slate-700 text-sm"
                >
                  <span className="font-serif font-bold text-cyan-700 dark:text-cyan-300 whitespace-nowrap">{uSym(u, lang)}</span>
                  <span className="text-slate-700 dark:text-slate-200 truncate">{uName(u, lang)}</span>
                  <span className="ml-auto text-xs text-slate-500 dark:text-slate-400 shrink-0">{shortQty(uQty(u, lang), lang)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => {
            sounds.playClick();
            setShowRoute((v) => !v);
          }}
          aria-pressed={showRoute}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${
            showRoute
              ? 'bg-cyan-600 border-cyan-600 text-white'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-cyan-400'
          }`}
        >
          <Route className="w-4 h-4" />
          {ja ? 'つながり探索' : 'Find a route'}
        </button>
      </div>

      {/* つながり探索（地図の上に重ねず、ここに開く） */}
      {showRoute && (
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-cyan-200 dark:border-slate-700 shadow-sm space-y-3" onClick={(e) => e.stopPropagation()}>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {ja
              ? '出発と目的地の単位を選ぶと、組み立て方や換算でつながる最短ルートを地図に示します。'
              : 'Pick a start and a goal to show the shortest route through recipes and conversions.'}
          </p>
          <div className="flex flex-wrap items-end gap-2">
            {([
              ['start', routeStart, setRouteStart, ja ? '出発' : 'Start'],
              ['goal', routeEnd, setRouteEnd, ja ? '目的地' : 'Goal'],
            ] as const).map(([key, value, setter, lbl]) => (
              <label key={key} className="flex-1 min-w-[140px] text-xs font-bold text-slate-600 dark:text-slate-400 space-y-1">
                <span className="block">{lbl}</span>
                <select
                  value={value}
                  onChange={(e) => {
                    sounds.playClick();
                    setter(e.target.value);
                  }}
                  className="w-full p-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-serif font-bold text-sm text-slate-800 dark:text-slate-100 outline-none"
                >
                  {RAW_UNITS.filter((u) => u.kind !== 'scale').map((u) => (
                    <option key={u.id} value={u.id}>
                      {uSym(u, lang)} - {uName(u, lang)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {route ? (
            <div className="flex items-center gap-1.5 flex-wrap p-2.5 rounded-xl bg-cyan-50 dark:bg-slate-800">
              <span className="text-xs font-bold text-cyan-800 dark:text-cyan-300 mr-1">
                {ja ? `${route.length - 1}ステップ` : `${route.length - 1} steps`}
              </span>
              {route.map((id, i) => (
                <React.Fragment key={id}>
                  <button
                    onClick={() => scrollToUnit(id)}
                    className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-700 font-serif font-bold text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-slate-600"
                  >
                    {uSym(unitsById[id], lang)}
                  </button>
                  {i < route.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-cyan-500 shrink-0" />}
                </React.Fragment>
              ))}
            </div>
          ) : (
            <p className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-400 text-center">
              {routeStart === routeEnd
                ? ja ? '出発と目的地がおなじです。' : 'Start and goal are the same.'
                : ja ? 'この向きにたどれるルートはありません。出発と目的地を入れ替えてみましょう。' : 'No route in this direction. Try swapping start and goal.'}
            </p>
          )}
        </div>
      )}

      {/* 凡例：分野（タップでその分野に出てくる単位だけ明るく）と線の見方 */}
      <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0 sm:flex-wrap">
          {REALMS.map((r) => {
            const on = realmFilter === r.id;
            return (
              <button
                key={r.id}
                onClick={() => {
                  sounds.playClick();
                  setFocusId(null);
                  setRealmFilter(on ? null : r.id);
                }}
                aria-pressed={on}
                className={`shrink-0 flex items-center gap-1.5 pl-2.5 pr-3 min-h-9 rounded-full border text-sm font-semibold whitespace-nowrap transition-colors ${
                  on
                    ? 'text-white border-transparent'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-slate-400'
                }`}
                style={on ? { background: r.color } : undefined}
              >
                <span aria-hidden className="w-2 h-2 rounded-full" style={{ background: on ? 'white' : r.color }} />
                <span>{r.icon}</span>
                <span>{realmName(r, lang)}</span>
              </button>
            );
          })}
        </div>
        {realmFilter && (
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            {(() => {
              const r = realmById[realmFilter];
              const all = RAW_UNITS.filter((u) => u.topics?.includes(r.id as UnitDefinition['realmId'])).length;
              const main = RAW_UNITS.filter((u) => u.realmId === r.id).length;
              return ja
                ? `${r.icon} ${realmName(r, lang)}で出てくる単位：${all}個（うち主な分野が${realmName(r, lang)}の単位 ${main}個）。ほかの分野の単位も、この分野で使うものは明るくなります。`
                : `${r.icon} ${all} units appear in ${realmName(r, lang)} (${main} have it as their main topic).`;
            })()}
          </p>
        )}
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
          <span>{ja ? '単位をタップ → つながりが光る（もう一度タップで詳しく）' : 'Tap a unit to light up its links (tap again for details)'}</span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded border-2 border-sky-500 bg-sky-50" />
            {ja ? '材料' : 'made from'}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded border-2 border-emerald-500 bg-emerald-50" />
            {ja ? 'この単位から作れる' : 'used to make'}
          </span>
          <span>{ja ? '実線 × かける ／ 点線 ÷ わる ／ 細かい点線 換算・目盛り' : 'solid × multiply / dashed ÷ divide / dotted conversion'}</span>
        </p>
      </div>

      {/* 地図本体 */}
      <div
        ref={contentRef}
        className="relative rounded-2xl bg-white/60 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-3 sm:p-4 overflow-x-auto"
      >
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" aria-hidden>
          <defs>
            {(Object.keys(EDGE_COLOR) as Array<keyof typeof EDGE_COLOR>).map((k) => (
              <marker key={k} id={`map-arrow-${k}`} viewBox="0 0 10 10" refX="10" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill={EDGE_COLOR[k]} />
              </marker>
            ))}
          </defs>
          {edges.map((e) => (
            <path
              key={e.id}
              d={e.d}
              fill="none"
              stroke={EDGE_COLOR[e.kind]}
              strokeWidth={e.kind === 'route' ? 3 : 2}
              strokeDasharray={e.dash || undefined}
              strokeLinecap="round"
              markerEnd={`url(#map-arrow-${e.kind})`}
              opacity={0.9}
            />
          ))}
        </svg>
        {/* ×・÷ のラベルは単位の上に出す */}
        <div className="absolute inset-0 pointer-events-none z-20" aria-hidden>
          {edges
            .filter((e) => e.label)
            .map((e) => (
              <span
                key={e.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 px-1.5 rounded-full text-xs font-bold leading-4 bg-white dark:bg-slate-900 border"
                style={{ left: e.lx, top: e.ly, color: EDGE_COLOR[e.kind], borderColor: EDGE_COLOR[e.kind] }}
              >
                {e.label}
              </span>
            ))}
        </div>

        {view === 'build' ? (
          <div className="flex flex-col md:flex-row gap-4 md:gap-3 md:min-w-[900px]">
            {BUILD_COLUMNS.map((col) => {
              // なかまの多い列（基本単位など）は、広い画面で2列に割って縦に長くなりすぎないようにする
              const rows = col.hosts.reduce((n, u) => n + 1 + Math.ceil((MEMBERS[u.id] || []).length / 2) * 0.55, 0);
              const sub = Math.max(1, Math.ceil(rows / 8.5));
              return (
                <section key={col.depth} className="md:basis-0 min-w-0" style={{ flexGrow: sub }}>
                  <h2 className="flex items-center gap-1.5 mb-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                    <span className="w-5 h-5 rounded-full bg-cyan-600 text-white flex items-center justify-center text-xs">{col.depth}</span>
                    {stepTitle(col.depth)}
                  </h2>
                  <div
                    className="grid grid-cols-3 sm:grid-cols-5 md:[grid-template-columns:var(--cols)] gap-2 items-start"
                    style={{ '--cols': `repeat(${sub}, minmax(0, 1fr))` } as React.CSSProperties}
                  >
                    {col.hosts.map(renderGroup)}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-3">
            {FIELD_GROUPS.map(({ realm, units }) => (
              <section key={realm.id} className="break-inside-avoid mb-3 p-3 rounded-xl border bg-white dark:bg-slate-900" style={{ borderColor: isDark ? realm.color + '80' : realm.borderLight }}>
                <h2 className="flex items-center gap-1.5 text-sm font-bold" style={{ color: isDark ? undefined : realm.color }}>
                  <span>{realm.icon}</span>
                  <span className="dark:text-slate-100">{realmName(realm, lang)}</span>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{units.length}</span>
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">{realmDesc(realm, lang)}</p>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-2">{units.map((u) => renderUnit(u))}</div>
              </section>
            ))}
          </div>
        )}
      </div>

      {/* 選んだ単位のカード（画面の下に固定） */}
      {focus && (
        <div
          className="fixed z-30 bottom-[calc(var(--tabbar-h)+0.75rem)] xl:bottom-6 inset-x-3 sm:left-auto sm:right-6 sm:w-[400px] p-4 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-2xl border border-slate-200 dark:border-slate-700 space-y-3"
                    onClick={(e) => e.stopPropagation()}
          role="region"
          aria-label={ja ? '選んだ単位' : 'Selected unit'}
        >
          <div className="flex items-start gap-3">
            <div className="min-w-12 h-12 px-2 rounded-xl bg-sky-50 dark:bg-sky-950 border-2 border-sky-600 flex items-center justify-center font-serif font-bold text-lg text-sky-800 dark:text-sky-200 whitespace-nowrap">
              {uSym(focus, lang)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-slate-800 dark:text-slate-100 leading-tight">{uName(focus, lang)}</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                {uQty(focus, lang)} ・ {realmById[focus.realmId]?.icon} {realmName(realmById[focus.realmId], lang)}
              </div>
              {(focus.topics || []).length > 1 && (
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  {ja ? '出てくる分野：' : 'Also in: '}
                  {(focus.topics || []).filter((t) => t !== 'base' && t !== 'scale').length >= 8
                    ? ja ? 'すべての分野' : 'every topic'
                    : (focus.topics || [])
                        .filter((id) => id !== focus.realmId)
                        .map((id) => `${realmById[id].icon}${realmName(realmById[id], lang)}`)
                        .join(ja ? '・' : ', ')}
                </div>
              )}
              <div className="mt-1 text-sm font-serif text-slate-700 dark:text-slate-200">
                {focus.forms?.[0]
                  ? `${uSym(focus, lang)} = ${recipeText(focus, lang)}`
                  : focus.kind === 'base'
                  ? ja ? 'SI基本単位（ほかの単位のもと）' : 'SI base unit'
                  : uConv(focus, lang) || (focus.kind === 'scale' ? (ja ? '単位ではない目盛り' : 'A scale, not a unit') : '')}
              </div>
            </div>
            <button onClick={() => setFocusId(null)} className="p-1 -m-1 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" aria-label={ja ? '閉じる' : 'Close'}>
              <X className="w-5 h-5" />
            </button>
          </div>

          {related && (related.inIds.size > 0 || related.outIds.size > 0) && (
            <div className="space-y-1.5 text-xs">
              {([
                ['in', related.inIds, ja ? '材料' : 'From', 'text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-700'],
                ['out', related.outIds, ja ? '作れる' : 'Makes', 'text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'],
              ] as const).map(([key, ids, lbl, cls]) =>
                ids.size > 0 ? (
                  <div key={key} className="flex items-start gap-2">
                    <span className="shrink-0 w-12 pt-0.5 font-bold text-slate-600 dark:text-slate-400">{lbl}</span>
                    <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                      {Array.from(ids).map((id) => (
                        <button
                          key={id}
                          onClick={() => {
                            sounds.playPop();
                            focusUnit(id, true);
                          }}
                          className={`px-1.5 py-0.5 rounded-md border bg-white dark:bg-slate-800 font-serif font-bold whitespace-nowrap ${cls}`}
                        >
                          {uSym(unitsById[id], lang)}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => {
                sounds.playPop();
                onSelectUnit(focus);
              }}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-bold"
            >
              <BookOpen className="w-4 h-4" />
              {ja ? '詳しく見る' : 'Details'}
            </button>
            {TARGET_IDS.has(focus.id) && (
              <button
                onClick={() => {
                  sounds.playPop();
                  onOpenTree(focus.id);
                }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold"
              >
                <GitBranch className="w-4 h-4" />
                {ja ? 'ツリー図で作り方' : 'Recipe tree'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
