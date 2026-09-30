import { UnitDefinition } from '../types/unit';
import { RAW_UNITS, REALMS, MAP_LINKS, unitsById } from './unitsData';

// ===== ワールドマップの並べ方 =====
// 「組み立て順」：基本単位を0段目とし、材料のうちいちばん右の段＋1 の段に置く。
// cm・hPa・pH のように換算や目盛りで決まる単位は、もとの単位の「なかま」としてその下に添える。

// 換算・対数の線で、もとの単位をたどれる単位（組み立て方をもたないもの）
const convParent: Record<string, string> = {};
const convChildren: Record<string, string[]> = {};
MAP_LINKS.forEach((l) => {
  if (l.op !== 'conv' && l.op !== 'log') return;
  const t = unitsById[l.target];
  if (!t || t.forms || t.kind === 'base' || convParent[t.id]) return;
  convParent[t.id] = l.source;
  (convChildren[l.source] = convChildren[l.source] || []).push(t.id);
});

// なかまを束ねる単位（cm → m、kcal → cal → J）
export const hostOf = (id: string): string => (convParent[id] ? hostOf(convParent[id]) : id);

// なかまの並び（J → cal → kcal のような換算の鎖も、もとの J の下にまとめて並べる）
const collectMembers = (id: string): string[] =>
  (convChildren[id] || []).flatMap((c) => [c, ...collectMembers(c)]);
export const MEMBERS: Record<string, string[]> = {};
RAW_UNITS.forEach((u) => {
  if (!convParent[u.id]) MEMBERS[u.id] = collectMembers(u.id);
});

// 段（基本単位＝0）
const depthCache: Record<string, number> = {};
export const unitDepth = (id: string): number => {
  if (depthCache[id] !== undefined) return depthCache[id];
  const u = unitsById[id];
  let d = 0;
  if (convParent[id]) d = unitDepth(hostOf(id));
  else if (u.kind !== 'base' && u.forms && u.forms[0]) d = 1 + Math.max(...u.forms[0].map(([i]) => unitDepth(i)));
  depthCache[id] = d;
  return d;
};

const realmOrder: Record<string, number> = {};
REALMS.forEach((r, i) => (realmOrder[r.id] = i));
const rawOrder: Record<string, number> = {};
RAW_UNITS.forEach((u, i) => (rawOrder[u.id] = i));
const byRealmThenRaw = (a: UnitDefinition, b: UnitDefinition) =>
  realmOrder[a.realmId] - realmOrder[b.realmId] || rawOrder[a.id] - rawOrder[b.id];

// 段ごとの列（中は分野の順）
export const BUILD_COLUMNS: Array<{ depth: number; hosts: UnitDefinition[] }> = (() => {
  const cols: Record<number, UnitDefinition[]> = {};
  RAW_UNITS.filter((u) => !convParent[u.id]).forEach((u) => {
    const d = unitDepth(u.id);
    (cols[d] = cols[d] || []).push(u);
  });
  return Object.keys(cols)
    .map(Number)
    .sort((a, b) => a - b)
    .map((depth) => ({ depth, hosts: cols[depth].sort(byRealmThenRaw) }));
})();

// 「分野別」：分野ごとに、段の浅い順
export const FIELD_GROUPS = REALMS.map((r) => ({
  realm: r,
  units: RAW_UNITS.filter((u) => u.realmId === r.id).sort(
    (a, b) => unitDepth(a.id) - unitDepth(b.id) || rawOrder[a.id] - rawOrder[b.id]
  ),
}));

export const realmById = Object.fromEntries(REALMS.map((r) => [r.id, r]));
