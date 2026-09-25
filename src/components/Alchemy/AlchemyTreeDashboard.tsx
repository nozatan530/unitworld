import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { GitBranch, Clock, Trash2, Sparkles, RefreshCw, ZoomIn, ZoomOut, RotateCcw, Filter, ExternalLink } from 'lucide-react';
import { UnitDefinition, AlchemyHistoryRecord } from '../../types/unit';
import { getAlchemyHistory, clearAlchemyHistory, SAMPLE_HISTORY } from '../../utils/alchemyHistory';
import { uSym, uName } from '../../utils/i18n';
import { unitsById } from '../../data/unitsData';
import { sounds } from '../../utils/sound';

interface AlchemyTreeDashboardProps {
  onSelectUnit: (unit: UnitDefinition) => void;
  onLoadRecipe?: (ingredients: Array<{ id: string; exp: number }>) => void;
  lang: 'ja' | 'en';
  isDark?: boolean;
}

interface D3Node extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  sym: string;
  type: 'base' | 'intermediate' | 'product';
  unitId?: string;
  dimSI: string;
  count: number;
  depth: number;
}

interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  source: string | D3Node;
  target: string | D3Node;
  op: 'mul' | 'div';
  exp: number;
  count: number;
}

export const AlchemyTreeDashboard: React.FC<AlchemyTreeDashboardProps> = ({
  onSelectUnit,
  onLoadRecipe,
  lang,
  isDark = false,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [history, setHistory] = useState<AlchemyHistoryRecord[]>(() => getAlchemyHistory());
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'named'>('all');
  const [hoveredNode, setHoveredNode] = useState<D3Node | null>(null);

  // Reload history
  const reloadHistory = () => {
    sounds.playClick();
    const updated = getAlchemyHistory();
    setHistory(updated);
  };

  const handleClearHistory = () => {
    if (window.confirm(lang === 'ja' ? '合成履歴をリセットしますか？' : 'Reset alchemy synthesis history?')) {
      sounds.playBonk();
      clearAlchemyHistory();
      setHistory(getAlchemyHistory());
    }
  };

  // まだ自分の記録がないときは見本を表示する
  const isSample = history.length === 0;
  const filteredHistory = useMemo(() => {
    const list = isSample ? SAMPLE_HISTORY : history;
    if (filterType === 'named') return list.filter((r) => !!r.resultUnitId);
    return list;
  }, [history, filterType, isSample]);

  // 記録からグラフを作る。同じ「材料→できた単位」は1本の線にまとめ、
  // 基本単位を左端（深さ0）に、材料より右にできた単位を並べる
  const graphData = useMemo(() => {
    const nodesMap = new Map<string, D3Node>();
    const linkMap = new Map<string, D3Link>();
    const addNode = (id: string) => {
      if (nodesMap.has(id)) return;
      const u = unitsById[id];
      if (!u) return;
      nodesMap.set(id, {
        id,
        name: uName(u, lang),
        sym: uSym(u, lang),
        type: u.kind === 'base' ? 'base' : 'intermediate',
        unitId: u.id,
        dimSI: u.sym,
        count: 0,
        depth: 0,
      });
    };

    filteredHistory.forEach((rec) => {
      if (!rec.resultUnitId || !unitsById[rec.resultUnitId]) return;
      addNode(rec.resultUnitId);
      const prod = nodesMap.get(rec.resultUnitId)!;
      prod.count += 1;
      if (prod.type !== 'base') prod.type = 'product';
      rec.ingredients.forEach((ing) => {
        addNode(ing.id);
        if (!nodesMap.has(ing.id)) return;
        const key = `${ing.id}->${rec.resultUnitId}:${ing.exp > 0 ? 'mul' : 'div'}`;
        const existing = linkMap.get(key);
        if (existing) existing.count += 1;
        else
          linkMap.set(key, {
            source: ing.id,
            target: rec.resultUnitId!,
            op: ing.exp > 0 ? 'mul' : 'div',
            exp: Math.abs(ing.exp),
            count: 1,
          });
      });
    });

    // 深さ：材料のいちばん深いものより1つ右（循環しても止まるよう回数を制限）
    const links = Array.from(linkMap.values());
    const nodes = Array.from(nodesMap.values());
    for (let i = 0; i < nodes.length; i++) {
      let changed = false;
      for (const l of links) {
        const src = nodesMap.get(l.source as string)!;
        const tgt = nodesMap.get(l.target as string)!;
        if (tgt.type !== 'base' && tgt.depth < src.depth + 1 && src.depth + 1 < nodes.length) {
          tgt.depth = src.depth + 1;
          changed = true;
        }
      }
      if (!changed) break;
    }

    return { nodes, links };
  }, [filteredHistory, lang]);

  // Render D3 Interactive Force/Tree Layout
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 800;
    const height = Math.max(520, containerRef.current.clientHeight || 560);

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    svg
      .attr('viewBox', [0, 0, width, height])
      .attr('width', '100%')
      .attr('height', '100%');

    // Root zoom container
    const g = svg.append('g').attr('class', 'tree-root');

    // Zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Initial positioning
    svg.call(zoom.transform, d3.zoomIdentity.translate(20, 0).scale(0.9));

    // Arrow markers
    const defs = svg.append('defs');
    defs
      .append('marker')
      .attr('id', 'tree-arrow-mul')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 28)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-4L10,0L0,4')
      .attr('fill', '#06B6D4');

    defs
      .append('marker')
      .attr('id', 'tree-arrow-div')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 28)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-4L10,0L0,4')
      .attr('fill', '#0284C7');

    // Force Simulation
    const simulation = d3
      .forceSimulation<D3Node>(graphData.nodes)
      .force(
        'link',
        d3
          .forceLink<D3Node, D3Link>(graphData.links)
          .id((d) => d.id)
          .distance((d) => (d.op === 'mul' ? 90 : 120))
      )
      .force('charge', d3.forceManyBody().strength(-260))
      .force('collide', d3.forceCollide().radius(48).iterations(2))
      .force('x', d3.forceX<D3Node>((d) => 60 + d.depth * 170).strength(1))
      .force('y', d3.forceY(height / 2).strength(0.06));

    // Links layer
    const link = g
      .append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(graphData.links)
      .join('line')
      .attr('stroke', (d) => (d.op === 'mul' ? '#06B6D4' : '#0284C7'))
      .attr('stroke-width', (d) => Math.min(5, 1.5 + (d.count - 1) * 0.8))
      .attr('stroke-dasharray', (d) => (d.op === 'div' ? '4,4' : 'none'))
      .attr('stroke-opacity', 0.6)
      .attr('marker-end', (d) => (d.op === 'mul' ? 'url(#tree-arrow-mul)' : 'url(#tree-arrow-div)'));

    // Nodes layer
    const node = g
      .append('g')
      .attr('class', 'nodes')
      .selectAll<SVGGElement, D3Node>('g')
      .data(graphData.nodes)
      .join('g')
      .attr('class', 'node-group')
      .style('cursor', 'pointer')
      .call(
        d3
          .drag<SVGGElement, D3Node>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    // Node Outer Ring
    node
      .append('circle')
      .attr('r', (d) => (d.type === 'base' ? 24 : d.type === 'product' ? 26 : 20))
      .attr('fill', (d) => {
        if (isDark) {
          return d.type === 'base' ? '#1E293B' : d.type === 'product' ? '#292524' : '#1E242B';
        }
        return d.type === 'base' ? '#EFF6FF' : d.type === 'product' ? '#CFFAFE' : '#F1F5F9';
      })
      .attr('stroke', (d) => {
        if (d.type === 'base') return '#3B82F6';
        if (d.type === 'product') return '#06B6D4';
        return '#94A3B8';
      })
      .attr('stroke-width', (d) => (d.type === 'product' ? 3 : 2))
      .attr('filter', 'drop-shadow(0 4px 6px rgba(0,0,0,0.08))');

    // Node Type Glow Ring for Products
    node
      .filter((d) => d.type === 'product')
      .append('circle')
      .attr('r', 30)
      .attr('fill', 'none')
      .attr('stroke', '#06B6D4')
      .attr('stroke-width', 1)
      .attr('stroke-opacity', 0.4)
      .attr('stroke-dasharray', '2,2');

    // Node Symbol Text
    node
      .append('text')
      .text((d) => d.sym)
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-family', 'STIX Two Text, serif')
      .attr('font-weight', 'bold')
      .attr('font-size', (d) => (d.sym.length > 4 ? '11px' : d.sym.length > 2 ? '13px' : '16px'))
      .attr('fill', (d) => {
        if (isDark) {
          return d.type === 'base' ? '#60A5FA' : d.type === 'product' ? '#67E8F9' : '#E2E8F0';
        }
        return d.type === 'base' ? '#1D4ED8' : d.type === 'product' ? '#0E7490' : '#334155';
      })
      .attr('pointer-events', 'none');

    // Node Label Badge (Name of unit)
    const labelGroup = node
      .append('g')
      .attr('transform', 'translate(0, 32)')
      .attr('pointer-events', 'none');

    labelGroup
      .append('rect')
      .attr('x', -40)
      .attr('y', -8)
      .attr('width', 80)
      .attr('height', 16)
      .attr('rx', 8)
      .attr('fill', isDark ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.95)')
      .attr('stroke', isDark ? '#334155' : '#E2E8F0')
      .attr('stroke-width', 1);

    labelGroup
      .append('text')
      .text((d) => (d.name.length > 5 ? d.name.slice(0, 5) + '…' : d.name))
      .attr('text-anchor', 'middle')
      .attr('dy', '4')
      .attr('font-size', '9px')
      .attr('font-weight', '600')
      .attr('fill', isDark ? '#CBD5E1' : '#475569');

    // Interactions
    node
      .on('mouseenter', (event, d) => {
        setHoveredNode(d);
      })
      .on('mouseleave', () => {
        setHoveredNode(null);
      })
      .on('click', (event, d) => {
        event.stopPropagation();
        if (d.unitId && unitsById[d.unitId]) {
          sounds.playPop();
          onSelectUnit(unitsById[d.unitId]);
        }
      });

    // Simulation Tick Updates
    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as D3Node).x || 0)
        .attr('y1', (d) => (d.source as D3Node).y || 0)
        .attr('x2', (d) => (d.target as D3Node).x || 0)
        .attr('y2', (d) => (d.target as D3Node).y || 0);

      node.attr('transform', (d) => `translate(${d.x || 0}, ${d.y || 0})`);
    });

    return () => {
      simulation.stop();
    };
  }, [graphData, isDark, lang, onSelectUnit]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 animate-in fade-in duration-200">
      {/* Dashboard Top Hero */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-indigo-500/10 dark:from-amber-950/20 dark:via-orange-950/20 dark:to-indigo-950/20 border border-amber-200/60 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm shadow-amber-500/20">
              <GitBranch className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100">
              {lang === 'ja' ? '錬成ツリー図ダッシュボード' : 'Alchemy Genealogy Tree'}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
            {lang === 'ja'
              ? '錬成ラボで正しく作れた組み合わせが記録され、左の基本単位から右へ「何から何ができたか」を枝分かれで表示します。単位をタップすると詳細が開きます。'
              : 'Recipes you craft correctly in the Alchemy Lab are recorded and drawn from base units on the left to what they make on the right. Tap a unit for details.'}
          </p>
        </div>

        {/* Stats Summary Pills */}
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-2xl bg-white dark:bg-slate-800 border border-amber-200/80 dark:border-slate-700 shadow-xs text-center">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {lang === 'ja' ? '記録された合成数' : 'Total Syntheses'}
            </div>
            <div className="font-serif font-black text-amber-600 dark:text-amber-400 text-lg leading-none">
              {isSample ? 0 : history.length}
            </div>
          </div>

          <div className="px-4 py-2 rounded-2xl bg-white dark:bg-slate-800 border border-amber-200/80 dark:border-slate-700 shadow-xs text-center">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {lang === 'ja' ? 'ツリーのノード数' : 'Tree Nodes'}
            </div>
            <div className="font-serif font-black text-emerald-600 dark:text-emerald-400 text-lg leading-none">
              {graphData.nodes.length}
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: D3 Tree Visualization Canvas (Left) + Synthesis Log Feed (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: D3 Tree Interactive Canvas (lg:col-span-8) */}
        <div className="lg:col-span-8 rounded-3xl bg-white dark:bg-slate-900 border border-amber-200/70 dark:border-slate-800 shadow-md p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>{lang === 'ja' ? '錬成ツリー' : 'Crafting tree'}</span>
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-semibold">
                {graphData.links.length} {lang === 'ja' ? 'リレーション' : 'links'}
              </span>
            </div>

            {/* Tree Filter & Actions */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                <button
                  onClick={() => {
                    sounds.playClick();
                    setFilterType('all');
                  }}
                  className={`px-2.5 py-1 font-semibold rounded-lg transition-colors ${
                    filterType === 'all'
                      ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-300 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {lang === 'ja' ? 'すべて' : 'All'}
                </button>
                <button
                  onClick={() => {
                    sounds.playClick();
                    setFilterType('named');
                  }}
                  className={`px-2.5 py-1 font-semibold rounded-lg transition-colors ${
                    filterType === 'named'
                      ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-300 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {lang === 'ja' ? '名前付き単位のみ' : 'Named Only'}
                </button>
              </div>

              <button
                onClick={reloadHistory}
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-amber-100 text-slate-600 dark:text-slate-300 transition-colors"
                title="Reload tree"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {isSample && (
            <div className="text-xs px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {lang === 'ja'
                ? '見本：まだ錬成の記録がないので、例（m/s → m/s² → N → J → W、Pa）を表示しています。錬成ラボで単位を作ると、あなたの記録に置き換わります。'
                : 'Example: you have no recipes yet, so a sample (m/s → m/s² → N → J → W, Pa) is shown. Craft units in the Alchemy Lab to replace it with your own.'}
            </div>
          )}

          {/* D3 Canvas Viewport */}
          <div
            ref={containerRef}
            className="relative w-full h-[520px] rounded-2xl bg-[#F8FAFC] dark:bg-[#070B0E] border border-amber-200/50 dark:border-slate-800 overflow-hidden select-none"
          >
            {/* Background Subtle Grid Pattern */}
            <div
              className="absolute inset-0 pointer-events-none opacity-30 dark:opacity-10"
              style={{
                backgroundImage: 'radial-gradient(#0891B2 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            />

            <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

            {/* Tree Legend on Canvas */}
            <div className="absolute bottom-3 left-3 p-2.5 rounded-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-xs border border-slate-200/70 dark:border-slate-700 text-[11px] space-y-1 shadow-xs pointer-events-none">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />
                <span className="text-slate-600 dark:text-slate-300 font-medium">
                  {lang === 'ja' ? 'SI基本単位 (ルート)' : 'Base Units (Roots)'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
                <span className="text-slate-600 dark:text-slate-300 font-medium">
                  {lang === 'ja' ? '発見・命名単位' : 'Discovered Units'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-0.5 bg-amber-500 inline-block" />
                <span className="text-slate-500 dark:text-slate-400">× {lang === 'ja' ? '掛け算' : 'Multiply'}</span>
                <span className="w-3 h-0.5 bg-sky-500 border-b border-dashed inline-block ml-1" />
                <span className="text-slate-500 dark:text-slate-400">÷ {lang === 'ja' ? '割り算' : 'Divide'}</span>
              </div>
            </div>

            {/* Hovered Node Mini Card */}
            {hoveredNode && (
              <div className="absolute top-3 left-3 p-3 rounded-xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-amber-300 dark:border-slate-600 shadow-md text-xs space-y-1 animate-in fade-in pointer-events-none">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100">
                  <span className="font-serif font-black text-amber-600 dark:text-amber-400 text-sm">
                    {hoveredNode.sym}
                  </span>
                  <span>{hoveredNode.name}</span>
                </div>

                {hoveredNode.unitId && (
                  <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                    {lang === 'ja' ? '💡 タップで詳細カードを表示' : '💡 Click to inspect unit'}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Synthesis History Feed & Recipe Loader (lg:col-span-4) */}
        <div className="lg:col-span-4 rounded-3xl bg-white dark:bg-slate-900 border border-amber-100 dark:border-slate-800 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-500" />
              <span>{lang === 'ja' ? '合成実験ログ' : 'Synthesis Experiment Logs'}</span>
            </h2>

            <button
              onClick={handleClearHistory}
              className="p-1 rounded-lg text-slate-400 hover:text-rose-500 transition-colors"
              title="Reset history"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            {lang === 'ja'
              ? '「レシピを復元」を押すと、調合フラスコに当時の材料がそのまま再現されます。'
              : 'Tap "Load Recipe" to restore the ingredients back into the Alchemy Lab kettle.'}
          </p>

          {/* History List */}
          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
            {filteredHistory.map((rec) => {
              const u = rec.resultUnitId ? unitsById[rec.resultUnitId] : null;
              const dateStr = new Date(rec.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={rec.id}
                  className="p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/80 hover:border-amber-300 transition-all space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-400">{dateStr}</span>
                    {u ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>{uName(u, lang)}</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">
                        {lang === 'ja' ? '未知の次元' : 'Composite'}
                      </span>
                    )}
                  </div>

                  {/* Formula Breakdown equation */}
                  <div className="flex items-center gap-1.5 flex-wrap font-serif text-sm">
                    {rec.ingredients.map((ing, iIdx) => {
                      const ingUnit = unitsById[ing.id];
                      return (
                        <React.Fragment key={iIdx}>
                          {iIdx > 0 && <span className="text-xs text-slate-400">×</span>}
                          <span
                            className={`px-1.5 py-0.2 rounded-md font-bold text-xs ${
                              ing.exp > 0
                                ? 'bg-amber-100/70 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300'
                                : 'bg-sky-100/70 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300'
                            }`}
                          >
                            {ingUnit ? uSym(ingUnit, lang) : ing.id}
                            {ing.exp !== 1 && (
                              <sup className="text-[9px] ml-0.5">
                                {ing.exp < 0 ? `⁻${Math.abs(ing.exp)}` : ing.exp}
                              </sup>
                            )}
                          </span>
                        </React.Fragment>
                      );
                    })}

                    <span className="text-slate-400">➔</span>

                    <span className="font-bold text-amber-600 dark:text-amber-400">
                      {u ? uSym(u, lang) : rec.resultUnitSym || rec.resultDimSI}
                    </span>
                  </div>

                  {/* Card Actions */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/50 dark:border-slate-700/60 text-xs">
                    {u && (
                      <button
                        onClick={() => {
                          sounds.playPop();
                          onSelectUnit(u);
                        }}
                        className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline"
                      >
                        {lang === 'ja' ? '単位詳細' : 'Inspect'}
                      </button>
                    )}

                    {onLoadRecipe && (
                      <button
                        onClick={() => {
                          sounds.playSuccess();
                          onLoadRecipe(rec.ingredients);
                        }}
                        className="text-[11px] font-bold px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white shadow-2xs transition-transform active:scale-95 ml-auto"
                      >
                        {lang === 'ja' ? '⚗️ レシピを復元' : 'Load Recipe'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
