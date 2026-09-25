import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Search,
  Route,
  ChevronRight,
} from 'lucide-react';
import { UnitDefinition } from '../../types/unit';
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
} from '../../data/unitsData';
import { uSym, uName, uQty, realmName, unitSearchText } from '../../utils/i18n';
import { sounds } from '../../utils/sound';

interface UnitMapProps {
  onSelectUnit: (unit: UnitDefinition) => void;
  selectedUnit: UnitDefinition | null;
  focusedUnit: UnitDefinition | null;
  lang: 'ja' | 'en';
  isDark?: boolean;
}

// 画面に地図全体が収まる倍率と位置
const fitWorld = (rect: DOMRect) => {
  const s = Math.max(0.14, Math.min((rect.width - 32) / WORLD_SIZE.width, (rect.height - 120) / WORLD_SIZE.height, 0.9));
  return { scale: s, pan: { x: (rect.width - WORLD_SIZE.width * s) / 2, y: 70 + (rect.height - 70 - WORLD_SIZE.height * s) / 2 } };
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
      flyTo(focusedUnit.x, focusedUnit.y, 1.15);
    }
  }, [focusedUnit, flyTo]);

  // Initial centering
  useEffect(() => {
    if (containerRef.current) {
      const fit = fitWorld(containerRef.current.getBoundingClientRect());
      setScale(fit.scale);
      setPan(fit.pan);
    }
  }, []);

  // Pan interaction
  const handleMouseDown = (e: React.PointerEvent) => {
    // Only drag with primary mouse button (touch and pen report button 0)
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
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
    const newScale = Math.min(Math.max(0.14, scale * zoomFactor), 2.5);

    // Zoom centered on cursor
    const newPanX = mouseX - (mouseX - pan.x) * (newScale / scale);
    const newPanY = mouseY - (mouseY - pan.y) * (newScale / scale);

    setScale(newScale);
    setPan({ x: newPanX, y: newPanY });
  };

  // Reset camera
  const handleResetCamera = () => {
    sounds.playClick();
    if (containerRef.current) {
      const fit = fitWorld(containerRef.current.getBoundingClientRect());
      setScale(fit.scale);
      setPan(fit.pan);
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

  const handleSelectSearchResult = (unit: UnitDefinition) => {
    sounds.playPop();
    setSearchQuery('');
    flyTo(unit.x, unit.y, 1.2);
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
                flyTo(r.x + r.width / 2, r.y + r.height / 2, 0.95);
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
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-400/40 flex items-center justify-center font-serif font-bold text-xl text-amber-600 dark:text-amber-300">
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

      {/* Zoom / Navigation Float Controls */}
      <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-1.5 p-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl shadow-lg border border-amber-200/60 dark:border-slate-800">
        <button
          onClick={() => {
            sounds.playClick();
            setScale((s) => Math.min(2.5, s * 1.2));
          }}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-amber-100 dark:hover:bg-slate-800 transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            sounds.playClick();
            setScale((s) => Math.max(0.14, s * 0.83));
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
            {/* Custom Arrow Markers */}
            <marker
              id="arrow-default"
              viewBox="0 0 10 10"
              refX="18"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#94A3B8" opacity="0.6" />
            </marker>
            <marker
              id="arrow-incoming"
              viewBox="0 0 10 10"
              refX="18"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 9 5 L 0 9 z" fill="#0284C7" />
            </marker>
            <marker
              id="arrow-outgoing"
              viewBox="0 0 10 10"
              refX="18"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 9 5 L 0 9 z" fill="#10B981" />
            </marker>
            <marker
              id="arrow-path"
              viewBox="0 0 10 10"
              refX="18"
              refY="5"
              markerWidth="8"
              markerHeight="8"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#06B6D4" />
            </marker>
          </defs>

          {/* World Container with dynamic pan & scale */}
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
            {/* 1. Island Landmasses (Organic Rounded Realms) */}
            {REALMS.map((r) => (
              <g key={r.id}>
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

                {/* Realm Header Label Banner */}
                <g transform={`translate(${r.x + 24}, ${r.y + 36})`}>
                  <rect
                    x="0"
                    y="-22"
                    width={Math.min(r.width - 48, 320)}
                    height="36"
                    rx="18"
                    fill={isDark ? "#1E293B" : "white"}
                    stroke={isDark ? "#334155" : r.borderLight}
                    strokeWidth="1.5"
                    className="shadow-xs"
                  />
                  <text
                    x="16"
                    y="2"
                    fontSize="15"
                    fontWeight="800"
                    fill={isDark ? '#F8FAFC' : r.color}
                    fontFamily="Zen Kaku Gothic New, sans-serif"
                  >
                    {r.icon} {realmName(r, lang)}
                  </text>
                </g>
              </g>
            ))}

            {/* 2. Map Connection Links / Roads */}
            <g className="links-layer">
              {MAP_LINKS.map((link) => {
                const src = unitsById[link.source];
                const tgt = unitsById[link.target];
                if (!src || !tgt) return null;

                // Determine highlight state
                const isIncoming = activeUnit && link.target === activeUnit.id;
                const isOutgoing = activeUnit && link.source === activeUnit.id;
                const isPathEdge = pathEdgeSet.has(`${link.source}->${link.target}`);

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

                // Curved bezier path between source and target
                const dx = tgt.x - src.x;
                const dy = tgt.y - src.y;
                const cx1 = src.x + dx * 0.45;
                const cy1 = src.y;
                const cx2 = src.x + dx * 0.55;
                const cy2 = tgt.y;

                const pathData = `M ${src.x} ${src.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${tgt.x} ${tgt.y}`;

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
                        x={(src.x + tgt.x) / 2}
                        y={(src.y + tgt.y) / 2 - 6}
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

            {/* 3. Pop Unit Nodes */}
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

                // Node size
                const radius = isBase ? 32 : isSelected ? 30 : 26;

                // Node fill & ring color
                let ringColor = isBase ? '#475569' : '#CBD5E1';
                let ringWidth = isBase ? 3.5 : 2;

                if (isSelected) {
                  ringColor = '#0284C7';
                  ringWidth = 4;
                } else if (isInPath) {
                  ringColor = '#06B6D4';
                  ringWidth = 4;
                } else if (isIncoming) {
                  ringColor = '#0284C7';
                  ringWidth = 3.5;
                } else if (isOutgoing) {
                  ringColor = '#10B981';
                  ringWidth = 3.5;
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
                    {/* Golden Crown / Base Unit Star Badge */}
                    {isBase && (
                      <g transform="translate(0, -36)">
                        <circle cx="0" cy="0" r="10" fill="#F1F5F9" stroke="#475569" strokeWidth="1.5" />
                        <text
                          x="0"
                          y="3.5"
                          textAnchor="middle"
                          fontSize="10"
                          fontWeight="bold"
                          fill="#475569"
                        >
                          ★
                        </text>
                      </g>
                    )}

                    {/* Scale Tag Badge */}
                    {isScale && (
                      <g transform="translate(0, -32)">
                        <rect x="-24" y="-8" width="48" height="16" rx="8" fill="#F5F5F4" stroke="#78716C" strokeWidth="1" />
                        <text x="0" y="3.5" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#57534E">
                          {lang === 'ja' ? '目盛り' : 'scale'}
                        </text>
                      </g>
                    )}

                    {/* Main Node Circle */}
                    <circle
                      cx="0"
                      cy="0"
                      r={isHovered ? radius + 2 : radius}
                      fill={isDark ? "#1E293B" : "white"}
                      stroke={ringColor}
                      strokeWidth={isHovered ? ringWidth + 1 : ringWidth}
                      className="transition-colors shadow-sm pointer-events-none"
                      style={{
                        filter: isSelected || isInPath || isHovered
                          ? 'drop-shadow(0 6px 16px rgba(234, 88, 12, 0.35))'
                          : 'drop-shadow(0 4px 8px rgba(0,0,0,0.06))',
                      }}
                    />

                    {/* Stable invisible hit target to prevent any micro-edge mouseleave flicker */}
                    <circle
                      cx="0"
                      cy="0"
                      r={radius + 12}
                      fill="transparent"
                      className="cursor-pointer"
                    />

                    {/* Center Symbol */}
                    <text
                      x="0"
                      y={uSym(u, lang).length > 3 ? "2" : "5"}
                      textAnchor="middle"
                      fontFamily="STIX Two Text, Georgia, serif"
                      fontWeight="bold"
                      fontSize={uSym(u, lang).length > 5 ? "13" : uSym(u, lang).length > 3 ? "15" : "19"}
                      fill={
                        isBase
                          ? isDark ? '#E2E8F0' : '#334155'
                          : isSelected
                          ? '#0284C7'
                          : isDark
                          ? '#F1F5F9'
                          : '#1E293B'
                      }
                      className="select-none pointer-events-none"
                    >
                      {uSym(u, lang)}
                    </text>

                    {/* Bottom Quantity Pill Label */}
                    <g transform={`translate(0, ${radius + 14})`} className="pointer-events-none">
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
                        fontSize="13"
                        fontWeight="600"
                        fill={isDark ? "#CBD5E1" : "#334155"}
                        className="select-none"
                      >
                        {shortQty(uQty(u, lang), lang)}
                      </text>
                    </g>
                  </g>
                );
              })}
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
};
