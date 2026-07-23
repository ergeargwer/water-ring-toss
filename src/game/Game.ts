import { Application, Container } from 'pixi.js';
import Matter from 'matter-js';
import { DESIGN_W, DESIGN_H, TANK, RINGS } from '../config';
import { rand, randInt } from '../utils/math';
import { PhysicsWorld } from './PhysicsWorld';
import { WaterTank } from './WaterTank';
import { RingVisual } from './RingVisual';
import { RetroButton } from './RetroButton';
import { ParticleSystem } from './ParticleSystem';
import { GameUI } from './UI';
import { InputManager } from './InputManager';
import { audio } from '../audio/AudioManager';
import { feel } from './FeelSettings';

/**
 * Main game orchestrator: physics ↔ visuals ↔ input ↔ UI.
 */
export class Game {
  private app: Application;
  private root = new Container();
  private physics!: PhysicsWorld;
  private tank!: WaterTank;
  private particles!: ParticleSystem;
  private leftBtn!: RetroButton;
  private rightBtn!: RetroButton;
  private ui!: GameUI;
  private input!: InputManager;

  private ringVisuals = new Map<number, RingVisual>();
  private ringBodies = new Map<number, Matter.Body>();
  private scoredIds = new Set<number>();
  private settleCounters = new Map<number, number>();

  private totalRings = 0;
  private elapsedSec = 0;
  private playing = false;
  private paused = false;
  private timeSec = 0;
  private nextRingId = 0;
  private lastCollideSfx = 0;

  private boundResize: () => void;
  private boundKey: (e: KeyboardEvent) => void;

  constructor(app: Application) {
    this.app = app;
    this.boundResize = this.layout.bind(this);
    this.boundKey = this.onGlobalKey.bind(this);
  }

  async init(): Promise<void> {
    this.root.label = 'game-root';
    this.app.stage.addChild(this.root);

    this.tank = new WaterTank();
    this.root.addChild(this.tank.view);

    this.particles = new ParticleSystem(this.tank.contentLayer);
    this.particles.ensureGlitter();

    this.leftBtn = new RetroButton('left');
    this.rightBtn = new RetroButton('right');
    this.root.addChild(this.leftBtn.view, this.rightBtn.view);

    this.ui = new GameUI();
    this.root.addChild(this.ui.view);
    this.ui.on({
      start: () => this.startGame(),
      restart: () => this.startGame(),
      togglePause: () => this.togglePause(),
      toggleMute: () => {
        audio.toggleMute();
        audio.playUiClick();
        this.refreshHud();
      },
      openSettings: () => {
        audio.playUiClick();
        // Disable jets while tuning
        this.input.setEnabled(false);
        audio.stopFlow();
      },
      closeSettings: () => {
        audio.playUiClick();
        // Restore input only if actively playing (not paused/title)
        const s = this.ui.getScreen();
        this.input.setEnabled(s === 'playing' && this.playing && !this.paused);
      },
      resetFeel: () => {
        audio.playUiClick();
        this.applyFeelToSystems();
      },
    });

    this.physics = new PhysicsWorld();
    // Live-apply feel when sliders move
    feel.subscribe(() => this.applyFeelToSystems());
    this.applyFeelToSystems();
    this.physics.onCollision((a, b, intensity) => {
      if (!this.playing || this.paused) return;
      const now = performance.now();
      if (now - this.lastCollideSfx < 80) return;
      if (intensity < 0.2) return;
      // Only ring collisions
      if (!a.label.startsWith('ring') && !b.label.startsWith('ring')) return;
      this.lastCollideSfx = now;
      audio.playCollision(intensity);
    });

    this.input = new InputManager(this.app.canvas as HTMLCanvasElement);
    this.input.clientToDesign = (cx, cy) => this.clientToDesign(cx, cy);
    this.input.hitLeft = (x, y) => this.hitSide('left', x, y);
    this.input.hitRight = (x, y) => this.hitSide('right', x, y);
    this.input.onJetChange = (side, active, strong, justStarted) => {
      if (!this.playing || this.paused) return;
      if (justStarted) {
        audio.playButtonPress(false);
      }
      if (active) {
        audio.startFlow(side, strong);
        if (strong && justStarted === false) {
          // became strong
          audio.playButtonPress(true);
        }
      } else {
        audio.stopFlow();
        // if other side still active, restart that flow
        if (side === 'left' && this.input.right.active) {
          audio.startFlow('right', this.input.right.strong);
        } else if (side === 'right' && this.input.left.active) {
          audio.startFlow('left', this.input.left.strong);
        } else {
          audio.playButtonRelease();
        }
      }
    };
    this.input.setEnabled(false);

    this.layout();
    window.addEventListener('resize', this.boundResize);
    window.addEventListener('keydown', this.boundKey);

    this.app.ticker.add(this.tick);

    this.refreshHud();
  }

