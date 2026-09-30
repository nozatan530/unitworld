import React, { useState } from 'react';
import { celebrate } from '../../utils/motion';
import { HelpCircle, CheckCircle2, XCircle, RotateCcw, Award, ChevronRight, BookOpen } from 'lucide-react';
import { UnitDefinition, SubjectType } from '../../types/unit';
import {
  RAW_UNITS,
  unitsById,
  getUnitDim,
  getDimKey,
  formatDimSI,
  getUnitFactor,
  sameFactor,
} from '../../data/unitsData';
import { uSym, uName, uQty, uNote, subjLabel } from '../../utils/i18n';
import { sounds } from '../../utils/sound';

interface QuizAdventureProps {
  onSelectUnit: (unit: UnitDefinition) => void;
  lang: 'ja' | 'en';
}

interface Question {
  type: string;
  prompt: string;
  correctAnswer: string;
  options: Array<{ text: string; isCorrect: boolean }>;
  explanation: string;
  unit: UnitDefinition;
}

export const QuizAdventure: React.FC<QuizAdventureProps> = ({
  onSelectUnit,
  lang,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [subjectFilter, setSubjectFilter] = useState<SubjectType | 'all'>('all');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [score, setScore] = useState<number>(0);
  const [bestScore, setBestScore] = useState<number>(() => {
    try {
      return Number(localStorage.getItem('unit_quiz_best') || 0);
    } catch {
      return 0;
    }
  });

  // 10問を作る。記号・SI基本単位への分解・かけ算わり算の3種類
  const generateQuestions = (subj: SubjectType | 'all'): Question[] => {
    const pool = RAW_UNITS.filter((u) => u.kind !== 'scale' && (subj === 'all' || u.subj.includes(subj)));
    const named = pool.filter((u) => u.kind !== 'base');
    const dimKeyOf = (u: UnitDefinition) => getDimKey(getUnitDim(u));
    const shuffle = <T,>(arr: T[]): T[] => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };
    const label = (u: UnitDefinition) => `${uSym(u, lang)} (${uName(u, lang)})`;
    // 組み立て方どおりにかけ算すると、本当にその単位になるか（kWh = W × h ではなく kW × h など、係数の合わない式を除く）
    const formMatches = (u: UnitDefinition, f: Array<[string, number]>) =>
      sameFactor(
        f.reduce((acc, [id, e]) => acc * Math.pow(getUnitFactor(unitsById[id]), e), 1),
        getUnitFactor(u)
      );
    const simpleForm = (u: UnitDefinition) =>
      Object.keys(getUnitDim(u)).length > 0
        ? u.forms?.find((f) => f.length === 2 && f.every(([, e]) => Math.abs(e) === 1) && formMatches(u, f))
        : undefined;

    const qs: Question[] = [];
    const used = new Set<string>();
    let guard = 0;

    while (qs.length < 10 && guard++ < 300) {
      const qType = ['sym', 'build', 'combine', 'sym'][Math.floor(Math.random() * 4)];

      if (qType === 'sym') {
        const u = shuffle(pool).find((c) => !used.has(c.id));
        if (!u) continue;
        // 同じ記号・同じ量の単位は選択肢にしない
        const ok = (v: UnitDefinition) =>
          v.id !== u.id && v.kind !== 'scale' && uSym(v, lang) !== uSym(u, lang) && v.qty !== u.qty;
        let others = shuffle(RAW_UNITS.filter((v) => ok(v) && v.field === u.field)).slice(0, 3);
        if (others.length < 3)
          others = others.concat(shuffle(RAW_UNITS.filter((v) => ok(v) && !others.includes(v))).slice(0, 3 - others.length));
        if (others.length < 3) continue;
        used.add(u.id);
        qs.push({
          type: lang === 'ja' ? '記号を選ぶ' : 'Symbol',
          prompt:
            lang === 'ja'
              ? `「${uName(u, lang)}」（${uQty(u, lang)}）の記号はどれ？`
              : `Which symbol means "${uName(u, lang)}" (${uQty(u, lang)})?`,
          correctAnswer: uSym(u, lang),
          options: shuffle([u, ...others]).map((o) => ({ text: uSym(o, lang), isCorrect: o.id === u.id })),
          explanation: `${uSym(u, lang)} (${uName(u, lang)}) — ${uNote(u, lang)}`,
          unit: u,
        });
      } else if (qType === 'build') {
        // SI基本単位での表し方を問うので、係数が1の単位（SIの単位）だけ
        const u = shuffle(named).find(
          (c) =>
            !used.has(c.id) && c.forms && c.forms.length > 0 && Object.keys(getUnitDim(c)).length > 0 && sameFactor(getUnitFactor(c), 1)
        );
        if (!u) continue;
        const key = dimKeyOf(u);
        // 不正解は、正解とも互いにも次元が違うものを3つ
        const wrong: UnitDefinition[] = [];
        const seen = new Set([key]);
        for (const v of shuffle(RAW_UNITS.filter((v) => v.kind !== 'scale' && Object.keys(getUnitDim(v)).length > 0))) {
          const k = dimKeyOf(v);
          if (seen.has(k)) continue;
          seen.add(k);
          wrong.push(v);
          if (wrong.length === 3) break;
        }
        if (wrong.length < 3) continue;
        used.add(u.id);
        const correctSI = formatDimSI(getUnitDim(u), lang);
        qs.push({
          type: lang === 'ja' ? '組み立て方を選ぶ' : 'SI base units',
          prompt:
            lang === 'ja'
              ? `${uSym(u, lang)}（${uQty(u, lang)}）をSI基本単位で表すと？`
              : `Which is ${uSym(u, lang)} (${uQty(u, lang)}) in SI base units?`,
          correctAnswer: correctSI,
          options: shuffle([
            { text: correctSI, isCorrect: true },
            ...wrong.map((o) => ({ text: formatDimSI(getUnitDim(o), lang), isCorrect: false })),
          ]),
          explanation: `${uSym(u, lang)} = ${correctSI}. ${uNote(u, lang)}`,
          unit: u,
        });
      } else {
        const u = shuffle(named).find((c) => !used.has(c.id) && simpleForm(c));
        if (!u) continue;
        const form = simpleForm(u)!;
        const [[aId, aExp], [bId, bExp]] = form;
        const uA = unitsById[aId];
        const uB = unitsById[bId];
        if (!uA || !uB) continue;
        let mathPrompt = '';
        if (aExp > 0 && bExp > 0) mathPrompt = `${uSym(uA, lang)} × ${uSym(uB, lang)}`;
        else if (aExp > 0) mathPrompt = `${uSym(uA, lang)} ÷ ${uSym(uB, lang)}`;
        else mathPrompt = `${uSym(uB, lang)} ÷ ${uSym(uA, lang)}`;
        // 正解と同じ次元の単位（J と N·m など）は不正解の選択肢に入れない
        const key = dimKeyOf(u);
        const others = shuffle(named.filter((v) => dimKeyOf(v) !== key && v.id !== aId && v.id !== bId)).slice(0, 3);
        if (others.length < 3) continue;
        used.add(u.id);
        qs.push({
          type: lang === 'ja' ? 'かけ算・わり算' : 'Multiply and divide',
          prompt: lang === 'ja' ? `${mathPrompt} はどの単位？` : `Which unit is ${mathPrompt}?`,
          correctAnswer: uSym(u, lang),
          options: shuffle([u, ...others]).map((o) => ({ text: label(o), isCorrect: o.id === u.id })),
          explanation: `${mathPrompt} = ${label(u)}. ${uNote(u, lang)}`,
          unit: u,
        });
      }
    }

    return qs;
  };

  // 言語を切り替えたら、問題文の言語がまざらないよう最初の画面に戻す
  React.useEffect(() => {
    setIsPlaying(false);
  }, [lang]);

  const handleStart = () => {
    sounds.playSuccess();
    const generated = generateQuestions(subjectFilter);
    setQuestions(generated);
    setCurrentIndex(0);
    setSelectedOption(null);
    setScore(0);
    setIsPlaying(true);
  };

  const handleSelectOption = (idx: number) => {
    if (selectedOption !== null) return;
    setSelectedOption(idx);
    const q = questions[currentIndex];
    const isCorrect = q.options[idx].isCorrect;

    if (isCorrect) {
      sounds.playSuccess();
      setScore((s) => s + 1);
    } else {
      sounds.playBonk();
    }
  };

  const handleNext = () => {
    sounds.playClick();
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((i) => i + 1);
      setSelectedOption(null);
    } else {
      // Game over, check best score
      const finalScore = score + (selectedOption !== null && questions[currentIndex].options[selectedOption].isCorrect ? 0 : 0);
      if (finalScore > bestScore) {
        setBestScore(finalScore);
        try {
          localStorage.setItem('unit_quiz_best', String(finalScore));
        } catch {}
      }
      celebrate({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.6 },
        });
      setCurrentIndex((i) => i + 1); // trigger result view
    }
  };

  // Start Screen
  if (!isPlaying) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-slate-800 shadow-xl text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
            <HelpCircle className="w-8 h-8" />
          </div>

          <div>
            <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100">
              {lang === 'ja' ? '単位アドベンチャークイズ' : 'Unit Adventure Quiz'}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
              {lang === 'ja'
                ? '全10問。記号当て・基本単位への分解・掛け算割り算の合成など、単位のつながりを楽しく力試し！'
                : '10 Questions. Test your intuition for science symbols, SI dimensions, and formula combinations!'}
            </p>
          </div>

          {/* Subject Filter Pills */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block uppercase tracking-wider">
              {lang === 'ja' ? '出題教科の選択' : 'Choose Subject'}
            </label>
            <div className="flex items-center justify-center gap-1.5 flex-wrap">
              {(['all', '物理', '化学', '生物', '地学'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    sounds.playClick();
                    setSubjectFilter(s);
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    subjectFilter === s
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {s === 'all' ? (lang === 'ja' ? '全教科ミックス' : 'All Subjects') : subjLabel(s, lang)}
                </button>
              ))}
            </div>
          </div>

          {bestScore > 0 && (
            <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
              <Award className="w-4 h-4" />
              <span>
                {lang === 'ja' ? `自己ベスト: ${bestScore} / 10 問正解` : `Personal Best: ${bestScore} / 10`}
              </span>
            </div>
          )}

          <button
            onClick={handleStart}
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-base shadow-lg shadow-amber-500/30 transition-transform active:scale-95"
          >
            {lang === 'ja' ? '冒険をスタートする！' : 'Start Adventure!'}
          </button>
        </div>
      </div>
    );
  }

  // Result Screen
  if (currentIndex >= questions.length) {
    const isPerfect = score === 10;
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-slate-800 shadow-xl text-center space-y-6 animate-in fade-in">
          <div className="w-20 h-20 rounded-3xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto text-3xl">
            {isPerfect ? '👑' : score >= 7 ? '🎉' : '🌱'}
          </div>

          <div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100">
              {lang === 'ja' ? 'クイズ完了！' : 'Quiz Complete!'}
            </h2>
            <div className="font-serif font-black text-5xl text-amber-600 dark:text-amber-400 my-3">
              {score} <span className="text-xl text-slate-500 dark:text-slate-400 font-sans font-normal">/ 10</span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {isPerfect
                ? lang === 'ja'
                  ? 'パーフェクト！単位のつながりが完全に頭に入っています！'
                  : 'Perfect score! You truly master the network of units!'
                : score >= 7
                ? lang === 'ja'
                  ? '素晴らしい成績！間違えた単位を「単位図鑑」や「錬成ラボ」で確かめてみよう。'
                  : 'Great job! Check the ones you missed in the Unit Index or Lab.'
                : lang === 'ja'
                ? 'ナイスファイト！「錬成ラボ」で実際に手を動かすと、どんどん覚えられますよ。'
                : 'Nice try! Spend some time in the Alchemy Lab to see how units multiply together.'}
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={handleStart}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shadow-md transition-transform active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{lang === 'ja' ? 'もう一度挑戦' : 'Play Again'}</span>
            </button>
            <button
              onClick={() => setIsPlaying(false)}
              className="px-6 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 font-bold text-sm transition-colors"
            >
              {lang === 'ja' ? 'クイズ設定に戻る' : 'Back to Menu'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active Question Card
  const q = questions[currentIndex];
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
      {/* Top Header & Progress Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-amber-100 dark:border-slate-800 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
            {q.type}
          </span>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            Q{currentIndex + 1} / {questions.length}
          </span>
        </div>
        <div className="flex items-center gap-1 font-serif font-bold text-sm text-amber-600">
          <Award className="w-4 h-4" />
          <span>{score} pts</span>
        </div>
      </div>

      {/* Question Prompt Card */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-slate-800 shadow-md space-y-5">
        <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100 leading-snug">
          {q.prompt}
        </h2>

        {/* 4 Choices */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {q.options.map((opt, idx) => {
            const isSelected = selectedOption === idx;
            const hasAnswered = selectedOption !== null;

            let btnStyle =
              'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-amber-400 text-slate-800 dark:text-slate-100';

            if (hasAnswered) {
              if (opt.isCorrect) {
                btnStyle =
                  'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 text-emerald-800 dark:text-emerald-200 font-bold';
              } else if (isSelected) {
                btnStyle =
                  'bg-rose-50 dark:bg-rose-950/40 border-rose-400 text-rose-800 dark:text-rose-200';
              } else {
                btnStyle = 'opacity-50 border-slate-200 dark:border-slate-700';
              }
            }

            return (
              <button
                key={idx}
                disabled={hasAnswered}
                onClick={() => handleSelectOption(idx)}
                className={`p-4 rounded-2xl border text-left transition-all flex items-center justify-between font-serif text-base ${btnStyle} ${
                  !hasAnswered ? 'hover:scale-102 active:scale-98' : ''
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-white dark:bg-slate-700 font-sans font-bold text-xs flex items-center justify-center text-slate-500 dark:text-slate-400 shrink-0">
                    {'ABCD'[idx]}
                  </span>
                  <span>{opt.text}</span>
                </div>
                {hasAnswered && opt.isCorrect && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                )}
                {hasAnswered && isSelected && !opt.isCorrect && (
                  <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Explanation Banner */}
        {selectedOption !== null && (
          <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-slate-800/80 border border-amber-200 dark:border-slate-700 space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                {q.options[selectedOption].isCorrect
                  ? lang === 'ja'
                    ? '🎉 正解！'
                    : '🎉 Correct!'
                  : lang === 'ja'
                  ? '惜しい！解説をチェック'
                  : 'Not quite! Check the explanation'}
              </span>
              <button
                onClick={() => {
                  sounds.playPop();
                  onSelectUnit(q.unit);
                }}
                className="text-xs font-bold text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>{lang === 'ja' ? 'この単位の図鑑を見る' : 'View in Index'}</span>
              </button>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              {q.explanation}
            </p>
          </div>
        )}

        {/* Next Question Button */}
        {selectedOption !== null && (
          <div className="flex justify-end">
            <button
              onClick={handleNext}
              className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shadow-md transition-transform active:scale-95"
            >
              <span>
                {currentIndex + 1 === questions.length
                  ? lang === 'ja'
                    ? '結果を見る'
                    : 'See Results'
                  : lang === 'ja'
                  ? '次の問題へ'
                  : 'Next Question'}
              </span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
