import React, { useEffect, useRef } from 'react';

// Rainbow palette: pink, purple, violet, blue, cyan, turquoise, lavender, and soft gold
const RAINBOW_PALETTE = [
  { color: '#f43f5e', glow: 'rgba(244, 63, 94, 0.7)', core: '#ffe4e6' },   // Rose Pink
  { color: '#ec4899', glow: 'rgba(236, 72, 153, 0.7)', core: '#fce7f3' },  // Hot Pink
  { color: '#d946ef', glow: 'rgba(217, 70, 239, 0.7)', core: '#fae8ff' },  // Magenta Orchid
  { color: '#a855f7', glow: 'rgba(168, 85, 247, 0.7)', core: '#f3e8ff' },  // Vibrant Purple
  { color: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.7)', core: '#ede9fe' },  // Violet
  { color: '#6366f1', glow: 'rgba(99, 102, 241, 0.7)', core: '#e0e7ff' },  // Indigo
  { color: '#3b82f6', glow: 'rgba(59, 130, 246, 0.7)', core: '#dbeafe' },  // Bright Azure Blue
  { color: '#06b6d4', glow: 'rgba(6, 182, 212, 0.7)', core: '#cffafe' },   // Cyan
  { color: '#14b8a6', glow: 'rgba(20, 184, 166, 0.7)', core: '#ccfbf1' },  // Turquoise
  { color: '#10b981', glow: 'rgba(16, 185, 129, 0.7)', core: '#d1fae5' },  // Spring Emerald
  { color: '#c084fc', glow: 'rgba(192, 132, 252, 0.7)', core: '#f5d0fe' }, // Lavender
  { color: '#e879f9', glow: 'rgba(232, 121, 249, 0.7)', core: '#fdf4ff' }, // Soft Lilac
  { color: '#f59e0b', glow: 'rgba(245, 158, 11, 0.7)', core: '#fef3c7' },  // Soft Gold
  { color: '#fbbf24', glow: 'rgba(251, 191, 36, 0.7)', core: '#fffbeb' },  // Golden Sunshine
  { color: '#eab308', glow: 'rgba(234, 179, 8, 0.7)', core: '#fef9c3' },   // Rich Warm Gold
];

type StarShape = 'sparkle4' | 'star5' | 'cross4' | 'stella8';

interface StarParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  maxSize: number;
  rotation: number;
  rotSpeed: number;
  paletteItem: (typeof RAINBOW_PALETTE)[number];
  shape: StarShape;
  age: number;
  maxAge: number;
  twinklePhase: number;
  twinkleSpeed: number;
}

