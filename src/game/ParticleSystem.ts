import { Container, Graphics } from 'pixi.js';
import { PARTICLES, TANK, WATER_JET } from '../config';
import { rand } from '../utils/math';
import { feel } from './FeelSettings';

type ParticleKind = 'water' | 'bubble' | 'glitter' | 'firework';

interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: number;
  alpha: number;
  g: Graphics;
  active: boolean;
}

/**
 * Pooled particle system for water jets, bubbles, glitter, fireworks.
 * Uses simple Graphics primitives — efficient on Pi 5.
 */
export class ParticleSystem {
  readonly container = new Container();
  private pool: Particle[] = [];
  private activeCount = 0;

  constructor(private parent: Container) {
    this.container.label = 'particles';
    // Keep particles clipped-ish by sorting under water glass later
    parent.addChild(this.container);
    this.preallocate();
  }

  private preallocate(): void {
    const total =
      PARTICLES.maxWater +
      PARTICLES.maxBubbles +
      PARTICLES.maxGlitter +
      PARTICLES.maxFireworks;
    for (let i = 0; i < total; i++) {
      const g = new Graphics();
      g.visible = false;
      this.container.addChild(g);
      this.pool.push({
        kind: 'water',
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        size: 2,
        color: 0xffffff,
        alpha: 1,
        g,
        active: false,
      });
    }
  }

  private acquire(
    kind: ParticleKind,
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    size: number,
    color: number
  ): void {
    const p = this.pool.find((q) => !q.active);
    if (!p) return;
    p.active = true;
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = life;
    p.maxLife = life;
    p.size = size;
    p.color = color;
    p.alpha = 1;
    p.g.visible = true;
    this.activeCount++;
    this.drawParticle(p);
  }

  private release(p: Particle): void {
    if (!p.active) return;
    p.active = false;
    p.g.visible = false;
    p.g.clear();
    this.activeCount--;
  }

  private drawParticle(p: Particle): void {
    const g = p.g;
    g.clear();
    const a = p.alpha;
    if (p.kind === 'water') {
      g.circle(0, 0, p.size);
      g.fill({ color: p.color, alpha: a * 0.75 });
      g.circle(-p.size * 0.25, -p.size * 0.25, p.size * 0.35);
      g.fill({ color: 0xffffff, alpha: a * 0.35 });
    } else if (p.kind === 'bubble') {
      g.circle(0, 0, p.size);
      g.stroke({ width: 1.2, color: 0xc8eeff, alpha: a * 0.85 });
      g.circle(-p.size * 0.3, -p.size * 0.3, p.size * 0.25);
      g.fill({ color: 0xffffff, alpha: a * 0.5 });
    } else if (p.kind === 'glitter') {
      // tiny diamond
      g.moveTo(0, -p.size);
      g.lineTo(p.size * 0.6, 0);
      g.lineTo(0, p.size);
      g.lineTo(-p.size * 0.6, 0);
      g.closePath();
      g.fill({ color: p.color, alpha: a });
    } else {
      // firework spark
      g.circle(0, 0, p.size);
      g.fill({ color: p.color, alpha: a });
    }
    g.x = p.x;
    g.y = p.y;
  }

  /** Emit water jet particles from nozzle */
  emitJet(side: 'left' | 'right', strong: boolean, dt: number): void {
    const jx = side === 'left' ? WATER_JET.jetXLeft : WATER_JET.jetXRight;
    const jy = WATER_JET.jetY;
    const rate = strong ? feel.particleRateStrong() : feel.particleRateWeak();
    // fractional spawn based on dt (60fps base)
    const n = Math.max(1, Math.round((rate * dt) / 16.67));
    const waterCount = this.countKind('water');
    const maxWater = feel.maxWaterParticles();

    for (let i = 0; i < n; i++) {
      if (waterCount + i >= maxWater) break;
      const sideSign = side === 'left' ? 1 : -1;
      const speed = strong ? rand(4.5, 8.5) : rand(2.2, 4.5);
      const angle = -Math.PI / 2 + sideSign * rand(-0.35, 0.55) + rand(-0.2, 0.2);
      this.acquire(
        'water',
        jx + rand(-6, 6),
        jy + rand(-2, 2),
        Math.cos(angle) * speed + sideSign * rand(0.2, 1.2),
        Math.sin(angle) * speed,
        PARTICLES.waterLife * rand(0.7, 1.2),
        strong ? rand(2.5, 5) : rand(1.5, 3.2),
        Math.random() > 0.3 ? 0xa8e0f5 : 0xffffff
      );
    }

    // occasional bubbles from jet
    if (Math.random() < (strong ? 0.35 : 0.15)) {
      this.emitBubble(jx + rand(-10, 10), jy - rand(5, 30));
    }
  }

