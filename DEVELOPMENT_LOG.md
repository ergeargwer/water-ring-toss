# Water Ring Toss · 水壓套圈 — 開發歷程

| 項目 | 內容 |
|------|------|
| 專案路徑 | `/home/sweet/water-ring-toss` |
| 技術棧 | TypeScript · PixiJS v8 · Matter.js · Vite 6 · Electron 33 |
| 記錄日期 | 2026-07-23 |
| 狀態 | 可運行（Web + Electron 打包設定完成） |

---

## 1. 專案目標

將 80 年代「水壓套圈遊戲機」（Water Ring Toss）高度還原為數位版：

- 透明水箱、彩色塑料圈、雙立針、左右復古噴水按鈕
- 短按弱水流 / 長按強水流
- 浮力、阻力、碰撞、粒子（水流·氣泡·亮片·煙火）
- 復古 UI、程序音效、Electron 可打包 Windows x64/ARM64
- 效能可顧及 Raspberry Pi 5

**明確不做：** 成就、多關卡、客製化外觀等現代化系統（手感微調除外，屬可玩性調整）。

---

## 2. 開發階段摘要

### 階段一：專案骨架（Electron + Vite + TS）

建立完整可建置結構：

```
water-ring-toss/
├── electron/          # main.ts, preload.ts
├── src/               # 遊戲與渲染
├── public/            # favicon 等靜態資源
├── index.html
├── package.json       # scripts: dev / build / dist:win
├── vite.config.ts
├── tsconfig.json
└── tsconfig.electron.json
```

| 指令 | 用途 |
|------|------|
| `npm run dev` | Vite 瀏覽器開發 |
| `npm run dev:electron` | Electron + Vite 聯調 |
| `npm run build` | 產出 `dist/` + `dist-electron/` |
| `npm run dist:win` | electron-builder Windows x64/ARM64 |

**驗證：** `vite build` 通過；headless Chromium 載入後 canvas 建立，console 出現 `Water Ring Toss 960×640 ready`。

---

### 階段二：視覺與場景

| 模組 | 檔案 | 內容 |
|------|------|------|
| 常數 | `src/config.ts` | 設計解析度 960×640、水箱、立針、圈、噴流、物理、粒子上限 |
| 水箱 | `src/game/WaterTank.ts` | 復古機殼、塑膠邊框反光、水面線、立針、海底裝飾、內容遮罩 |
| Shader | `src/shaders/waterFilter.ts` | PixiJS v8 GlProgram 水面折射；失敗時自動 fallback |
| 圈圈外觀 | `src/game/RingVisual.ts` | 中空塑料圈、bevel、高光、得分金邊 |
| 按鈕 | `src/game/RetroButton.ts` | 圓形硬塑按鈕、按壓下沉動畫 |

---

### 階段三：物理與水流

| 模組 | 檔案 | 內容 |
|------|------|------|
| 物理世界 | `src/game/PhysicsWorld.ts` | Matter 邊界、立針、複合中空圈、浮力、水阻、噴流力、套針判定與鎖定 |
| 粒子 | `src/game/ParticleSystem.ts` | 物件池：水流 / 氣泡 / 亮片 / 煙火 |
| 輸入 | `src/game/InputManager.ts` | 滑鼠·觸控左右區、左 Ctrl/Z、右 Ctrl/X、短長按 |

**關鍵設計決策 — 圈圈必須「套得進」立針：**

- 初版用實心圓 `Bodies.circle`，無法讓立針穿過圈心。
- 改為 **12 段小圓組成的複合剛體**（中空），立針可穿過內徑。
- 接近立針時施加可調的 **套針輔助力**，模擬玩具「滑進去」的感覺。

**得分條件：** 圈心對齊立針軸、位於針身高度、速度低於門檻並維持約 20 frame 後鎖定。

---

### 階段四：遊戲流程、UI、音效

| 模組 | 檔案 | 內容 |
|------|------|------|
| UI | `src/game/UI.ts` | 標題 / 遊戲 HUD / 暫停 / 勝利 |
| 主循環 | `src/game/Game.ts` | 場景協調、得分、勝利煙火、全螢幕 |
| 音效 | `src/audio/AudioManager.ts` | Web Audio 程序合成：按鈕、水流噪音、碰撞、得分、勝利 |
| 入口 | `src/main.ts` | Pixi Application、低功耗 DPR 自動降檔 |

**操作一覽（當前）：**

| 輸入 | 效果 |
|------|------|
| 左半邊 / 左鈕 / 左 Ctrl / Z | 左噴水 |
| 右半邊 / 右鈕 / 右 Ctrl / X | 右噴水 |
| 短按 / 長按 | 弱流 / 強流 |
| Esc / P | 暫停（設定中 Esc 關閉設定） |
| O | 手感微調開關 |
| F / F11 | 全螢幕 |
| M | 靜音 |

---

### 階段五：手感微調（介面內可調）

使用者要求將原 `config.ts` 手感參數搬到**遊戲內可調**，並持久化。