export const RainbowStarCursor: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // Respect user's accessibility setting for reduced motion
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    if (prefersReducedMotion) return;

    // Avoid running on coarse touch devices without a mouse
    const hasCoarsePointerOnly =
      window.matchMedia('(pointer: coarse)').matches &&
      !window.matchMedia('(pointer: fine)').matches;
    if (hasCoarsePointerOnly) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrameId: number | null = null;
    let particles: StarParticle[] = [];
    let lastMousePos = { x: -100, y: -100 };
    let hasMouseMoved = false;

    // Handle high DPI crisp canvas sizing
    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas, { passive: true });

    // Helper: generate a single random star particle
    const createStar = (x: number, y: number, spread = 6): StarParticle => {
      const paletteItem =
        RAINBOW_PALETTE[Math.floor(Math.random() * RAINBOW_PALETTE.length)];
      const shapes: StarShape[] = ['sparkle4', 'sparkle4', 'star5', 'cross4', 'stella8'];
      const shape = shapes[Math.floor(Math.random() * shapes.length)];
      
      const size = 5 + Math.random() * 9; // 5px to 14px radius
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.2 + Math.random() * 0.8;
      
      return {
        x: x + (Math.random() - 0.5) * spread,
        y: y + (Math.random() - 0.5) * spread,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.35, // gentle float upward
        size: 0,
        maxSize: size,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.08,
        paletteItem,
        shape,
        age: 0,
        maxAge: 32 + Math.floor(Math.random() * 24), // ~32 to 56 frames (~0.5s - 0.9s)
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.15 + Math.random() * 0.15,
      };
    };

    // Draw 4-point sparkle star (classic magical star with pointed needle rays)
    const drawSparkle4 = (
      c: CanvasRenderingContext2D,
      r: number,
      innerRatio = 0.22
    ) => {
      const innerR = r * innerRatio;
      c.beginPath();
      for (let i = 0; i < 8; i++) {
        const rad = (i * Math.PI) / 4;
        const currentR = i % 2 === 0 ? r : innerR;
        const px = Math.cos(rad) * currentR;
        const py = Math.sin(rad) * currentR;
        if (i === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      c.closePath();
    };

    // Draw 5-pointed traditional magical star
    const drawStar5 = (c: CanvasRenderingContext2D, r: number) => {
      const innerR = r * 0.45;
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const rad = (i * Math.PI) / 5 - Math.PI / 2;
        const currentR = i % 2 === 0 ? r : innerR;
        const px = Math.cos(rad) * currentR;
        const py = Math.sin(rad) * currentR;
        if (i === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      c.closePath();
    };

    // Draw 4-point slender twinkle cross
    const drawCross4 = (c: CanvasRenderingContext2D, r: number) => {
      const innerR = r * 0.12;
      c.beginPath();
      for (let i = 0; i < 8; i++) {
        const rad = (i * Math.PI) / 4;
        const currentR = i % 2 === 0 ? r * 1.15 : innerR;
        const px = Math.cos(rad) * currentR;
        const py = Math.sin(rad) * currentR;
        if (i === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      c.closePath();
    };

    // Draw 8-point stella star
    const drawStella8 = (c: CanvasRenderingContext2D, r: number) => {
      const innerR = r * 0.35;
      c.beginPath();
      for (let i = 0; i < 16; i++) {
        const rad = (i * Math.PI) / 8;
        const currentR = i % 2 === 0 ? (i % 4 === 0 ? r : r * 0.65) : innerR;
        const px = Math.cos(rad) * currentR;
        const py = Math.sin(rad) * currentR;
        if (i === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      c.closePath();
    };

    // Main animation loop
    const render = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.age += 1;

        if (p.age >= p.maxAge) {
          particles.splice(i, 1);
          continue;
        }

        // Physics step
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.98;
        p.vy *= 0.98;
        p.rotation += p.rotSpeed;
        p.twinklePhase += p.twinkleSpeed;

        // Life cycle progress: 0.0 to 1.0
        const progress = p.age / p.maxAge;

        // Size calculation: smooth spring in, then gently shrink
        if (progress < 0.18) {
          p.size = p.maxSize * (progress / 0.18);
        } else {
          p.size = p.maxSize * (1 - (progress - 0.18) / 0.82);
        }

        // Twinkle opacity oscillation
        const twinkle = 0.85 + 0.15 * Math.sin(p.twinklePhase);
        const opacity = Math.max(0, Math.min(1, (1 - progress) * 1.15 * twinkle));

        if (p.size <= 0.2 || opacity <= 0) continue;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = opacity;

        // Subtle color matching glow
        ctx.shadowColor = p.paletteItem.glow;
        ctx.shadowBlur = 6 * (p.size / p.maxSize);

        // Fill colored star body
        ctx.fillStyle = p.paletteItem.color;

        if (p.shape === 'star5') {
          drawStar5(ctx, p.size);
        } else if (p.shape === 'cross4') {
          drawCross4(ctx, p.size);
        } else if (p.shape === 'stella8') {
          drawStella8(ctx, p.size);
        } else {
          drawSparkle4(ctx, p.size);
        }
        ctx.fill();

        // White/tinted bright core sparkle for magical diamond sheen
        if (p.size > 2.5) {
          ctx.shadowBlur = 2;
          ctx.shadowColor = '#ffffff';
          ctx.fillStyle = '#ffffff';
          drawSparkle4(ctx, p.size * 0.42, 0.3);
          ctx.fill();
        }

        ctx.restore();
      }

      // If particles remain, keep RAF running; otherwise sleep until next mousemove
      if (particles.length > 0) {
        animFrameId = requestAnimationFrame(render);
      } else {
        animFrameId = null;
      }
    };

    // Start loop if not already running
    const ensureLoop = () => {
      if (!animFrameId) {
        animFrameId = requestAnimationFrame(render);
      }
    };

    // Mouse movement listener
    const onMouseMove = (e: MouseEvent) => {
      const curX = e.clientX;
      const curY = e.clientY;

      if (!hasMouseMoved) {
        lastMousePos = { x: curX, y: curY };
        hasMouseMoved = true;
        return;
      }

      const dx = curX - lastMousePos.x;
      const dy = curY - lastMousePos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Only spawn if mouse moved a perceptible distance
      if (dist > 3) {
        // Interpolate along movement vector for silky smooth trail on fast sweeps
        const steps = Math.min(6, Math.max(1, Math.floor(dist / 9)));
        for (let s = 1; s <= steps; s++) {
          const t = s / steps;
          const interpX = lastMousePos.x + dx * t;
          const interpY = lastMousePos.y + dy * t;
          // Spawn 1 or 2 stars per step for a rich, vibrant trail
          particles.push(createStar(interpX, interpY, 4));
          if (Math.random() < 0.45) {
            particles.push(createStar(interpX, interpY, 6));
          }
        }

        // Limit total particle pool to prevent any frame drops
        if (particles.length > 90) {
          particles.splice(0, particles.length - 90);
        }

        lastMousePos = { x: curX, y: curY };
        ensureLoop();
      }
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', onMouseMove);
      if (animFrameId) cancelAnimationFrame(animFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-50 select-none overflow-hidden"
      style={{
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    />
  );
};
