# 本週菜單頁面 UI 翻修 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `WeeklyPlanner.tsx` 從目前「白卡片內又包米色 day-card + 字體層次平 + 兩顆按鈕擠在標題列」的樣式，改成 spec 設計：保留外層白卡片、每天用淡灰水平線分段、菜名加深加粗、食材淡灰、餐別「早 / 午 / 晚」單字 pill、產生鍵改成右下橘色 FAB。

**Architecture:** 純 UI 改寫。`WeeklyPlanner` props (`dishes`、`weeklyPlans`、`onGenerate`、`canGenerate`) 介面不變；資料層 / 排菜邏輯 / 採買清單 modal 完全不動。FAB 用 `position: fixed` + 在 `WeeklyPlanner` 內條件渲染，自然只出現在本週菜單分頁。為了維持現有 a11y 測試的選取行為，`採買清單` 與 FAB 都用 `aria-label` 鎖定可訪問名稱。

**Tech Stack:** React 18, TypeScript, vitest, @testing-library/react, vanilla CSS.

**Spec:** `docs/superpowers/specs/2026-05-10-weekly-menu-ui-refresh-design.md`

> **使用者特別指示：本 plan 執行期間不要做任何 git commit。** 所有 commit step 都標註為「跳過」。

---

## File Structure

- Modify: `src/components/WeeklyPlanner.tsx` — 重寫 render 區塊；移除 `.menu-actions` / `.week-menu` / `.day-card` / `.meal-block` / `.meal-label` / `.menu-dishes` 用法；新增 `.day-section` / `.menu-row` / `.menu-pill` / `.menu-fab` 結構。`.section-heading` 維持。Props 不變。
- Modify: `src/App.css` — 新增 `.day-section`、`.day-head`、`.day-name`、`.day-count`、`.menu-row`、`.menu-pill`、`.menu-dish-name`、`.menu-dish-ing`、`.menu-fab`（含 disabled）。移除 `.week-menu`、`.day-card`、`.day-card span`、`.meal-block`、`.meal-label`、`.menu-dishes`、`.menu-dishes li`、`.menu-dishes .dish-name`、`.dish-ingredients`、`.menu-actions`、`.week-grid`（不再被任何元件使用）。
- Modify: `src/App.test.tsx` — 把指向舊 DOM 結構（`<li>` / `早餐` 全字 / `晚餐` 全字）的本週菜單斷言更新成新結構（`.menu-row` / `早` / `晚` pill 文字）。
- Touch (read only): `src/components/ShoppingListModal.tsx`、`src/planner.ts`、`src/db.ts`、`src/components/MealSettings.tsx`、`src/components/DishList.tsx` — 不改動。

---

## Task 1: 更新 `App.test.tsx` 中本週菜單相關斷言

**目的：** 先把測試改成新 DOM 結構與新文字，跑起來會 fail（紅燈），下一個 task 寫實作讓它們轉綠。

**Files:**
- Modify: `src/App.test.tsx`

- [ ] **Step 1: 找到 `renders generated meals grouped under 本週菜單` 測試（約 516–531 行），整段取代為新版**

打開 `src/App.test.tsx`，找到這段：

```tsx
  test('renders generated meals grouped under 本週菜單', async () => {
    mockState.weeklyPlansData = [
      weeklyPlan({ id: 1, day: 0, meal: 'breakfast', slot: 0, dishId: 1 }),
      weeklyPlan({ id: 2, day: 0, meal: 'dinner', slot: 0 }),
    ];

    render(<App />);
    const menu = await screen.findByRole('heading', { name: '本週菜單' });
    const menuCard = menu.closest('section')!;

    expect(within(menuCard).getByText('週一')).toBeInTheDocument();
    expect(within(menuCard).getByText('早餐')).toBeInTheDocument();
    expect(within(menuCard).getByText('番茄炒蛋')).toBeInTheDocument();
    expect(within(menuCard).getByText('晚餐')).toBeInTheDocument();
    expect(within(menuCard).getByText('尚未安排')).toBeInTheDocument();
  });
```

整段取代為：

