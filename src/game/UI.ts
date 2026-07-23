import { Container, Graphics, Text } from 'pixi.js';
import { DESIGN_W, DESIGN_H, UI as UIC } from '../config';
import { SettingsPanel } from './SettingsPanel';

export type GameScreen = 'title' | 'playing' | 'paused' | 'victory' | 'settings';

export interface HudData {
  remaining: number;
  scored: number;
  total: number;
  elapsedSec: number;
  muted: boolean;
}

/**
 * Retro UI: title, HUD, pause, victory + feel settings panel.
 */
export class GameUI {
  readonly view = new Container();
  private hud = new Container();
  private overlay = new Container();
  private titleScreen = new Container();
  private pauseScreen = new Container();
  private victoryScreen = new Container();
  readonly settings: SettingsPanel;

  private remainingText!: Text;
  private scoredText!: Text;
  private timeText!: Text;
  private muteLabel: Text = new Text({ text: '音量: 開' });
  private victoryTimeText!: Text;

  private screen: GameScreen = 'title';
  private screenBeforeSettings: GameScreen = 'title';
  private onStart?: () => void;
  private onRestart?: () => void;
  private onTogglePause?: () => void;
  private onToggleMute?: () => void;
  private onOpenSettings?: () => void;
  private onCloseSettings?: () => void;
  private onResetFeel?: () => void;

  constructor() {
    this.view.label = 'ui';
    this.view.eventMode = 'static';
    this.settings = new SettingsPanel();
    this.buildHud();
    this.buildTitle();
    this.buildPause();
    this.buildVictory();
    this.view.addChild(this.hud, this.overlay, this.settings.view);
    this.overlay.addChild(this.titleScreen, this.pauseScreen, this.victoryScreen);
    this.settings.on({
      close: () => {
        this.closeSettings();
        this.onCloseSettings?.();
      },
      reset: () => this.onResetFeel?.(),
    });
    this.setScreen('title');
  }

  on(handlers: {
    start?: () => void;
    restart?: () => void;
    togglePause?: () => void;
    toggleMute?: () => void;
    openSettings?: () => void;
    closeSettings?: () => void;
    resetFeel?: () => void;
  }): void {
    this.onStart = handlers.start;
    this.onRestart = handlers.restart;
    this.onTogglePause = handlers.togglePause;
    this.onToggleMute = handlers.toggleMute;
    this.onOpenSettings = handlers.openSettings;
    this.onCloseSettings = handlers.closeSettings;
    this.onResetFeel = handlers.resetFeel;
  }

  setScreen(s: GameScreen): void {
    if (s === 'settings') {
      this.openSettings();
      return;
    }
    this.screen = s;
    this.settings.close();
    this.hud.visible = s === 'playing' || s === 'paused';
    this.titleScreen.visible = s === 'title';
    this.pauseScreen.visible = s === 'paused';
    this.victoryScreen.visible = s === 'victory';
    this.overlay.visible = s !== 'playing';
  }

  openSettings(): void {
    // Remember where we came from (not settings itself)
    if (this.screen !== 'settings') {
      this.screenBeforeSettings = this.screen;
    }
    const from =
      this.screenBeforeSettings === 'paused'
        ? 'paused'
        : this.screenBeforeSettings === 'playing'
          ? 'playing'
          : 'title';
    this.screen = 'settings';
    this.settings.open(from);
    // Keep underlying screen visible under dim when from pause/title
    this.hud.visible =
      this.screenBeforeSettings === 'playing' || this.screenBeforeSettings === 'paused';
    this.titleScreen.visible = this.screenBeforeSettings === 'title';
    this.pauseScreen.visible = this.screenBeforeSettings === 'paused';
    this.victoryScreen.visible = this.screenBeforeSettings === 'victory';
    this.overlay.visible = this.screenBeforeSettings !== 'playing';
    this.onOpenSettings?.();
  }

  closeSettings(): void {
    this.settings.close();
    const back = this.screenBeforeSettings;
    this.screen = back === 'settings' ? 'title' : back;
    this.hud.visible = this.screen === 'playing' || this.screen === 'paused';
    this.titleScreen.visible = this.screen === 'title';
    this.pauseScreen.visible = this.screen === 'paused';
    this.victoryScreen.visible = this.screen === 'victory';
    this.overlay.visible = this.screen !== 'playing';
  }

  isSettingsOpen(): boolean {
    return this.settings.isOpen();
  }

  getScreen(): GameScreen {
    return this.screen;
  }

