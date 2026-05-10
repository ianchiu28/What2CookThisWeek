# 本週菜單頁面 UI 翻修設計

## 背景

本週菜單（`src/components/WeeklyPlanner.tsx`）目前在外層白卡片內，又用米色 `.day-card` 把每天再包一層、每餐之間還有 `border-top` 分線、食材跟菜名顏色相近，整體有「卡中卡」與視覺雜訊的問題。標題列也擠了「採買清單 + 產生本週菜單」兩顆按鈕，視覺重量過大。

本次只翻修 UI（視覺與排版），**不改互動模型、資料模型、排菜邏輯與測試行為**。

## 目標

- 拿掉嵌套的米色 `.day-card`，每天改用「淡灰水平線分段」的輕量呈現。
- 標題列只保留 h2「本週菜單」與「採買清單」compact-button，與菜品設定頁的 h2 + 「新增」對齊。
- 把「產生本週菜單」搬離標題列，改成右下橘色 FAB（floating action button），讓破壞性動作不擠在 h2 旁、誤觸機率低。
- 食材永遠顯示但用更淡的灰色（`#9ca3af`），讓視線可掃過；菜名加深加粗（`#111827; font-weight: 600`）作為主視覺。
- 餐別標籤從「午餐 / 晚餐」字樣改為「早 / 午 / 晚」單字小 pill。
- 不顯示日期（週幾足夠）。

## 非目標

- 不變動 `WeeklyPlan / Dish` 資料結構或 `db.ts`。
- 不變動 `pickDishesForWeek` 或 `aggregateShoppingList` 排菜 / 採買邏輯。
- 不變動「產生會清空並重排整週」這個行為（仍直接覆寫，不加確認對話框）。
- 不調整 App.tsx 的 header（`.eyebrow` + `<h1>這週煮什麼？</h1>`）與底部 tabs。
- 不動菜品設定 / 排餐設定兩頁。
- 不引入新的 icon library；採買清單前的 🛒 emoji 與 FAB 上的 ↻ emoji 直接以文字字元渲染。

## 視覺結構

```
┌─ 這週煮什麼？（共用 header，不動）            ─┐
└────────────────────────────────────────────────┘

┌─ 本週菜單                       [🛒 採買清單] ─┐  ← 外層 .menu-card（保留）
│                                                │
│  週一                                3 道       │  ← .day-section
│  [午] 番茄炒蛋                                  │
│        番茄・蛋・蔥                             │
│  [午] 蒜炒空心菜                                │
│        空心菜・蒜頭                             │
│  [晚] 滷雞腿                                    │
│        雞腿・醬油・薑                           │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─       │  ← border-top 分隔下一天
│  週二                                2 道       │
│  [午] 咖哩飯                                    │
│        馬鈴薯・紅蘿蔔・洋蔥・牛肉               │
│  [晚] 麻婆豆腐                                  │
│        豆腐・絞肉・蔥                           │
│                                                │
└────────────────────────────────────────────────┘

                                    ┌──────────┐
                                    │ ↻ 重新產生│  ← FAB（fixed, 右下）
                                    └──────────┘

┌─ [本週菜單] [菜品設定] [排餐設定] ─────────────┐
└────────────────────────────────────────────────┘
```

## 元件規格

### 外層卡片（沿用 `.menu-card`）

- 結構維持 `<section className="card menu-card">`。
- 樣式不動：`border: 1px solid #fdba74; box-shadow: 0 16px 40px rgb(249 115 22 / 0.14); border-radius: 18px; padding: 1rem;`。

### 標題列（沿用 `.section-heading`）

```tsx
<div className="section-heading">
  <h2>本週菜單</h2>
  <button type="button" className="compact-button neutral" disabled={!hasPlans}>
    🛒 採買清單
  </button>
</div>
```

- h2 樣式維持與其他兩頁一致。
- 採買清單按鈕沿用現有 `.compact-button` + `.neutral`（灰底 `#f3f4f6`、灰字 `#374151`），與菜品設定頁的「新增」對齊。
- 沒有菜單時 `disabled`（沿用現行邏輯）。
- 拿掉現行的 `.menu-actions` 容器與「產生本週菜單」按鈕（移到 FAB）。

### 每日分段（NEW `.day-section`，取代舊 `.day-card`）