  private hitSide(side: 'left' | 'right', x: number, y: number): boolean {
    const btn = side === 'left' ? this.leftBtn : this.rightBtn;
    if (btn.containsPoint(x, y)) return true;
    // Also: left/right thirds of tank bottom area & full left/right cabinet zones
    if (side === 'left') {
      return x < DESIGN_W * 0.38 && y > DESIGN_H * 0.15;
    }
    return x > DESIGN_W * 0.62 && y > DESIGN_H * 0.15;
  }

  private clientToDesign(clientX: number, clientY: number): { x: number; y: number } {
    const canvas = this.app.canvas as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    // Account for letterboxing from layout scale
    const scale = this.root.scale.x || 1;
    const ox = this.root.x;
    const oy = this.root.y;
    const x = (clientX - rect.left - ox * (rect.width / this.app.screen.width)) /
      (scale * (rect.width / this.app.screen.width));
    const y = (clientY - rect.top - oy * (rect.height / this.app.screen.height)) /
      (scale * (rect.height / this.app.screen.height));
    // Simpler approach using renderer dimensions:
    const sx = this.app.screen.width / rect.width;
    const sy = this.app.screen.height / rect.height;
    const px = (clientX - rect.left) * sx;
    const py = (clientY - rect.top) * sy;
    return {
      x: (px - this.root.x) / (this.root.scale.x || 1),
      y: (py - this.root.y) / (this.root.scale.y || 1),
    };
  }

