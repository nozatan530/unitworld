// 「単位のよりみち」：教科書の外でよく見かける単位を、SI の単位に換算して並べる
// factor は「1 この単位 = factor × 基準の単位（m・m²・m³・kg）」

export type DetourKind = 'length' | 'area' | 'volume' | 'mass';
export type DetourSystem = 'si' | 'imperial' | 'shakkan' | 'daily';

export interface DetourUnit {
  id: string;
  sym: string;
  name: string;
  nameEn: string;
  system: DetourSystem;
  factor: number;
  // 定義（何とイコールか）
  def: string;
  defEn: string;
  note: string;
  noteEn: string;
}

export const DETOUR_KINDS: Array<{ id: DetourKind; icon: string; ja: string; en: string; base: string }> = [
  { id: 'length', icon: '📏', ja: '長さ', en: 'Length', base: 'm' },
  { id: 'area', icon: '🟩', ja: '面積', en: 'Area', base: 'm2' },
  { id: 'volume', icon: '🧃', ja: '体積', en: 'Volume', base: 'L' },
  { id: 'mass', icon: '⚖️', ja: '重さ（質量）', en: 'Mass', base: 'kg' },
];

export const DETOUR_SYSTEMS: Record<DetourSystem, { ja: string; en: string }> = {
  si: { ja: 'メートル法（SI）', en: 'Metric (SI)' },
  imperial: { ja: 'ヤード・ポンド法', en: 'Imperial / US customary' },
  shakkan: { ja: '日本の尺貫法', en: 'Traditional Japanese' },
  daily: { ja: '身近なもの', en: 'Everyday references' },
};

const SHAKU = 10 / 33; // 1尺（明治の度量衡法で 1 m = 3.3 尺）
const SHO = 2401 / 1331 / 1000; // 1升（m³）

