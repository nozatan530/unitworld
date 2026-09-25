import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  HelpCircle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  BookOpen,
  Lightbulb,
  History,
  Award,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { UnitDefinition } from '../../types/unit';
import { getUnitTrivia, TriviaQuiz, UnitTriviaBundle } from '../../data/unitTriviaData';
import { sounds } from '../../utils/sound';
import { uSym } from '../../utils/i18n';

interface UnitTriviaQuizCardProps {
  unit: UnitDefinition;
  lang: 'ja' | 'en';
}

export const UnitTriviaQuizCard: React.FC<UnitTriviaQuizCardProps> = ({ unit, lang }) => {
  // 手書きの豆知識がある単位だけカードを出す
  const triviaBundle: UnitTriviaBundle | null = useMemo(() => getUnitTrivia(unit), [unit]);

  const [activeTab, setActiveTab] = useState<'quiz' | 'history' | 'applications'>('quiz');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'history' | 'application'>('all');
  const [currentQuizIndex, setCurrentQuizIndex] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState<boolean>(false);
  const [streak, setStreak] = useState<number>(0);

  // Filter quizzes by category
  const filteredQuizzes = useMemo(() => {
    if (!triviaBundle) return [];
    if (selectedCategory === 'all') return triviaBundle.quizzes;
    return triviaBundle.quizzes.filter((q) => q.category === selectedCategory);
  }, [triviaBundle, selectedCategory]);

  // Reset quiz state when unit or category changes
  useEffect(() => {
    setCurrentQuizIndex(0);
    setSelectedOption(null);
    setHasAnswered(false);
  }, [unit.id, selectedCategory]);

  const rawQuiz: TriviaQuiz | undefined =
    filteredQuizzes[currentQuizIndex % Math.max(1, filteredQuizzes.length)] || triviaBundle?.quizzes[0];

  // 選択肢を並べ替える（データでは正解がいつも先頭にあるため）
  const currentQuiz: TriviaQuiz | undefined = useMemo(() => {
    if (!rawQuiz) return undefined;
    const order = rawQuiz.optionsJa.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return {
      ...rawQuiz,
      optionsJa: order.map((i) => rawQuiz.optionsJa[i]),
      optionsEn: order.map((i) => rawQuiz.optionsEn[i]),
      correctIndex: order.indexOf(rawQuiz.correctIndex),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawQuiz?.id, currentQuizIndex]);

  const handleSelectOption = (index: number) => {
    if (hasAnswered || !currentQuiz) return;
    setSelectedOption(index);
    setHasAnswered(true);

    const isCorrect = index === currentQuiz.correctIndex;
    if (isCorrect) {
      sounds.playSuccess();
      setStreak((s) => s + 1);
    } else {
      sounds.playPop(320);
      setStreak(0);
    }
  };

  const handleNextQuiz = () => {
    sounds.playClick();
    setSelectedOption(null);
    setHasAnswered(false);
    if (filteredQuizzes.length > 1) {
      setCurrentQuizIndex((prev) => (prev + 1) % filteredQuizzes.length);
    } else {
      // If only 1 in filtered, toggle category or shake
      setCurrentQuizIndex((prev) => prev + 1);
    }
  };

  if (!triviaBundle || !currentQuiz) return null;

  const isCorrect = selectedOption === currentQuiz.correctIndex;
  const options = lang === 'ja' ? currentQuiz.optionsJa : currentQuiz.optionsEn;
  const optionLetters = ['A', 'B', 'C', 'D'];

  return (
    <div className="rounded-2xl border border-amber-200/80 dark:border-amber-900/40 bg-gradient-to-br from-amber-50/70 via-orange-50/40 to-amber-100/30 dark:from-slate-800/90 dark:via-slate-850 dark:to-amber-950/20 p-4 sm:p-5 shadow-xs transition-all">
      {/* Top Header with Tab Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3.5 border-b border-amber-200/60 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 dark:bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-black tracking-wide text-amber-900 dark:text-amber-200 uppercase flex items-center gap-1.5">
              <span>{lang === 'ja' ? '科学トリビア ＆ 意外な応用例' : 'Science Trivia & Surprising Applications'}</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300">
                {uSym(unit, lang)}
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {lang === 'ja'
                ? '単位にまつわる歴史の裏話や日常のハイテク応用を学ぶ'
                : 'Discover historical anecdotes and cutting-edge tech applications'}
            </p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center p-0.5 rounded-xl bg-amber-100/80 dark:bg-slate-800 border border-amber-200/70 dark:border-slate-700 text-xs">
          <button
            onClick={() => {
              sounds.playPop();
              setActiveTab('quiz');
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-all ${
              activeTab === 'quiz'
                ? 'bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-300 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-amber-600'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{lang === 'ja' ? 'クイズ' : 'Quiz'}</span>
            {streak > 1 && (
              <span className="text-[10px] px-1 py-0.2 rounded-full bg-amber-500 text-white font-extrabold animate-pulse">
                {streak}🔥
              </span>
            )}
          </button>

          <button
            onClick={() => {
              sounds.playPop();
              setActiveTab('history');
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-all ${
              activeTab === 'history'
                ? 'bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-300 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-amber-600'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>{lang === 'ja' ? '科学の歴史' : 'History'}</span>
          </button>

          <button
            onClick={() => {
              sounds.playPop();
              setActiveTab('applications');
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-all ${
              activeTab === 'applications'
                ? 'bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-300 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-amber-600'
            }`}
          >
            <Lightbulb className="w-3.5 h-3.5" />
            <span>{lang === 'ja' ? '意外な応用' : 'Tech Uses'}</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Quiz Mode */}
      {activeTab === 'quiz' && (
        <div className="pt-3.5 space-y-3.5 animate-in fade-in duration-200">
          {/* Subheader: Category filter & Random trigger */}
          <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {lang === 'ja' ? 'テーマ:' : 'Topic:'}
              </span>
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-2 py-0.5 rounded-md font-medium text-[11px] transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-amber-500 text-white font-bold'
                    : 'bg-white/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-amber-100 dark:hover:bg-slate-700'
                }`}
              >
                {lang === 'ja' ? 'ランダム' : 'All'}
              </button>
              <button
                onClick={() => setSelectedCategory('history')}
                className={`px-2 py-0.5 rounded-md font-medium text-[11px] transition-colors ${
                  selectedCategory === 'history'
                    ? 'bg-amber-500 text-white font-bold'
                    : 'bg-white/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-amber-100 dark:hover:bg-slate-700'
                }`}
              >
                📜 {lang === 'ja' ? '歴史' : 'History'}
              </button>
              <button
                onClick={() => setSelectedCategory('application')}
                className={`px-2 py-0.5 rounded-md font-medium text-[11px] transition-colors ${
                  selectedCategory === 'application'
                    ? 'bg-amber-500 text-white font-bold'
                    : 'bg-white/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-amber-100 dark:hover:bg-slate-700'
                }`}
              >
                💡 {lang === 'ja' ? '応用' : 'Tech'}
              </button>
            </div>

            <button
              onClick={handleNextQuiz}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-slate-700 border border-amber-200 dark:border-slate-700 text-amber-700 dark:text-amber-300 font-semibold shadow-2xs transition-all hover:scale-102 active:scale-98"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{lang === 'ja' ? '別の問題に挑戦' : 'Try Another Quiz'}</span>
            </button>
          </div>

          {/* Question Card Box */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-white dark:bg-slate-850 border border-amber-200/70 dark:border-slate-700/80 shadow-xs">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                {currentQuiz.category === 'history'
                  ? lang === 'ja'
                    ? '📜 科学の歴史トリビア'
                    : '📜 Science History Trivia'
                  : lang === 'ja'
                  ? '💡 意外なハイテク応用'
                  : '💡 Unexpected Real-World Application'}
              </span>
              <span className="text-[11px] text-slate-400">
                Q. {((currentQuizIndex % Math.max(1, filteredQuizzes.length)) + 1)} / {filteredQuizzes.length}
              </span>
            </div>

            <h4 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 leading-snug">
              {lang === 'ja' ? currentQuiz.question : currentQuiz.questionEn}
            </h4>

            {/* Multiple Choice Options */}
            <div className="mt-3.5 space-y-2">
              {options.map((optText, optIdx) => {
                const isSelected = selectedOption === optIdx;
                const isThisCorrect = optIdx === currentQuiz.correctIndex;

                let btnStyle =
                  'bg-slate-50 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-slate-750 border-slate-200/90 dark:border-slate-700 text-slate-700 dark:text-slate-200';

                if (hasAnswered) {
                  if (isThisCorrect) {
                    btnStyle =
                      'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 dark:border-emerald-600 text-emerald-800 dark:text-emerald-200 font-bold';
                  } else if (isSelected && !isThisCorrect) {
                    btnStyle =
                      'bg-rose-50 dark:bg-rose-950/60 border-rose-400 dark:border-rose-600 text-rose-800 dark:text-rose-200 line-through opacity-80';
                  } else {
                    btnStyle = 'opacity-50 border-slate-200 dark:border-slate-800 text-slate-400';
                  }
                }

                return (
                  <button
                    key={optIdx}
                    disabled={hasAnswered}
                    onClick={() => handleSelectOption(optIdx)}
                    className={`w-full text-left p-2.5 sm:p-3 rounded-xl border text-xs sm:text-sm flex items-start gap-2.5 transition-all ${btnStyle} ${
                      !hasAnswered ? 'hover:scale-[1.01] active:scale-[0.99] cursor-pointer' : ''
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-[11px] shrink-0 ${
                        hasAnswered && isThisCorrect
                          ? 'bg-emerald-500 text-white'
                          : hasAnswered && isSelected
                          ? 'bg-rose-500 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {optionLetters[optIdx]}
                    </span>
                    <span className="flex-1 leading-relaxed">{optText}</span>
                    {hasAnswered && isThisCorrect && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 self-center" />
                    )}
                    {hasAnswered && isSelected && !isThisCorrect && (
                      <XCircle className="w-4 h-4 text-rose-500 shrink-0 self-center" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Answer Feedback & Explanation Box */}
            {hasAnswered && (
              <div
                className={`mt-4 p-3.5 rounded-xl border animate-in slide-in-from-top-2 duration-200 ${
                  isCorrect
                    ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
                    : 'bg-amber-50/90 dark:bg-slate-800 border-amber-200 dark:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    {isCorrect ? (
                      <span className="flex items-center gap-1 text-xs font-black text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        {lang === 'ja' ? '🎉 大正解！' : '🎉 Correct!'}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-black text-rose-600 dark:text-rose-400">
                        <XCircle className="w-4 h-4 text-rose-500" />
                        {lang === 'ja' ? '🤔 おしい！' : '🤔 Not quite!'}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={handleNextQuiz}
                    className="text-[11px] font-bold text-amber-700 dark:text-amber-300 hover:underline flex items-center gap-0.5"
                  >
                    <span>{lang === 'ja' ? '次の問題へ' : 'Next Question'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                  {lang === 'ja' ? currentQuiz.explanationJa : currentQuiz.explanationEn}
                </p>

                {/* Extra Trivia Fact Nugget */}
                {(currentQuiz.triviaFactJa || currentQuiz.triviaFactEn) && (
                  <div className="mt-2.5 pt-2 border-t border-amber-200/50 dark:border-slate-700/60 flex items-start gap-1.5 text-[11px] text-amber-800 dark:text-amber-300">
                    <span className="shrink-0 font-bold">✨ {lang === 'ja' ? '豆知識:' : 'Did you know?'}</span>
                    <span className="leading-relaxed">
                      {lang === 'ja' ? currentQuiz.triviaFactJa : currentQuiz.triviaFactEn}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Science History Story Mode */}
      {activeTab === 'history' && (
        <div className="pt-3.5 space-y-3 animate-in fade-in duration-200">
          <div className="p-4 rounded-xl bg-white dark:bg-slate-850 border border-amber-200/70 dark:border-slate-700 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                📜 {lang === 'ja' ? '科学の歴史トリビア' : 'Science History Trivia'}
              </span>
              {lang === 'ja' && triviaBundle.historyTrivia.era && (
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  ⏳ {triviaBundle.historyTrivia.era}
                </span>
              )}
            </div>

            <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 mb-2">
              {lang === 'ja' ? triviaBundle.historyTrivia.title : triviaBundle.historyTrivia.titleEn}
            </h4>

            {lang === 'ja' && triviaBundle.historyTrivia.scientist && (
              <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 mb-2.5 flex items-center gap-1">
                <span>👤 {lang === 'ja' ? '関連科学者:' : 'Key Scientist:'}</span>
                <span>{triviaBundle.historyTrivia.scientist}</span>
              </div>
            )}

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {lang === 'ja' ? triviaBundle.historyTrivia.story : triviaBundle.historyTrivia.storyEn}
            </p>

            <div className="mt-3 p-2.5 rounded-lg bg-amber-50 dark:bg-slate-800/80 border border-amber-200/60 dark:border-slate-700 text-xs text-amber-900 dark:text-amber-200 font-medium flex items-start gap-2">
              <span className="text-base leading-none">💡</span>
              <span className="leading-snug">
                {lang === 'ja'
                  ? triviaBundle.historyTrivia.keyTakeaway
                  : triviaBundle.historyTrivia.keyTakeawayEn}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Unexpected Applications Mode */}
      {activeTab === 'applications' && (
        <div className="pt-3.5 space-y-2.5 animate-in fade-in duration-200">
          {triviaBundle.unexpectedApplications.map((app, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-xl bg-white dark:bg-slate-850 border border-amber-200/70 dark:border-slate-700 shadow-xs flex items-start gap-3"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400/20 to-orange-500/20 border border-amber-300/40 dark:border-amber-700/40 flex items-center justify-center text-xl shrink-0">
                {app.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 flex-wrap mb-1">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
                    {lang === 'ja' ? app.title : app.titleEn}
                  </h4>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {lang === 'ja' ? app.realWorldContext : app.realWorldContextEn}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {lang === 'ja' ? app.description : app.descriptionEn}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
