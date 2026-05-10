# 排餐設定頁面 UI 翻修設計（A2 方案）

## 背景

排餐設定（`src/components/MealSettings.tsx`）目前每餐用一顆獨立 `choice-chip` 包住的 checkbox 呈現「啟用 / 停用」，右側再放數量輸入框。三個 checkbox 框堆疊起來體積大、與右側 chip 視覺斷開，整體較碎。早餐只顯示「固定 1 樣」與午、晚餐的 3 個數量 chip 也讓三行高度不一致。

這次只動 UI（視覺與排版），**不改互動模型、資料模型或排菜單邏輯**。

## 目標

- 拿掉每餐獨立的 checkbox 框，改用「餐別 pill 即 toggle」的設計。
- 每日卡片內每餐一行，左邊餐別 pill、右邊數量 chip（或固定文字 / 未安排佔位），高度一致。
- 數量 chip 預設顯示精簡 `菜 2`；點擊後就地展開為可編輯態（橘框 + mini stepper），也接受鍵盤輸入。
- 視覺風格延用現有暖色（`#fff7ed / #fed7aa / #f97316 / #9a3412 / #1f2937`）與 chip 圓角設計，與菜品設定頁協調。

## 非目標

- 不變動 `MealSetting` 資料結構或 `db.ts`。
- 不變動 `setDayEnabled` 行為（啟用整日 = 啟用 dinner、關閉整日 = 關閉三餐），不動 `planner.ts`。
- 不調整每日 toggle、底部 tab、整體 Layout、字型載入。
- 不新增「跨日複製」「批次套用」等功能。
- 不取代 native `<input type="number">` 的鍵盤輸入能力（仍可直接打字）。

## 視覺結構

每天卡片（`.settings-day`）保持外觀；內部從原本的「每餐一個 fieldset/checkbox 框」改為：

```
┌─ 週一 · 早餐、午餐、晚餐                  [●━━] ─┐
│                                                 │
│  [早餐]            固定 1 樣                     │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│  [午餐]      ( 菜 2 )( 肉 0 )( 湯 0 )            │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│  [晚餐]      ( 菜 1 )( 肉 0 )( 湯 0 )            │
└──────────────────────────────────────────────────┘
```

每個餐別行 (`.meal-row`) 之間用 `1px dashed #fed7aa` 分隔線取代原本的個別圓框。

## 元件規格

### 餐別 Pill（取代現在的 `.choice-chip` checkbox）

- 角色：純按鈕（`<button type="button">`），按下切換 `setting.enabled`。
- 尺寸：`padding: 0.4rem 0.95rem; border-radius: 999px; font-weight: 700; font-size: 0.95rem`。
- 啟用態：`background: #f97316; color: #fff;` 無邊框。
- 停用態：`background: transparent; color: #c2855a; border: 1.5px solid #fed7aa; opacity: 0.65`。
- 不再使用 `<input type="checkbox">`；以 `aria-pressed` 標記啟用狀態。`aria-label` 維持「{星期}{餐別}」。

### 數量 Chip（取代現在的 `.count-field`）

預設態：

- 結構：`<button type="button" class="chip">菜 <span class="num">2</span></button>`，整顆 chip 可點擊。
- 樣式：`background: #fff; border: 1.5px solid #fed7aa; border-radius: 999px; padding: 0.3rem 0.75rem; height: 1.85rem; min-width: 2.85rem;`。
- 文字：標籤（菜/肉/湯）`color: #9a3412; font-weight: 700`；數字 `color: #1f2937`，`font-variant-numeric: tabular-nums`。
- **數字為 0 時**：`.num` 改為 `color: #c2855a`（dim），讓「未排」一眼可辨。

編輯態（同一時間最多一個 chip 處於編輯態）：

- 觸發：點擊 chip。
- 樣式：`border-color: #f97316; box-shadow: 0 0 0 3px rgba(249,115,22,0.18)`。
- 結構：chip 內 `.num` 換成 `<input type="number" min="0">`（無邊框、透明背景、`text-align: center; width: 1.4rem`），右側追加 mini stepper：

  ```html
  <span class="stepper">
    <button type="button" aria-label="增加">▲</button>
    <button type="button" aria-label="減少">▼</button>
  </span>
  ```

  上下箭頭：每顆視覺尺寸 `1.05rem × 0.72rem`、`background: #fff7ed; border-radius: 4px;`，hover 時 `#fed7aa`。為了符合手機觸控可達性，按鈕本體保持小尺寸但用 `padding` 把命中區域擴展為至少 `2rem × 1.4rem`（視覺保持精緻、實際好按）。