export const DETOUR_UNITS: Record<DetourKind, DetourUnit[]> = {
  length: [
    { id: 'm', sym: 'm', name: 'メートル', nameEn: 'metre', system: 'si', factor: 1, def: '基準', defEn: 'base unit', note: '光が真空中を 1/299 792 458 秒に進む距離。', noteEn: 'The distance light travels in 1/299 792 458 s.' },
    { id: 'km', sym: 'km', name: 'キロメートル', nameEn: 'kilometre', system: 'si', factor: 1000, def: '1 km = 1000 m', defEn: '1 km = 1000 m', note: '', noteEn: '' },
    { id: 'cm', sym: 'cm', name: 'センチメートル', nameEn: 'centimetre', system: 'si', factor: 0.01, def: '1 cm = 0.01 m', defEn: '1 cm = 0.01 m', note: '', noteEn: '' },
    { id: 'mm', sym: 'mm', name: 'ミリメートル', nameEn: 'millimetre', system: 'si', factor: 0.001, def: '1 mm = 0.001 m', defEn: '1 mm = 0.001 m', note: '', noteEn: '' },
    { id: 'in', sym: 'in', name: 'インチ', nameEn: 'inch', system: 'imperial', factor: 0.0254, def: '1 in = 2.54 cm', defEn: '1 in = 2.54 cm', note: 'テレビやスマホの画面の大きさ（対角線）、自転車のタイヤ。', noteEn: 'Screen sizes (diagonal) and bicycle wheels.' },
    { id: 'ft', sym: 'ft', name: 'フィート（フット）', nameEn: 'foot', system: 'imperial', factor: 0.3048, def: '1 ft = 12 in = 0.3048 m', defEn: '1 ft = 12 in = 0.3048 m', note: '飛行機の高度はフィートで表す。単数形がフット、複数形がフィート。', noteEn: 'Aircraft altitude is given in feet.' },
    { id: 'yd', sym: 'yd', name: 'ヤード', nameEn: 'yard', system: 'imperial', factor: 0.9144, def: '1 yd = 3 ft = 0.9144 m', defEn: '1 yd = 3 ft = 0.9144 m', note: 'ゴルフの距離やアメリカンフットボールのフィールド。1959年に 0.9144 m ちょうどと決められた。', noteEn: 'Golf distances and American football. Fixed at exactly 0.9144 m in 1959.' },
    { id: 'mi', sym: 'mi', name: 'マイル', nameEn: 'mile', system: 'imperial', factor: 1609.344, def: '1 mi = 1760 yd = 1609.344 m', defEn: '1 mi = 1760 yd = 1609.344 m', note: 'アメリカやイギリスの道路標識。野球の球速「マイル/時」も。', noteEn: 'Road signs in the US and UK, and pitch speeds in mph.' },
    { id: 'nmi', sym: 'NM', name: '海里', nameEn: 'nautical mile', system: 'imperial', factor: 1852, def: '1 海里 = 1852 m', defEn: '1 NM = 1852 m', note: '海や空の距離。地球の緯度 1 分（1/60 度）の長さがもとになっている。1 海里/時 が 1 ノット。', noteEn: 'Used at sea and in the air; based on one minute of latitude. 1 NM per hour is 1 knot.' },
    { id: 'sun', sym: '寸', name: '寸（すん）', nameEn: 'sun', system: 'shakkan', factor: SHAKU / 10, def: '1 寸 = 1/10 尺 = 1/33 m', defEn: '1 sun = 1/10 shaku = 1/33 m', note: '約 3 cm。「一寸法師」は身長 3 cm ほど。', noteEn: 'About 3 cm — the height of the folk hero Issun-bōshi.' },
    { id: 'shaku', sym: '尺', name: '尺（しゃく）', nameEn: 'shaku', system: 'shakkan', factor: SHAKU, def: '1 尺 = 10/33 m', defEn: '1 shaku = 10/33 m', note: '約 30 cm。明治の度量衡法で 1 m = 3.3 尺と決められた。「尺八」は 1 尺 8 寸の笛。', noteEn: 'About 30 cm; defined as 10/33 m in 1891. The shakuhachi flute is 1.8 shaku long.' },
    { id: 'ken', sym: '間', name: '間（けん）', nameEn: 'ken', system: 'shakkan', factor: SHAKU * 6, def: '1 間 = 6 尺', defEn: '1 ken = 6 shaku', note: '約 1.82 m。建物の柱と柱の間や、畳の長い辺のもと。', noteEn: 'About 1.82 m — the spacing of pillars in traditional buildings.' },
    { id: 'cho', sym: '町', name: '町（ちょう）', nameEn: 'chō', system: 'shakkan', factor: SHAKU * 360, def: '1 町 = 60 間 = 360 尺', defEn: '1 chō = 60 ken', note: '約 109 m。', noteEn: 'About 109 m.' },
    { id: 'ri', sym: '里', name: '里（り）', nameEn: 'ri', system: 'shakkan', factor: SHAKU * 12960, def: '1 里 = 36 町', defEn: '1 ri = 36 chō', note: '約 3.9 km。人が 1 時間ほどで歩く道のり。街道の「一里塚」の間隔。', noteEn: 'About 3.9 km, roughly an hour on foot.' },
  ],
  area: [
    { id: 'm2', sym: 'm²', name: '平方メートル', nameEn: 'square metre', system: 'si', factor: 1, def: '基準', defEn: 'base unit', note: '', noteEn: '' },
    { id: 'cm2', sym: 'cm²', name: '平方センチメートル', nameEn: 'square centimetre', system: 'si', factor: 1e-4, def: '1 cm² = 0.0001 m²', defEn: '1 cm² = 0.0001 m²', note: '', noteEn: '' },
    { id: 'a', sym: 'a', name: 'アール', nameEn: 'are', system: 'si', factor: 100, def: '1 a = 10 m × 10 m = 100 m²', defEn: '1 a = 100 m²', note: '田畑の広さ。', noteEn: 'Used for farmland.' },
    { id: 'ha', sym: 'ha', name: 'ヘクタール', nameEn: 'hectare', system: 'si', factor: 1e4, def: '1 ha = 100 m × 100 m', defEn: '1 ha = 10 000 m²', note: '農地や森林の広さ。', noteEn: 'Farms and forests.' },
    { id: 'km2', sym: 'km²', name: '平方キロメートル', nameEn: 'square kilometre', system: 'si', factor: 1e6, def: '1 km² = 1 000 000 m²', defEn: '1 km² = 10⁶ m²', note: '市町村や国の面積。', noteEn: 'Areas of cities and countries.' },
    { id: 'ft2', sym: 'ft²', name: '平方フィート', nameEn: 'square foot', system: 'imperial', factor: 0.3048 ** 2, def: '1 ft² = 0.3048 m × 0.3048 m', defEn: '1 ft² = (0.3048 m)²', note: 'アメリカの住宅の広さ。', noteEn: 'Home sizes in the US.' },
    { id: 'acre', sym: 'ac', name: 'エーカー', nameEn: 'acre', system: 'imperial', factor: 4046.8564224, def: '1 エーカー = 4840 yd²', defEn: '1 acre = 4840 yd²', note: 'もとは「牛 2 頭で 1 日に耕せる広さ」。', noteEn: 'Originally the land a pair of oxen could plough in a day.' },
    { id: 'mi2', sym: 'mi²', name: '平方マイル', nameEn: 'square mile', system: 'imperial', factor: 1609.344 ** 2, def: '1 mi² = 640 エーカー', defEn: '1 mi² = 640 acres', note: '', noteEn: '' },
    { id: 'tsubo', sym: '坪', name: '坪（つぼ）', nameEn: 'tsubo', system: 'shakkan', factor: (SHAKU * 6) ** 2, def: '1 坪 = 1 間 × 1 間', defEn: '1 tsubo = 1 ken × 1 ken', note: '約 3.3 m²。畳 2 枚分。家や土地の広さで今も使われる。', noteEn: 'About 3.3 m², two tatami mats. Still used for homes and land.' },
    { id: 'jo', sym: '畳', name: '畳（じょう）', nameEn: 'jō (tatami)', system: 'shakkan', factor: 1.62, def: '1 畳 ≒ 1.62 m²（不動産広告の目安）', defEn: '1 jō ≈ 1.62 m² (real-estate convention)', note: '畳の大きさは地域で違う（京間 約 1.82 m²、江戸間 約 1.55 m²）。ここでは不動産広告の目安を使っている。', noteEn: 'Tatami sizes vary by region; this uses the real-estate figure.' },
    { id: 'tan', sym: '反', name: '反（たん）', nameEn: 'tan', system: 'shakkan', factor: (SHAKU * 6) ** 2 * 300, def: '1 反 = 300 坪', defEn: '1 tan = 300 tsubo', note: '約 10 a。昔は「米 1 石がとれる田の広さ」の目安だった。', noteEn: 'About 10 ares; roughly the paddy that yielded one koku of rice.' },
    { id: 'chobu', sym: '町歩', name: '町歩（ちょうぶ）', nameEn: 'chōbu', system: 'shakkan', factor: (SHAKU * 6) ** 2 * 3000, def: '1 町歩 = 10 反', defEn: '1 chōbu = 10 tan', note: '約 1 ha。', noteEn: 'About 1 hectare.' },
    { id: 'dome', sym: '東京ドーム', name: '東京ドーム', nameEn: 'Tokyo Dome', system: 'daily', factor: 46755, def: '建築面積 46 755 m²', defEn: 'building area 46 755 m²', note: '広さのたとえによく使われる。', noteEn: 'A popular yardstick for large areas in Japan.' },
  ],
  volume: [
    { id: 'L', sym: 'L', name: 'リットル', nameEn: 'litre', system: 'si', factor: 1e-3, def: '1 L = 10 cm × 10 cm × 10 cm', defEn: '1 L = 1000 cm³', note: '', noteEn: '' },
    { id: 'mL', sym: 'mL', name: 'ミリリットル', nameEn: 'millilitre', system: 'si', factor: 1e-6, def: '1 mL = 1 cm³ = 1 cc', defEn: '1 mL = 1 cm³', note: '「cc」も同じ大きさ。', noteEn: 'Same as a cubic centimetre (cc).' },
    { id: 'm3', sym: 'm³', name: '立方メートル', nameEn: 'cubic metre', system: 'si', factor: 1, def: '1 m³ = 1000 L', defEn: '1 m³ = 1000 L', note: '水道の使用量は m³ で数える。', noteEn: 'Water bills are counted in m³.' },
    { id: 'tsp', sym: '小さじ', name: '小さじ', nameEn: 'teaspoon (JP)', system: 'daily', factor: 5e-6, def: '1 小さじ = 5 mL', defEn: '1 tsp = 5 mL', note: '', noteEn: '' },
    { id: 'tbsp', sym: '大さじ', name: '大さじ', nameEn: 'tablespoon (JP)', system: 'daily', factor: 15e-6, def: '1 大さじ = 15 mL', defEn: '1 tbsp = 15 mL', note: '', noteEn: '' },
    { id: 'cup', sym: 'カップ', name: '計量カップ', nameEn: 'measuring cup (JP)', system: 'daily', factor: 200e-6, def: '1 カップ = 200 mL', defEn: '1 cup = 200 mL', note: '日本の料理の 1 カップ。アメリカのカップ（約 237 mL）とは違う。', noteEn: 'The Japanese cup; a US cup is about 237 mL.' },
    { id: 'floz', sym: 'fl oz', name: '液量オンス（米）', nameEn: 'US fluid ounce', system: 'imperial', factor: 29.5735295625e-6, def: '1 fl oz = 1/128 ガロン', defEn: '1 fl oz = 1/128 US gal', note: '飲み物の缶やボトル。', noteEn: 'Drink cans and bottles.' },
    { id: 'galUS', sym: 'gal', name: 'ガロン（米）', nameEn: 'US gallon', system: 'imperial', factor: 3.785411784e-3, def: '1 gal = 231 立方インチ', defEn: '1 US gal = 231 in³', note: 'アメリカのガソリンや牛乳。イギリスのガロン（約 4.55 L）より小さい。', noteEn: 'US gasoline and milk; smaller than the imperial gallon (≈ 4.55 L).' },
    { id: 'bbl', sym: 'bbl', name: 'バレル（石油）', nameEn: 'oil barrel', system: 'imperial', factor: 158.987294928e-3, def: '1 バレル = 42 ガロン（米）', defEn: '1 bbl = 42 US gal', note: '原油の量や値段のニュースで出てくる。', noteEn: 'Crude oil prices and output.' },
    { id: 'go', sym: '合', name: '合（ごう）', nameEn: 'gō', system: 'shakkan', factor: SHO / 10, def: '1 合 = 1/10 升', defEn: '1 gō = 1/10 shō', note: '約 180 mL。お米を炊くときの 1 合、日本酒の 1 合。', noteEn: 'About 180 mL — a cup of rice or sake.' },
    { id: 'sho', sym: '升', name: '升（しょう）', nameEn: 'shō', system: 'shakkan', factor: SHO, def: '1 升 = 2401/1331 L', defEn: '1 shō = 2401/1331 L', note: '約 1.8 L。「一升瓶」の大きさ。', noteEn: 'About 1.8 L — the big sake bottle.' },
    { id: 'to', sym: '斗', name: '斗（と）', nameEn: 'to', system: 'shakkan', factor: SHO * 10, def: '1 斗 = 10 升', defEn: '1 to = 10 shō', note: '約 18 L。「一斗缶」。', noteEn: 'About 18 L — the classic square can.' },
    { id: 'koku', sym: '石', name: '石（こく）', nameEn: 'koku', system: 'shakkan', factor: SHO * 100, def: '1 石 = 10 斗 = 100 升', defEn: '1 koku = 100 shō', note: '約 180 L。1 人が 1 年に食べるお米の量とされ、「加賀百万石」のように大名の力を表した。', noteEn: "About 180 L, roughly a person's rice for a year; used to rank feudal domains." },
  ],
  mass: [
    { id: 'kg', sym: 'kg', name: 'キログラム', nameEn: 'kilogram', system: 'si', factor: 1, def: '基準', defEn: 'base unit', note: '', noteEn: '' },
    { id: 'g', sym: 'g', name: 'グラム', nameEn: 'gram', system: 'si', factor: 1e-3, def: '1 g = 0.001 kg', defEn: '1 g = 0.001 kg', note: '', noteEn: '' },
    { id: 'mg', sym: 'mg', name: 'ミリグラム', nameEn: 'milligram', system: 'si', factor: 1e-6, def: '1 mg = 0.001 g', defEn: '1 mg = 0.001 g', note: '', noteEn: '' },
    { id: 't', sym: 't', name: 'トン', nameEn: 'tonne', system: 'si', factor: 1000, def: '1 t = 1000 kg', defEn: '1 t = 1000 kg', note: '', noteEn: '' },
    { id: 'ct', sym: 'ct', name: 'カラット', nameEn: 'carat', system: 'si', factor: 2e-4, def: '1 ct = 0.2 g', defEn: '1 ct = 0.2 g', note: '宝石の重さ。純金の「24 金」の「金（K）」とは別もの。', noteEn: 'Gemstone mass (not the karat of gold purity).' },
    { id: 'oz', sym: 'oz', name: 'オンス', nameEn: 'ounce', system: 'imperial', factor: 0.028349523125, def: '1 oz = 1/16 lb', defEn: '1 oz = 1/16 lb', note: '約 28 g。ボクシングのグローブの重さ。', noteEn: 'About 28 g; boxing gloves are rated in ounces.' },
    { id: 'lb', sym: 'lb', name: 'ポンド', nameEn: 'pound', system: 'imperial', factor: 0.45359237, def: '1 lb = 0.45359237 kg', defEn: '1 lb = 0.45359237 kg', note: '約 454 g。ボウリングの球や、アメリカの体重。', noteEn: 'About 454 g; bowling balls and body weight in the US.' },
    { id: 'ozt', sym: 'oz t', name: 'トロイオンス', nameEn: 'troy ounce', system: 'imperial', factor: 0.0311034768, def: '1 oz t = 31.1034768 g', defEn: '1 oz t = 31.1034768 g', note: '金・銀の値段に使うオンス。ふつうのオンスより少し重い。', noteEn: 'Used for gold and silver prices.' },
    { id: 'monme', sym: '匁', name: '匁（もんめ）', nameEn: 'monme', system: 'shakkan', factor: 3.75e-3, def: '1 匁 = 3.75 g', defEn: '1 monme = 3.75 g', note: '5 円玉 1 枚の重さがちょうど 1 匁（3.75 g）。真珠の取り引きでは今も「mom」として使われる。', noteEn: 'A 5-yen coin weighs exactly 1 monme. Still used for pearls (“mom”).' },
    { id: 'kin', sym: '斤', name: '斤（きん）', nameEn: 'kin', system: 'shakkan', factor: 0.6, def: '1 斤 = 160 匁 = 600 g', defEn: '1 kin = 600 g', note: '食パンの「1 斤」はこれとは別で、表示のきまりで 340 g 以上とされている。', noteEn: 'A “kin” of sliced bread is a separate convention (at least 340 g).' },
    { id: 'kan', sym: '貫', name: '貫（かん）', nameEn: 'kan', system: 'shakkan', factor: 3.75, def: '1 貫 = 1000 匁 = 3.75 kg', defEn: '1 kan = 1000 monme = 3.75 kg', note: '', noteEn: '' },
  ],
};
