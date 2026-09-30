import React, { useEffect, useRef, useState, useCallback } from 'react';
import { celebrate, prefersReducedMotion } from '../../utils/motion';
import {
  Sparkles,
  Zap,
  Repeat,
  Volume2,
  VolumeX,
  Palette,
  Eye,
  GitBranch,
  X,
  FlaskConical,
} from 'lucide-react';
import { UnitDefinition } from '../../types/unit';
import { sounds } from '../../utils/sound';
import { uSym, bySymLength } from '../../utils/i18n';

interface SynthesisSuccessModalProps {
  unit: UnitDefinition;
  formulaDesc: string;
  onClose: () => void;
  onInspect: (unit: UnitDefinition) => void;
  onOpenTree?: () => void;
  lang: 'ja' | 'en';
}

type EffectTheme = 'gold' | 'cosmic' | 'rainbow';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  angle: number;
  spin: number;
  type: 'star' | 'circle' | 'bubble' | 'ring';
}

export const SynthesisSuccessModal: React.FC<SynthesisSuccessModalProps> = ({
  unit,
  formulaDesc,
  onClose,
  onInspect,
  onOpenTree,
  lang,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const runesRotationRef = useRef<number>(0);
  const [theme, setTheme] = useState<EffectTheme>('gold');
  const [soundEnabled, setSoundEnabled] = useState(sounds.enabled);

  // Palettes per theme
  const themePalettes: Record<EffectTheme, string[]> = {
    gold: ['#F59E0B', '#FBBF24', '#FCD34D', '#F97316', '#FEF08A', '#FFFBEB', '#D97706'],
    cosmic: ['#38BDF8', '#818CF8', '#C084FC', '#F472B6', '#06B6D4', '#E0E7FF', '#6366F1'],
    rainbow: ['#EF4444', '#F97316', '#F59E0B', '#10B981', '#06B6D4', '#6366F1', '#EC4899'],
  };

  // Spawn a fresh burst of transmutation particles
  const spawnBurst = useCallback((activeTheme: EffectTheme = theme) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    const colors = themePalettes[activeTheme];
    const newParticles: Particle[] = [];

    // 1. Radiant central burst stars (60 particles)
    for (let i = 0; i < 65; i++) {
      const angle = (Math.PI * 2 * i) / 65 + (Math.random() - 0.5) * 0.2;
      const speed = 2.0 + Math.random() * 4.5;
      newParticles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 2.5 + Math.random() * 3.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        life: 0,
        maxLife: 60 + Math.random() * 40,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.2,
        type: 'star',
      });
    }

    // 2. High-speed shimmering glowing orbs (40 particles)
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.0 + Math.random() * 3.0;
      newParticles.push({
        x: centerX + Math.cos(angle) * 20,
        y: centerY + Math.sin(angle) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 1.5 + Math.random() * 3.0,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        life: 0,
        maxLife: 50 + Math.random() * 45,
        angle: 0,
        spin: 0,
        type: 'circle',
      });
    }

    // 3. Floating rising alchemy bubbles (30 particles)
    for (let i = 0; i < 30; i++) {
      newParticles.push({
        x: centerX + (Math.random() - 0.5) * 200,
        y: centerY + 80 + Math.random() * 60,
        vx: (Math.random() - 0.5) * 1.0,
        vy: -(1.2 + Math.random() * 2.2),
        radius: 3.5 + Math.random() * 4.0,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 0.9,
        life: 0,
        maxLife: 70 + Math.random() * 50,
        angle: 0,
        spin: 0,
        type: 'bubble',
      });
    }

    // 4. Expanding shockwave ring
    newParticles.push({
      x: centerX,
      y: centerY,
      vx: 0,
      vy: 0,
      radius: 10,
      color: colors[0],
      alpha: 1,
      life: 0,
      maxLife: 45,
      angle: 0,
      spin: 0,
      type: 'ring',
    });

    particlesRef.current = [...particlesRef.current, ...newParticles];

    celebrate({ particleCount: 50, spread: 80, origin: { y: 0.55 }, colors: colors.slice(0, 5) });
  }, [theme]);

  // Initial trigger on mount
  useEffect(() => {
    sounds.playAlchemyFanfare();
    spawnBurst('gold');
  }, [spawnBurst]);

  // Main Canvas Rendering Loop (Sacred Alchemy Transmutation Runes + Dynamic Particles)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || prefersReducedMotion()) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      if (!canvas.parentElement) return;
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // --- Draw Sacred Alchemy Transmutation Circle (錬成陣) ---
      runesRotationRef.current += 0.008;
      const rot = runesRotationRef.current;
      const ringRadius = Math.min(width, height) * 0.38;

      ctx.save();
      ctx.translate(centerX, centerY);

      // Outer delicate glowing circle
      ctx.strokeStyle = theme === 'gold' ? 'rgba(245, 158, 11, 0.25)' : theme === 'cosmic' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(236, 72, 153, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Middle dashed runic circle (rotating clockwise)
      ctx.save();
      ctx.rotate(rot);
      ctx.setLineDash([8, 12]);
      ctx.strokeStyle = theme === 'gold' ? 'rgba(251, 191, 36, 0.35)' : theme === 'cosmic' ? 'rgba(129, 140, 248, 0.35)' : 'rgba(249, 115, 22, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, ringRadius * 0.85, 0, Math.PI * 2);
      ctx.stroke();

      // Runic tick marks along the perimeter
      for (let i = 0; i < 16; i++) {
        const a = (Math.PI * 2 * i) / 16;
        const innerR = ringRadius * 0.88;
        const outerR = ringRadius * 0.98;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * innerR, Math.sin(a) * innerR);
        ctx.lineTo(Math.cos(a) * outerR, Math.sin(a) * outerR);
        ctx.stroke();
      }
      ctx.restore();

      // Inner sacred equilateral triangle (counter-rotating)
      ctx.save();
      ctx.rotate(-rot * 1.2);
      ctx.setLineDash([]);
      ctx.strokeStyle = theme === 'gold' ? 'rgba(245, 158, 11, 0.28)' : theme === 'cosmic' ? 'rgba(192, 132, 252, 0.28)' : 'rgba(16, 185, 129, 0.28)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const triR = ringRadius * 0.65;
      for (let i = 0; i < 3; i++) {
        const a = (Math.PI * 2 * i) / 3 - Math.PI / 2;
        const px = Math.cos(a) * triR;
        const py = Math.sin(a) * triR;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();

      // Interlocking inverted triangle forming a hexagram star
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = (Math.PI * 2 * i) / 3 + Math.PI / 2;
        const px = Math.cos(a) * triR;
        const py = Math.sin(a) * triR;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      ctx.restore();

      // --- Draw Dynamic Particle Engine ---
      const activeParticles: Particle[] = [];

      for (let i = 0; i < particlesRef.current.length; i++) {
        const p = particlesRef.current[i];
        p.life++;
        p.alpha = Math.max(0, 1 - p.life / p.maxLife);

        if (p.type === 'ring') {
          p.radius += 4.5;
          ctx.save();
          ctx.strokeStyle = p.color;
          ctx.globalAlpha = p.alpha * 0.7;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        } else if (p.type === 'bubble') {
          p.x += p.vx + Math.sin(p.life * 0.15) * 0.8;
          p.y += p.vy;
          ctx.save();
          ctx.globalAlpha = p.alpha * 0.65;
          ctx.fillStyle = p.color;
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Bubble glossy shine spot
          ctx.fillStyle = '#FFFFFF';
          ctx.globalAlpha = p.alpha * 0.9;
          ctx.beginPath();
          ctx.arc(p.x - p.radius * 0.35, p.y - p.radius * 0.35, p.radius * 0.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (p.type === 'circle') {
          p.x += p.vx;
          p.y += p.vy;
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 8;
          ctx.shadowColor = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
          // 4-pointed sparkle star
          p.x += p.vx;
          p.y += p.vy;
          p.angle += p.spin;

          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 10;
          ctx.shadowColor = p.color;

          ctx.beginPath();
          const r = p.radius;
          ctx.moveTo(0, -r * 1.8);
          ctx.quadraticCurveTo(0, 0, r * 1.8, 0);
          ctx.quadraticCurveTo(0, 0, 0, r * 1.8);
          ctx.quadraticCurveTo(0, 0, -r * 1.8, 0);
          ctx.quadraticCurveTo(0, 0, 0, -r * 1.8);
          ctx.fill();
          ctx.restore();
        }

        if (p.life < p.maxLife) {
          activeParticles.push(p);
        }
      }

      particlesRef.current = activeParticles;
      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [theme]);

  // Interactive mouse/touch trail: leaves glowing alchemical fairy dust on pointer movement
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const colors = themePalettes[theme];

    for (let i = 0; i < 2; i++) {
      particlesRef.current.push({
        x: x + (Math.random() - 0.5) * 12,
        y: y + (Math.random() - 0.5) * 12,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -0.8 - Math.random() * 1.2,
        radius: 1.5 + Math.random() * 2.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 0.9,
        life: 0,
        maxLife: 30 + Math.random() * 20,
        angle: Math.random() * Math.PI,
        spin: 0.1,
        type: Math.random() > 0.4 ? 'star' : 'bubble',
      });
    }
  };

  const handleReplayEffect = () => {
    sounds.playAlchemyFanfare();
    spawnBurst(theme);
  };

  const handleThemeChange = (newTheme: EffectTheme) => {
    sounds.playPop(580);
    setTheme(newTheme);
    spawnBurst(newTheme);
  };

  const toggleSound = () => {
    const next = sounds.toggle();
    setSoundEnabled(next);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
      onPointerMove={handlePointerMove}
    >
      <div
        className="relative w-full max-w-lg bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl shadow-2xl border-2 border-amber-300/80 dark:border-amber-500/50 p-6 sm:p-8 text-center overflow-hidden flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Full-bleed HTML5 Canvas for Transmutation Circle & Alchemy Particles */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none z-0"
        />

        {/* Ambient Radial Soft Glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-gradient-to-tr from-amber-400/25 via-orange-400/20 to-yellow-300/20 blur-3xl pointer-events-none" />

        {/* Top Controls: Sound Toggle, Theme Selector, Close */}
        <div className="relative z-10 w-full flex items-center justify-between gap-2 mb-2">
          {/* Theme Selector */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 px-1.5 flex items-center gap-1">
              <Palette className="w-3 h-3" />
              <span>{lang === 'ja' ? '演出' : 'Vibe'}</span>
            </span>
            <button
              onClick={() => handleThemeChange('gold')}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all ${
                theme === 'gold'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-amber-600'
              }`}
            >
              {lang === 'ja' ? '黄金' : 'Gold'}
            </button>
            <button
              onClick={() => handleThemeChange('cosmic')}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all ${
                theme === 'cosmic'
                  ? 'bg-sky-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-sky-500'
              }`}
            >
              {lang === 'ja' ? '星雲' : 'Cosmic'}
            </button>
            <button
              onClick={() => handleThemeChange('rainbow')}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all ${
                theme === 'rainbow'
                  ? 'bg-gradient-to-r from-pink-500 to-indigo-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-pink-500'
              }`}
            >
              {lang === 'ja' ? '虹色' : 'Rainbow'}
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Audio Toggle */}
            <button
              onClick={toggleSound}
              className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              title={soundEnabled ? 'Mute' : 'Unmute'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-500" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Container (z-10) */}
        <div className="relative z-10 w-full flex flex-col items-center space-y-4">
          {/* Top Banner Tag */}
          <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-amber-500/30 animate-pop-stamp">
            <Sparkles className="w-4 h-4 animate-spin" style={{ animationDuration: '4s' }} />
            <span>{lang === 'ja' ? '✨ 錬 成 成 功 ! ✨' : '✨ ALCHEMY SUCCESS! ✨'}</span>
          </div>

          {/* Central Unit Emblem with Spinning Radiant Sunburst & Pop Stamp */}
          <div className="relative my-2 flex items-center justify-center">
            {/* Sunburst Beams (CSS animated continuous rotation) */}
            <div
              className="absolute -inset-10 pointer-events-none opacity-20 dark:opacity-30 animate-magic-ray-spin"
              style={{
                backgroundImage:
                  theme === 'gold'
                    ? 'conic-gradient(from 0deg, #F59E0B 0deg 15deg, transparent 15deg 30deg, #F59E0B 30deg 45deg, transparent 45deg 60deg, #F59E0B 60deg 75deg, transparent 75deg 90deg, #F59E0B 90deg 105deg, transparent 105deg 120deg, #F59E0B 120deg 135deg, transparent 135deg 150deg, #F59E0B 150deg 165deg, transparent 165deg 180deg, #F59E0B 180deg 195deg, transparent 195deg 210deg, #F59E0B 210deg 225deg, transparent 225deg 240deg, #F59E0B 240deg 255deg, transparent 255deg 270deg, #F59E0B 270deg 285deg, transparent 285deg 300deg, #F59E0B 300deg 315deg, transparent 315deg 330deg, #F59E0B 330deg 345deg, transparent 345deg 360deg)'
                    : theme === 'cosmic'
                    ? 'conic-gradient(from 0deg, #38BDF8 0deg 15deg, transparent 15deg 30deg, #818CF8 30deg 45deg, transparent 45deg 60deg, #C084FC 60deg 75deg, transparent 75deg 90deg, #38BDF8 90deg 105deg, transparent 105deg 120deg, #818CF8 120deg 135deg, transparent 135deg 150deg, #C084FC 150deg 165deg, transparent 165deg 180deg, #38BDF8 180deg 195deg, transparent 195deg 210deg, #818CF8 210deg 225deg, transparent 225deg 240deg, #C084FC 240deg 255deg, transparent 255deg 270deg, #38BDF8 270deg 285deg, transparent 285deg 300deg, #818CF8 300deg 315deg, transparent 315deg 330deg, #C084FC 330deg 345deg, transparent 345deg 360deg)'
                    : 'conic-gradient(from 0deg, #EC4899 0deg 15deg, transparent 15deg 30deg, #F59E0B 30deg 45deg, transparent 45deg 60deg, #10B981 60deg 75deg, transparent 75deg 90deg, #06B6D4 90deg 105deg, transparent 105deg 120deg, #6366F1 120deg 135deg, transparent 135deg 150deg, #EC4899 150deg 165deg, transparent 165deg 180deg, #F59E0B 180deg 195deg, transparent 195deg 210deg, #10B981 210deg 225deg, transparent 225deg 240deg, #06B6D4 240deg 255deg, transparent 255deg 270deg, #6366F1 270deg 285deg, transparent 285deg 300deg, #EC4899 300deg 315deg, transparent 315deg 330deg, #F59E0B 330deg 345deg, transparent 345deg 360deg)',
              }}
            />

            {/* Glowing Pulse Ring */}
            <div className="absolute -inset-6 rounded-full border-2 border-amber-400/50 dark:border-amber-400/30 pointer-events-none animate-pulse-ring" />

            {/* Spinning decorative runic ring */}
            <div
              className="absolute -inset-4 rounded-full border-2 border-dashed border-amber-500/60 dark:border-amber-400/40 pointer-events-none animate-runic-spin-ccw"
            />

            {/* Tactile 3D Main Emblem Badge */}
            <div className="min-w-28 h-28 px-4 rounded-3xl bg-gradient-to-br from-amber-50 via-white to-orange-100 dark:from-slate-800 dark:via-slate-850 dark:to-slate-750 border-3 border-amber-400 dark:border-amber-500 shadow-2xl shadow-amber-500/30 flex items-center justify-center transform transition-transform hover:scale-108 animate-pop-stamp select-none">
              <span className={`font-serif font-black whitespace-nowrap text-amber-600 dark:text-amber-400 filter drop-shadow-sm ${bySymLength(uSym(unit, lang), 'text-5xl sm:text-6xl', 'text-4xl sm:text-5xl', 'text-3xl sm:text-4xl')}`}>
                {uSym(unit, lang)}
              </span>
            </div>
          </div>

          {/* Unit Name, Quantity, and Domain */}
          <div className="space-y-1">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
              {lang === 'ja' ? unit.name : unit.nameEn || unit.name}
            </h2>
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400">
              <span>{lang === 'ja' ? `物理量: ${unit.qty}` : `Quantity: ${unit.qtyEn || unit.qty}`}</span>
              <span>·</span>
              <span className="text-slate-600 dark:text-slate-400">
                {lang === 'ja' ? unit.field : unit.fieldEn || unit.field}
              </span>
            </div>
          </div>

          {/* Synthesis Formula Equation Card */}
          {formulaDesc && (
            <div className="w-full px-4 py-2.5 rounded-2xl bg-amber-50/90 dark:bg-slate-800/90 border border-amber-200 dark:border-slate-700 text-xs font-serif font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2 shadow-2xs">
              <span className="text-slate-600 dark:text-slate-400 font-sans text-xs">
                {lang === 'ja' ? '調合式:' : 'Recipe:'}
              </span>
              <span className="text-slate-800 dark:text-slate-100 text-sm tracking-wide">{formulaDesc}</span>
              <span className="text-amber-500 font-sans font-bold">➔</span>
              <span className="text-base font-black text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-lg bg-white dark:bg-slate-700 border border-amber-300 dark:border-slate-600 shadow-2xs">
                {uSym(unit, lang)}
              </span>
            </div>
          )}

          {/* Educational Note Preview */}
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-sm line-clamp-3">
            {lang === 'ja' ? unit.note : unit.noteEn || unit.note}
          </p>

          {/* Replay Effect Button Bar */}
          <div className="w-full flex items-center justify-center gap-2 py-1">
            <button
              onClick={handleReplayEffect}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-100/80 dark:bg-amber-950/50 hover:bg-amber-200/80 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-300/80 dark:border-amber-700 text-xs font-bold transition-all hover:scale-104 active:scale-95 shadow-2xs"
            >
              <Repeat className="w-3.5 h-3.5" />
              <span>{lang === 'ja' ? '💥 エフェクトをもう一度再生' : 'Replay Transmutation'}</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="w-full pt-1 flex flex-col sm:flex-row items-center justify-center gap-2.5">
            <button
              onClick={() => {
                sounds.playPop();
                onInspect(unit);
                onClose();
              }}
              className="w-full sm:flex-1 py-2.5 px-4 rounded-xl font-bold text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all hover:scale-102 flex items-center justify-center gap-1.5"
            >
              <Eye className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
              <span>{lang === 'ja' ? '図鑑で詳しく見る' : 'Inspect Unit'}</span>
            </button>

            {onOpenTree && (
              <button
                onClick={() => {
                  sounds.playPop(560);
                  onOpenTree();
                  onClose();
                }}
                className="w-full sm:flex-1 py-2.5 px-4 rounded-xl font-bold text-xs bg-amber-100 dark:bg-amber-950/60 hover:bg-amber-200 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 transition-all hover:scale-102 flex items-center justify-center gap-1.5"
              >
                <GitBranch className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>{lang === 'ja' ? '錬成ツリーで確認' : 'View in Tree'}</span>
              </button>
            )}

            <button
              onClick={() => {
                sounds.playClick();
                onClose();
              }}
              className="w-full sm:w-auto py-2.5 px-5 rounded-xl font-bold text-xs bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white shadow-md shadow-amber-500/30 transition-transform active:scale-95 flex items-center justify-center gap-1.5"
            >
              <FlaskConical className="w-3.5 h-3.5" />
              <span>{lang === 'ja' ? '調合を続ける' : 'Keep Crafting'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