  emitBubble(x: number, y: number): void {
    if (this.countKind('bubble') >= PARTICLES.maxBubbles) return;
    if (x < TANK.x || x > TANK.x + TANK.width) return;
    this.acquire(
      'bubble',
      x,
      y,
      rand(-0.3, 0.3),
      rand(-1.2, -0.4),
      PARTICLES.bubbleLife * rand(0.6, 1.2),
      rand(2, 6),
      0xffffff
    );
  }

  /** Ambient bubbles rising through tank */
  ambientBubbles(dt: number): void {
    if (Math.random() < 0.04 * (dt / 16.67)) {
      this.emitBubble(
        rand(TANK.x + 20, TANK.x + TANK.width - 20),
        rand(TANK.y + TANK.height * 0.4, TANK.y + TANK.height - 20)
      );
    }
  }

  /** Floating glitter / confetti sparkles in water */
  ensureGlitter(): void {
    while (this.countKind('glitter') < PARTICLES.maxGlitter) {
      const colors = [0xffd700, 0xff6bcb, 0x7fdbff, 0xffffff, 0xff9f43];
      this.acquire(
        'glitter',
        rand(TANK.x + 15, TANK.x + TANK.width - 15),
        rand(TANK.y + 20, TANK.y + TANK.height - 30),
        rand(-0.25, 0.25),
        rand(-0.15, 0.15),
        PARTICLES.glitterLife * rand(0.8, 1.4),
        rand(1.5, 3.5),
        colors[Math.floor(Math.random() * colors.length)]!
      );
    }
  }

  emitFireworks(cx: number, cy: number): void {
    const colors = [0xff5252, 0xffeb3b, 0x69f0ae, 0x40c4ff, 0xea80fc, 0xffab40];
    const bursts = 3;
    for (let b = 0; b < bursts; b++) {
      const ox = cx + rand(-80, 80);
      const oy = cy + rand(-40, 40);
      for (let i = 0; i < 40; i++) {
        if (this.countKind('firework') >= PARTICLES.maxFireworks) return;
        const ang = rand(0, Math.PI * 2);
        const sp = rand(1.5, 6);
        this.acquire(
          'firework',
          ox,
          oy,
          Math.cos(ang) * sp,
          Math.sin(ang) * sp - 1,
          rand(0.8, 1.6),
          rand(1.5, 3.5),
          colors[Math.floor(Math.random() * colors.length)]!
        );
      }
    }
  }

  private countKind(kind: ParticleKind): number {
    let n = 0;
    for (const p of this.pool) if (p.active && p.kind === kind) n++;
    return n;
  }

  update(dt: number): void {
    const dtSec = dt / 1000;
    const tankTop = TANK.y + 8;
    const tankBottom = TANK.y + TANK.height;
    const tankLeft = TANK.x;
    const tankRight = TANK.x + TANK.width;

    for (const p of this.pool) {
      if (!p.active) continue;
      p.life -= dtSec;
      if (p.life <= 0) {
        this.release(p);
        continue;
      }

      // Integration
      if (p.kind === 'water') {
        p.vy += 0.12; // gravity
        p.vx *= 0.99;
      } else if (p.kind === 'bubble') {
        p.vy -= 0.02; // buoyancy
        p.vx += Math.sin(p.life * 5 + p.x) * 0.02;
      } else if (p.kind === 'glitter') {
        p.vx += Math.sin(p.life * 2 + p.y) * 0.01;
        p.vy += Math.cos(p.life * 1.5 + p.x) * 0.008;
        // soft bounds bounce
        if (p.x < tankLeft + 10 || p.x > tankRight - 10) p.vx *= -1;
        if (p.y < tankTop + 15 || p.y > tankBottom - 15) p.vy *= -1;
      } else {
        // firework
        p.vy += 0.08;
        p.vx *= 0.98;
      }

      p.x += p.vx;
      p.y += p.vy;

      // Kill water outside tank roughly
      if (p.kind === 'water') {
        if (p.y < tankTop - 20 || p.y > tankBottom + 10 || p.x < tankLeft - 20 || p.x > tankRight + 20) {
          this.release(p);
          continue;
        }
      }
      if (p.kind === 'bubble' && p.y < tankTop + 5) {
        this.release(p);
        continue;
      }

      p.alpha = Math.min(1, p.life / (p.maxLife * 0.35));
      if (p.kind === 'glitter') {
        p.alpha = 0.4 + 0.6 * Math.abs(Math.sin(p.life * 6));
      }

      p.g.x = p.x;
      p.g.y = p.y;
      p.g.alpha = p.alpha;
      // occasional redraw for size fade on water
      if (p.kind === 'water' || p.kind === 'firework') {
        const scale = 0.5 + 0.5 * (p.life / p.maxLife);
        p.g.scale.set(scale);
      }
    }
  }

  clearKind(kind: ParticleKind): void {
    for (const p of this.pool) {
      if (p.active && p.kind === kind) this.release(p);
    }
  }

  clearAll(): void {
    for (const p of this.pool) this.release(p);
  }

  destroy(): void {
    this.clearAll();
    this.container.destroy({ children: true });
  }
}
