/**
 * Water Ring Toss — entry point
 * PixiJS v8 Application + Game bootstrap
 */
import { Application } from 'pixi.js';
import { DESIGN_W, DESIGN_H } from './config';
import { Game } from './game/Game';

async function main(): Promise<void> {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  if (!canvas) throw new Error('#game-canvas not found');

  const app = new Application();

  // Cap DPR for low-power devices (e.g. Raspberry Pi 5)
  const isLowPower =
    /Raspberry|ARM|aarch64/i.test(navigator.userAgent) ||
    (navigator.hardwareConcurrency ?? 8) <= 4;
  const maxDpr = isLowPower ? 1 : 2;

  await app.init({
    canvas,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0x0d2430,
    antialias: !isLowPower,
    resolution: Math.min(window.devicePixelRatio || 1, maxDpr),
    autoDensity: true,
    preference: 'webgl',
    powerPreference: 'high-performance',
  });

  // Resize renderer to window
  const onResize = (): void => {
    app.renderer.resize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', onResize);

  // Unlock audio on first gesture
  const unlock = (): void => {
    document.removeEventListener('pointerdown', unlock);
    document.removeEventListener('keydown', unlock);
  };
  document.addEventListener('pointerdown', unlock, { once: true });
  document.addEventListener('keydown', unlock, { once: true });

  const game = new Game(app);
  await game.init();

  // Expose for debugging in web console
  (window as unknown as { __game: Game }).__game = game;

  console.info(
    `%c Water Ring Toss %c ${DESIGN_W}×${DESIGN_H} ready `,
    'background:#c62828;color:#fff;padding:2px 6px;border-radius:3px 0 0 3px',
    'background:#5d4037;color:#ffe082;padding:2px 6px;border-radius:0 3px 3px 0'
  );
}

main().catch((err) => {
  console.error('Failed to start Water Ring Toss:', err);
  const el = document.getElementById('app');
  if (el) {
    el.innerHTML = `<div style="color:#ffe082;padding:2rem;font-family:sans-serif">
      <h1>啟動失敗</h1>
      <pre style="color:#ffcdd2;white-space:pre-wrap">${String(err)}</pre>
    </div>`;
  }
});
