import { Container, Graphics } from 'pixi.js';
import { RINGS } from '../config';

/**
 * Plastic ring with thickness / bevel for retro toy look.
 * Position/rotation synced from Matter body externally.
 */
export class RingVisual {
  readonly view = new Container();
  readonly id: number;
  readonly color: number;
  scored = false;
  private body: Graphics;
  private highlight: Graphics;

  constructor(id: number, color: number) {
    this.id = id;
    this.color = color;
    this.view.label = `ring-vis-${id}`;

    this.body = new Graphics();
    this.highlight = new Graphics();
    this.view.addChild(this.body, this.highlight);
    this.draw();
  }

  private draw(): void {
    const outer = RINGS.outerRadius;
    const inner = RINGS.innerRadius;
    const g = this.body;
    g.clear();

    // Shadow under ring (depth)
    g.circle(2, 3, outer);
    g.fill({ color: 0x000000, alpha: 0.22 });
    g.circle(2, 3, inner);
    g.cut();

    // Main plastic body
    g.circle(0, 0, outer);
    g.fill({ color: this.color, alpha: 1 });
    g.circle(0, 0, inner);
    g.cut();

    // Darker outer rim
    g.circle(0, 0, outer);
    g.stroke({ width: 2.5, color: shade(this.color, 0.65), alpha: 0.9 });
    g.circle(0, 0, inner);
    g.stroke({ width: 2, color: shade(this.color, 0.55), alpha: 0.85 });

    // Mid bevel ring
    g.circle(0, 0, (outer + inner) / 2);
    g.stroke({ width: 3, color: shade(this.color, 1.15), alpha: 0.35 });

    // Specular highlight (plastic sheen)
    const h = this.highlight;
    h.clear();
    h.arc(0, 0, outer - 3, -Math.PI * 0.9, -Math.PI * 0.35);
    h.stroke({ width: 3, color: 0xffffff, alpha: 0.45 });
    h.arc(0, 0, inner + 3, Math.PI * 0.1, Math.PI * 0.55);
    h.stroke({ width: 2, color: 0xffffff, alpha: 0.25 });
  }

  setScored(scored: boolean): void {
    this.scored = scored;
    if (scored) {
      // Gold rim flash
      this.body.circle(0, 0, RINGS.outerRadius + 2);
      this.body.stroke({ width: 2, color: 0xffd54f, alpha: 0.9 });
    }
  }

  sync(x: number, y: number, angle: number): void {
    this.view.x = x;
    this.view.y = y;
    this.view.rotation = angle;
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }
}

function shade(color: number, factor: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.round((color & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
}
