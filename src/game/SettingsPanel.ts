/**
 * Retro-styled feel-tuning panel with draggable sliders.
 */
import { Container, Graphics, Text } from 'pixi.js';
import { DESIGN_W, DESIGN_H, UI as UIC } from '../config';
import {
  feel,
  FEEL_SLIDERS,
  formatFeelValue,
  type FeelKey,
  type FeelValues,
  type SliderDef,
} from './FeelSettings';

const PANEL_W = 520;
const PANEL_H = 520;
const SLIDER_X = 150;
const SLIDER_W = 260;
const ROW_H = 36;
const TRACK_H = 8;
const KNOB_R = 10;

type SliderRow = {
  def: SliderDef;
  root: Container;
  track: Graphics;
  fill: Graphics;
  knob: Graphics;
  valueText: Text;
  dragging: boolean;
};

export class SettingsPanel {
  readonly view = new Container();
  private rows: SliderRow[] = [];
  private unsub?: () => void;
  private onClose?: () => void;
  private onReset?: () => void;
  private returnScreen: 'title' | 'paused' | 'playing' = 'title';

  constructor() {
    this.view.label = 'settings-panel';
    this.view.visible = false;
    this.view.eventMode = 'static';
    this.build();
    this.unsub = feel.subscribe((v) => this.syncFromFeel(v));
    this.syncFromFeel(feel.get());
  }

  on(handlers: { close?: () => void; reset?: () => void }): void {
    this.onClose = handlers.close;
    this.onReset = handlers.reset;
  }

  open(from: 'title' | 'paused' | 'playing' = 'title'): void {
    this.returnScreen = from;
    this.view.visible = true;
    this.syncFromFeel(feel.get());
  }

  close(): void {
    this.view.visible = false;
  }

  isOpen(): boolean {
    return this.view.visible;
  }

  getReturnScreen(): 'title' | 'paused' | 'playing' {
    return this.returnScreen;
  }

  destroy(): void {
    this.unsub?.();
    this.view.destroy({ children: true });
  }

  private build(): void {
    const px = (DESIGN_W - PANEL_W) / 2;
    const py = (DESIGN_H - PANEL_H) / 2 - 10;

    // Dim background — block clicks to game
    const dim = new Graphics();
    dim.rect(0, 0, DESIGN_W, DESIGN_H);
    dim.fill({ color: UIC.overlay, alpha: 0.72 });
    dim.eventMode = 'static';
    dim.on('pointerdown', (e) => e.stopPropagation());
    this.view.addChild(dim);

    const panel = new Container();
    panel.x = px;
    panel.y = py;
    this.view.addChild(panel);

    const bg = new Graphics();
    bg.roundRect(0, 0, PANEL_W, PANEL_H, 16);
    bg.fill({ color: 0x3e2723 });
    bg.stroke({ width: 4, color: UIC.textGold });
    // Inner gold line
    bg.roundRect(8, 8, PANEL_W - 16, PANEL_H - 16, 12);
    bg.stroke({ width: 1.5, color: 0x8d6e63, alpha: 0.7 });
    panel.addChild(bg);

    const title = new Text({
      text: '手感微調',
      style: {
        fontFamily: 'Microsoft JhengHei, sans-serif',
        fontSize: 26,
        fontWeight: 'bold',
        fill: UIC.textGold,
      },
    });
    title.anchor.set(0.5, 0);
    title.x = PANEL_W / 2;
    title.y = 18;
    panel.addChild(title);

    const hint = new Text({
      text: '拖曳滑桿調整 · 設定會自動儲存',
      style: {
        fontFamily: 'Microsoft JhengHei, sans-serif',
        fontSize: 12,
        fill: 0xbcaaa4,
      },
    });
    hint.anchor.set(0.5, 0);
    hint.x = PANEL_W / 2;
    hint.y = 50;
    panel.addChild(hint);

    let y = 78;
    for (const def of FEEL_SLIDERS) {
      const row = this.makeSliderRow(def, y);
      panel.addChild(row.root);
      this.rows.push(row);
      y += ROW_H;
    }

    // Buttons
    const btnY = PANEL_H - 58;
    panel.addChild(
      this.makeBtn(PANEL_W / 2 - 170, btnY, 100, 36, '重設預設', () => {
        feel.reset();
        this.onReset?.();
      })
    );
    panel.addChild(
      this.makeBtn(PANEL_W / 2 - 50, btnY, 100, 36, '完成', () => {
        this.close();
        this.onClose?.();
      }, true)
    );
    panel.addChild(
      this.makeBtn(PANEL_W / 2 + 70, btnY, 100, 36, '關閉', () => {
        this.close();
        this.onClose?.();
      })
    );
  }

