import { Container, Graphics, Filter } from 'pixi.js';
import { TANK, PEGS, CABINET, DESIGN_W, DESIGN_H } from '../config';
import { createWaterFilter, updateWaterFilter } from '../shaders/waterFilter';

/**
 * Retro plastic water tank: frame, water fill, pegs, surface line.
 */
export class WaterTank {
  readonly view = new Container();
  readonly waterLayer = new Container();
  readonly contentLayer = new Container(); // rings + particles go here
  readonly glassLayer = new Container();

  private waterFill: Graphics;
  private surface: Graphics;
  private pegGraphics: Graphics;
  private frame: Graphics;
  private waterFilter: Filter | null = null;
  private filterOk = false;
  private wavePhase = 0;
  private jetIntensity = 0;

  constructor() {
    this.view.label = 'water-tank';

    this.drawCabinet();
    this.frame = new Graphics();
    this.view.addChild(this.frame);
    this.drawFrame();

    // Clip mask for tank interior
    const mask = new Graphics();
    mask.rect(TANK.x, TANK.y, TANK.width, TANK.height);
    mask.fill(0xffffff);
    this.view.addChild(mask);

    this.waterLayer.label = 'water';
    this.contentLayer.label = 'content';
    this.glassLayer.label = 'glass';

    this.waterFill = new Graphics();
    this.surface = new Graphics();
    this.pegGraphics = new Graphics();

    this.waterLayer.addChild(this.waterFill, this.surface, this.pegGraphics);
    this.view.addChild(this.waterLayer);
    this.view.addChild(this.contentLayer);
    this.view.addChild(this.glassLayer);

    this.waterLayer.mask = mask;
    this.contentLayer.mask = mask;

    this.drawWater();
    this.drawPegs();
    this.drawGlassOverlay();
    this.tryWaterFilter();
  }

  private drawCabinet(): void {
    const g = new Graphics();
    // Outer toy body
    g.roundRect(12, 12, DESIGN_W - 24, DESIGN_H - 24, 28);
    g.fill({ color: CABINET.bodyColor });
    g.stroke({ width: 4, color: CABINET.frameDark });

    // Inner recess
    g.roundRect(28, 28, DESIGN_W - 56, DESIGN_H - 100, 18);
    g.fill({ color: CABINET.bodyShadow, alpha: 0.35 });

    // Top decorative stripe
    g.roundRect(40, 22, DESIGN_W - 80, 14, 6);
    g.fill({ color: CABINET.frameLight, alpha: 0.5 });

    // Screws
    for (const [sx, sy] of [
      [40, 40],
      [DESIGN_W - 40, 40],
      [40, DESIGN_H - 50],
      [DESIGN_W - 40, DESIGN_H - 50],
    ] as const) {
      g.circle(sx, sy, 5);
      g.fill({ color: 0x6d4c41 });
      g.circle(sx - 1, sy - 1, 2);
      g.fill({ color: 0xa1887f, alpha: 0.6 });
    }

    // Brand plate
    g.roundRect(DESIGN_W / 2 - 90, 32, 180, 28, 6);
    g.fill({ color: 0x5d4037 });
    g.stroke({ width: 2, color: CABINET.frameLight });

    this.view.addChild(g);
  }

  private drawFrame(): void {
    const g = this.frame;
    g.clear();
    const { x, y, width, height } = TANK;
    const pad = 8;

    // Plastic bezel
    g.roundRect(x - pad, y - pad, width + pad * 2, height + pad * 2, 10);
    g.fill({ color: TANK.borderColor, alpha: 0.95 });
    g.stroke({ width: 3, color: TANK.borderShadow });

    // Inner dark water window edge
    g.roundRect(x - 2, y - 2, width + 4, height + 4, 4);
    g.fill({ color: 0x0a3040 });

    // Highlight on top-left of bezel (plastic reflection)
    g.moveTo(x - pad + 6, y - pad + 4);
    g.lineTo(x + width * 0.4, y - pad + 4);
    g.stroke({ width: 3, color: TANK.borderHighlight, alpha: 0.55 });

    // Bottom shadow
    g.moveTo(x - pad + 4, y + height + pad - 3);
    g.lineTo(x + width + pad - 4, y + height + pad - 3);
    g.stroke({ width: 3, color: 0x000000, alpha: 0.2 });
  }

