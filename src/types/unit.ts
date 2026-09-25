export type SubjectType = '基本' | '物理' | '化学' | '生物' | '地学';
export type UnitKind = 'base' | 'derived' | 'nonsi' | 'scale';

export interface UnitDefinition {
  id: string;
  sym: string;
  symEn?: string;
  plain?: string;
  name: string;
  nameEn?: string;
  qty: string;
  qtyEn?: string;
  kind: UnitKind;
  dim?: Record<string, number>;
  // SI換算の係数（1 この単位 = factor × SI組立単位）。省略時は forms[0] から計算
  factor?: number;
  forms?: Array<Array<[string, number]>>;
  subj: SubjectType[];
  field: string;
  fieldEn?: string;
  note: string;
  noteEn?: string;
  formulas?: string[];
  conv?: string;
  convEn?: string;
  // Map coordinates & island
  realmId: 'base' | 'mechanics' | 'wave' | 'em' | 'thermal' | 'atomic' | 'chem' | 'bio' | 'earth' | 'scale';
  x: number;
  y: number;
  _dim?: Record<string, number>;
  _factor?: number;
}

export interface MapLink {
  id: string;
  source: string;
  target: string;
  op: 'mul' | 'div' | 'conv' | 'log';
  label?: string;
}

export interface RealmInfo {
  id: string;
  name: string;
  nameEn: string;
  color: string;
  bgLight: string;
  bgDark: string;
  borderLight: string;
  icon: string;
  desc: string;
  descEn: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AlchemyHistoryRecord {
  id: string;
  timestamp: number;
  ingredients: Array<{ id: string; exp: number }>;
  resultDimSI: string;
  resultDimKey: string;
  resultUnitId?: string;
  resultUnitName?: string;
  resultUnitSym?: string;
}

