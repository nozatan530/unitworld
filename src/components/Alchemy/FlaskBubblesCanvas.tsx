import React, { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '../../utils/motion';

interface FlaskBubblesCanvasProps {
  hasItems: boolean;
  hasMatch: boolean;
}

interface FlaskParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  wobbleSpeed: number;
  wobblePhase: number;
}

export const FlaskBubblesCanvas: React.FC<FlaskBubblesCanvasProps> = ({ hasItems, hasMatch }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || prefersReducedMotion()) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const particles: FlaskParticle[] = [];
    const count = hasMatch ? 28 : hasItems ? 16 : 8;

    const colors = hasMatch
      ? ['#06B6D4', '#22D3EE', '#67E8F9', '#0EA5E9', '#FFFFFF']
      : ['#38BDF8', '#60A5FA', '#93C5FD', '#67E8F9', '#A7F3D0'];

    const resize = () => {
      if (!canvas.parentElement) return;
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const initParticle = (): FlaskParticle => {
      const w = canvas.width || 300;
      const h = canvas.height || 200;
      return {
        x: Math.random() * w,
        y: h + Math.random() * 20,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -(0.5 + Math.random() * (hasMatch ? 1.4 : 0.8)),
        radius: 2 + Math.random() * (hasMatch ? 4.5 : 3.5),
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 0.2 + Math.random() * 0.45,
        wobbleSpeed: 0.03 + Math.random() * 0.05,
        wobblePhase: Math.random() * Math.PI * 2,
      };
    };

    for (let i = 0; i < count; i++) {
      const p = initParticle();
      p.y = Math.random() * (canvas.height || 200);
      particles.push(p);
    }

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      particles.forEach((p) => {
        p.wobblePhase += p.wobbleSpeed;
        p.x += p.vx + Math.sin(p.wobblePhase) * 0.4;
        p.y += p.vy;

        // Reset if float out top
        if (p.y < -10) {
          p.y = h + 10;
          p.x = Math.random() * w;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        // Shimmer shine dot
        ctx.fillStyle = '#FFFFFF';
        ctx.globalAlpha = p.alpha * 0.9;
        ctx.beginPath();
        ctx.arc(p.x - p.radius * 0.3, p.y - p.radius * 0.3, p.radius * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [hasItems, hasMatch]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0 rounded-3xl"
    />
  );
};
