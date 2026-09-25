import confetti from 'canvas-confetti';

// 端末で「視差効果を減らす／アニメーションを減らす」が有効なら演出を控える
export const prefersReducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

export const celebrate = (opts: confetti.Options) => {
  if (prefersReducedMotion()) return;
  try {
    confetti({ ...opts, disableForReducedMotion: true });
  } catch {}
};