  private layout(): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const scale = Math.min(w / DESIGN_W, h / DESIGN_H);
    this.root.scale.set(scale);
    this.root.x = (w - DESIGN_W * scale) / 2;
    this.root.y = (h - DESIGN_H * scale) / 2;
  }

  private applyFeelToSystems(): void {
    this.physics.applyFeelSettings();
    audio.setVolume(feel.getKey('volume'));
    // If volume is 0, treat as muted for HUD consistency without flipping mute flag
  }

  private onGlobalKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (this.ui.isSettingsOpen()) {
        this.ui.closeSettings();
        const s = this.ui.getScreen();
        this.input.setEnabled(s === 'playing' && this.playing && !this.paused);
        audio.playUiClick();
        return;
      }
      if (this.ui.getScreen() === 'playing' || this.ui.getScreen() === 'paused') {
        this.togglePause();
      }
    }
    if (e.key === 'f' || e.key === 'F' || e.key === 'F11') {
      e.preventDefault();
      void this.toggleFullscreen();
    }
    if (e.key === 'm' || e.key === 'M') {
      if (this.ui.isSettingsOpen()) return;
      audio.toggleMute();
      this.refreshHud();
    }
    if (e.key === 'p' || e.key === 'P') {
      if (this.ui.isSettingsOpen()) return;
      if (this.playing) this.togglePause();
    }
    // O = open feel settings
    if (e.key === 'o' || e.key === 'O') {
      if (this.ui.getScreen() === 'victory') return;
      if (this.ui.isSettingsOpen()) {
        this.ui.closeSettings();
        const s = this.ui.getScreen();
        this.input.setEnabled(s === 'playing' && this.playing && !this.paused);
      } else {
        this.ui.openSettings();
        this.input.setEnabled(false);
        audio.stopFlow();
      }
      audio.playUiClick();
    }
  }

  private async toggleFullscreen(): Promise<void> {
    if (window.electronAPI?.toggleFullscreen) {
      await window.electronAPI.toggleFullscreen();
      return;
    }
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.();
    } else {
      await document.exitFullscreen?.();
    }
  }

  private startGame(): void {
    audio.playUiClick();
    audio.stopFlow();
    this.clearRings();
    this.scoredIds.clear();
    this.settleCounters.clear();
    this.elapsedSec = 0;
    this.paused = false;
    this.playing = true;
    this.nextRingId = 0;

    this.totalRings = randInt(RINGS.countMin, RINGS.countMax);
    const colors = [...RINGS.colors];
    // shuffle
    for (let i = colors.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [colors[i], colors[j]] = [colors[j]!, colors[i]!];
    }

    for (let i = 0; i < this.totalRings; i++) {
      const color = colors[i % colors.length]!;
      const x = rand(TANK.x + 60, TANK.x + TANK.width - 60);
      const y = rand(TANK.y + 80, TANK.y + TANK.height - 80);
      this.spawnRing(x, y, color);
    }

    this.particles.clearKind('firework');
    this.particles.ensureGlitter();

    this.ui.setScreen('playing');
    this.input.setEnabled(true);
    this.refreshHud();
  }

  private spawnRing(x: number, y: number, color: number): void {
    const id = this.nextRingId++;
    const body = this.physics.addRing(x, y, id);
    const vis = new RingVisual(id, color);
    this.tank.contentLayer.addChild(vis.view);
    // Keep particles above rings? Actually rings above water particles mid-layer
    this.ringBodies.set(id, body);
    this.ringVisuals.set(id, vis);
    vis.sync(body.position.x, body.position.y, body.angle);
  }

  private clearRings(): void {
    for (const vis of this.ringVisuals.values()) {
      vis.destroy();
    }
    this.ringVisuals.clear();
    this.ringBodies.clear();
    this.physics.removeAllRings();
  }

  private togglePause(): void {
    if (this.ui.isSettingsOpen()) return;
    if (!this.playing && this.ui.getScreen() !== 'paused') return;
    if (this.ui.getScreen() === 'victory') return;
    this.paused = !this.paused;
    this.input.setEnabled(!this.paused && this.playing);
    if (this.paused) {
      audio.stopFlow();
      this.ui.setScreen('paused');
    } else {
      this.ui.setScreen('playing');
    }
    audio.playUiClick();
  }

  private refreshHud(): void {
    this.ui.updateHud({
      remaining: this.totalRings - this.scoredIds.size,
      scored: this.scoredIds.size,
      total: this.totalRings,
      elapsedSec: this.elapsedSec,
      muted: audio.isMuted(),
    });
  }

  private tick = (): void => {
    const dt = Math.min(this.app.ticker.deltaMS, 50);
    this.timeSec += dt / 1000;

    this.leftBtn.update(dt);
    this.rightBtn.update(dt);
    this.tank.update(dt, this.timeSec);

    if (!this.playing || this.paused || this.ui.isSettingsOpen()) {
      // still animate ambient particles gently
      this.particles.ambientBubbles(dt);
      this.particles.update(dt);
      return;
    }

    this.elapsedSec += dt / 1000;
    this.input.update();

    // Sync buttons visual
    this.leftBtn.setPressed(this.input.left.active);
    this.rightBtn.setPressed(this.input.right.active);

    // Jets
    this.physics.setJet(
      'left',
      this.input.left.active,
      this.input.left.strong,
      this.input.left.pressMs
    );
    this.physics.setJet(
      'right',
      this.input.right.active,
      this.input.right.strong,
      this.input.right.pressMs
    );

    if (this.input.left.active) {
      this.particles.emitJet('left', this.input.left.strong, dt);
    }
    if (this.input.right.active) {
      this.particles.emitJet('right', this.input.right.strong, dt);
    }

    const jetI =
      (this.input.left.active ? (this.input.left.strong ? 1 : 0.45) : 0) +
      (this.input.right.active ? (this.input.right.strong ? 1 : 0.45) : 0);
    this.tank.setJetIntensity(Math.min(1, jetI));

    this.physics.update(dt);

    // Sync visuals
    for (const [id, body] of this.ringBodies) {
      const vis = this.ringVisuals.get(id);
      if (!vis) continue;
      vis.sync(body.position.x, body.position.y, body.angle);
    }

    // Scoring with settle frames
    const candidates = this.physics.getScoredRingIds(this.scoredIds);
    for (const id of candidates) {
      const n = (this.settleCounters.get(id) ?? 0) + 1;
      this.settleCounters.set(id, n);
      if (n >= 20) {
        this.markScored(id);
      }
    }
    // decay counters for rings that left
    for (const id of [...this.settleCounters.keys()]) {
      if (!candidates.includes(id) && !this.scoredIds.has(id)) {
        this.settleCounters.set(id, Math.max(0, (this.settleCounters.get(id) ?? 0) - 2));
      }
    }

    this.particles.ambientBubbles(dt);
    this.particles.ensureGlitter();
    this.particles.update(dt);

    this.refreshHud();
  };

  private markScored(id: number): void {
    if (this.scoredIds.has(id)) return;
    this.scoredIds.add(id);
    const body = this.ringBodies.get(id);
    const vis = this.ringVisuals.get(id);
    if (body) {
      const pegIndex = this.physics.findPegIndexForRing(body);
      this.physics.lockRingOnPeg(body, pegIndex);
      // Stack offset if multiple on same peg
      const onSame = [...this.scoredIds].filter((sid) => {
        if (sid === id) return false;
        const b = this.ringBodies.get(sid);
        return b && Math.abs(b.position.x - body.position.x) < 5;
      }).length;
      Matter.Body.setPosition(body, {
        x: body.position.x,
        y: body.position.y + onSame * (RINGS.thickness * 0.6),
      });
      vis?.sync(body.position.x, body.position.y, 0);
    }
    vis?.setScored(true);
    audio.playRingScored();

    if (this.scoredIds.size >= this.totalRings) {
      this.win();
    }
  }

  private win(): void {
    this.playing = false;
    this.input.setEnabled(false);
    audio.stopFlow();
    audio.playVictory();
    this.particles.emitFireworks(DESIGN_W / 2, DESIGN_H / 2 - 40);
    this.ui.setVictoryTime(this.elapsedSec);
    this.ui.setScreen('victory');
    // Extra firework bursts
    let bursts = 0;
    const iv = setInterval(() => {
      this.particles.emitFireworks(
        DESIGN_W / 2 + rand(-100, 100),
        DESIGN_H / 2 + rand(-60, 40)
      );
      bursts++;
      if (bursts >= 4) clearInterval(iv);
    }, 400);
  }

  destroy(): void {
    this.app.ticker.remove(this.tick);
    window.removeEventListener('resize', this.boundResize);
    window.removeEventListener('keydown', this.boundKey);
    this.input.destroy();
    this.physics.destroy();
    this.particles.destroy();
    this.clearRings();
    this.root.destroy({ children: true });
  }
}
