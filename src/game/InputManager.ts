import { feel } from './FeelSettings';

export type JetInput = {
  active: boolean;
  strong: boolean;
  pressMs: number;
};

/**
 * Mouse / touch / keyboard input for left & right water buttons.
 * - Pointer in left/right half of tank or on buttons
 * - Left Ctrl / Z = left, Right Ctrl / X = right
 */
export class InputManager {
  left: JetInput = { active: false, strong: false, pressMs: 0 };
  right: JetInput = { active: false, strong: false, pressMs: 0 };

  private leftKeys = new Set<string>();
  private rightKeys = new Set<string>();
  private leftPointer = false;
  private rightPointer = false;
  private leftDownAt = 0;
  private rightDownAt = 0;

  private enabled = true;
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundBlur: () => void;

  /** Called when a jet starts/stops for SFX */
  onJetChange?: (
    side: 'left' | 'right',
    active: boolean,
    strong: boolean,
    justStarted: boolean
  ) => void;

  /** Hit-test callbacks provided by game */
  hitLeft?: (x: number, y: number) => boolean;
  hitRight?: (x: number, y: number) => boolean;
  /** Convert client coords to design space */
  clientToDesign?: (clientX: number, clientY: number) => { x: number; y: number };

  private canvas: HTMLCanvasElement;
  private prevLeft = false;
  private prevRight = false;
  private prevLeftStrong = false;
  private prevRightStrong = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundKeyUp = this.onKeyUp.bind(this);
    this.boundBlur = this.releaseAll.bind(this);

    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
    window.addEventListener('blur', this.boundBlur);

    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('pointerleave', this.onPointerUp);
    canvas.addEventListener('pointermove', this.onPointerMove);
    // Multi-touch: track each pointer
    canvas.style.touchAction = 'none';
  }

  setEnabled(v: boolean): void {
    this.enabled = v;
    if (!v) this.releaseAll();
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.enabled) return;
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    // Left: ControlLeft, z
    if (e.code === 'ControlLeft' || k === 'z') {
      e.preventDefault();
      this.leftKeys.add(e.code || k);
      if (!this.left.active) this.leftDownAt = performance.now();
    }
    // Right: ControlRight, x
    if (e.code === 'ControlRight' || k === 'x') {
      e.preventDefault();
      this.rightKeys.add(e.code || k);
      if (!this.right.active) this.rightDownAt = performance.now();
    }
    // Escape pause handled by Game
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const k = e.key.toLowerCase();
    if (e.code === 'ControlLeft' || k === 'z') {
      this.leftKeys.delete(e.code);
      this.leftKeys.delete('ControlLeft');
      this.leftKeys.delete('z');
      this.leftKeys.delete('KeyZ');
    }
    if (e.code === 'ControlRight' || k === 'x') {
      this.rightKeys.delete(e.code);
      this.rightKeys.delete('ControlRight');
      this.rightKeys.delete('x');
      this.rightKeys.delete('KeyX');
    }
  };

  private pointers = new Map<number, { x: number; y: number }>();

  private onPointerDown = (e: PointerEvent): void => {
    if (!this.enabled) return;
    this.canvas.setPointerCapture?.(e.pointerId);
    const pos = this.toDesign(e.clientX, e.clientY);
    this.pointers.set(e.pointerId, pos);
    this.recomputePointers();
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.pointers.has(e.pointerId)) return;
    const pos = this.toDesign(e.clientX, e.clientY);
    this.pointers.set(e.pointerId, pos);
    this.recomputePointers();
  };

  private onPointerUp = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
    this.recomputePointers();
  };

  private toDesign(clientX: number, clientY: number): { x: number; y: number } {
    if (this.clientToDesign) return this.clientToDesign(clientX, clientY);
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 960,
      y: ((clientY - rect.top) / rect.height) * 640,
    };
  }

  private recomputePointers(): void {
    let l = false;
    let r = false;
    for (const pos of this.pointers.values()) {
      if (this.hitLeft?.(pos.x, pos.y)) l = true;
      if (this.hitRight?.(pos.x, pos.y)) r = true;
    }
    if (l && !this.leftPointer) this.leftDownAt = performance.now();
    if (r && !this.rightPointer) this.rightDownAt = performance.now();
    this.leftPointer = l;
    this.rightPointer = r;
  }

  private releaseAll(): void {
    this.leftKeys.clear();
    this.rightKeys.clear();
    this.leftPointer = false;
    this.rightPointer = false;
    this.pointers.clear();
  }

  update(): void {
    const now = performance.now();
    const leftActive = this.enabled && (this.leftKeys.size > 0 || this.leftPointer);
    const rightActive = this.enabled && (this.rightKeys.size > 0 || this.rightPointer);

    if (leftActive) {
      this.left.pressMs = now - this.leftDownAt;
      this.left.strong = this.left.pressMs >= feel.getKey('shortPressMs');
      this.left.active = true;
    } else {
      this.left.active = false;
      this.left.strong = false;
      this.left.pressMs = 0;
    }

    if (rightActive) {
      this.right.pressMs = now - this.rightDownAt;
      this.right.strong = this.right.pressMs >= feel.getKey('shortPressMs');
      this.right.active = true;
    } else {
      this.right.active = false;
      this.right.strong = false;
      this.right.pressMs = 0;
    }

    // Edge notifications
    if (this.left.active !== this.prevLeft || this.left.strong !== this.prevLeftStrong) {
      this.onJetChange?.(
        'left',
        this.left.active,
        this.left.strong,
        this.left.active && !this.prevLeft
      );
    }
    if (this.right.active !== this.prevRight || this.right.strong !== this.prevRightStrong) {
      this.onJetChange?.(
        'right',
        this.right.active,
        this.right.strong,
        this.right.active && !this.prevRight
      );
    }
    this.prevLeft = this.left.active;
    this.prevRight = this.right.active;
    this.prevLeftStrong = this.left.strong;
    this.prevRightStrong = this.right.strong;
  }

  destroy(): void {
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    window.removeEventListener('blur', this.boundBlur);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
    this.canvas.removeEventListener('pointerleave', this.onPointerUp);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
  }
}
