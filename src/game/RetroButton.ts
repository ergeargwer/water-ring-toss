import { Container, Graphics, Text } from 'pixi.js';
import { BUTTONS } from '../config';

/**
 * Retro hard-plastic circular water-pump button.
 */
export class RetroButton {
  readonly view = new Container();
  readonly side: 'left' | 'right';
  private base: Graphics;
  private face: Graphics;
  private rim: Graphics;
  private label: Text;
  private _pressed = false;
  private pressDepth = 0;

  readonly hitRadius: number;
  readonly cx: number;
  readonly cy: number;

  constructor(side: 'left' | 'right') {
    this.side = side;
    const cfg = side === 'left' ? BUTTONS.left : BUTTONS.right;
    this.cx = cfg.x;
    this.cy = cfg.y;
    this.hitRadius = cfg.radius + 12;

    this.view.x = cfg.x;
    this.view.y = cfg.y;
    this.view.label = `btn-${side}`;
    this.view.eventMode = 'static';
    this.view.cursor = 'pointer';

    this.base = new Graphics();
    this.rim = new Graphics();
    this.face = new Graphics();
    this.view.addChild(this.base, this.rim, this.face);

    this.label = new Text({
      text: side === 'left' ? 'L' : 'R',
      style: {
        fontFamily: 'Georgia, serif',
        fontSize: 28,
        fontWeight: 'bold',
        fill: BUTTONS.labelColor,
        dropShadow: {
          color: 0x000000,
          alpha: 0.35,
          blur: 1,
          distance: 1,
        },
      },
    });
    this.label.anchor.set(0.5);
    this.view.addChild(this.label);

    // Chinese hint under button
    const hint = new Text({
      text: side === 'left' ? '左噴水' : '右噴水',
      style: {
        fontFamily: 'Microsoft JhengHei, sans-serif',
        fontSize: 12,
        fill: 0x5d4037,
      },
    });
    hint.anchor.set(0.5, 0);
    hint.y = cfg.radius + 14;
    this.view.addChild(hint);

    this.redraw();
  }

  get pressed(): boolean {
    return this._pressed;
  }

  setPressed(v: boolean): void {
    if (this._pressed === v) return;
    this._pressed = v;
  }

  containsPoint(x: number, y: number): boolean {
    const dx = x - this.cx;
    const dy = y - this.cy;
    return dx * dx + dy * dy <= this.hitRadius * this.hitRadius;
  }

  update(dt: number): void {
    const target = this._pressed ? 1 : 0;
    this.pressDepth += (target - this.pressDepth) * Math.min(1, dt * 0.02);
    this.redraw();
  }

  private redraw(): void {
    const r = BUTTONS.left.radius;
    const d = this.pressDepth;
    const faceY = d * 5;
    const faceColor = d > 0.5 ? BUTTONS.pressColor : BUTTONS.color;

    this.base.clear();
    // Pedestal shadow
    this.base.ellipse(2, 8, r + 6, r * 0.35);
    this.base.fill({ color: 0x000000, alpha: 0.25 });
    // Housing
    this.base.circle(0, 4, r + 10);
    this.base.fill({ color: BUTTONS.rimColor });
    this.base.stroke({ width: 2, color: 0x3e2723 });

    this.rim.clear();
    this.rim.circle(0, 2, r + 6);
    this.rim.fill({ color: 0x6d4c41 });
    this.rim.circle(0, 1, r + 4);
    this.rim.stroke({ width: 2, color: 0x8d6e63, alpha: 0.8 });

    this.face.clear();
    // Button body
    this.face.circle(0, faceY, r);
    this.face.fill({ color: faceColor });
    this.face.stroke({ width: 3, color: shade(faceColor, 0.55) });

    // Plastic highlight
    this.face.ellipse(-r * 0.25, faceY - r * 0.3, r * 0.45, r * 0.25);
    this.face.fill({ color: 0xffffff, alpha: 0.28 * (1 - d * 0.5) });

    // Inner ring groove
    this.face.circle(0, faceY, r * 0.72);
    this.face.stroke({ width: 2, color: shade(faceColor, 0.75), alpha: 0.6 });

    this.label.y = faceY;
    this.label.alpha = 0.9 - d * 0.15;
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
