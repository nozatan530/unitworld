import { AlchemyHistoryRecord } from '../types/unit';
import { unitsById, getUnitDim, getDimKey, getUnitFactor, sameFactor, isCraftable } from '../data/unitsData';

const ALCHEMY_HISTORY_KEY = 'unit_alchemy_synthesis_history';

// 見本のレシピ（まだ何も錬成していないときに「見本」として表示する。保存はしない）
export const SAMPLE_HISTORY: AlchemyHistoryRecord[] = [
  {
    id: 'default_1',
    timestamp: Date.now() - 3600000 * 5,
    ingredients: [{ id: 'm', exp: 1 }, { id: 's', exp: -1 }],
    resultDimSI: 'm/s',
    resultDimKey: '0,1,-1,0,0,0,0',
    resultUnitId: 'm_s',
    resultUnitName: 'メートル毎秒',
    resultUnitSym: 'm/s',
  },
  {
    id: 'default_2',
    timestamp: Date.now() - 3600000 * 4,
    ingredients: [{ id: 'm_s', exp: 1 }, { id: 's', exp: -1 }],
    resultDimSI: 'm/s²',
    resultDimKey: '0,1,-2,0,0,0,0',
    resultUnitId: 'm_s2',
    resultUnitName: 'メートル毎秒毎秒',
    resultUnitSym: 'm/s²',
  },
  {
    id: 'default_3',
    timestamp: Date.now() - 3600000 * 3,
    ingredients: [{ id: 'kg', exp: 1 }, { id: 'm_s2', exp: 1 }],
    resultDimSI: 'kg·m/s²',
    resultDimKey: '1,1,-2,0,0,0,0',
    resultUnitId: 'N',
    resultUnitName: 'ニュートン',
    resultUnitSym: 'N',
  },
  {
    id: 'default_4',
    timestamp: Date.now() - 3600000 * 2,
    ingredients: [{ id: 'N', exp: 1 }, { id: 'm', exp: 1 }],
    resultDimSI: 'kg·m²/s²',
    resultDimKey: '1,2,-2,0,0,0,0',
    resultUnitId: 'J',
    resultUnitName: 'ジュール',
    resultUnitSym: 'J',
  },
  {
    id: 'default_5',
    timestamp: Date.now() - 3600000 * 1,
    ingredients: [{ id: 'J', exp: 1 }, { id: 's', exp: -1 }],
    resultDimSI: 'kg·m²/s³',
    resultDimKey: '1,2,-3,0,0,0,0',
    resultUnitId: 'W',
    resultUnitName: 'ワット',
    resultUnitSym: 'W',
  },
  {
    id: 'default_6',
    timestamp: Date.now() - 3600000 * 0.5,
    ingredients: [{ id: 'N', exp: 1 }, { id: 'm2', exp: -1 }],
    resultDimSI: 'kg/(m·s²)',
    resultDimKey: '1,-1,-2,0,0,0,0',
    resultUnitId: 'Pa',
    resultUnitName: 'パスカル',
    resultUnitSym: 'Pa',
  },
];

// 材料をかけ合わせた結果が、記録された単位と次元も係数も一致するか
export function isValidRecord(r: AlchemyHistoryRecord): boolean {
  const target = r.resultUnitId ? unitsById[r.resultUnitId] : undefined;
  if (!target || !isCraftable(target) || !Array.isArray(r.ingredients)) return false;
  const dim: Record<string, number> = {};
  let factor = 1;
  let pieces = 0;
  for (const ing of r.ingredients) {
    const u = unitsById[ing.id];
    if (!u) return false;
    const d = getUnitDim(u);
    for (const k in d) dim[k] = (dim[k] || 0) + d[k] * ing.exp;
    factor *= Math.pow(getUnitFactor(u), ing.exp);
    pieces += Math.abs(ing.exp);
  }
  return pieces >= 2 && getDimKey(dim) === getDimKey(getUnitDim(target)) && sameFactor(factor, getUnitFactor(target));
}

// 自分で錬成した記録だけを返す（正しくない記録は取り除く）
export function getAlchemyHistory(): AlchemyHistoryRecord[] {
  try {
    const raw = localStorage.getItem(ALCHEMY_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((r) => !String(r.id).startsWith('default_') && isValidRecord(r));
  } catch {
    return [];
  }
}

export function saveAlchemyRecord(record: Omit<AlchemyHistoryRecord, 'id' | 'timestamp'>): AlchemyHistoryRecord {
  const current = getAlchemyHistory();
  // Check if identical synthesis was already recorded recently
  // 材料の順番が違うだけの同じレシピは1件にまとめる
  const sig = (ings: Array<{ id: string; exp: number }>) =>
    ings.map((i) => `${i.id}:${i.exp}`).sort().join('|');
  const existingIndex = current.findIndex(
    (r) => r.resultUnitId === record.resultUnitId && sig(r.ingredients) === sig(record.ingredients)
  );

  const newRecord: AlchemyHistoryRecord = {
    ...record,
    id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    timestamp: Date.now(),
  };

  let updated: AlchemyHistoryRecord[];
  if (existingIndex >= 0) {
    // Bring to top with updated timestamp
    updated = [newRecord, ...current.filter((_, i) => i !== existingIndex)].slice(0, 100);
  } else {
    updated = [newRecord, ...current].slice(0, 100);
  }

  try {
    localStorage.setItem(ALCHEMY_HISTORY_KEY, JSON.stringify(updated));
  } catch {}

  return newRecord;
}

export function clearAlchemyHistory(): void {
  try {
    localStorage.removeItem(ALCHEMY_HISTORY_KEY);
  } catch {}
}