```tsx
  test('renders generated meals grouped under 本週菜單', async () => {
    mockState.weeklyPlansData = [
      weeklyPlan({ id: 1, day: 0, meal: 'breakfast', slot: 0, dishId: 1 }),
      weeklyPlan({ id: 2, day: 0, meal: 'dinner', slot: 0 }),
    ];

    render(<App />);
    const menu = await screen.findByRole('heading', { name: '本週菜單' });
    const menuCard = menu.closest('section')!;

    expect(within(menuCard).getByText('週一')).toBeInTheDocument();
    expect(within(menuCard).getByLabelText('早餐')).toHaveTextContent('早');
    expect(within(menuCard).getByText('番茄炒蛋')).toBeInTheDocument();
    expect(within(menuCard).getByLabelText('晚餐')).toHaveTextContent('晚');
    expect(within(menuCard).getByText('尚未安排')).toBeInTheDocument();
  });
```

- [ ] **Step 2: 找到 `renders dish ingredients under each menu item` 測試（約 572–591 行），整段取代為新版**

找到這段：

```tsx
  test('renders dish ingredients under each menu item', async () => {
    mockState.dishesData = [
      dish({ id: 1, name: '番茄炒蛋', ingredients: ['番茄', '蛋', '蔥'] }),
      dish({ id: 2, name: '清炒青菜', ingredients: [] }),
    ];
    mockState.weeklyPlansData = [
      weeklyPlan({ id: 1, day: 0, meal: 'dinner', slot: 0, dishId: 1 }),
      weeklyPlan({ id: 2, day: 0, meal: 'dinner', slot: 1, dishId: 2 }),
    ];

    render(<App />);
    const menu = await screen.findByRole('heading', { name: '本週菜單' });
    const menuCard = menu.closest('section')!;

    const tomatoRow = within(menuCard).getByText('番茄炒蛋').closest('li')!;
    expect(within(tomatoRow).getByText('番茄・蛋・蔥')).toBeInTheDocument();

    const veggieRow = within(menuCard).getByText('清炒青菜').closest('li')!;
    expect(within(veggieRow).queryByText(/・/)).not.toBeInTheDocument();
  });
```

整段取代為：

```tsx
  test('renders dish ingredients under each menu item', async () => {
    mockState.dishesData = [
      dish({ id: 1, name: '番茄炒蛋', ingredients: ['番茄', '蛋', '蔥'] }),
      dish({ id: 2, name: '清炒青菜', ingredients: [] }),
    ];
    mockState.weeklyPlansData = [
      weeklyPlan({ id: 1, day: 0, meal: 'dinner', slot: 0, dishId: 1 }),
      weeklyPlan({ id: 2, day: 0, meal: 'dinner', slot: 1, dishId: 2 }),
    ];

    render(<App />);
    const menu = await screen.findByRole('heading', { name: '本週菜單' });
    const menuCard = menu.closest('section')!;

    const tomatoRow = within(menuCard).getByText('番茄炒蛋').closest('.menu-row')!;
    expect(within(tomatoRow as HTMLElement).getByText('番茄・蛋・蔥')).toBeInTheDocument();

    const veggieRow = within(menuCard).getByText('清炒青菜').closest('.menu-row')!;
    expect(within(veggieRow as HTMLElement).queryByText(/・/)).not.toBeInTheDocument();
  });
```

- [ ] **Step 3: 找到 `renders generated meal slots in slot order` 測試（約 593–606 行），整段取代為新版**

找到這段：

```tsx
  test('renders generated meal slots in slot order', async () => {
    mockState.dishesData = [dish({ id: 1, name: '第一道' }), dish({ id: 2, name: '第二道' })];
    mockState.weeklyPlansData = [
      weeklyPlan({ id: 1, day: 0, meal: 'dinner', slot: 1, dishId: 2 }),
      weeklyPlan({ id: 2, day: 0, meal: 'dinner', slot: 0, dishId: 1 }),
    ];

    render(<App />);
    const menu = await screen.findByRole('heading', { name: '本週菜單' });
    const menuCard = menu.closest('section')!;
    const items = within(menuCard).getAllByRole('listitem').map((item) => item.textContent);

    expect(items).toEqual(['第一道', '第二道']);
  });
```

整段取代為：