- 互動：
  - 進入編輯態：focus 並選取 input 內現有數字（按一下就能直接覆寫）。
  - `▲ / ▼`：clamp 到 `>= 0`；按鈕在 0 時 `▼` 不 disable（保持視覺一致），但 onClick 仍然 clamp。
  - 退出編輯態：input blur（點 chip 之外、focus 其他 chip、按 Tab）即視為提交。
  - 鍵盤：上下方向鍵等同 `▲ / ▼`；Enter / Escape 也離開編輯態。

- 焦點管理：點另一顆 chip 進入編輯時，前一顆自動退出編輯態。內部用 `useState<{ meal, field } | null>` 即可。

### 行內非數量內容

- **早餐行**：右側永遠顯示文字 `固定 1 樣`（樣式：`color: #9a3412; font-weight: 700; font-size: 0.85rem`）。
- **午、晚餐被關閉時**：右側顯示 `未安排` 灰字佔位（`color: #c2855a; opacity: 0.7; font-weight: 700; font-size: 0.85rem`），保持每行高度一致、避免空蕩。

### 整日 disabled

維持現行：日卡片折疊為單列「{星期} · 不開伙」+ 右側 toggle，背景 `#fffbeb`、`opacity: 0.72`。本次不動。

### 0 樣警告

當啟用的午餐或晚餐三項皆 0 時，沿用現行 `這餐不會安排菜品` 紅字警告，但改放在該餐 row 下方右側對齊（`.meal-warning` 微調）。樣式維持紅字 `#b91c1c; font-size: 0.82rem`。

## 互動模型（不變）

- 餐別 pill 切換 = 寫回 `MealSetting.enabled`。
- 數量改動 = 寫回對應 `vegetableCount / meatCount / soupCount`，clamp `>= 0`。
- 日 toggle 行為照舊（`setDayEnabled`）。
- 早餐分類數量欄位仍存在於 DB，UI 不顯示。

## 不影響的部分

- `src/db.ts`、`src/planner.ts`、`src/components/WeeklyPlanner.tsx`、`src/components/DishList.tsx`、`src/components/DishForm.tsx` 完全不動。
- `MealSettings.tsx` 的 props (`settings`, `onChangeSetting`) 介面不變。
- 既有測試（`App.test.tsx`、`planner.test.ts`、`db.test.ts`）的斷言只與資料 / 行為有關，不會受 UI 翻修破壞；若有測試以 `getByRole('checkbox', { name: '早餐' })` 之類抓元素，需配合改為 `getByRole('button', { name: '早餐' })`。

## CSS 變更總覽

`src/App.css` 區塊：

- 移除：`.choice-chip` 在排餐設定中的使用（檔案內定義仍可保留供其他頁面使用，本檔不動）；`.meal-toggle`；`.count-field`；`.meal-count-panel`。
- 新增：`.meal-pill`（含 on/off 變體）、`.count-chip`（含 zero/editing 變體與 `.stepper`）、`.meal-row` 改用 dashed 分隔線、`.fixed-text`、`.empty-text`（未安排灰字）。
- 沿用：`.settings-day`、`.settings-day-disabled`、`.settings-day-header`、`.switch-toggle`、`.meal-warning`、`.meal-setting-list`。

行動裝置（`@media` 區塊內現有 `.meal-setting-main / .meal-summary / .meal-toggle` 規則）需要重新審視：新版每行是 flex `space-between`，不需要 grid 欄位寫死。這部分等實作時就地清理。

## 驗收條件

1. 排餐設定頁在桌機（≥768px）與手機（375px 寬）兩個視窗下，每行不換行、不溢出。
2. 點餐別 pill 立即切換啟用狀態，視覺色彩立即變化。
3. 點數量 chip 進入編輯態，可用鍵盤輸入或 ▲▼ 增減；blur 後回到預設態，數字寫回。
4. 數字為 0 時 chip 數字 dim；非 0 時恢復深色。
5. 午餐 / 晚餐三項皆 0 時，「這餐不會安排菜品」警告仍出現。
6. 整日 OFF 時的折疊外觀與現在一致。
7. 既有單元測試（`npm run test`）全綠；若有需要，調整以 `getByRole('button')` 取代 `getByRole('checkbox')`。
8. 鍵盤可達性：Tab 順序 = 日 toggle → 早餐 pill → （早餐文字佔位）→ 午餐 pill → 菜 chip → 肉 chip → 湯 chip → 晚餐 pill → …。

## 開放問題

下列為 spec 撰寫時採用的預設選擇，若 review 時想調整請告知：

1. 餐別關閉時右側佔位文字採「未安排」（也可改為「—」或留空白）。
2. 0 數字採 dim（`#c2855a`）；如不喜歡可改為與其他數字同色。
3. 餐別停用態用 outline + `opacity: 0.65`，不加刪除線。

## 參考視覺

A2 完整狀態 mockup（含標準 / 部分關閉 / 整日不開伙 / 0 樣警告）保存在 `.superpowers/brainstorm/99312-1778403423/content/a2-states.html`。