  updateHud(data: HudData): void {
    this.remainingText.text = `剩餘圈圈  ${data.remaining}`;
    this.scoredText.text = `已套上  ${data.scored}/${data.total}`;
    this.timeText.text = `時間  ${formatTime(data.elapsedSec)}`;
    this.muteLabel.text = data.muted ? '音量: 關' : '音量: 開';
  }

  setVictoryTime(sec: number): void {
    this.victoryTimeText.text = `用時 ${formatTime(sec)}`;
  }

  private buildHud(): void {
    const bar = new Graphics();
    bar.roundRect(100, 8, DESIGN_W - 200, 36, 8);
    bar.fill({ color: UIC.panelBg, alpha: 0.82 });
    bar.stroke({ width: 2, color: UIC.textGold, alpha: 0.5 });
    this.hud.addChild(bar);

    const style = {
      fontFamily: 'Microsoft JhengHei, Segoe UI, sans-serif',
      fontSize: 14,
      fill: UIC.textCream,
    };

    this.remainingText = new Text({ text: '剩餘圈圈  0', style });
    this.remainingText.x = 114;
    this.remainingText.y = 16;

    this.scoredText = new Text({ text: '已套上  0/0', style });
    this.scoredText.x = 250;
    this.scoredText.y = 16;

    this.timeText = new Text({ text: '時間  0:00', style });
    this.timeText.x = 380;
    this.timeText.y = 16;

    this.hud.addChild(this.remainingText, this.scoredText, this.timeText);

    this.hud.addChild(
      this.makeButton(DESIGN_W - 310, 12, 56, 28, '手感', () => this.openSettings())
    );
    this.hud.addChild(
      this.makeButton(DESIGN_W - 246, 12, 56, 28, '暫停', () => this.onTogglePause?.())
    );
    const muteBtn = this.makeButton(DESIGN_W - 182, 12, 72, 28, '音量: 開', () =>
      this.onToggleMute?.()
    );
    for (const c of muteBtn.children) {
      if (c instanceof Text) {
        this.muteLabel = c;
        break;
      }
    }
    this.hud.addChild(muteBtn);
  }

  private buildTitle(): void {
    const bg = new Graphics();
    bg.rect(0, 0, DESIGN_W, DESIGN_H);
    bg.fill({ color: UIC.overlay, alpha: 0.55 });
    this.titleScreen.addChild(bg);

    const card = new Graphics();
    card.roundRect(DESIGN_W / 2 - 220, 90, 440, 380, 20);
    card.fill({ color: 0xd4a84b });
    card.stroke({ width: 5, color: 0x8b6914 });
    card.roundRect(DESIGN_W / 2 - 200, 110, 400, 80, 10);
    card.fill({ color: 0x5d4037 });
    this.titleScreen.addChild(card);

    const title = new Text({
      text: 'WATER RING TOSS',
      style: {
        fontFamily: 'Georgia, serif',
        fontSize: 32,
        fontWeight: 'bold',
        fill: UIC.textGold,
        letterSpacing: 2,
      },
    });
    title.anchor.set(0.5);
    title.x = DESIGN_W / 2;
    title.y = 140;
    this.titleScreen.addChild(title);

    const subtitle = new Text({
      text: '水  壓  套  圈',
      style: {
        fontFamily: 'Microsoft JhengHei, sans-serif',
        fontSize: 28,
        fill: UIC.textCream,
      },
    });
    subtitle.anchor.set(0.5);
    subtitle.x = DESIGN_W / 2;
    subtitle.y = 180;
    this.titleScreen.addChild(subtitle);

    const desc = new Text({
      text: '按住左右按鈕噴水\n把彩色圈圈套上立針！\n\n短按＝弱水流　長按＝強水流\nCtrl/Z 左　Ctrl/X 右　O 手感　F 全螢幕',
      style: {
        fontFamily: 'Microsoft JhengHei, sans-serif',
        fontSize: 16,
        fill: 0x4e342e,
        align: 'center',
        lineHeight: 26,
      },
    });
    desc.anchor.set(0.5, 0);
    desc.x = DESIGN_W / 2;
    desc.y = 230;
    this.titleScreen.addChild(desc);

    this.titleScreen.addChild(
      this.makeButton(DESIGN_W / 2 - 150, 400, 140, 44, '開始遊戲', () => this.onStart?.(), true)
    );
    this.titleScreen.addChild(
      this.makeButton(DESIGN_W / 2 + 10, 400, 140, 44, '手感微調', () => this.openSettings())
    );
  }

