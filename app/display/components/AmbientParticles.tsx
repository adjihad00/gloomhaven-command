import { h } from 'preact';
import { useRef, useEffect } from 'preact/hooks';

type ParticlePreset = 'embers' | 'fog' | 'dust' | 'snow';

interface AmbientParticlesProps {
  preset?: ParticlePreset;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  life: number;
  maxLife: number;
  color: string;
}

const PRESETS: Record<ParticlePreset, {
  count: number;
  colors: string[];
  sizeRange: [number, number];
  speedRange: [number, number];
  lifeRange: [number, number];
  direction: 'up' | 'down' | 'horizontal' | 'random';
  opacityRange: [number, number];
}> = {
  embers: {
    count: 60,
    colors: ['#d3a663', '#b87333', '#e8c882', '#c4944a'],
    sizeRange: [1.5, 4],
    speedRange: [0.15, 0.6],
    lifeRange: [120, 300],
    direction: 'up',
    opacityRange: [0.2, 0.7],
  },
  fog: {
    count: 30,
    colors: ['#7a6a5a', '#9a8a7a', '#6a5a4a'],
    sizeRange: [20, 60],
    speedRange: [0.1, 0.3],
    lifeRange: [200, 500],
    direction: 'horizontal',
    opacityRange: [0.02, 0.06],
  },
  dust: {
    count: 40,
    colors: ['#c4b5a0', '#d3a663', '#b87333'],
    sizeRange: [0.5, 2],
    speedRange: [0.05, 0.2],
    lifeRange: [150, 400],
    direction: 'random',
    opacityRange: [0.1, 0.3],
  },
  snow: {
    count: 80,
    colors: ['#ffffff', '#e0e8f0', '#c8d8e8', '#ddeeff'],
    sizeRange: [1, 3.5],
    speedRange: [0.3, 0.8],
    lifeRange: [200, 500],
    direction: 'down',
    opacityRange: [0.15, 0.5],
  },
};

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function createParticle(w: number, h: number, preset: typeof PRESETS['embers']): Particle {
  const color = preset.colors[Math.floor(Math.random() * preset.colors.length)];
  const size = rand(...preset.sizeRange);
  const speed = rand(...preset.speedRange);
  const life = rand(...preset.lifeRange);

  let vx = 0;
  let vy = 0;
  let x = rand(0, w);
  let y = rand(0, h);

  switch (preset.direction) {
    case 'up':
      vx = rand(-0.15, 0.15);
      vy = -speed;
      y = h + rand(0, 50);
      break;
    case 'down':
      vx = rand(-0.2, 0.2);
      vy = speed;
      y = -rand(0, 50);
      break;
    case 'horizontal':
      vx = speed * (Math.random() > 0.5 ? 1 : -1);
      vy = rand(-0.02, 0.02);
      break;
    case 'random':
      vx = rand(-speed, speed);
      vy = rand(-speed, speed);
      break;
  }

  return {
    x, y, vx, vy, size,
    opacity: rand(...preset.opacityRange),
    life, maxLife: life, color,
  };
}

export function AmbientParticles({ preset = 'embers' }: AmbientParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const config = PRESETS[preset];
    let w = window.innerWidth;
    let h = window.innerHeight;

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas!.width = w;
      canvas!.height = h;
    }
    resize();
    window.addEventListener('resize', resize);

    // Initialize particles
    particlesRef.current = [];
    for (let i = 0; i < config.count; i++) {
      const p = createParticle(w, h, config);
      p.life = rand(0, p.maxLife); // stagger initial lifecycle
      particlesRef.current.push(p);
    }

    function animate() {
      if (document.hidden) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      }

      ctx!.clearRect(0, 0, w, h);
      const particles = particlesRef.current;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Update
        p.x += p.vx + rand(-0.05, 0.05); // wobble
        p.y += p.vy;
        p.life--;

        // Fade near edges and at life boundaries
        const lifeFade = Math.min(p.life / 30, (p.maxLife - p.life) / 30, 1);
        const edgeFadeX = Math.min(p.x / 50, (w - p.x) / 50, 1);
        const edgeFadeY = Math.min(p.y / 50, (h - p.y) / 50, 1);
        const alpha = p.opacity * lifeFade * Math.max(0, edgeFadeX) * Math.max(0, edgeFadeY);

        // Draw
        if (alpha > 0.005) {
          ctx!.globalAlpha = alpha;
          ctx!.fillStyle = p.color;

          if (p.size > 10) {
            // Fog: draw as soft circle
            const gradient = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
            gradient.addColorStop(0, p.color);
            gradient.addColorStop(1, 'transparent');
            ctx!.fillStyle = gradient;
            ctx!.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
          } else {
            // Embers/dust: draw as circle
            ctx!.beginPath();
            ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx!.fill();
          }
        }

        // Respawn
        if (p.life <= 0 || p.y < -20 || p.y > h + 60 || p.x < -60 || p.x > w + 60) {
          particles[i] = createParticle(w, h, config);
        }
      }

      ctx!.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(animate);
    }

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [preset]);

  return <canvas ref={canvasRef} class="ambient-particles" />;
}
