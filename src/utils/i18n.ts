import { UnitDefinition, RealmInfo } from '../types/unit';

export type Lang = 'ja' | 'en';

export const uSym = (u: UnitDefinition, lang: Lang) => (lang === 'en' && u.symEn ? u.symEn : u.sym);
export const uName = (u: UnitDefinition, lang: Lang) => (lang === 'en' ? u.nameEn || u.name : u.name);
export const uQty = (u: UnitDefinition, lang: Lang) => (lang === 'en' ? u.qtyEn || u.qty : u.qty);
export const uNote = (u: UnitDefinition, lang: Lang) => (lang === 'en' ? u.noteEn || u.note : u.note);
export const uConv = (u: UnitDefinition, lang: Lang) => (lang === 'en' ? u.convEn || u.conv : u.conv);
export const uField = (u: UnitDefinition, lang: Lang) => (lang === 'en' ? u.fieldEn || u.field : u.field);

const SUBJ_EN: Record<string, string> = {
  基本: 'Base',
  物理: 'Physics',
  化学: 'Chemistry',
  生物: 'Biology',
  地学: 'Earth science',
};
export const subjLabel = (s: string, lang: Lang) => (lang === 'en' ? SUBJ_EN[s] || s : s);

export const realmName = (r: RealmInfo, lang: Lang) => (lang === 'en' ? r.nameEn : r.name);
export const realmDesc = (r: RealmInfo, lang: Lang) => (lang === 'en' ? r.descEn : r.desc);

// 検索用：日本語・英語の両方の名前・量・記号を含める
export const unitSearchText = (u: UnitDefinition) =>
  [u.plain || u.sym, u.symEn, u.name, u.nameEn, u.qty, u.qtyEn, u.field, u.fieldEn]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

// 教科の色（単位のつながり帳と同じ決まり：物理＝青、化学＝金、生物＝緑、地学＝紫）
export const SUBJ_TAG_CLASS: Record<string, string> = {
  物理: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  化学: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  生物: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  地学: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  基本: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
};
