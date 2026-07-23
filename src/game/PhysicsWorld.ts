import Matter from 'matter-js';
import { PHYSICS, TANK, PEGS, RINGS, WATER_JET } from '../config';
import { feel } from './FeelSettings';

const { Engine, World, Bodies, Body, Events, Composite } = Matter;

export type JetState = {
  active: boolean;
  strong: boolean;
  pressMs: number;
};

export class PhysicsWorld {
  readonly engine: Matter.Engine;
  readonly world: Matter.World;
  walls: Matter.Body[] = [];
  pegs: Matter.Body[] = [];
  rings: Matter.Body[] = [];

  leftJet: JetState = { active: false, strong: false, pressMs: 0 };
  rightJet: JetState = { active: false, strong: false, pressMs: 0 };

  private collisionCallbacks: Array<(a: Matter.Body, b: Matter.Body, intensity: number) => void> =
    [];

  constructor() {
    this.engine = Engine.create({
      gravity: { x: 0, y: feel.getKey('gravityY'), scale: 0.001 },
      enableSleeping: true,
    });
    this.world = this.engine.world;
    this.engine.positionIterations = 6;
    this.engine.velocityIterations = 4;

    this.buildBounds();
    this.buildPegs();
    this.wireCollisions();
  }

  /** Apply user feel settings (gravity) — call when settings change */
  applyFeelSettings(): void {
    this.engine.gravity.y = feel.getKey('gravityY');
  }

  private buildBounds(): void {
    const { x, y, width, height, wallThickness: t } = TANK;
    const opts = {
      isStatic: true,
      friction: PHYSICS.wallFriction,
      restitution: 0.25,
      label: 'wall',
    };

    const floor = Bodies.rectangle(x + width / 2, y + height + t / 2, width + t * 2, t, {
      ...opts,
      label: 'floor',
    });
    const ceil = Bodies.rectangle(x + width / 2, y - t / 2, width + t * 2, t, {
      ...opts,
      label: 'ceiling',
    });
    const left = Bodies.rectangle(x - t / 2, y + height / 2, t, height + t * 2, opts);
    const right = Bodies.rectangle(x + width + t / 2, y + height / 2, t, height + t * 2, opts);

    this.walls = [floor, ceil, left, right];
    World.add(this.world, this.walls);
  }

  private buildPegs(): void {
    this.pegs = PEGS.map((p, i) => {
      // Slightly thinner than visual so ring hole can clear more easily
      const body = Bodies.rectangle(p.x, p.y, p.radius * 1.6, p.height, {
        isStatic: true,
        friction: PHYSICS.pegFriction,
        restitution: 0.12,
        chamfer: { radius: p.radius * 0.6 },
        label: `peg-${i}`,
        collisionFilter: {
          category: 0x0004,
          mask: 0xffff,
        },
      });
      World.add(this.world, body);
      return body;
    });
  }

  private wireCollisions(): void {
    Events.on(this.engine, 'collisionStart', (event) => {
      for (const pair of event.pairs) {
        const intensity = Math.min(
          1,
          (pair.collision.depth ?? 0.5) * 0.5 +
            Math.hypot(
              pair.bodyA.velocity.x - pair.bodyB.velocity.x,
              pair.bodyA.velocity.y - pair.bodyB.velocity.y
            ) * 0.15
        );
        for (const cb of this.collisionCallbacks) {
          cb(pair.bodyA, pair.bodyB, intensity);
        }
      }
    });
  }

  onCollision(cb: (a: Matter.Body, b: Matter.Body, intensity: number) => void): void {
    this.collisionCallbacks.push(cb);
  }