- 結構：純 `<div className="day-section">`，不再用米色背景或邊框。
- 樣式：
  - `padding: 0.75rem 0;`
  - 從第二段開始 `border-top: 1px solid #f3f4f6;`（淡灰水平線）。
  - 第一段 `padding-top: 0.25rem;`，最後一段 `padding-bottom: 0.25rem;`。
- 內部頂端是 `.day-head`：

  ```tsx
  <div className="day-head">
    <span className="day-name">{dayName}</span>
    <span className="day-count">{totalDishes} 道</span>
  </div>
  ```

  - `.day-name`: `color: #111827; font-weight: 700; font-size: 1rem;`
  - `.day-count`: `color: #9ca3af; font-size: 0.74rem;`，計算來源是這天所有 meal 的 `plans.length` 加總。

### 每餐每道（NEW `.menu-row` + `.menu-pill`，取代舊 `.meal-block` + `.meal-label`）

- 結構：

  ```tsx
  <div className="menu-row">
    <span className="menu-pill">{shortMealLabel}</span>
    <div>
      <div className="menu-dish-name">{dish.name}</div>
      {ingredients.length > 0 && (
        <div className="menu-dish-ing">{ingredients.join('・')}</div>
      )}
    </div>
  </div>
  ```

- `.menu-row`: `display: flex; gap: 0.6rem; padding: 0.4rem 0; align-items: flex-start;`。**沒有 row 之間的分隔線**（菜名加粗已足夠分隔，避免再加細線造成雜訊）。
- `.menu-pill`: 早 / 午 / 晚單字 pill。
  - `background: #fff7ed; color: #c2410c; border-radius: 6px; padding: 0.05rem 0.4rem; font-size: 0.7rem; font-weight: 700; flex: 0 0 auto; margin-top: 0.2rem;`
  - 文字內容對應：`breakfast → 早`、`lunch → 午`、`dinner → 晚`。
- `.menu-dish-name`: `color: #111827; font-size: 0.95rem; font-weight: 600; line-height: 1.3;`
- `.menu-dish-ing`: `color: #9ca3af; font-size: 0.78rem; margin-top: 0.2rem; line-height: 1.4;`
- 「尚未安排」（`plan.dishId === undefined`）的項目：`menu-dish-name` 顯示 `尚未安排`，文字顏色降為 `color: #9ca3af`。
- 食材清單為空時，整個 `.menu-dish-ing` 不渲染（不留空 div）。

### FAB（NEW `.menu-fab`）

```tsx
<button
  type="button"
  className="menu-fab"
  onClick={onGenerate}
  disabled={!canGenerate}
>
  {hasPlans ? '↻ 重新產生' : '產生本週菜單'}
</button>
```

- 位置：`position: fixed; right: 1rem; bottom: calc(env(safe-area-inset-bottom) + 4.5rem); z-index: 5;`
  - `4.5rem` 預留底部 tabs 高度（tabs 約 3.5rem + 留白），需要在實作時用實際 tabs 高度微調。
- 樣式：
  - 啟用：`background: #f97316; color: #fff; border: 0; border-radius: 999px; padding: 0.75rem 1.2rem; font-size: 0.9rem; font-weight: 600; box-shadow: 0 10px 24px rgb(249 115 22 / 0.4);`
  - Disabled：`background: #fdba74; box-shadow: none; cursor: not-allowed;`
- 標籤切換：
  - 已有菜單（`hasPlans`）：`↻ 重新產生`
  - 尚未產生（`hasPlans === false`）：`產生本週菜單`
- 沒有菜（`canGenerate === false`）時 disabled，沿用現行邏輯。
- 只在 `activeTab === 'menu'` 時渲染（FAB 只屬於本週菜單頁；自然由 WeeklyPlanner 元件內部負責掛載 / 卸載）。

### 空狀態文字

維持現行兩段提示，但移除外面的 `<p className="muted">` 包裝改為置中：

- `!canGenerate`（沒有菜）：「新增至少一道菜後就可以自動排菜。」
- `canGenerate && visibleDays.length === 0`（有菜但尚未產生）：「尚未產生菜單，請按右下『產生本週菜單』。」（更新文字，從「請先確認排餐設定後產生本週菜單」改為提示新位置）。

兩種狀態都顯示在卡片內、置中、`color: #6b7280; padding: 1.5rem 0;`。