```tsx
  test('renders generated meal slots in slot order', async () => {
    mockState.dishesData = [dish({ id: 1, name: '第一道' }), dish({ id: 2, name: '第二道' })];
    mockState.weeklyPlansData = [
      weeklyPlan({ id: 1, day: 0, meal: 'dinner', slot: 1, dishId: 2 }),
      weeklyPlan({ id: 2, day: 0, meal: 'dinner', slot: 0, dishId: 1 }),
    ];

    render(<App />);
    const menu = await screen.findByRole('heading', { name: '本週菜單' });
    const menuCard = menu.closest('section')!;
    const dishNames = Array.from(menuCard.querySelectorAll('.menu-dish-name')).map(
      (node) => node.textContent,
    );

    expect(dishNames).toEqual(['第一道', '第二道']);
  });
```

- [ ] **Step 4: 找到 `rotates picks across consecutive generations` 測試（約 482–514 行），更新第二次點擊的按鈕選取**

在這個測試中，第一次點擊按鈕後菜單會被產生，FAB label 會從「產生本週菜單」切換到「↻ 重新產生」，但目前的測試在第二次點擊時仍然找 `產生本週菜單`。我們透過 `aria-label` 維持「產生本週菜單」永不變，此測試**理論上不需更新**。但為了可讀性，加一行註記。

為了避免「沒改但要跑」的疑慮，**這一步不修改檔案，只執行下面的驗證**：

Run:
```bash
grep -n "產生本週菜單" src/App.test.tsx
```

Expected: 看到兩行（第 445 / 497 行附近），都用 `findByRole('button', { name: '產生本週菜單' })`。確認後不動。

- [ ] **Step 5: 執行測試，確認三個 menu 測試現在會 fail**

Run:
```bash
npx vitest run src/App.test.tsx -t "本週菜單" 2>&1 | head -80
npx vitest run src/App.test.tsx -t "menu item" 2>&1 | head -80
npx vitest run src/App.test.tsx -t "slot order" 2>&1 | head -80
```

Expected：
- `renders generated meals grouped under 本週菜單` — FAIL（找不到 `aria-label="早餐"` 元素）
- `renders dish ingredients under each menu item` — FAIL（找不到 `.menu-row` 元素）
- `renders generated meal slots in slot order` — FAIL（找不到 `.menu-dish-name` 元素）

其他既有測試應仍 PASS。

- [ ] **Step 6: Commit — 跳過（per user request）**

---

## Task 2: 在 `App.css` 新增本週菜單新樣式

**目的：** 加入新 class 但不移除舊的。中途 Task 1 的紅燈仍紅，因為 JSX 還沒改；但 app-style.test.ts 不會被影響（它沒測這次新增的 class）。

**Files:**
- Modify: `src/App.css`

- [ ] **Step 1: 在 `App.css` 中找到 `.shopping-list { ... }` 區塊（約 366–383 行）前面、原本 `.menu-card { ... }` 之後**

我們要把整塊本週菜單舊樣式（`.week-menu`、`.meal-block`、`.meal-label`、`.menu-dishes`、`.menu-dishes li`、`.menu-dishes .dish-name`、`.dish-ingredients`）替換成新樣式。先把新樣式貼到原 `.menu-card { ... }` 規則的下一行（之後 Task 5 再清舊規則，避免一次改太多）。

打開 `src/App.css`，在 `.menu-card { ... }` 規則 `}` 結尾的下一行（約第 325 行，緊接在 `.menu-card` 區塊之後、`.week-menu` 區塊之前），插入：