  private makeSliderRow(def: SliderDef, y: number): SliderRow {
    const root = new Container();
    root.y = y;

    const label = new Text({
      text: def.label,
      style: {
        fontFamily: 'Microsoft JhengHei, sans-serif',
        fontSize: 14,
        fill: UIC.textCream,
      },
    });
    label.x = 24;
    label.y = 6;
    root.addChild(label);

    const track = new Graphics();
    track.x = SLIDER_X;
    track.y = 12;
    track.eventMode = 'static';
    track.cursor = 'pointer';
    root.addChild(track);

    const fill = new Graphics();
    fill.x = SLIDER_X;
    fill.y = 12;
    fill.eventMode = 'none';
    root.addChild(fill);

    const knob = new Graphics();
    knob.eventMode = 'static';
    knob.cursor = 'grab';
    root.addChild(knob);

    const valueText = new Text({
      text: '0',
      style: {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: 13,
        fill: UIC.textGold,
      },
    });
    valueText.x = SLIDER_X + SLIDER_W + 14;
    valueText.y = 6;
    root.addChild(valueText);

    const row: SliderRow = {
      def,
      root,
      track,
      fill,
      knob,
      valueText,
      dragging: false,
    };

    const setFromLocalX = (localX: number): void => {
      const t = Math.min(1, Math.max(0, localX / SLIDER_W));
      const raw = def.min + t * (def.max - def.min);
      const stepped = Math.round(raw / def.step) * def.step;
      // Avoid float noise
      const value = Math.min(def.max, Math.max(def.min, Number(stepped.toFixed(6))));
      feel.setKey(def.key, value, true);
    };

    track.on('pointerdown', (e) => {
      e.stopPropagation();
      row.dragging = true;
      knob.cursor = 'grabbing';
      const local = e.getLocalPosition(track);
      setFromLocalX(local.x);
    });

    knob.on('pointerdown', (e) => {
      e.stopPropagation();
      row.dragging = true;
      knob.cursor = 'grabbing';
    });

    // Drag via window pointer events (works with canvas letterboxing / scale)
    const onMove = (e: PointerEvent): void => {
      if (!row.dragging) return;
      const bounds = track.getBounds();
      const t = (e.clientX - bounds.x) / Math.max(1, bounds.width);
      setFromLocalX(t * SLIDER_W);
    };

    const onUp = (): void => {
      if (!row.dragging) return;
      row.dragging = false;
      knob.cursor = 'grab';
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    this.drawTrack(row, 0);
    return row;
  }

  private drawTrack(row: SliderRow, t: number): void {
    const { track, fill, knob } = row;
    track.clear();
    // Hit area
    track.rect(-4, -10, SLIDER_W + 8, TRACK_H + 20);
    track.fill({ color: 0x000000, alpha: 0.001 });
    // Groove
    track.roundRect(0, 0, SLIDER_W, TRACK_H, 4);
    track.fill({ color: 0x1a120e });
    track.stroke({ width: 1, color: 0x5d4037 });

    fill.clear();
    const fw = Math.max(0, SLIDER_W * t);
    if (fw > 0) {
      fill.roundRect(0, 0, fw, TRACK_H, 4);
      fill.fill({ color: 0xc62828 });
    }

    const kx = SLIDER_X + SLIDER_W * t;
    const ky = 12 + TRACK_H / 2;
    knob.clear();
    knob.circle(0, 0, KNOB_R + 2);
    knob.fill({ color: 0x5d4037 });
    knob.circle(0, 0, KNOB_R);
    knob.fill({ color: 0xffe082 });
    knob.circle(-2, -2, 3);
    knob.fill({ color: 0xffffff, alpha: 0.45 });
    knob.x = kx;
    knob.y = ky;
  }

  private syncFromFeel(values: FeelValues): void {
    for (const row of this.rows) {
      const v = values[row.def.key];
      const t = (v - row.def.min) / (row.def.max - row.def.min);
      this.drawTrack(row, Math.min(1, Math.max(0, t)));
      row.valueText.text = formatFeelValue(row.def, v);
    }
  }

  private makeBtn(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    onClick: () => void,
    primary = false
  ): Container {
    const c = new Container();
    c.x = x;
    c.y = y;
    c.eventMode = 'static';
    c.cursor = 'pointer';

    const g = new Graphics();
    const paint = (hover: boolean): void => {
      g.clear();
      g.roundRect(0, 0, w, h, 8);
      g.fill({
        color: primary
          ? hover
            ? 0xe53935
            : 0xc62828
          : hover
            ? 0x6d4c41
            : 0x5d4037,
      });
      g.stroke({ width: 2, color: primary ? 0xffcdd2 : UIC.textGold });
    };
    paint(false);
    c.addChild(g);

    const t = new Text({
      text: label,
      style: {
        fontFamily: 'Microsoft JhengHei, sans-serif',
        fontSize: 14,
        fill: UIC.textCream,
      },
    });
    t.anchor.set(0.5);
    t.x = w / 2;
    t.y = h / 2;
    c.addChild(t);

    c.on('pointerdown', (e) => {
      e.stopPropagation();
      onClick();
    });
    c.on('pointerover', () => paint(true));
    c.on('pointerout', () => paint(false));
    return c;
  }
}

export type { FeelKey };