  addRing(x: number, y: number, id: number): Matter.Body {
    /**
     * Compound ring of small circles — leaves a real hole so pegs can pass through.
     * Visual is a solid torus drawn by RingVisual; physics matches inner/outer radii.
     */
    const segments = 12;
    const midR = (RINGS.outerRadius + RINGS.innerRadius) / 2;
    const beadR = (RINGS.outerRadius - RINGS.innerRadius) / 2 + 1.5;
    const parts: Matter.Body[] = [];
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      parts.push(
        Bodies.circle(x + Math.cos(a) * midR, y + Math.sin(a) * midR, beadR, {
          density: RINGS.density,
          friction: RINGS.friction,
          restitution: RINGS.restitution,
          label: `ring-part-${id}`,
        })
      );
    }
    const body = Body.create({
      parts,
      frictionAir: RINGS.frictionAir,
      label: `ring-${id}`,
      sleepThreshold: 40,
      collisionFilter: {
        group: 0,
        category: 0x0002,
        mask: 0xffff,
      },
    });
    Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.05);
    World.add(this.world, body);
    this.rings.push(body);
    return body;
  }

  removeAllRings(): void {
    for (const r of this.rings) {
      World.remove(this.world, r);
    }
    this.rings = [];
  }

  /** Apply buoyancy, drag, and jet forces each frame */
  applyFluidForces(dtMs: number): void {
    const waterTop = TANK.y + 12;
    const waterBottom = TANK.y + TANK.height;
    const waterLeft = TANK.x;
    const waterRight = TANK.x + TANK.width;
    const f = feel.get();

    for (const ring of this.rings) {
      if (ring.isStatic) continue;
      const { x, y } = ring.position;
      const submerged = y > waterTop && y < waterBottom && x > waterLeft && x < waterRight;

      if (submerged) {
        // Buoyancy proportional to how deep (capped)
        const depthRatio = clamp((y - waterTop) / (waterBottom - waterTop), 0, 1);
        const buoy = f.buoyancy * (0.55 + depthRatio * 0.6);
        Body.applyForce(ring, ring.position, { x: 0, y: -buoy * ring.mass });

        // Linear drag
        const vx = ring.velocity.x;
        const vy = ring.velocity.y;
        Body.applyForce(ring, ring.position, {
          x: -vx * f.waterDrag * ring.mass * 0.01,
          y: -vy * f.waterDrag * ring.mass * 0.01,
        });

        // Angular drag
        Body.setAngularVelocity(
          ring,
          ring.angularVelocity * (1 - PHYSICS.waterAngularDrag)
        );
      }

      // Soft surface attraction when near surface (helps stacking feel)
      if (Math.abs(y - waterTop) < 25 && x > waterLeft && x < waterRight) {
        Body.applyForce(ring, ring.position, {
          x: 0,
          y: PHYSICS.surfaceTensionPull * Math.sign(waterTop - y) * ring.mass,
        });
      }

      // Soft "slotting" assist: when hole is nearly over a peg, nudge toward axis
      const slot = f.slotAssist;
      if (slot > 0.01) {
        for (const peg of PEGS) {
          const pegTop = peg.y - peg.height / 2;
          const pegBottom = peg.y + peg.height / 2;
          const dx = peg.x - x;
          const adx = Math.abs(dx);
          if (adx < RINGS.outerRadius + 8 && y > pegTop - 10 && y < pegBottom + 10) {
            if (adx < RINGS.innerRadius + 6) {
              Body.applyForce(ring, ring.position, {
                x: dx * 0.00004 * ring.mass * slot,
                y: 0.00002 * ring.mass * slot,
              });
            }
          }
        }
      }
    }

    this.applyJet(this.leftJet, WATER_JET.jetXLeft, WATER_JET.jetY, 1);
    this.applyJet(this.rightJet, WATER_JET.jetXRight, WATER_JET.jetY, -1);
  }

  private applyJet(jet: JetState, jx: number, jy: number, sideSign: number): void {
    if (!jet.active) return;
    const f = feel.get();
    const force = jet.strong ? f.strongForce : f.weakForce;
    const radius = jet.strong ? f.strongRadius : f.weakRadius;

    for (const ring of this.rings) {
      if (ring.isStatic) continue;
      const dx = ring.position.x - jx;
      const dy = ring.position.y - jy;
      const d = Math.hypot(dx, dy);
      if (d > radius || d < 1) continue;

      const falloff = 1 - d / radius;
      const falloffSq = falloff * falloff;

      // Upward primary + slight inward toward center of tank
      const dirX =
        (dx / d) * WATER_JET.lateralSpread + sideSign * 0.15 * (jet.strong ? 1 : 0.5);
      const dirY = WATER_JET.upwardBias;
      const len = Math.hypot(dirX, dirY) || 1;

      Body.applyForce(ring, ring.position, {
        x: (dirX / len) * force * falloffSq * ring.mass * 12,
        y: (dirY / len) * force * falloffSq * ring.mass * 12,
      });

      // Spin from jet shear
      Body.setAngularVelocity(
        ring,
        ring.angularVelocity + sideSign * falloff * 0.002 * (jet.strong ? 1.5 : 0.8)
      );
    }
  }

  setJet(side: 'left' | 'right', active: boolean, strong: boolean, pressMs: number): void {
    const jet = side === 'left' ? this.leftJet : this.rightJet;
    jet.active = active;
    jet.strong = strong;
    jet.pressMs = pressMs;
  }

  update(dtMs: number): void {
    // Cap dt to avoid spiral of death on lag spikes
    const step = Math.min(dtMs, 1000 / 30);
    this.applyFluidForces(step);
    Engine.update(this.engine, step);
  }

  /**
   * Check if a ring is scored on a peg:
   * - ring center near peg X
   * - ring roughly around peg mid-upper height
   * - low velocity (settled)
   */
  getScoredRingIds(alreadyScored: Set<number>): number[] {
    const scored: number[] = [];
    for (const ring of this.rings) {
      const id = parseRingId(ring.label);
      if (id == null || alreadyScored.has(id)) continue;

      const speed = Math.hypot(ring.velocity.x, ring.velocity.y);
      if (speed > PHYSICS.scoredVelMax) continue;

      for (const peg of PEGS) {
        const pegTop = peg.y - peg.height / 2;
        const pegBottom = peg.y + peg.height / 2;
        const dx = Math.abs(ring.position.x - peg.x);
        const ry = ring.position.y;

        // Ring hole over peg: center close to peg axis, vertical within peg shaft
        if (
          dx < RINGS.innerRadius * 0.85 &&
          ry > pegTop + 10 &&
          ry < pegBottom - 20
        ) {
          scored.push(id);
          break;
        }
      }
    }
    return scored;
  }

  /** Freeze scored ring on peg (optional visual lock) */
  lockRingOnPeg(ringBody: Matter.Body, pegIndex: number): void {
    const peg = PEGS[pegIndex];
    if (!peg) return;
    Body.setStatic(ringBody, true);
    Body.setPosition(ringBody, {
      x: peg.x,
      y: Math.min(ringBody.position.y, peg.y - peg.height / 2 + 35),
    });
    Body.setAngle(ringBody, 0);
    Body.setVelocity(ringBody, { x: 0, y: 0 });
    Body.setAngularVelocity(ringBody, 0);
  }

  findPegIndexForRing(ring: Matter.Body): number {
    let best = 0;
    let bestD = Infinity;
    PEGS.forEach((p, i) => {
      const d = Math.abs(ring.position.x - p.x);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  destroy(): void {
    Events.off(this.engine, 'collisionStart');
    Composite.clear(this.world, false);
    Engine.clear(this.engine);
  }
}

function parseRingId(label: string): number | null {
  const m = /^ring-(\d+)$/.exec(label);
  return m ? parseInt(m[1]!, 10) : null;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export { parseRingId };