```css
.day-section {
  padding: 0.75rem 0;
}

.day-section + .day-section {
  border-top: 1px solid #f3f4f6;
}

.day-section:first-of-type {
  padding-top: 0.25rem;
}

.day-section:last-of-type {
  padding-bottom: 0.25rem;
}

.day-head {
  align-items: baseline;
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.day-name {
  color: #111827;
  font-size: 1rem;
  font-weight: 700;
}

.day-count {
  color: #9ca3af;
  font-size: 0.74rem;
}

.menu-row {
  align-items: flex-start;
  display: flex;
  gap: 0.6rem;
  padding: 0.4rem 0;
}

.menu-pill {
  background: #fff7ed;
  border-radius: 6px;
  color: #c2410c;
  flex: 0 0 auto;
  font-size: 0.7rem;
  font-weight: 700;
  margin-top: 0.2rem;
  padding: 0.05rem 0.4rem;
}

.menu-dish-name {
  color: #111827;
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.3;
}

.menu-dish-name.unassigned {
  color: #9ca3af;
  font-weight: 500;
}

.menu-dish-ing {
  color: #9ca3af;
  font-size: 0.78rem;
  line-height: 1.4;
  margin-top: 0.2rem;
}

.menu-fab {
  background: #f97316;
  border: 0;
  border-radius: 999px;
  bottom: calc(env(safe-area-inset-bottom) + 4.5rem);
  box-shadow: 0 10px 24px rgb(249 115 22 / 0.4);
  color: white;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  padding: 0.75rem 1.2rem;
  position: fixed;
  right: 1rem;
  z-index: 5;
}

.menu-fab:disabled {
  background: #fdba74;
  box-shadow: none;
  cursor: not-allowed;
}

.menu-empty {
  color: #6b7280;
  padding: 1.5rem 0;
  text-align: center;
}
```

- [ ] **Step 2: 驗證 CSS 沒語法錯**

Run:
```bash
npx vite build 2>&1 | tail -30
```

Expected: build 成功，無 CSS 解析錯誤。`dist/` 會被產生但本步驟只關心 build status。

> 提示：若不想觸發 build（為了縮短回合時間），可直接 `node -e "require('fs').readFileSync('src/App.css', 'utf-8')"` 或讀檔大略檢查；但 `vite build` 會抓出語法錯，比較保險。

- [ ] **Step 3: Commit — 跳過（per user request）**

---

## Task 3: 重寫 `WeeklyPlanner.tsx` render 區塊

**目的：** 套用新 DOM 結構，把 Task 1 的紅燈轉綠。

**Files:**
- Modify: `src/components/WeeklyPlanner.tsx`

- [ ] **Step 1: 在檔案頂端的型別 / 常數區，新增 pill label 對應**

打開 `src/components/WeeklyPlanner.tsx`，在 `import { ShoppingListModal } from './ShoppingListModal';` 下面、`type WeeklyPlannerProps = {...};` 上面，加入：

```tsx
const MEAL_PILL_LABELS: Record<MealType, string> = {
  breakfast: '早',
  lunch: '午',
  dinner: '晚',
};

const MEAL_FULL_LABELS: Record<MealType, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
};
```

`MealType` 已經在 `import type { Dish, MealType, WeeklyPlan } from '../db';` 引入過，不需要改 import。

- [ ] **Step 2: 把現行的 `visibleDays` useMemo 內、攤平到一個 `meals` 陣列的計算改成「每天總道數 + 攤平到 plans」**

找到現行的 `visibleDays` useMemo（約 41–62 行）：

```tsx
  const visibleDays = useMemo<VisibleDay[]>(() => {
    const plansByMeal = new Map<string, WeeklyPlan[]>();

    weeklyPlans.forEach((plan) => {
      const key = planKey(plan.day, plan.meal);
      plansByMeal.set(key, [...(plansByMeal.get(key) ?? []), plan]);
    });

    plansByMeal.forEach((plans) => {
      plans.sort((a, b) => a.slot - b.slot);
    });

    return DAYS.map((dayName, day) => ({
      day,
      dayName,
      meals: MEAL_TYPES.map(({ value, label }) => ({
        meal: value,
        label,
        plans: plansByMeal.get(planKey(day, value)) ?? [],
      })).filter((meal) => meal.plans.length > 0),
    })).filter((day) => day.meals.length > 0);
  }, [weeklyPlans]);
```

整段取代為（保留原本「沒安排的日 / 餐自動隱藏」邏輯，但把 meals 內每筆 plan 攤平成 row 結構，方便 render）：

```tsx
  const visibleDays = useMemo<VisibleDay[]>(() => {
    const plansByMeal = new Map<string, WeeklyPlan[]>();

    weeklyPlans.forEach((plan) => {
      const key = planKey(plan.day, plan.meal);
      plansByMeal.set(key, [...(plansByMeal.get(key) ?? []), plan]);
    });

    plansByMeal.forEach((plans) => {
      plans.sort((a, b) => a.slot - b.slot);
    });

    return DAYS.map((dayName, day) => {
      const rows = MEAL_TYPES.flatMap(({ value }) =>
        (plansByMeal.get(planKey(day, value)) ?? []).map((plan) => ({ meal: value, plan })),
      );
      return { day, dayName, rows };
    }).filter((day) => day.rows.length > 0);
  }, [weeklyPlans]);
```

