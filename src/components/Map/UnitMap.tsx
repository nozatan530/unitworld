import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Search,
  Route,
  ChevronRight,
} from 'lucide-react';
import { UnitDefinition, RealmInfo } from '../../types/unit';
import {
  REALMS,
  RAW_UNITS,
  MAP_LINKS,
  unitsById,
  getAncestors,
  getDescendants,
  getUnitDim,
  formatDimSI,
  WORLD_SIZE,
  layoutWorld,
  LayoutMode,
} from '../../data/unitsData';
import { uSym, uName, uQty, realmName, unitSearchText, bySymLength } from '../../utils/i18n';
import { sounds } from '../../utils/sound';

interface UnitMapProps {
  onSelectUnit: (unit: UnitDefinition) => void;
  selectedUnit: UnitDefinition | null;
  focusedUnit: UnitDefinition | null;
  lang: 'ja' | 'en';
  isDark?: boolean;
}

// 上の操作バー（地域ワープ・検索）の高さ。地図はこの下から見せる
const TOP_BAR = 110;
// これより縮めたら、単位の代わりに「島の地図」を表示する（文字が読めない大きさになるため）
const ISLAND_BELOW = 0.5;
// 島の地図で、島ごとに大きく見せる代表的な単位
const KEY_UNITS: Record<string, string[]> = {
  base: ['m', 'kg', 's', 'A', 'K', 'mol', 'cd'],
  mechanics: ['N', 'J', 'W', 'Pa'],
  wave: ['Hz', 'nm', 'lm'],
  thermal: ['J_K', 'degC', 'cal'],
  em: ['C', 'V', 'ohm', 'T'],
  atomic: ['eV', 'Bq', 'Sv'],
  chem: ['mol_L', 'g_mol', 'pct'],
  bio: ['um', 'lx', 'mmHg'],
  earth: ['hPa', 'Gal', 'ly'],
  scale: ['pH', 'M', 'shindo'],
};
// 文字列のおおよその幅（漢字・かなは1、英数字は0.6文字分）
const textWidth = (t: string) => [...t].reduce((w, ch) => w + (/[\u3040-\u9fff\uff00-\uffef]/.test(ch) ? 1.0 : 0.6), 0);

const fitAllScale = (rect: DOMRect) =>
  Math.min((rect.width - 32) / WORLD_SIZE.width, (rect.height - TOP_BAR - 16) / WORLD_SIZE.height);

// 最初の表示：どちらも全体（島の地図）から始める。縦長の画面では島のカード一覧になる
const initialView = (rect: DOMRect, mode: LayoutMode) => {
  if (mode === 'tall') {
    const s = ISLAND_BELOW * 0.6;
    return { scale: s, pan: { x: (rect.width - WORLD_SIZE.width * s) / 2, y: TOP_BAR } };
  }
  const s = Math.min(0.9, fitAllScale(rect));
  return {
    scale: s,
    pan: { x: (rect.width - WORLD_SIZE.width * s) / 2, y: TOP_BAR + Math.max(0, (rect.height - TOP_BAR - WORLD_SIZE.height * s) / 2) },
  };
};

// 単位の枠：記号の長さから幅を決める（漢字は1文字分、英数字は約0.58文字分）
const SYM_FONT = 20;
const nodeBox = (u: UnitDefinition, lang: 'ja' | 'en') => {
  const sym = uSym(u, lang);
  const width = [...sym].reduce((w, ch) => w + (/[\u3040-\u9fff]/.test(ch) ? 1.0 : 0.6), 0) * SYM_FONT;
  return { w: Math.max(52, Math.round(width + 24)), h: 44 };
};
// 枠の中心から (tx, ty) へ向かう線が枠と交わる点（gap だけ外側）
const edgePoint = (u: UnitDefinition, tx: number, ty: number, lang: 'ja' | 'en', gap: number): [number, number] => {
  const { w, h } = nodeBox(u, lang);
  const dx = tx - u.x;
  const dy = ty - u.y;
  const len = Math.hypot(dx, dy) || 1;
  const t = Math.min(dx !== 0 ? (w / 2) / Math.abs(dx) : Infinity, dy !== 0 ? (h / 2) / Math.abs(dy) : Infinity);
  return [u.x + dx * t + (dx / len) * gap, u.y + dy * t + (dy / len) * gap];
};

