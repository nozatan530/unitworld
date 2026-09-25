import { UnitDefinition } from '../types/unit';
import { RAW_UNITS, REALMS, unitsById, isCraftable, getUnitDim } from './unitsData';

// おすすめのお題（錬成ラボ・ツリー図で最初に並べる）
export const SUGGESTED_TARGETS = ['N', 'J', 'W', 'Pa', 'C', 'V', 'ohm', 'F', 'T', 'Wb', 'H', 'Hz', 'mol_L', 'kg_m3'];

// 目標にできる単位：かけ算・わり算で作れる、基本単位以外の単位（無次元の rad・sr は除く）
export const TARGET_UNITS: UnitDefinition[] = RAW_UNITS.filter(
  (u) => isCraftable(u) && u.kind !== 'base' && Object.keys(getUnitDim(u)).length > 0
);

// 材料として最初に見せる「よく使う」単位
export const COMMON_INGREDIENTS = ['m', 'kg', 's', 'A', 'K', 'mol', 'cd', 'm2', 'm3', 'm_s', 'm_s2', 'N', 'J', 'W', 'Pa', 'C', 'V', 'L', 'g'];

// 地域（分野）ごとの並び。scale（目盛り）は材料にならないので除く
export const INGREDIENT_GROUPS = REALMS.filter((r) => r.id !== 'scale').map((r) => ({
  realm: r,
  units: RAW_UNITS.filter((u) => u.realmId === r.id && u.kind !== 'scale'),
}));

// 材料として手に入る単位（作る必要がない）：基本単位と、換算で定義される単位（L・g・h など）
export const isStarter = (u: UnitDefinition) => u.kind === 'base' || !isCraftable(u);

// レシピの木：root の作り方（formIndex 番目）を、基本単位か換算の単位にたどり着くまで展開する
export interface RecipeNode {
  unit: UnitDefinition;
  exp: number; // 親に対して何乗で入るか（負ならわる）
  children: RecipeNode[];
}

export function buildRecipeTree(id: string, formIndex = 0): RecipeNode | null {
  const root = unitsById[id];
  if (!root) return null;
  const expand = (u: UnitDefinition, exp: number, path: Set<string>, fi: number): RecipeNode => {
    const form = u.forms?.[fi] || u.forms?.[0];
    if (isStarter(u) || !form || path.has(u.id)) return { unit: u, exp, children: [] };
    const next = new Set(path).add(u.id);
    return {
      unit: u,
      exp,
      children: form
        .filter(([cid]) => unitsById[cid])
        .map(([cid, e]) => expand(unitsById[cid], e, next, 0)),
    };
  };
  return expand(root, 1, new Set(), formIndex);
}

// 作れた単位の記録（錬成ラボで正しく作れた単位）
const DISCOVERED_KEY = 'unit_discovered_alchemy';
export function getCraftedUnits(): Set<string> {
  try {
    const raw = localStorage.getItem(DISCOVERED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}
export function addCraftedUnits(ids: string[]): Set<string> {
  const set = getCraftedUnits();
  ids.forEach((id) => set.add(id));
  try {
    localStorage.setItem(DISCOVERED_KEY, JSON.stringify(Array.from(set)));
  } catch {}
  return set;
}