接著把舊的型別 `VisibleMeal / VisibleDay`（檔案頂端 14–24 行）整段刪除：

```tsx
type VisibleMeal = {
  meal: MealType;
  label: string;
  plans: WeeklyPlan[];
};

type VisibleDay = {
  day: number;
  dayName: string;
  meals: VisibleMeal[];
};
```

替換成：

```tsx
type VisibleRow = {
  meal: MealType;
  plan: WeeklyPlan;
};

type VisibleDay = {
  day: number;
  dayName: string;
  rows: VisibleRow[];
};
```

- [ ] **Step 3: 重寫 `return ( ... )` 區塊**

找到目前的 `return (...)`（約 67–121 行），整段取代為：

```tsx
  return (
    <>
      <section className="card menu-card">
        <div className="section-heading">
          <h2>本週菜單</h2>
          <button
            type="button"
            className="compact-button neutral"
            aria-label="採買清單"
            disabled={!hasPlans}
            onClick={() => setShowShoppingList(true)}
          >
            🛒 採買清單
          </button>
        </div>

        {!canGenerate && (
          <p className="menu-empty">新增至少一道菜後就可以自動排菜。</p>
        )}

        {canGenerate && visibleDays.length === 0 && (
          <p className="menu-empty">尚未產生菜單，請按右下「產生本週菜單」。</p>
        )}

        {visibleDays.length > 0 && (
          <div className="week-menu">
            {visibleDays.map((day) => (
              <div className="day-section" key={day.dayName}>
                <div className="day-head">
                  <span className="day-name">{day.dayName}</span>
                  <span className="day-count">{day.rows.length} 道</span>
                </div>
                {day.rows.map(({ meal, plan }) => {
                  const dish = plan.dishId !== undefined ? dishesById.get(plan.dishId) : undefined;
                  const name = dish?.name ?? '尚未安排';
                  const ingredients = dish?.ingredients ?? [];
                  const isUnassigned = !dish;
                  return (
                    <div className="menu-row" key={`${plan.day}-${plan.meal}-${plan.slot}`}>
                      <span className="menu-pill" aria-label={MEAL_FULL_LABELS[meal]}>
                        {MEAL_PILL_LABELS[meal]}
                      </span>
                      <div>
                        <div className={isUnassigned ? 'menu-dish-name unassigned' : 'menu-dish-name'}>
                          {name}
                        </div>
                        {ingredients.length > 0 && (
                          <div className="menu-dish-ing">{ingredients.join('・')}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </section>

      <button
        type="button"
        className="menu-fab"
        aria-label="產生本週菜單"
        disabled={!canGenerate}
        onClick={onGenerate}
      >
        {hasPlans ? '↻ 重新產生' : '產生本週菜單'}
      </button>

      {showShoppingList && (
        <ShoppingListModal items={shoppingItems} onClose={() => setShowShoppingList(false)} />
      )}
    </>
  );
```

> 重點解釋：
> - 外層改用 fragment `<>...</>`，因為 FAB 要 sibling 於 `<section>` 而非塞進 card 裡（FAB 用 `position: fixed`，但維持 sibling 關係比較直觀）。
> - `aria-label="採買清單"` 與 `aria-label="產生本週菜單"` 鎖定 accessible name，讓既有測試（`getByRole('button', { name: '採買清單' })` / `'產生本週菜單'`）持續綠燈，**不論按鈕內顯示文字 + emoji 怎麼變**。
> - `aria-label={MEAL_FULL_LABELS[meal]}` 在 pill 上提供「早餐 / 午餐 / 晚餐」可訪問名稱（給 a11y 與 Task 1 修改後的測試使用）。
> - `class="week-menu"` 此處仍當外層容器名稱沿用；CSS 裡 `.week-menu` 規則 Task 5 才清掉，本 task 暫時不需要它有任何規則（沒規則 = 預設 block 顯示，新版內部用 day-section 控制間距）。

- [ ] **Step 4: 確認檔案 import 仍正確**