  private drawWater(): void {
    const g = this.waterFill;
    g.clear();
    // Gradient-like layers
    g.rect(TANK.x, TANK.y, TANK.width, TANK.height);
    g.fill({ color: TANK.bgColor, alpha: 1 });

    // Deeper blue at bottom
    g.rect(TANK.x, TANK.y + TANK.height * 0.45, TANK.width, TANK.height * 0.55);
    g.fill({ color: 0x0d4a63, alpha: 0.55 });

    // Mid water tint
    g.rect(TANK.x, TANK.y + 8, TANK.width, TANK.height - 8);
    g.fill({ color: TANK.waterColor, alpha: TANK.waterAlpha });

    // Soft light from top
    g.rect(TANK.x, TANK.y, TANK.width, 40);
    g.fill({ color: 0x7ec8e3, alpha: 0.15 });

    // Simple seabed decoration
    g.ellipse(TANK.x + 80, TANK.y + TANK.height - 10, 50, 12);
    g.fill({ color: 0xc2a36b, alpha: 0.35 });
    g.ellipse(TANK.x + TANK.width - 100, TANK.y + TANK.height - 8, 60, 10);
    g.fill({ color: 0xb8956a, alpha: 0.3 });

    // Tiny seaweed
    for (const sx of [TANK.x + 50, TANK.x + 120, TANK.x + TANK.width - 70]) {
      g.moveTo(sx, TANK.y + TANK.height);
      g.quadraticCurveTo(sx + 8, TANK.y + TANK.height - 40, sx - 4, TANK.y + TANK.height - 70);
      g.stroke({ width: 3, color: 0x2e7d32, alpha: 0.45 });
    }
  }

  private drawSurface(): void {
    const g = this.surface;
    g.clear();
    const y0 = TANK.y + 10;
    g.moveTo(TANK.x, y0);
    const segs = 24;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const x = TANK.x + t * TANK.width;
      const wave =
        Math.sin(t * Math.PI * 4 + this.wavePhase) * (1.5 + this.jetIntensity * 3) +
        Math.sin(t * Math.PI * 9 - this.wavePhase * 1.3) * (0.8 + this.jetIntensity * 1.5);
      g.lineTo(x, y0 + wave);
    }
    g.stroke({ width: 2, color: 0xd0f0ff, alpha: 0.55 + this.jetIntensity * 0.25 });

    // Secondary surface gleam
    g.moveTo(TANK.x, y0 + 3);
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const x = TANK.x + t * TANK.width;
      const wave = Math.sin(t * Math.PI * 5 - this.wavePhase * 0.8) * (1 + this.jetIntensity * 2);
      g.lineTo(x, y0 + 3 + wave);
    }
    g.stroke({ width: 1, color: 0xffffff, alpha: 0.2 });
  }

  private drawPegs(): void {
    const g = this.pegGraphics;
    g.clear();
    for (const peg of PEGS) {
      const top = peg.y - peg.height / 2;
      const bot = peg.y + peg.height / 2;

      // Shadow
      g.roundRect(peg.x - peg.radius + 2, top + 2, peg.radius * 2, peg.height, peg.radius);
      g.fill({ color: 0x000000, alpha: 0.2 });

      // Metal/plastic shaft
      g.roundRect(peg.x - peg.radius, top, peg.radius * 2, peg.height, peg.radius);
      g.fill({ color: 0xcfd8dc });
      g.stroke({ width: 1.5, color: 0x78909c });

      // Highlight stripe
      g.roundRect(peg.x - peg.radius + 2, top + 4, 3, peg.height - 8, 1);
      g.fill({ color: 0xffffff, alpha: 0.55 });

      // Tip ball
      g.circle(peg.x, top + 2, peg.radius + 2);
      g.fill({ color: 0xffc107 });
      g.stroke({ width: 1.5, color: 0xf57f17 });
      g.circle(peg.x - 2, top, 2);
      g.fill({ color: 0xffffff, alpha: 0.5 });

      // Base flange
      g.ellipse(peg.x, bot, peg.radius + 8, 5);
      g.fill({ color: 0x90a4ae });
      g.stroke({ width: 1, color: 0x546e7a });
    }
  }

  private drawGlassOverlay(): void {
    const g = new Graphics();
    // Glass reflection streaks
    g.rect(TANK.x + 20, TANK.y + 20, 18, TANK.height * 0.45);
    g.fill({ color: 0xffffff, alpha: 0.06 });
    g.rect(TANK.x + 50, TANK.y + 40, 8, TANK.height * 0.3);
    g.fill({ color: 0xffffff, alpha: 0.04 });

    // Corner gloss
    g.moveTo(TANK.x + 4, TANK.y + 4);
    g.lineTo(TANK.x + 80, TANK.y + 4);
    g.lineTo(TANK.x + 4, TANK.y + 50);
    g.closePath();
    g.fill({ color: 0xffffff, alpha: 0.07 });

    this.glassLayer.addChild(g);
  }

  private tryWaterFilter(): void {
    try {
      this.waterFilter = createWaterFilter();
      this.waterLayer.filters = [this.waterFilter];
      this.filterOk = true;
    } catch (e) {
      console.warn('Water filter unavailable, using CPU waves only', e);
      this.filterOk = false;
    }
  }

  setJetIntensity(v: number): void {
    this.jetIntensity = Math.max(0, Math.min(1, v));
  }

  update(dt: number, timeSec: number): void {
    this.wavePhase += dt * 0.004 * (1 + this.jetIntensity);
    this.drawSurface();
    if (this.filterOk && this.waterFilter) {
      updateWaterFilter(this.waterFilter, timeSec, 0.5 + this.jetIntensity * 0.5);
    }
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }
}
