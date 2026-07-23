# Water Ring Toss · 水壓套圈

高度還原 80 年代街機／玩具店常見的 **水壓套圈遊戲機**（Water Ring Toss）的數位版本。

在透明水箱裡用左右按鈕噴水，把彩色塑料圈套上立針——手感可調、物理可玩、外觀懷舊。

| | |
|---|---|
| **技術** | TypeScript · [PixiJS](https://pixijs.com/) v8 · [Matter.js](https://brm.io/matter-js/) · Vite 6 · Electron 33 |
| **平台** | 瀏覽器（Web）· Electron 桌面 · Windows x64 / ARM64 打包 |
| **線上試玩** | [https://ergeargwer.github.io/water-ring-toss/](https://ergeargwer.github.io/water-ring-toss/) |
| **授權** | MIT |

> 推送到 `main` 後，GitHub Actions 會自動建置並部署到 **GitHub Pages**。首次啟用後約 1–3 分鐘可開啟。

---

## 目錄

- [線上試玩（GitHub Pages）](#線上試玩github-pages)
- [遊戲簡介](#遊戲簡介)
- [功能一覽](#功能一覽)
- [環境需求](#環境需求)
- [快速開始](#快速開始)
- [腳本指令](#腳本指令)
- [操作說明](#操作說明)
- [手感微調](#手感微調)
- [專案結構](#專案結構)
- [架構說明](#架構說明)
- [打包發佈](#打包發佈)
- [效能與 Raspberry Pi 5](#效能與-raspberry-pi-5)
- [疑難排解](#疑難排解)
- [開發歷程](#開發歷程)
- [授權](#授權)

---

## 線上試玩（GitHub Pages）

| | |
|---|---|
| **網址** | https://ergeargwer.github.io/water-ring-toss/ |
| **部署方式** | GitHub Actions（`.github/workflows/deploy-pages.yml`） |
| **觸發條件** | 推送至 `main`，或在 Actions 分頁手動 **Run workflow** |

### 本機預覽與 Pages 建置相同產物

```bash
npm run build:web
npm run preview
```

靜態檔輸出於 `dist/`，與線上部署內容一致。`vite.config.ts` 使用 `base: './'`，可正確載入於 `https://<user>.github.io/<repo>/` 路徑下。

### 首次設定（維護者）

若倉庫尚未開啟 Pages，在 GitHub 網頁：

1. **Settings → Pages**
2. **Build and deployment → Source** 選 **GitHub Actions**

或使用 CLI（倉庫需已有 workflow 並推送過）：

```bash
gh api -X POST repos/ergeargwer/water-ring-toss/pages \
  -f build_type=workflow
```

---

## 遊戲簡介

畫面中央是一座復古塑膠水箱。箱內漂浮 5～8 個彩色圈圈，底部左右各有噴水口，對應兩顆圓形硬塑按鈕。

- **短按**：弱水流，適合微調位置  
- **長按**：強水流，大範圍推動圈圈  
- 把所有圈套上兩根立針即過關，觸發煙火與勝利畫面  

無成就、無關卡樹、無線上排行——只還原那一台桌上玩具的玩法與氛圍。

---

## 功能一覽

### 玩法與物理

- 透明長方形水箱、塑膠邊框反光、簡易海底背景  
- 彩色有厚度塑料圈（中空複合剛體，可真正「套進」立針）  
- 雙立針碰撞與得分鎖定（穩定後套上）  
- 浮力、水阻、角阻、牆／針／圈互相碰撞與堆疊  
- 噴流力場：推力、作用半徑、上下偏向  

### 視覺與音效

- 水流粒子、上升氣泡、漂浮亮片、勝利煙火  
- 水面波動線 + WebGL Shader 折射（不支援時自動降級）  
- Web Audio 程序音效：按鈕、水流、碰撞、得分、勝利  

### 介面與設定

- 開始畫面 / 遊戲 HUD / 暫停 / 勝利重開  
- 音量開關、全螢幕  
- **手感微調面板**（滑桿即時生效，自動存檔）  

---

## 環境需求

- **Node.js** 18+（建議 20+）  
- **npm** 9+  
- 現代瀏覽器（Chrome / Edge / Chromium 建議，需 WebGL）  
- 打包 Windows 安裝檔時需在 **Windows** 主機或對應 CI 執行  

```bash
node -v   # 例：v18.20.x 或更高
npm -v
```

---

## 快速開始

```bash
# 1. 進入專案
cd water-ring-toss

# 2. 安裝依賴
npm install

# 3. 瀏覽器開發（熱更新）
npm run dev
```

瀏覽器開啟：**http://localhost:5173**（或終端顯示的位址）

### Electron 桌面開發

一鍵聯調（會先編譯 Electron 主程序，再開 Vite + Electron）：

```bash
npm run dev:electron
```

開發模式下 Electron 載入 `http://127.0.0.1:5173`。

手動分兩步也可以：

```bash
npx tsc -p tsconfig.electron.json   # 產出 dist-electron/
npm run dev                         # 終端 1：Vite
npx electron .                      # 終端 2：視窗
```

### 正式建置後用 Electron 預覽

```bash
npm run build
npx electron .
```

此時載入的是打包後的 `dist/index.html`（production）。

---

## 腳本指令

| 指令 | 說明 |
|------|------|
| `npm run dev` | Vite 開發伺服器 |
| `npm run dev:electron` | Electron + Vite 開發 |
| `npm run build` | 建置網頁 + 編譯 Electron |
| `npm run build:web` | 僅建置網頁至 `dist/`（**GitHub Pages 使用此步驟**） |
| `npm run preview` | 預覽 production 網頁 |
| `npm run electron` | 編譯 Electron 並啟動 |
| `npm run pack` | 建置後 electron-builder 解壓目錄 |
| `npm run dist` | 建置並打包（依當前平台） |
| `npm run dist:win` | Windows x64 + ARM64（NSIS + portable） |
| `npm run dist:win:x64` | 僅 Windows x64 |
| `npm run dist:win:arm64` | 僅 Windows ARM64 |
| `npm run typecheck` | TypeScript 檢查（不輸出檔案） |

---

## 操作說明

### 噴水

| 操作 | 效果 |
|------|------|
| 按住畫面**左半邊**、左圓鈕、**左 Ctrl** 或 **Z** | 左噴水 |
| 按住畫面**右半邊**、右圓鈕、**右 Ctrl** 或 **X** | 右噴水 |
| **短按** | 弱水流（精細控制） |
| **長按**（預設約 ≥ 180ms，可在手感中調整） | 強水流 |

支援滑鼠與觸控；可同時按左右。

### 系統

| 操作 | 效果 |
|------|------|
| **Esc** / **P** | 暫停／繼續（在手感面板中 **Esc** 為關閉面板） |
| **O** | 開啟／關閉手感微調 |
| **F** / **F11** | 全螢幕 |
| **M** | 靜音切換 |

---

## 手感微調

可從以下入口開啟：

- 標題畫面 → **手感微調**  
- 遊戲上方 HUD → **手感**  
- 暫停／勝利選單 → **手感微調**  
- 鍵盤 **O**  

| 參數 | 說明 |
|------|------|
| 弱水流 / 強水流 | 噴水推力大小 |
| 弱流範圍 / 強流範圍 | 力場作用半徑 |
| 長按判定 | 弱流切換為強流的毫秒門檻 |
| 水流粒子 | 粒子數量倍率（影響畫面華麗度與效能） |
| 浮力 | 圈圈上浮程度 |
| 水阻 | 水中阻尼 |
| 重力 | 整體下落感 |
| 套針輔助 | 接近立針時的輕微吸附（**0**＝完全靠技術） |
| 音量 | 主音量 |

- 拖曳滑桿**即時**影響物理與噴水（進行中也可調）  
- 自動寫入瀏覽器 **`localStorage`**（鍵名：`water-ring-toss-feel-v1`）  
- **重設預設**可還原出廠手感  

程式預設常數見 `src/config.ts`；執行期覆寫見 `src/game/FeelSettings.ts`。

---

## 專案結構

```
water-ring-toss/
├── electron/
│   ├── main.ts              # Electron 主程序、全螢幕 IPC
│   └── preload.ts           # contextBridge API
├── public/
│   └── favicon.svg
├── src/
│   ├── main.ts              # 瀏覽器入口、Pixi Application
│   ├── config.ts            # 版面、預設物理、粒子上限
│   ├── styles.css
│   ├── audio/
│   │   └── AudioManager.ts  # Web Audio 程序音效
│   ├── shaders/
│   │   └── waterFilter.ts   # 水面折射 Filter
│   ├── utils/
│   │   └── math.ts
│   └── game/
│       ├── Game.ts            # 主循環與場景協調
│       ├── PhysicsWorld.ts    # Matter.js 世界、浮力、噴流
│       ├── WaterTank.ts       # 水箱與機殼外觀
│       ├── RingVisual.ts      # 圈圈繪製
│       ├── RetroButton.ts     # 復古噴水鈕
│       ├── ParticleSystem.ts  # 水流 / 氣泡 / 亮片 / 煙火
│       ├── InputManager.ts    # 滑鼠、觸控、鍵盤
│       ├── UI.ts              # 標題、HUD、暫停、勝利
│       ├── FeelSettings.ts    # 手感參數與持久化
│       └── SettingsPanel.ts   # 手感滑桿面板
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.electron.json
├── DEVELOPMENT_LOG.md       # 開發歷程
└── README.md
```

建置產物（gitignore）：

| 目錄 | 內容 |
|------|------|
| `dist/` | 網頁靜態檔 |
| `dist-electron/` | Electron main / preload |
| `release/` | electron-builder 安裝包／portable |
| `node_modules/` | 依賴 |

---

## 架構說明

```
main.ts
  └── Game
        ├── WaterTank (+ 可選 waterFilter)
        ├── ParticleSystem  ← 粒子倍率
        ├── PhysicsWorld    ← 浮力 / 阻力 / 重力 / 噴流 / 套針
        ├── RetroButton ×2
        ├── InputManager    ← 長按門檻
        ├── GameUI
        │     └── SettingsPanel  → FeelSettings → localStorage
        └── AudioManager    ← 音量
```

- **邏輯解析度**固定 `960 × 640`，執行時等比縮放並置中 letterbox。  
- 物理與繪圖分離：Matter 剛體位置每幀同步到 Pixi 顯示物件。  
- 圈圈物理為 **環狀複合體**（多段小圓），內孔可穿過立針。  

更完整的階段說明與問題解法見 [DEVELOPMENT_LOG.md](./DEVELOPMENT_LOG.md)。

---

## 打包發佈

### 僅網頁

```bash
npm run build:web
```

將 `dist/` 部署到任意靜態主機（Nginx、GitHub Pages、本機檔案伺服器等）。  
注意：`vite.config.ts` 已設 `base: './'`，適合相對路徑部署。

### Windows 桌面（exe）

在 **Windows** 上：

```bash
npm install
npm run dist:win          # x64 + arm64，NSIS 安裝包 + portable
# 或
npm run dist:win:x64
npm run dist:win:arm64
```

產物目錄：`release/`  
應用 ID：`com.waterringtoss.app` · 產品名：`Water Ring Toss`

### 其他

```bash
npm run pack    # 不解壓安裝包，僅輸出可執行目錄（除錯用）
npm run dist    # 依目前 OS 預設 target（Linux 上可能產出 AppImage）
```

---

## 效能與 Raspberry Pi 5

程式已對低核心數裝置做初步優化（自動降低 DPR、可關 antialias）。若仍偏卡，可依序嘗試：

1. **手感面板**把「水流粒子」調低（例如 0.3～0.6×）  
2. 在 `src/config.ts` 降低 `PARTICLES.maxWater` / `maxBubbles`（例如 160 / 40）  
3. `src/main.ts` 強制 `resolution: 1`、`antialias: false`  
4. Electron 啟動參數：  
   `--enable-gpu-rasterization --ignore-gpu-blocklist`  
5. Matter 迭代：`PhysicsWorld` 內 `positionIterations` 可從 6 降到 4  
6. Shader 異常時會自動改用 CPU 水面線，無需手動關閉  

目標流暢區間約 **30–60 FPS**。

---

## 疑難排解

| 現象 | 可能原因與處理 |
|------|----------------|
| `npm run dev:electron` 白屏 | 先確認 Vite 已在 5173 起來；或改跑 `npm run build && npx electron .` |
| Electron 找不到 `dist-electron/main.js` | 執行 `npx tsc -p tsconfig.electron.json` |
| 沒有聲音 | 需使用者先點一下畫面（瀏覽器 AudioContext 政策）；檢查是否靜音、手感音量是否為 0 |
| 水面無折射效果 | GPU/Canvas2D 環境會跳過 Filter，屬正常降級 |
| 圈圈套不進針 | 調高「套針輔助」；或檢查是否長按強流把圈沖飛 |
| localStorage 設定異常 | 瀏覽器清除站台資料，或面板按「重設預設」 |
| Windows 打包失敗 | 需在 Windows 環境；檢查 Node 版本與磁碟空間 |

---

## 開發歷程

從專案骨架、物理中空圈、到遊戲內手感微調的完整紀錄：

- **[DEVELOPMENT_LOG.md](./DEVELOPMENT_LOG.md)** — 階段摘要、架構圖、問題解法、需求對照  

---

## 授權

[MIT](./package.json) © Water Ring Toss

歡迎修改、再發佈與嵌入自己的復古遊戲收藏。