打開檔案最頂端，確認 imports 為（`useMemo`, `useState` 都還在用）：

```tsx
import { useMemo, useState } from 'react';
import type { Dish, MealType, WeeklyPlan } from '../db';
import { aggregateShoppingList } from '../ingredients';
import { DAYS, MEAL_TYPES } from '../planner';
import { ShoppingListModal } from './ShoppingListModal';
```

`MEAL_TYPES.label` 不再使用，但 `MEAL_TYPES`（陣列本身）仍用於 `flatMap`，import 保留。`DAYS` 仍用。

- [ ] **Step 5: 跑全部測試確認轉綠**

Run:
```bash
npm test 2>&1 | tail -40
```

Expected: 全部測試 PASS（包含 Task 1 改的三個 menu 測試）。

如有失敗，最常見三種狀況：
1. `getByLabelText('早餐')` 找不到 → 確認 pill 上 `aria-label={MEAL_FULL_LABELS[meal]}` 確實寫了。
2. `.menu-row` 選不到 → 確認 div 上 `className="menu-row"` 確實寫了。
3. `.menu-dish-name` 順序不對 → 確認 `MEAL_TYPES.flatMap` 與原本 `MEAL_TYPES.map` 順序一致（仍是 breakfast → lunch → dinner）；plans 內仍按 `slot` 排序。

- [ ] **Step 6: Commit — 跳過（per user request）**

---

## Task 4: 移除 `App.css` 內已不再使用的舊 menu 樣式

**目的：** 清理。**Task 3 已經把 JSX 完全改完**、所有測試應該綠燈，現在可以放心刪舊 class。

**Files:**
- Modify: `src/App.css`

- [ ] **Step 1: 移除 `.week-menu` 規則（約原 326–330 行）**

打開 `src/App.css`，找到並整塊刪除：

```css
.week-menu {
  display: grid;
  gap: 0.75rem;
  margin-top: 1rem;
}
```

> 我們在 Task 3 仍保留 `<div className="week-menu">` 容器，但**不需要任何規則**。預設 block 即可。如不想留下這個 class 名稱，可在 `WeeklyPlanner.tsx` 把 `<div className="week-menu">` 改成 `<div>`。本 plan 採前者（保留 class 名作為錨點，不影響視覺）。

- [ ] **Step 2: 移除 `.meal-block`、`.meal-label`、`.menu-dishes`、`.menu-dishes li`、`.menu-dishes .dish-name`、`.dish-ingredients` 規則（約原 332–364 行）**

找到並整塊刪除：

```css
.meal-block {
  border-top: 1px solid #fed7aa;
  display: grid;
  gap: 0.35rem;
  padding-top: 0.6rem;
}

.meal-label {
  color: #ea580c;
  font-weight: 700;
}

.menu-dishes {
  display: grid;
  gap: 0.25rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

.menu-dishes li {
  display: grid;
  gap: 0.1rem;
}

.menu-dishes .dish-name {
  color: #1f2937;
}

.dish-ingredients {
  color: #9a3412;
  font-size: 0.82rem;
}
```

- [ ] **Step 3: 移除 `.day-card`、`.day-card span`、`.week-grid` 規則（約原 301–319 行）**

找到並整塊刪除：

```css
.week-grid {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  margin-top: 1rem;
}

.day-card {
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 14px;
  display: grid;
  gap: 0.35rem;
  padding: 0.85rem;
}

.day-card span {
  color: #374151;
}
```

確認檔案內已無 `.week-grid` / `.day-card` 字樣。

- [ ] **Step 4: 移除 `.menu-actions` 規則（約原 107–111 行）**

找到並整塊刪除：

```css
.menu-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
```

- [ ] **Step 5: 跑全部測試 + build 確認**

Run:
```bash
npm test 2>&1 | tail -20
npx vite build 2>&1 | tail -10
```

Expected：
- `npm test` — 全綠。
- `vite build` — 成功，無 CSS 解析錯誤。

- [ ] **Step 6: Commit — 跳過（per user request）**

---

## Task 5: 手動視覺驗證

**目的：** 自動測試只能驗證行為與可訪問名稱；視覺與 FAB 位置需要人眼確認。

**Files:** 無檔案改動。

- [ ] **Step 1: 啟動 dev server**

Run（在背景）：
```bash
npm run dev
```