## 互動模型（不變）

- 點 `🛒 採買清單`：開啟 `ShoppingListModal`（沿用現行）。
- 點 FAB：呼叫 `onGenerate`，清空舊菜單並重排。**不加確認對話框**（沿用現行行為）。
- `visibleDays` 過濾邏輯（隱藏沒安排的日 / 餐）沿用現行。

## CSS 變更總覽

`src/App.css` 改動：

- **新增**：`.day-section`、`.day-head`、`.day-name`、`.day-count`、`.menu-row`、`.menu-pill`、`.menu-dish-name`、`.menu-dish-ing`、`.menu-fab`（含 disabled）。
- **移除**：`.day-card`（在本週菜單情境下被取代；其他頁未使用，可整段刪除）、`.week-menu`、`.meal-block`、`.meal-label`、`.menu-dishes`、`.menu-dishes .dish-name`、`.dish-ingredients` 在 menu 情境的使用、`.menu-actions`。
- **沿用**：`.menu-card`、`.section-heading`、`.compact-button`、`.muted`、`.modal-backdrop / .modal-card`（採買清單）、`.bottom-tabs`。
- **媒體查詢**：`@media (max-width: 560px)` 下的 `.row` / `.modal-actions` 規則維持；本次新增的 class 預設 mobile-first 即可，不需額外 media query。

## 不影響的部分

- `src/db.ts`、`src/planner.ts`、`src/ingredients.ts`、`src/components/MealSettings.tsx`、`src/components/DishList.tsx`、`src/components/DishForm.tsx`、`src/components/ShoppingListModal.tsx` 完全不動。
- `WeeklyPlanner` 元件對外介面（`dishes`、`weeklyPlans`、`onGenerate`、`canGenerate` props）不變。
- App.tsx 唯一可能的改動：無。FAB 由 WeeklyPlanner 自己渲染（`position: fixed`）。

## 驗收條件

1. 桌機（≥768px）與手機（375px 寬）兩個視窗下，整張頁面內容無水平捲動、無溢出。
2. 標題列只看到 h2「本週菜單」+ 灰色「🛒 採買清單」按鈕，無「產生本週菜單」按鈕。
3. 每天區塊之間用淡灰水平線分隔，無米色嵌套卡片。
4. 菜名為深色 (`#111827`) + 加粗；食材為淡灰 (`#9ca3af`) + 較小字級。
5. 餐別 pill 顯示為「早 / 午 / 晚」單字。
6. 右下出現橘色 FAB；有菜單時 label 為「↻ 重新產生」、無菜單時為「產生本週菜單」、沒菜時 disabled。
7. FAB 不會擋住底部 tabs（在 iPhone safe-area 下也能完整看到）。
8. 切換到菜品設定 / 排餐設定 tab 時 FAB 消失。
9. 採買清單按鈕在無菜單時 disabled。
10. `npm run test` 全綠。`App.test.tsx` 若以 `getByRole('button', { name: '產生本週菜單' })` 抓按鈕，仍能命中（標籤文字不變）；以 `name: /採買清單/` 抓的測試需確認新版仍含「採買清單」字樣（含 🛒 emoji 前綴）。
11. 既有 `app-style.test.ts` 若針對舊 class（`.day-card / .meal-block / .week-menu / .meal-label`）斷言，需更新為新 class。

## 開放問題（採用預設選擇，review 時可調整）

1. 食材淡灰色採 `#9ca3af`；如覺得太淡可改 `#6b7280`，太深則改 `#d1d5db`。
2. 餐別 pill 文字用「早 / 午 / 晚」單字；保留現有 `MEAL_TYPES` 的 `label`（早餐 / 午餐 / 晚餐）作為 `aria-label` 給螢幕報讀器。
3. FAB 已有菜單時 label 為「↻ 重新產生」；未有菜單時 label 為「產生本週菜單」。也可以兩種狀態都用同一個字串（例如永遠寫「產生本週菜單」），看哪個語感較好。
4. 「N 道」計數顯示在每天右上；如覺得多餘可整顆拿掉。
5. 「尚未安排」項目目前仍會佔一行；如希望直接過濾掉、不顯示，請告知。

## 參考視覺

最終確認版 mockup 保存在：
`.superpowers/brainstorm/49929-1778417606/content/refined-with-card.html`