// ラベルは括弧の補足を省き、長いものだけ切る
const shortQty = (q: string, lang: 'ja' | 'en') => {
  const base = q.split(/\s*[（(]/)[0].split(/[・,]/)[0];
  const max = lang === 'ja' ? 8 : 16;
  return base.length > max ? base.slice(0, max - 1) + '…' : base;
};

export const UnitMap: React.FC<UnitMapProps> = ({
  onSelectUnit,
  selectedUnit,
  focusedUnit,
  lang,
  isDark = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<LayoutMode>(WORLD_SIZE.mode);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [scale, setScale] = useState<number>(0.75);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: -280, y: -220 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredUnitId, setHoveredUnitId] = useState<string | null>(null);

  // Filters & Modes
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showPathFinder, setShowPathFinder] = useState<boolean>(false);
  const [pathStart, setPathStart] = useState<string>('kg');
  const [pathEnd, setPathEnd] = useState<string>('V');

  const rectOf = () => containerRef.current?.getBoundingClientRect();
  const minScale = () => {
    const rect = rectOf();
    if (WORLD_SIZE.mode === 'tall') return ISLAND_BELOW * 0.6;
    return rect ? Math.min(fitAllScale(rect), 0.2) * 0.8 : 0.1;
  };
  const clampScale = (v: number) => Math.min(2.5, Math.max(minScale(), v));
  // 単位が読める大きさ（縦長の画面では横幅いっぱい）
  const unitScale = () => {
    const rect = rectOf();
    return rect && WORLD_SIZE.mode === 'tall' ? Math.min(1.3, (rect.width - 16) / WORLD_SIZE.width) : 1.1;
  };

  // 画面の形（横長／縦長）に合わせて島を並べ直す
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const apply = (force: boolean) => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0) return;
      const next: LayoutMode = rect.width < 640 ? 'tall' : 'wide';
      if (!force && next === WORLD_SIZE.mode) return;
      layoutWorld(next);
      setMode(next);
      setLayoutVersion((v) => v + 1);
      const view = initialView(rect, next);
      setScale(view.scale);
      setPan(view.pan);
    };
    apply(true);
    const ro = new ResizeObserver(() => apply(false));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 島に近づく（縦長の画面は横幅に合わせ、島の上端から見せる）
  const flyToRealm = useCallback((r: RealmInfo) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    let s: number;
    if (WORLD_SIZE.mode === 'tall') s = Math.min(1.3, (rect.width - 16) / r.width);
    else s = Math.max(ISLAND_BELOW + 0.08, Math.min(1.2, (rect.width - 40) / r.width, (rect.height - TOP_BAR - 24) / r.height));
    const x = rect.width / 2 - (r.x + r.width / 2) * s;
    const fits = r.height * s <= rect.height - TOP_BAR - 16;
    const y = fits ? TOP_BAR + (rect.height - TOP_BAR - r.height * s) / 2 - r.y * s : TOP_BAR + 8 - r.y * s;
    setScale(s);
    setPan({ x, y });
  }, []);

  // 画面の中心を基準にズーム
  const zoomBy = (factor: number) => {
    const rect = rectOf();
    if (!rect) return;
    const ns = clampScale(scale * factor);
    const cx = rect.width / 2;
    const cy = (rect.height + TOP_BAR) / 2;
    setPan({ x: cx - (cx - pan.x) * (ns / scale), y: cy - (cy - pan.y) * (ns / scale) });
    setScale(ns);
  };

  // Smooth camera zoom/fly to coordinate
  const flyTo = useCallback((targetX: number, targetY: number, targetScale = 1.1) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const newPanX = rect.width / 2 - targetX * targetScale;
    const newPanY = rect.height / 2 - targetY * targetScale;
    setScale(targetScale);
    setPan({ x: newPanX, y: newPanY });
  }, []);

  // When focusedUnit changes from outside (e.g. from Detail drawer or Catalog)
  useEffect(() => {
    if (focusedUnit) {
      flyTo(focusedUnit.x, focusedUnit.y, unitScale());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedUnit, flyTo]);

  // ドラッグで移動、2本指でピンチズーム
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; scale: number; pan: { x: number; y: number }; mid: { x: number; y: number } } | null>(null);
  const pointerDist = () => {
    const [a, b] = Array.from(pointers.current.values());
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  const handleMouseDown = (e: React.PointerEvent) => {
    // Only drag with primary mouse button (touch and pen report button 0)
    if (e.button !== 0) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const rect = rectOf()!;
      const [a, b] = Array.from(pointers.current.values());
      pinch.current = {
        dist: pointerDist(),
        scale,
        pan,
        mid: { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top },
      };
      setIsDragging(false);
      return;
    }
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size >= 2) {
      const p = pinch.current;
      const ns = clampScale(p.scale * (pointerDist() / p.dist));
      setScale(ns);
      setPan({ x: p.mid.x - (p.mid.x - p.pan.x) * (ns / p.scale), y: p.mid.y - (p.mid.y - p.pan.y) * (ns / p.scale) });
      return;
    }
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = (e?: React.PointerEvent) => {
    if (e) pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 1) {
      const [p] = Array.from(pointers.current.values());
      setIsDragging(true);
      setDragStart({ x: p.x - pan.x, y: p.y - pan.y });
      return;
    }
    setIsDragging(false);
  };

  // Zoom with wheel
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    const newScale = clampScale(scale * zoomFactor);

    // Zoom centered on cursor
    const newPanX = mouseX - (mouseX - pan.x) * (newScale / scale);
    const newPanY = mouseY - (mouseY - pan.y) * (newScale / scale);

    setScale(newScale);
    setPan({ x: newPanX, y: newPanY });
  };

  // Reset camera
  const handleResetCamera = () => {
    sounds.playClick();
    const rect = rectOf();
    if (rect) {
      const view = initialView(rect, WORLD_SIZE.mode);
      setScale(view.scale);
      setPan(view.pan);
    }
  };

  // Active unit for highlighting: prioritize selectedUnit, fallback to hoveredUnitId
  const activeUnitId = selectedUnit ? selectedUnit.id : hoveredUnitId;
  const activeUnit = activeUnitId ? unitsById[activeUnitId] : null;

  // Compute related units for active unit
  const activeRelated = useMemo(() => {
    if (!activeUnit) return null;
    const incoming = new Set<string>();
    const outgoing = new Set<string>();

    const ancestors = getAncestors(activeUnit);
    ancestors.forEach((a) => incoming.add(a.unit.id));

    const descendants = getDescendants(activeUnit);
    descendants.forEach((d) => outgoing.add(d.id));

    // Also collect from explicit links
    MAP_LINKS.forEach((l) => {
      if (l.target === activeUnit.id) incoming.add(l.source);
      if (l.source === activeUnit.id) outgoing.add(l.target);
    });

    return { incoming, outgoing };
  }, [activeUnit]);

  // BFS Path Finder
  const calculatedPath = useMemo(() => {
    if (!showPathFinder || !pathStart || !pathEnd || pathStart === pathEnd) return null;

    // Adjacency graph
    const adj: Record<string, string[]> = {};
    RAW_UNITS.forEach((u) => {
      adj[u.id] = [];
    });
    MAP_LINKS.forEach((l) => {
      if (!adj[l.source]) adj[l.source] = [];
      adj[l.source].push(l.target);
    });

    // BFS queue
    const queue: Array<{ id: string; path: string[] }> = [{ id: pathStart, path: [pathStart] }];
    const visited = new Set<string>([pathStart]);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (curr.id === pathEnd) {
        return curr.path;
      }
      for (const nextId of adj[curr.id] || []) {
        if (!visited.has(nextId)) {
          visited.add(nextId);
          queue.push({ id: nextId, path: [...curr.path, nextId] });
        }
      }
    }
    return null;
  }, [showPathFinder, pathStart, pathEnd]);

  const pathEdgeSet = useMemo(() => {
    if (!calculatedPath || calculatedPath.length < 2) return new Set<string>();
    const set = new Set<string>();
    for (let i = 0; i < calculatedPath.length - 1; i++) {
      set.add(`${calculatedPath[i]}->${calculatedPath[i + 1]}`);
    }
    return set;
  }, [calculatedPath]);

  // Handle Search input
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return RAW_UNITS.filter((u) => unitSearchText(u).includes(q)).slice(0, 5);
  }, [searchQuery]);

  const islandMode = scale < ISLAND_BELOW;

  // 島どうしのつながり：単位の線を島ごとにまとめて数える
  const realmLinks = useMemo(() => {
    const m = new Map<string, { a: string; b: string; count: number }>();
    MAP_LINKS.forEach((l) => {
      const ra = unitsById[l.source]?.realmId;
      const rb = unitsById[l.target]?.realmId;
      if (!ra || !rb || ra === rb) return;
      const [a, b] = [ra, rb].sort();
      const key = `${a}|${b}`;
      const cur = m.get(key) || { a, b, count: 0 };
      cur.count += 1;
      m.set(key, cur);
    });
    return Array.from(m.values());
  }, []);

  const handleSelectSearchResult = (unit: UnitDefinition) => {
    sounds.playPop();
    setSearchQuery('');
    flyTo(unit.x, unit.y, unitScale());
    onSelectUnit(unit);
  };

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-[#F6F8FA] dark:bg-[#0B1015]">
      {/* Background World Grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-20"
        style={{
          backgroundImage:
            'radial-gradient(#94A3B8 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Top Floating Controls Bar */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left: Island Realm Teleports */}
        <div className="flex items-center gap-1 p-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl shadow-md border border-amber-200/60 dark:border-slate-800 pointer-events-auto overflow-x-auto max-w-[85vw] sm:max-w-none scrollbar-none">
          <span className="text-xs font-bold px-2 py-1 text-slate-400 dark:text-slate-500 whitespace-nowrap">
            {lang === 'ja' ? '🗺️ 地域ワープ:' : '🗺️ Islands:'}
          </span>
          {REALMS.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                sounds.playPop(520);
                flyToRealm(r);
              }}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-300 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-100/60 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <span>{r.icon}</span>
              <span>{realmName(r, lang)}</span>
            </button>
          ))}
        </div>

        {/* Right: Search & PathFinder Toggle */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Path Finder Toggle Button */}
          <button
            onClick={() => {
              sounds.playClick();
              setShowPathFinder(!showPathFinder);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md ${
              showPathFinder
                ? 'bg-amber-500 text-white shadow-amber-500/25 ring-2 ring-amber-400'
                : 'bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 border border-amber-200/60 dark:border-slate-800 hover:bg-amber-50'
            }`}
          >
            <Route className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{lang === 'ja' ? 'つながり探索' : 'Route Finder'}</span>
          </button>

          {/* Quick Search Input */}
          <div className="relative">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-md border border-amber-200/60 dark:border-slate-800 text-xs">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={lang === 'ja' ? '単位を検索 (N, 圧力, J...)' : 'Search unit...'}
                className="w-32 sm:w-44 bg-transparent outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400 text-xs"
              />
            </div>

            {/* Search Dropdown Results */}
            {searchResults.length > 0 && (
              <div className="absolute right-0 top-full mt-1.5 w-56 p-1.5 rounded-xl bg-white dark:bg-slate-800 shadow-xl border border-amber-200/60 dark:border-slate-700 space-y-1">
                {searchResults.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleSelectSearchResult(u)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left hover:bg-amber-50 dark:hover:bg-slate-700 text-xs transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-serif font-bold text-amber-600 dark:text-amber-400">{uSym(u, lang)}</span>
                      <span className="font-medium text-slate-700 dark:text-slate-200 truncate">{uName(u, lang)}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">{uQty(u, lang)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Path Finder Floating Panel */}
      {showPathFinder && (
        <div className="absolute top-16 right-3 z-20 w-80 p-4 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-xl border border-amber-200/80 dark:border-slate-700 text-xs space-y-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <Route className="w-4 h-4 text-amber-500" />
              <span>{lang === 'ja' ? '単位ハイウェイ探索' : 'Unit Highway Finder'}</span>
            </span>
            <button
              onClick={() => setShowPathFinder(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              ✕
            </button>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {lang === 'ja'
              ? '出発と目的地の単位を選ぶと、組み立て方や換算でつながる最短ルートを地図上に表示します。'
              : 'Pick a start and a goal unit to show the shortest route through formulas and conversions.'}
          </p>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-slate-400 block mb-1">
                {lang === 'ja' ? '出発 (Start)' : 'Start Unit'}
              </label>
              <select
                value={pathStart}
                onChange={(e) => {
                  sounds.playClick();
                  setPathStart(e.target.value);
                }}
                className="w-full p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-serif font-bold text-amber-600 text-xs outline-none"
              >
                {RAW_UNITS.filter((u) => u.kind !== 'scale').map((u) => (
                  <option key={u.id} value={u.id}>
                    {uSym(u, lang)} - {uName(u, lang)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 block mb-1">
                {lang === 'ja' ? '目的地 (Goal)' : 'Target Unit'}
              </label>
              <select
                value={pathEnd}
                onChange={(e) => {
                  sounds.playClick();
                  setPathEnd(e.target.value);
                }}
                className="w-full p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-serif font-bold text-emerald-600 text-xs outline-none"
              >
                {RAW_UNITS.filter((u) => u.kind !== 'scale').map((u) => (
                  <option key={u.id} value={u.id}>
                    {uSym(u, lang)} - {uName(u, lang)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Path Steps */}
          {calculatedPath ? (
            <div className="p-2.5 rounded-xl bg-amber-50/80 dark:bg-slate-800/80 border border-amber-200/60 dark:border-slate-700 space-y-1.5">
              <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 block">
                {lang === 'ja'
                  ? `ルート（${calculatedPath.length - 1} ステップ）`
                  : `Route (${calculatedPath.length - 1} steps)`}
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {calculatedPath.map((id, idx) => {
                  const u = unitsById[id];
                  return (
                    <React.Fragment key={id}>
                      <button
                        onClick={() => {
                          sounds.playPop();
                          flyTo(u.x, u.y, 1.2);
                          onSelectUnit(u);
                        }}
                        className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-700 font-serif font-bold text-amber-700 dark:text-amber-300 shadow-2xs hover:scale-105 transition-transform"
                      >
                        {uSym(u, lang)}
                      </button>
                      {idx < calculatedPath.length - 1 && (
                        <ChevronRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-[11px] text-slate-400 text-center">
              {lang === 'ja' ? 'この向きにたどれるルートはありません。出発と目的地を入れ替えてみましょう。' : 'No route in this direction. Try swapping start and goal.'}
            </div>
          )}
        </div>
      )}

      {/* Floating Legend / Active Inspector Pill */}
      {activeUnit && (
        <div className="absolute bottom-4 left-4 z-20 max-w-sm p-3.5 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-xl border border-amber-200/80 dark:border-slate-700 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-3">
            <div className={`min-w-12 h-12 px-2 shrink-0 whitespace-nowrap rounded-xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-400/40 flex items-center justify-center font-serif font-bold text-amber-600 dark:text-amber-300 ${bySymLength(uSym(activeUnit, lang), 'text-xl', 'text-lg', 'text-base')}`}>
              {uSym(activeUnit, lang)}
            </div>
            <div>
              <div className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-tight">
                {uName(activeUnit, lang)}
              </div>
              <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                {uQty(activeUnit, lang)}
              </div>
              <div className="text-[10px] text-slate-400">
                {formatDimSI(getUnitDim(activeUnit), lang)}
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              sounds.playPop();
              onSelectUnit(activeUnit);
            }}
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm shadow-amber-500/30 transition-transform active:scale-95 shrink-0"
          >
            {lang === 'ja' ? '詳細を見る' : 'Inspect'}
          </button>
        </div>
      )}

      {/* スマホ（縦長）の全体像：島のカードを2列で並べる */}
      {islandMode && mode === 'tall' && (
        <div className="absolute inset-x-0 bottom-0 z-10 overflow-y-auto px-3 pb-20" style={{ top: TOP_BAR }}>
          <div className="grid grid-cols-2 gap-2.5">
            {REALMS.map((r) => {
              const count = RAW_UNITS.filter((u) => u.realmId === r.id).length;
              const syms = (KEY_UNITS[r.id] || []).map((id) => unitsById[id]).filter(Boolean).map((u) => uSym(u, lang));
              return (
                <button
                  key={r.id}
                  onClick={() => {
                    sounds.playPop(520);
                    flyToRealm(r);
                  }}
                  className="text-left p-3 rounded-2xl border-2 bg-white/95 dark:bg-slate-900/95 shadow-sm active:scale-[0.98] transition-transform"
                  style={{ borderColor: r.color }}
                >
                  <div className="font-black text-[15px] leading-tight" style={{ color: r.color }}>
                    {r.icon} {realmName(r, lang)}
                  </div>
                  <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                    {lang === 'ja' ? `${count} 単位` : `${count} units`}
                  </div>
                  <div className="font-serif font-bold text-lg text-slate-800 dark:text-slate-100 mt-1 leading-snug">
                    {syms.join('  ')}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* スマホで島に近づいているとき：カード一覧へ戻るボタン */}
      {!islandMode && mode === 'tall' && !activeUnit && (
        <button
          onClick={() => {
            sounds.playClick();
            handleResetCamera();
          }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2.5 rounded-full bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 shadow-lg text-sm font-bold whitespace-nowrap"
        >
          🗺️ {lang === 'ja' ? '島の一覧へ' : 'All islands'}
        </button>
      )}

      {/* 島の地図のときの案内 */}
      {islandMode && mode === 'wide' && !activeUnit && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-full bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 shadow-md text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap pointer-events-none">
          {lang === 'ja' ? '島をタップすると、単位が見えるところまで近づきます' : 'Tap an island to zoom in to its units'}
        </div>
      )}

      {/* Zoom / Navigation Float Controls */}
      <div
        style={{ display: islandMode && mode === 'tall' ? 'none' : undefined }}
        className="absolute bottom-4 right-4 z-20 flex flex-col gap-1.5 p-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl shadow-lg border border-amber-200/60 dark:border-slate-800">
        <button
          onClick={() => {
            sounds.playClick();
            zoomBy(1.25);
          }}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-amber-100 dark:hover:bg-slate-800 transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            sounds.playClick();
            zoomBy(0.8);
          }}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-amber-100 dark:hover:bg-slate-800 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleResetCamera}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-amber-100 dark:hover:bg-slate-800 transition-colors"
          title="Reset View"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Pan/Zoom Interactive SVG Canvas */}
      <div
        ref={containerRef}
        onPointerDown={handleMouseDown}
        onPointerMove={handleMouseMove}
        onPointerUp={handleMouseUp}
        onPointerLeave={handleMouseUp}
        onPointerCancel={handleMouseUp}
        onWheel={handleWheel}
        className={`w-full h-full cursor-${isDragging ? 'grabbing' : 'grab'}`}
      >
        <svg
          width="100%"
          height="100%"
          className="w-full h-full"
          style={{ touchAction: 'none' }}
        >
          <defs>
            {/* 矢印：大きさは線の太さに関係なく一定。先端（refX=10）が線の終点にぴったり重なる */}
            <marker id="arrow-default" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="11" markerHeight="11" markerUnits="userSpaceOnUse" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#94A3B8" />
            </marker>
            <marker id="arrow-incoming" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="14" markerHeight="14" markerUnits="userSpaceOnUse" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#0284C7" />
            </marker>
            <marker id="arrow-outgoing" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="14" markerHeight="14" markerUnits="userSpaceOnUse" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#10B981" />
            </marker>
            <marker id="arrow-path" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="15" markerHeight="15" markerUnits="userSpaceOnUse" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#06B6D4" />
            </marker>
          </defs>

          {/* World Container with dynamic pan & scale */}
          <g
            transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}
            data-layout={layoutVersion}
            style={{ display: islandMode && mode === 'tall' ? 'none' : undefined }}
          >
            {/* 0. 島の地図：島どうしのつながり（島の下に描き、すき間に橋のように見せる） */}
            {islandMode &&
              realmLinks.map((l) => {
                const a = REALMS.find((r) => r.id === l.a)!;
                const b = REALMS.find((r) => r.id === l.b)!;
                return (
                  <line
                    key={`${l.a}-${l.b}`}
                    x1={a.x + a.width / 2}
                    y1={a.y + a.height / 2}
                    x2={b.x + b.width / 2}
                    y2={b.y + b.height / 2}
                    stroke={isDark ? '#475569' : '#94A3B8'}
                    strokeWidth={Math.min(14, 2 + l.count * 0.8) / scale}
                    strokeLinecap="round"
                    opacity={0.55}
                  />
                );
              })}

            {/* 1. Island Landmasses (Organic Rounded Realms) */}
            {REALMS.map((r) => (
              <g
                key={r.id}
                onClick={islandMode ? () => { sounds.playPop(520); flyToRealm(r); } : undefined}
                className={islandMode ? 'cursor-pointer' : undefined}
              >
                {/* Realm Soft Shadow / Landmass */}
                <rect
                  x={r.x}
                  y={r.y}
                  width={r.width}
                  height={r.height}
                  rx="48"
                  fill={isDark ? r.bgDark : r.bgLight}
                  stroke={isDark ? r.color : r.borderLight}
                  strokeWidth={isDark ? "1.5" : "2.5"}
                  opacity={isDark ? 0.45 : 0.95}
                  className="transition-colors duration-300"
                  style={{
                    filter: 'drop-shadow(0 12px 24px rgba(0,0,0,0.03))',
                  }}
                />

                {/* 島の名前（近づいたとき）：縮小しても読める大きさを保つ */}
                {!islandMode && (() => {
                  const fs = Math.min(28, Math.max(16, 12 / scale));
                  const label = `${r.icon} ${realmName(r, lang)}`;
                  const w = Math.min(r.width - 40, textWidth(label) * fs + fs * 2);
                  return (
                    <g transform={`translate(${r.x + 20}, ${r.y + 14})`}>
                      <rect x="0" y="0" width={w} height={fs * 2.1} rx={fs * 1.05} fill={isDark ? '#1E293B' : 'white'} stroke={isDark ? '#334155' : r.borderLight} strokeWidth="1.5" />
                      <text x={fs * 0.9} y={fs * 1.42} fontSize={fs} fontWeight="800" fill={isDark ? '#F8FAFC' : r.color} fontFamily="Zen Kaku Gothic New, sans-serif">
                        {label}
                      </text>
                    </g>
                  );
                })()}

                {/* 島の地図（遠くから見たとき）：島の名前・単位の数・代表的な記号を大きく */}
                {islandMode && (() => {
                  const name = `${r.icon} ${realmName(r, lang)}`;
                  const count = RAW_UNITS.filter((u) => u.realmId === r.id).length;
                  const symList = (KEY_UNITS[r.id] || []).map((id) => unitsById[id]).filter(Boolean).map((u) => uSym(u, lang));
                  // 記号が多い島（基本単位）は2行に分ける
                  const lines = symList.length > 4 ? [symList.slice(0, 4).join('  '), symList.slice(4).join('  ')] : [symList.join('  ')];
                  const maxW = r.width * 0.86;
                  const f1 = Math.min(24 / scale, maxW / textWidth(name));
                  const f2 = f1 * 0.62;
                  const f3 = Math.min(30 / scale, ...lines.map((l) => maxW / textWidth(l)), r.height * 0.22);
                  const total = f1 * 1.25 + f2 * 1.6 + f3 * 1.2 * lines.length;
                  const top = r.y + (r.height - total) / 2;
                  const cx = r.x + r.width / 2;
                  return (
                    <g className="pointer-events-none select-none" fontFamily="Zen Kaku Gothic New, sans-serif" textAnchor="middle">
                      <text x={cx} y={top + f1} fontSize={f1} fontWeight="900" fill={isDark ? '#F8FAFC' : r.color}>
                        {name}
                      </text>
                      <text x={cx} y={top + f1 * 1.25 + f2 * 1.2} fontSize={f2} fontWeight="700" fill={isDark ? '#CBD5E1' : '#475569'}>
                        {lang === 'ja' ? `${count} 単位` : `${count} units`}
                      </text>
                      {lines.map((l, i) => (
                        <text key={i} x={cx} y={top + f1 * 1.25 + f2 * 1.6 + f3 * (1 + i * 1.2)} fontSize={f3} fontWeight="700" fontFamily="STIX Two Text, Georgia, serif" fill={isDark ? '#E2E8F0' : '#1E293B'}>
                          {l}
                        </text>
                      ))}
                    </g>
                  );
                })()}
              </g>
            ))}

            {/* 2. Map Connection Links / Roads */}
            {!islandMode && (
            <g className="links-layer">
              {MAP_LINKS.map((link) => {
                const src = unitsById[link.source];
                const tgt = unitsById[link.target];
                if (!src || !tgt) return null;

                // Determine highlight state
                const isIncoming = activeUnit && link.target === activeUnit.id;
                const isOutgoing = activeUnit && link.source === activeUnit.id;
                const isPathEdge = pathEdgeSet.has(`${link.source}->${link.target}`);
                // 縦長の画面では、ほかの島へ向かう長い線は選んだ単位のものだけ描く（縦に何本も走って読みにくくなるため）
                if (mode === 'tall' && src.realmId !== tgt.realmId && !isIncoming && !isOutgoing && !isPathEdge) return null;

                const isConv = link.op === 'conv' || link.op === 'log';
                let strokeColor = isConv ? '#94A3B8' : '#CBD5E1';
                let strokeWidth = 1.5;
                let strokeDash = isConv ? '5 5' : 'none';
                let markerEnd = 'url(#arrow-default)';
                let opacity = isConv ? 0.45 : 0.3;

                if (isPathEdge) {
                  strokeColor = '#06B6D4';
                  strokeWidth = 4;
                  strokeDash = '6 4';
                  markerEnd = 'url(#arrow-path)';
                  opacity = 1;
                } else if (isIncoming) {
                  strokeColor = '#0284C7';
                  strokeWidth = 3;
                  if (isConv) strokeDash = '6 4';
                  markerEnd = 'url(#arrow-incoming)';
                  opacity = 1;
                } else if (isOutgoing) {
                  strokeColor = '#10B981';
                  strokeWidth = 3;
                  if (isConv) strokeDash = '6 4';
                  markerEnd = 'url(#arrow-outgoing)';
                  opacity = 1;
                } else if (activeUnit) {
                  // Dim unrelated links
                  opacity = 0.12;
                }

                // 単位の枠の端から端へまっすぐ結ぶ（矢印の先が枠に当たる）
                const [x1, y1] = edgePoint(src, tgt.x, tgt.y, lang, 3);
                const [x2, y2] = edgePoint(tgt, src.x, src.y, lang, 3);
                const pathData = `M ${x1} ${y1} L ${x2} ${y2}`;

                return (
                  <g key={link.id}>
                    <path
                      d={pathData}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      strokeDasharray={strokeDash}
                      markerEnd={markerEnd}
                      opacity={opacity}
                      className="transition-all duration-200"
                    />
                    {/* Optional operation label when highlighted */}
                    {(isIncoming || isOutgoing || isPathEdge) && (
                      <text
                        x={(x1 + x2) / 2}
                        y={(y1 + y2) / 2 - 6}
                        fill={isPathEdge ? '#0E7490' : isIncoming ? '#0369A1' : '#047857'}
                        fontSize="12"
                        fontWeight="800"
                        textAnchor="middle"
                        className="bg-white/80 select-none font-bold"
                      >
                        {link.op === 'conv'
                          ? lang === 'ja' ? '換算' : 'convert'
                          : link.op === 'log'
                          ? lang === 'ja' ? '対数・目安' : 'log / rough'
                          : link.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>

            )}

            {/* 3. Pop Unit Nodes */}
            {!islandMode && (
            <g className="nodes-layer">
              {RAW_UNITS.map((u) => {
                const isSelected = selectedUnit?.id === u.id;
                const isHovered = hoveredUnitId === u.id;
                const isBase = u.kind === 'base';
                const isScale = u.kind === 'scale';

                // Relationship status to active unit
                const isIncoming = activeRelated?.incoming.has(u.id);
                const isOutgoing = activeRelated?.outgoing.has(u.id);
                const isInPath = calculatedPath ? calculatedPath.includes(u.id) : false;

                // Dimming when something is active and this node is unrelated
                let nodeOpacity = 1;
                if (activeUnit && activeUnit.id !== u.id && !isIncoming && !isOutgoing && !isInPath) {
                  nodeOpacity = 0.28;
                }

                // 枠の大きさは記号の長さに合わせる
                const box = nodeBox(u, lang);

                // Node fill & ring color
                let ringColor = isBase ? '#475569' : '#CBD5E1';
                let ringWidth = isBase ? 3 : 1.5;

                if (isSelected) {
                  ringColor = '#0284C7';
                  ringWidth = 3.5;
                } else if (isInPath) {
                  ringColor = '#06B6D4';
                  ringWidth = 3.5;
                } else if (isIncoming) {
                  ringColor = '#0284C7';
                  ringWidth = 3;
                } else if (isOutgoing) {
                  ringColor = '#10B981';
                  ringWidth = 3;
                }

                return (
                  <g
                    key={u.id}
                    transform={`translate(${u.x}, ${u.y})`}
                    opacity={nodeOpacity}
                    onClick={() => {
                      sounds.playPop();
                      onSelectUnit(u);
                    }}
                    onMouseEnter={() => setHoveredUnitId(u.id)}
                    onMouseLeave={() => setHoveredUnitId(null)}
                    className="cursor-pointer select-none"
                  >
                    {/* Scale Tag Badge */}
                    {isScale && (
                      <g transform={`translate(0, ${-box.h / 2 - 12})`}>
                        <rect x="-24" y="-8" width="48" height="16" rx="8" fill="#F5F5F4" stroke="#78716C" strokeWidth="1" />
                        <text x="0" y="3.5" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#57534E">
                          {lang === 'ja' ? '目盛り' : 'scale'}
                        </text>
                      </g>
                    )}

                    {/* 単位の枠（基本単位は太い濃い枠） */}
                    <rect
                      x={-box.w / 2 - (isHovered ? 2 : 0)}
                      y={-box.h / 2 - (isHovered ? 2 : 0)}
                      width={box.w + (isHovered ? 4 : 0)}
                      height={box.h + (isHovered ? 4 : 0)}
                      rx={box.h / 2}
                      fill={isDark ? (isBase ? '#334155' : '#1E293B') : isBase ? '#F1F5F9' : 'white'}
                      stroke={ringColor}
                      strokeWidth={ringWidth}
                      className="transition-colors pointer-events-none"
                      style={{
                        filter: isSelected || isInPath || isHovered
                          ? 'drop-shadow(0 6px 16px rgba(2, 132, 199, 0.3))'
                          : 'drop-shadow(0 3px 6px rgba(0,0,0,0.06))',
                      }}
                    />

                    {/* Stable invisible hit target */}
                    <rect x={-box.w / 2 - 10} y={-box.h / 2 - 10} width={box.w + 20} height={box.h + 20} rx={box.h / 2 + 10} fill="transparent" className="cursor-pointer" />

                    {/* Center Symbol */}
                    <text
                      x="0"
                      y="6.5"
                      textAnchor="middle"
                      fontFamily="STIX Two Text, Georgia, serif"
                      fontWeight="bold"
                      fontSize={SYM_FONT}
                      fill={
                        isBase
                          ? isDark ? '#E2E8F0' : '#334155'
                          : isSelected
                          ? '#0369A1'
                          : isDark
                          ? '#F1F5F9'
                          : '#1E293B'
                      }
                      className="select-none pointer-events-none"
                    >
                      {uSym(u, lang)}
                    </text>

                    {/* Bottom Quantity Pill Label */}
                    {scale >= 0.7 && (
                    <g transform={`translate(0, ${box.h / 2 + 16})`} className="pointer-events-none">
                      <rect
                        x="-66"
                        y="-12"
                        width="132"
                        height="24"
                        rx="12"
                        fill={isDark ? "rgba(30, 41, 59, 0.95)" : "rgba(255, 255, 255, 0.95)"}
                        stroke={isDark ? "#334155" : "#CBD5E1"}
                        strokeWidth="1"
                      />
                      <text
                        x="0"
                        y="4"
                        textAnchor="middle"
                        fontSize="14"
                        fontWeight="600"
                        fill={isDark ? "#CBD5E1" : "#334155"}
                        className="select-none"
                      >
                        {shortQty(uQty(u, lang), lang)}
                      </text>
                    </g>
                    )}
                  </g>
                );
              })}
            </g>
            )}
          </g>
        </svg>
      </div>
    </div>
  );
};