| 檔案 | 職責 |
|------|------|
| `src/game/FeelSettings.ts` | 參數定義、預設值、`localStorage` 讀寫、訂閱通知 |
| `src/game/SettingsPanel.ts` | 復古滑桿面板（拖曳、重設、完成） |

**可調項：** 弱/強水流、弱/強流範圍、長按判定、水流粒子倍率、浮力、水阻、重力、套針輔助、音量。

**接入點：**

- 標題「手感微調」、HUD「手感」、暫停/勝利選單、快捷鍵 **O**
- `PhysicsWorld` / `InputManager` / `ParticleSystem` / `audio` 讀 `feel` 而非寫死常數
- 變更即時生效；`localStorage` key：`water-ring-toss-feel-v1`

---

## 3. 架構關係（簡圖）

```
main.ts
  └─ Game
       ├─ WaterTank (+ waterFilter)
       ├─ ParticleSystem ── feel.particleRate*
       ├─ PhysicsWorld ──── feel.buoyancy/drag/gravity/jet/slot
       ├─ RetroButton ×2
       ├─ InputManager ──── feel.shortPressMs
       ├─ GameUI
       │    └─ SettingsPanel ── feel.set / localStorage
       └─ audio ─────────── feel.volume
```

設計解析度固定 **960×640**，由 `Game.layout()` 等比縮放 letterbox 置中。

---

## 4. 檔案清單（原始碼）

| 路徑 | 說明 |
|------|------|
| `electron/main.ts` | BrowserWindow、F11 全螢幕 IPC |
| `electron/preload.ts` | `electronAPI` bridge |
| `src/main.ts` | 啟動 Pixi |
| `src/config.ts` | 版面與預設物理常數 |
| `src/styles.css` | 全螢幕 canvas 樣式 |
| `src/audio/AudioManager.ts` | 程序音效 |
| `src/shaders/waterFilter.ts` | 水面 Filter |
| `src/utils/math.ts` | clamp / lerp / rand |
| `src/game/Game.ts` | 主協調 |
| `src/game/PhysicsWorld.ts` | Matter 物理 |
| `src/game/WaterTank.ts` | 水箱視覺 |
| `src/game/RingVisual.ts` | 圈圈繪製 |
| `src/game/RetroButton.ts` | 噴水鈕 |
| `src/game/ParticleSystem.ts` | 粒子池 |
| `src/game/InputManager.ts` | 輸入 |
| `src/game/UI.ts` | 各畫面 UI |
| `src/game/FeelSettings.ts` | 手感狀態 |
| `src/game/SettingsPanel.ts` | 手感面板 |
| `README.md` | 使用說明 |
| `DEVELOPMENT_LOG.md` | 本開發歷程 |

約 **3500+ 行** TypeScript（含 electron，不含 node_modules）。

---

## 5. 問題與解法紀錄

| 問題 | 解法 |
|------|------|
| 實心圓無法套針 | 複合小圓環（中空）+ 幾何得分判定 |
| Headless 無 WebGPU/WebGL Filter | 嘗試 Shader，失敗則僅用 CPU 水面線 |
| Pi 5 / 低功耗 | 自動降 DPR、可關 antialias；粒子上限可調 |
| Electron 開發需先編譯 main | `tsc -p tsconfig.electron.json`；`dev:electron` 腳本已串 |
| 手感寫死在 config | 抽出 `FeelSettings` + 遊戲內滑桿 + localStorage |
| 設定中誤觸噴水 | 開啟設定時 `input.setEnabled(false)` 並停水流 |

---

## 6. 建置與驗證紀錄

```text
npm install          # 成功（Node 18 / npm 10）
npx vite build       # 成功（pixi / matter 分包）
npx tsc -p tsconfig.electron.json  # 產出 dist-electron/
headless Chromium    # canvas 建立，主迴圈 ready
```

Windows 實機 `npm run dist:win` 需在 Windows 或對應 CI 環境執行（本機為 Linux 開發環境）。

---

## 7. 後續可選方向（未實作）

1. 水箱/圈圈改用實拍或繪製貼圖，加強塑料質感  
2. 更精緻的中空碰撞（或 2D SDF）  
3. 觸控專用更大 hit 區與手感預設檔（「簡單 / 標準 / 硬核」）  
4. Linux AppImage / macOS 打包驗證  
5. 自動化 E2E（Playwright）截圖回歸  

---

## 8. 對話需求對應

| 使用者需求 | 對應交付 |
|------------|----------|
| PixiJS v8 + Matter.js | 已採用 |
| Electron Web + Win x64/ARM64 | package.json `build` / `dist:win*` |
| 水箱、圈、立針、雙鈕、短長按噴水 | 已實作 |
| 粒子、浮力、碰撞、勝利 | 已實作 |
| 極簡復古 UI、無成就多關 | 已遵守 |
| 一步步開發、可運行 | 骨架→物理→流程→手感 |
| 手感微調放進遊戲介面 | FeelSettings + SettingsPanel |
| 儲存開發歷程 | 本文件 |

---

*本文件記錄截至 2026-07-23 的開發過程，便於日後接續維護與交接。*