等待輸出顯示 `Local: http://localhost:5173/`（或其他 port）。

- [ ] **Step 2: 在瀏覽器打開頁面，並切到行動版視窗（375px 寬）**

驗證以下視覺項目：

| 項目 | 預期 |
|---|---|
| 上方 header | 仍是橘色小字 `WHAT2COOKTHISWEEK` + 大字 `這週煮什麼？` |
| 卡片標題列 | h2「本週菜單」+ 右側灰色按鈕「🛒 採買清單」，無「產生本週菜單」按鈕 |
| 每天區塊 | 左側「週一/二/...」+ 右側「N 道」灰字計數 |
| 區塊間分隔 | 淡灰水平線（`#f3f4f6`），無米色嵌套卡片 |
| 餐別 pill | 米色底「早 / 午 / 晚」單字 |
| 菜名 | 深色加粗（明顯），明顯比食材深 |
| 食材 | 淡灰小字 |
| FAB | 右下橘色圓角按鈕，貼近底 tab 上方但不重疊 |
| FAB 文字 | 已有菜單顯示「↻ 重新產生」；無菜單顯示「產生本週菜單」 |
| 切到「菜品設定」tab | FAB 消失 |
| 切到「排餐設定」tab | FAB 消失 |
| 點 FAB | 觸發產生菜單；如點兩次發現同樣的菜，請按 spec 仍視為正常（產生邏輯不變） |
| 點「採買清單」 | 開啟 modal |
| 沒菜單時的「採買清單」 | disabled |
| 沒菜時的 FAB | disabled（淡橘色） |

- [ ] **Step 3: 在 iPhone safe-area 模擬下確認 FAB 沒擋住 tabs**

在 Chrome DevTools toggle device toolbar，選 `iPhone 14 Pro`（有 home indicator）。

驗證：
- FAB 完整可見、未被 home indicator 遮住。
- 底部 tabs 仍完整可點。
- FAB 與 tabs 之間有清楚間距。

如位置不對，回頭修改 `App.css` 內 `.menu-fab` 的 `bottom` 值（增加或減少 `4.5rem`，常見可調到 `4rem` 或 `5rem`）。

- [ ] **Step 4: 關掉 dev server**

回到 dev server 跑著的 terminal，按 `Ctrl+C`。

- [ ] **Step 5: Commit — 跳過（per user request）**

---

## 完工檢核

執行完所有 task 後：

- [ ] `npm test` 全綠
- [ ] `npx vite build` 成功
- [ ] 視覺檢核項目全勾
- [ ] `src/App.css` 沒有 `.week-menu` 規則 / `.day-card` / `.meal-block` / `.meal-label` / `.menu-dishes` / `.dish-ingredients` / `.menu-actions` / `.week-grid` 殘留（`grep -n` 確認）
- [ ] `src/components/WeeklyPlanner.tsx` 沒有 `.menu-actions` className 殘留

最後一道驗證：

Run:
```bash
grep -nE "\.week-menu|\.day-card|\.meal-block|\.meal-label|\.menu-dishes|\.dish-ingredients|\.menu-actions|\.week-grid" src/App.css
```

Expected: 無輸出（除了 `.menu-dishes` 不應該再出現；如果上面 `WeeklyPlanner.tsx` 仍保留 `<div className="week-menu">`，CSS 內也已無對應規則，這是預期行為）。

```bash
grep -n "menu-actions" src/components/WeeklyPlanner.tsx
```

Expected: 無輸出。

---

## 開放問題（spec 中提到、實作時若想調整）

1. 食材色 `#9ca3af`：覺得太淡可改 `#6b7280`，太深可改 `#d1d5db`。
2. FAB 已有菜單時 label「↻ 重新產生」：可改成永遠顯示「產生本週菜單」（搭配 `aria-label` 不變即可，不影響測試）。
3. 「N 道」計數：覺得多餘可整顆拿掉（移除 `.day-count` 渲染與 `<span className="day-count">`，並可考慮從 CSS 移除 `.day-count` 規則）。
4. 「尚未安排」項目：目前仍顯示一行；如要直接過濾掉，在 `visibleDays` 內 `flatMap` 時加上 `.filter(({ plan }) => plan.dishId !== undefined)`。