  private buildPause(): void {
    const bg = new Graphics();
    bg.rect(0, 0, DESIGN_W, DESIGN_H);
    bg.fill({ color: UIC.overlay, alpha: 0.6 });
    this.pauseScreen.addChild(bg);

    const title = new Text({
      text: '暫停',
      style: {
        fontFamily: 'Microsoft JhengHei, sans-serif',
        fontSize: 42,
        fill: UIC.textGold,
      },
    });
    title.anchor.set(0.5);
    title.x = DESIGN_W / 2;
    title.y = DESIGN_H / 2 - 100;
    this.pauseScreen.addChild(title);

    this.pauseScreen.addChild(
      this.makeButton(DESIGN_W / 2 - 70, DESIGN_H / 2 - 40, 140, 44, '繼續', () =>
        this.onTogglePause?.(), true
      )
    );
    this.pauseScreen.addChild(
      this.makeButton(DESIGN_W / 2 - 70, DESIGN_H / 2 + 16, 140, 40, '手感微調', () =>
        this.openSettings()
      )
    );
    this.pauseScreen.addChild(
      this.makeButton(DESIGN_W / 2 - 70, DESIGN_H / 2 + 70, 140, 40, '重新開始', () =>
        this.onRestart?.()
      )
    );
  }

  private buildVictory(): void {
    const bg = new Graphics();
    bg.rect(0, 0, DESIGN_W, DESIGN_H);
    bg.fill({ color: UIC.overlay, alpha: 0.65 });
    this.victoryScreen.addChild(bg);

    const banner = new Graphics();
    banner.roundRect(DESIGN_W / 2 - 200, DESIGN_H / 2 - 120, 400, 240, 16);
    banner.fill({ color: 0x3e2723 });
    banner.stroke({ width: 4, color: UIC.textGold });
    this.victoryScreen.addChild(banner);

    const title = new Text({
      text: '全部套上！',
      style: {
        fontFamily: 'Microsoft JhengHei, sans-serif',
        fontSize: 36,
        fontWeight: 'bold',
        fill: UIC.successGreen,
      },
    });
    title.anchor.set(0.5);
    title.x = DESIGN_W / 2;
    title.y = DESIGN_H / 2 - 70;
    this.victoryScreen.addChild(title);

    this.victoryTimeText = new Text({
      text: '用時 0:00',
      style: {
        fontFamily: 'Microsoft JhengHei, sans-serif',
        fontSize: 20,
        fill: UIC.textCream,
      },
    });
    this.victoryTimeText.anchor.set(0.5);
    this.victoryTimeText.x = DESIGN_W / 2;
    this.victoryTimeText.y = DESIGN_H / 2 - 20;
    this.victoryScreen.addChild(this.victoryTimeText);

    this.victoryScreen.addChild(
      this.makeButton(DESIGN_W / 2 - 150, DESIGN_H / 2 + 30, 140, 44, '再玩一次', () =>
        this.onRestart?.(), true
      )
    );
    this.victoryScreen.addChild(
      this.makeButton(DESIGN_W / 2 + 10, DESIGN_H / 2 + 30, 140, 44, '手感微調', () =>
        this.openSettings()
      )
    );
  }

  private makeButton(
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
    g.roundRect(0, 0, w, h, 8);
    g.fill({ color: primary ? 0xc62828 : 0x5d4037 });
    g.stroke({ width: 2, color: primary ? 0xffcdd2 : UIC.textGold });
    c.addChild(g);

    const t = new Text({
      text: label,
      style: {
        fontFamily: 'Microsoft JhengHei, sans-serif',
        fontSize: primary ? 18 : 14,
        fill: UIC.textCream,
      },
    });
    t.label = 'label';
    t.anchor.set(0.5);
    t.x = w / 2;
    t.y = h / 2;
    c.addChild(t);

    c.on('pointerdown', (e) => {
      e.stopPropagation();
      onClick();
    });

    c.on('pointerover', () => {
      g.clear();
      g.roundRect(0, 0, w, h, 8);
      g.fill({ color: primary ? 0xe53935 : 0x6d4c41 });
      g.stroke({ width: 2, color: primary ? 0xffcdd2 : UIC.textGold });
    });
    c.on('pointerout', () => {
      g.clear();
      g.roundRect(0, 0, w, h, 8);
      g.fill({ color: primary ? 0xc62828 : 0x5d4037 });
      g.stroke({ width: 2, color: primary ? 0xffcdd2 : UIC.textGold });
    });

    return c;
  }
}

function formatTime(sec: number): string {
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}
