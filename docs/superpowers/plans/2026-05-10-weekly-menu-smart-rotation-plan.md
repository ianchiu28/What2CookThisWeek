# Weekly Menu Smart Rotation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 升級「產生本週菜單」演算法，讓本週同一道菜不重複、優先排最久沒煮過的菜，並在產生後自動更新菜品的 `lastCookedAt`。

**Architecture:** 把現有 `generateWeeklyPlans` 抽出為純函式 `pickDishesForWeek`，回傳 `{ plans, pickedDishIds }`。每個 slot 動態從整個 dish 列表中過濾候選池（依 meal/category + 本週尚未排過），再依 `lastCookedAt ?? -Infinity` 升冪排序，平手以 random key 打散，取首位。`generateWeeklyPlans` 改為 thin wrapper。`App.tsx` 的 `generatePlans` 在同一 transaction 內 bulkAdd plans 並對 `pickedDishIds` 做 `db.dishes.update(id, { lastCookedAt: now })`。

**Tech Stack:** React 18, TypeScript, Dexie 4, Vitest, @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-05-10-weekly-menu-smart-rotation-design.md`

---

## File Structure

- Modify: `src/planner.ts` — 抽出 `pickDishesForWeek`，改寫挑選邏輯（去重 + 輪替 + random key sort）。
- Modify: `src/planner.test.ts` — 新增本週去重、lastCookedAt 輪替、新菜優先、跨餐去重、`pickDishesForWeek` 回傳值等測試。
- Modify: `src/App.tsx` — `generatePlans` 串接 `pickDishesForWeek` 並更新 `lastCookedAt`。
- Modify: `src/App.test.tsx` — 新增 lastCookedAt 寫回測試與重複產生會輪替的測試；補 mock `db.dishes.update`。

---

### Task 1: 抽出 `pickDishesForWeek` 純函式並引入 `pickedDishIds`（行為相容）

**Files:**
- Modify: `src/planner.ts`
- Modify: `src/planner.test.ts`

- [ ] **Step 1: Write the failing test**

在 `src/planner.test.ts` 最上方 `import` 加入新函式：

```ts
import { createDefaultMealSettings, generateWeeklyPlans, pickDishesForWeek, type PlannerDish } from './planner';
```

在 `describe('generateWeeklyPlans', ...)` 之後新增：

```ts
describe('pickDishesForWeek', () => {
  test('returns plans plus the dish ids actually placed into slots', () => {
    const result = pickDishesForWeek(
      [
        { id: 1, name: '早餐蛋餅', mealTypes: ['breakfast'], category: 'uncategorized' },
        { id: 2, name: '青菜', mealTypes: ['dinner'], category: 'vegetable' },
      ],
      [
        setting({ meal: 'breakfast' }),
        setting({ meal: 'dinner', vegetableCount: 2, meatCount: 0, soupCount: 0 }),
      ],
    );

    expect(result.plans).toEqual([
      { day: 0, meal: 'breakfast', slot: 0, dishId: 1 },
      { day: 0, meal: 'dinner', slot: 0, dishId: 2 },
      { day: 0, meal: 'dinner', slot: 1 },
    ]);
    expect(result.pickedDishIds).toEqual([1, 2]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/planner.test.ts`
Expected: FAIL with "pickDishesForWeek is not a function" or similar import error.

- [ ] **Step 3: Refactor `src/planner.ts` to add `pickDishesForWeek` and make `generateWeeklyPlans` a thin wrapper**

把 `src/planner.ts` 中從 `function matchingDishes` 那一行開始到檔案結尾的整段內容替換為以下程式碼（保留檔案上方既有的 `shuffle`、`DAYS`、`MEAL_TYPES`、`createDefaultMealSettings` 不動）：

```ts
function matchingDishes(dishes: PlannerDish[], meal: MealType, category: DishCategory) {
  return shuffle(
    dishes.filter(
      (dish) => typeof dish.id === 'number' && dish.mealTypes.includes(meal) && dish.category === category,
    ),
  );
}

type PlanSlot = WeeklyPlan & { category: DishCategory };

function createSlots(setting: MealSetting, categoryCounts: Array<{ category: DishCategory; count: number }>): PlanSlot[] {
  let slot = 0;

  return categoryCounts.flatMap(({ category, count }) =>
    Array.from({ length: count }, () => ({
      day: setting.day,
      meal: setting.meal,
      slot: slot++,
      category,
    })),
  );
}

export type PickResult = {
  plans: WeeklyPlan[];
  pickedDishIds: number[];
};

export function pickDishesForWeek(dishes: PlannerDish[], settings: MealSetting[]): PickResult {
  const plans: WeeklyPlan[] = [];
  const pickedDishIds: number[] = [];

  for (const setting of settings) {
    if (!setting.enabled) continue;

    if (setting.meal === 'breakfast') {
      const candidates = matchingDishes(dishes, 'breakfast', 'uncategorized');
      const chosen = candidates[0];
      plans.push({
        day: setting.day,
        meal: setting.meal,
        slot: 0,
        ...(chosen ? { dishId: chosen.id } : {}),
      });
      if (chosen?.id !== undefined) pickedDishIds.push(chosen.id);
      continue;
    }

    const slots = createSlots(setting, [
      { category: 'vegetable', count: setting.vegetableCount },
      { category: 'meat', count: setting.meatCount },
      { category: 'soup', count: setting.soupCount },
    ]);

    const dishesByCategory = new Map<DishCategory, PlannerDish[]>([
      ['vegetable', matchingDishes(dishes, setting.meal, 'vegetable')],
      ['meat', matchingDishes(dishes, setting.meal, 'meat')],
      ['soup', matchingDishes(dishes, setting.meal, 'soup')],
    ]);

    for (const { category, ...slot } of slots) {
      const chosen = dishesByCategory.get(category)?.shift();
      plans.push({
        ...slot,
        ...(chosen ? { dishId: chosen.id } : {}),
      });
      if (chosen?.id !== undefined) pickedDishIds.push(chosen.id);
    }
  }

  return { plans, pickedDishIds };
}

export function generateWeeklyPlans(dishes: PlannerDish[], settings: MealSetting[]): WeeklyPlan[] {
  return pickDishesForWeek(dishes, settings).plans;
}
```

- [ ] **Step 4: Run all planner tests to verify they pass**

Run: `npx vitest run src/planner.test.ts`
Expected: PASS — all existing `generateWeeklyPlans` tests still pass and the new `pickDishesForWeek` test passes.

- [ ] **Step 5: Commit**

```bash
git add src/planner.ts src/planner.test.ts
git commit -m "refactor: extract pickDishesForWeek and expose pickedDishIds"
```

---

### Task 2: 本週去重（同一道菜本週最多 1 次）

**Files:**
- Modify: `src/planner.ts`
- Modify: `src/planner.test.ts`

- [ ] **Step 1: Write the failing test**

在 `describe('pickDishesForWeek', ...)` 中新增：

```ts
test('does not place the same dish twice in the same week', () => {
  const dinnerVegSetting = (day: number) =>
    setting({ day, meal: 'dinner', vegetableCount: 2, meatCount: 0, soupCount: 0 });

  const dishes: PlannerDish[] = [
    { id: 11, name: '青菜A', mealTypes: ['dinner'], category: 'vegetable' },
    { id: 12, name: '青菜B', mealTypes: ['dinner'], category: 'vegetable' },
    { id: 13, name: '青菜C', mealTypes: ['dinner'], category: 'vegetable' },
  ];

  const { plans, pickedDishIds } = pickDishesForWeek(dishes, [
    dinnerVegSetting(0),
    dinnerVegSetting(1),
    dinnerVegSetting(2),
  ]);

  const placedIds = plans.map((plan) => plan.dishId).filter((id): id is number => id !== undefined);
  expect(new Set(placedIds).size).toBe(placedIds.length);
  expect(placedIds).toHaveLength(3);
  expect(pickedDishIds.sort()).toEqual([11, 12, 13]);

  const unfilled = plans.filter((plan) => plan.dishId === undefined);
  expect(unfilled).toHaveLength(3);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/planner.test.ts -t "does not place the same dish twice"`
Expected: FAIL — current implementation lets the same dish repeat across days, so `placedIds` has 6 entries, all with duplicates.

- [ ] **Step 3: Implement `pickDishesForWeek` with global de-duplication**

把 `src/planner.ts` 中從 `function shuffle` 那一行開始一直到檔案結尾的整段內容替換為下列程式碼（即移除 `shuffle`、`matchingDishes`、舊的 `PlanSlot` / `createSlots` / `PickResult` / `pickDishesForWeek` / `generateWeeklyPlans`，整段重寫）：

```ts
function pickByRotation(candidates: PlannerDish[]): PlannerDish | undefined {
  if (candidates.length === 0) return undefined;
  return [...candidates]
    .map((dish) => ({ dish, randomKey: Math.random() }))
    .sort((a, b) => {
      const keyA = a.dish.lastCookedAt ?? Number.NEGATIVE_INFINITY;
      const keyB = b.dish.lastCookedAt ?? Number.NEGATIVE_INFINITY;
      if (keyA !== keyB) return keyA - keyB;
      return a.randomKey - b.randomKey;
    })[0]?.dish;
}

function candidatesFor(
  dishes: PlannerDish[],
  meal: MealType,
  category: DishCategory,
  used: Set<number>,
): PlannerDish[] {
  return dishes.filter(
    (dish) =>
      typeof dish.id === 'number' &&
      !used.has(dish.id) &&
      dish.mealTypes.includes(meal) &&
      dish.category === category,
  );
}

type PlanSlot = WeeklyPlan & { category: DishCategory };

function createSlots(setting: MealSetting, categoryCounts: Array<{ category: DishCategory; count: number }>): PlanSlot[] {
  let slot = 0;

  return categoryCounts.flatMap(({ category, count }) =>
    Array.from({ length: count }, () => ({
      day: setting.day,
      meal: setting.meal,
      slot: slot++,
      category,
    })),
  );
}

export type PickResult = {
  plans: WeeklyPlan[];
  pickedDishIds: number[];
};

export function pickDishesForWeek(dishes: PlannerDish[], settings: MealSetting[]): PickResult {
  const plans: WeeklyPlan[] = [];
  const pickedDishIds: number[] = [];
  const usedDishIds = new Set<number>();

  function placeSlot(plan: WeeklyPlan, candidates: PlannerDish[]) {
    const chosen = pickByRotation(candidates);
    plans.push({
      ...plan,
      ...(chosen ? { dishId: chosen.id } : {}),
    });
    if (chosen?.id !== undefined) {
      usedDishIds.add(chosen.id);
      pickedDishIds.push(chosen.id);
    }
  }

  for (const setting of settings) {
    if (!setting.enabled) continue;

    if (setting.meal === 'breakfast') {
      const candidates = candidatesFor(dishes, 'breakfast', 'uncategorized', usedDishIds);
      placeSlot({ day: setting.day, meal: setting.meal, slot: 0 }, candidates);
      continue;
    }

    const slots = createSlots(setting, [
      { category: 'vegetable', count: setting.vegetableCount },
      { category: 'meat', count: setting.meatCount },
      { category: 'soup', count: setting.soupCount },
    ]);

    for (const { category, ...slot } of slots) {
      const candidates = candidatesFor(dishes, setting.meal, category, usedDishIds);
      placeSlot(slot, candidates);
    }
  }

  return { plans, pickedDishIds };
}

export function generateWeeklyPlans(dishes: PlannerDish[], settings: MealSetting[]): WeeklyPlan[] {
  return pickDishesForWeek(dishes, settings).plans;
}
```

並把舊的 `function shuffle`、`function matchingDishes` 移除（已被 `candidatesFor` + `pickByRotation` 取代）。

- [ ] **Step 4: Run all planner tests to verify they pass**

Run: `npx vitest run src/planner.test.ts`
Expected: PASS — all previous tests + new de-duplication test.

注意：現有 `creates lunch and dinner slots from vegetable, meat, and soup counts` 測試預期 `dishId` 為 `[2, undefined, 3, 4]`。新實作維持這個結果（同分類只有 1 道菜時，第二個 vegetable slot 留空），所以仍會通過。

- [ ] **Step 5: Commit**

```bash
git add src/planner.ts src/planner.test.ts
git commit -m "feat: prevent the same dish from repeating in the same week"
```

---

### Task 3: lastCookedAt 輪替（含「未煮過視為最舊」與平手隨機）

**Files:**
- Modify: `src/planner.test.ts`

實作已在 Task 2 用 `pickByRotation` 完成；本 task 只是補上行為測試以鎖住設計。

- [ ] **Step 1: Write failing tests for rotation behavior**

在 `describe('pickDishesForWeek', ...)` 中新增三個測試：

```ts
test('prefers the dish with the oldest lastCookedAt', () => {
  const dishes: PlannerDish[] = [
    { id: 21, name: '舊菜', mealTypes: ['dinner'], category: 'vegetable', lastCookedAt: 1000 },
    { id: 22, name: '中菜', mealTypes: ['dinner'], category: 'vegetable', lastCookedAt: 2000 },
    { id: 23, name: '新菜', mealTypes: ['dinner'], category: 'vegetable', lastCookedAt: 3000 },
  ];

  const { plans } = pickDishesForWeek(dishes, [setting({ meal: 'dinner', vegetableCount: 1, meatCount: 0, soupCount: 0 })]);

  expect(plans).toEqual([{ day: 0, meal: 'dinner', slot: 0, dishId: 21 }]);
});

test('treats dishes without lastCookedAt as the oldest', () => {
  const dishes: PlannerDish[] = [
    { id: 31, name: '煮過', mealTypes: ['dinner'], category: 'vegetable', lastCookedAt: 1000 },
    { id: 32, name: '沒煮過', mealTypes: ['dinner'], category: 'vegetable' },
  ];

  const { plans } = pickDishesForWeek(dishes, [setting({ meal: 'dinner', vegetableCount: 1, meatCount: 0, soupCount: 0 })]);

  expect(plans).toEqual([{ day: 0, meal: 'dinner', slot: 0, dishId: 32 }]);
});

test('breaks ties on lastCookedAt randomly across runs', () => {
  const dishes: PlannerDish[] = [
    { id: 41, name: 'A', mealTypes: ['dinner'], category: 'vegetable' },
    { id: 42, name: 'B', mealTypes: ['dinner'], category: 'vegetable' },
    { id: 43, name: 'C', mealTypes: ['dinner'], category: 'vegetable' },
  ];

  const seen = new Set<number>();
  const randomMock = vi.spyOn(Math, 'random');

  // Drive each run with different random values so each dish wins once.
  // pickByRotation calls Math.random() once per candidate; with 3 candidates,
  // the smallest randomKey wins. Provide values where the intended winner has the lowest.
  const sequences: Array<[number, number, number]> = [
    [0.1, 0.5, 0.9], // A wins
    [0.5, 0.1, 0.9], // B wins
    [0.5, 0.9, 0.1], // C wins
  ];

  for (const seq of sequences) {
    randomMock.mockReset();
    seq.forEach((value) => randomMock.mockReturnValueOnce(value));
    const { pickedDishIds } = pickDishesForWeek(dishes, [setting({ meal: 'dinner', vegetableCount: 1, meatCount: 0, soupCount: 0 })]);
    expect(pickedDishIds).toHaveLength(1);
    seen.add(pickedDishIds[0]);
  }

  randomMock.mockRestore();

  expect(seen).toEqual(new Set([41, 42, 43]));
});
```

如果檔案頂部還沒有 `vi`，把 import 改為：

```ts
import { describe, expect, test, vi } from 'vitest';
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx vitest run src/planner.test.ts`
Expected: PASS — Task 2 已實作正確的排序與 random tiebreak。

> 若有任何測試失敗，回頭檢查 `pickByRotation`：候選從原陣列 map 為 `{ dish, randomKey }`，再以 `(lastCookedAt ?? -Infinity, randomKey)` 升冪 sort。

- [ ] **Step 3: Commit**

```bash
git add src/planner.test.ts
git commit -m "test: lock in lastCookedAt rotation and random tiebreak behavior"
```

---

### Task 4: App 端串接，按下「產生本週菜單」時更新被選中菜品的 `lastCookedAt`

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write the failing test**

在 `src/App.test.tsx` 的 `mockState` 內新增 `dishesUpdate` mock。把 `mockState` 的 hoisted 區塊（檔案 28–74 行）替換為：

```ts
const mockState = vi.hoisted(() => {
  let weeklyPlansData: WeeklyPlan[] = [];
  let mealSettingsData: MealSetting[] = [];

  const dishesAdd = vi.fn(async (dish: Omit<Dish, 'id'>) => {
    mockState.dishesData = [...mockState.dishesData, { ...dish, id: mockState.dishesData.length + 1 }];
  });
  const dishesDelete = vi.fn();
  const dishesPut = vi.fn(async (dish: Dish) => {
    mockState.dishesData = mockState.dishesData.map((item) => (item.id === dish.id ? dish : item));
  });
  const dishesUpdate = vi.fn(async (id: number, changes: Partial<Dish>) => {
    mockState.dishesData = mockState.dishesData.map((item) => (item.id === id ? { ...item, ...changes } : item));
  });
  const weeklyPlansClear = vi.fn(async () => {
    weeklyPlansData = [];
  });
  const weeklyPlansBulkAdd = vi.fn(async (plans: WeeklyPlan[]) => {
    weeklyPlansData = plans;
  });
  const mealSettingsBulkAdd = vi.fn(async (settings: MealSetting[]) => {
    mealSettingsData = settings.map((setting, index) => ({ ...setting, id: index + 1 }));
  });
  const mealSettingsPut = vi.fn(async (setting: MealSetting) => {
    mealSettingsData = mealSettingsData.map((item) => (item.id === setting.id ? setting : item));
  });

  return {
    dishesData: [{ id: 1, name: '番茄炒蛋', mealTypes: ['dinner'], category: 'uncategorized' }] as Dish[],
    get weeklyPlansData() {
      return weeklyPlansData;
    },
    set weeklyPlansData(value: WeeklyPlan[]) {
      weeklyPlansData = value;
    },
    get mealSettingsData() {
      return mealSettingsData;
    },
    set mealSettingsData(value: MealSetting[]) {
      mealSettingsData = value;
    },
    dishesAdd,
    dishesDelete,
    dishesPut,
    dishesUpdate,
    weeklyPlansClear,
    weeklyPlansBulkAdd,
    mealSettingsBulkAdd,
    mealSettingsPut,
  };
});
```

把 `vi.mock('./db', ...)` 中 `dishes` 物件加上 `update`：

```ts
    dishes: {
      orderBy: () => ({ toArray: () => Promise.resolve(mockState.dishesData) }),
      add: mockState.dishesAdd,
      delete: mockState.dishesDelete,
      put: mockState.dishesPut,
      update: mockState.dishesUpdate,
    },
```

在 `describe('App', ...)` 區塊內新增測試（建議放在 `test('generates the weekly menu from saved settings', ...)` 之後）：

```ts
test('updates lastCookedAt on dishes placed in the generated menu', async () => {
  const fixedNow = 1_700_000_000_000;
  vi.useFakeTimers();
  vi.setSystemTime(fixedNow);

  mockState.dishesData = [
    dish({ id: 1, name: '早餐蛋餅', mealTypes: ['breakfast'], category: 'uncategorized' }),
    dish({ id: 2, name: '青菜', mealTypes: ['dinner'], category: 'vegetable' }),
    dish({ id: 3, name: '不會被選的菜', mealTypes: ['lunch'], category: 'vegetable', lastCookedAt: 999 }),
  ];
  mockState.mealSettingsData = [
    mealSetting({ id: 1, day: 0, meal: 'breakfast' }),
    mealSetting({ id: 2, day: 0, meal: 'lunch', enabled: false }),
    mealSetting({ id: 3, day: 0, meal: 'dinner', vegetableCount: 1, meatCount: 0, soupCount: 0 }),
  ];

  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: '產生本週菜單' }));

  await waitFor(() => expect(mockState.dishesUpdate).toHaveBeenCalledTimes(2));
  const updatedIds = mockState.dishesUpdate.mock.calls.map((call) => call[0]).sort();
  expect(updatedIds).toEqual([1, 2]);
  for (const call of mockState.dishesUpdate.mock.calls) {
    expect(call[1]).toEqual({ lastCookedAt: fixedNow });
  }

  vi.useRealTimers();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/App.test.tsx -t "updates lastCookedAt"`
Expected: FAIL — current `generatePlans` doesn't call `db.dishes.update`, so `dishesUpdate` is called 0 times.

- [ ] **Step 3: Implement `generatePlans` to update `lastCookedAt`**

在 `src/App.tsx` 中：

把 import 從：

```ts
import { createDefaultMealSettings, generateWeeklyPlans } from './planner';
```

改為：

```ts
import { createDefaultMealSettings, pickDishesForWeek } from './planner';
```

把 `generatePlans` 函式（檔案 59–66 行）替換為：

```ts
  async function generatePlans() {
    const now = Date.now();
    const { plans, pickedDishIds } = pickDishesForWeek(dishes, mealSettings);
    await db.transaction('rw', db.weeklyPlans, db.dishes, async () => {
      await db.weeklyPlans.clear();
      await db.weeklyPlans.bulkAdd(plans);
      await Promise.all(pickedDishIds.map((id) => db.dishes.update(id, { lastCookedAt: now })));
    });
    await loadData();
  }
```

- [ ] **Step 4: Run all tests to verify they pass**

Run: `npx vitest run`
Expected: PASS — including `updates lastCookedAt on dishes placed in the generated menu` and all existing planner / App tests.

注意：現有測試 `generates the weekly menu from saved settings` 仍會通過——`weeklyPlansBulkAdd` 仍以相同形狀的 plans 呼叫；新呼叫 `dishesUpdate` 不影響該斷言。

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: stamp lastCookedAt when generating the weekly menu"
```

---

### Task 5: 補一個跨產生會輪替的整合測試（鎖住整體行為）

**Files:**
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write the test**

在 `src/App.test.tsx` 中於 Task 4 新增測試之後再加：

```ts
test('rotates picks across consecutive generations', async () => {
  const firstNow = 1_700_000_000_000;
  vi.useFakeTimers();
  vi.setSystemTime(firstNow);

  mockState.dishesData = [
    dish({ id: 1, name: '青菜A', mealTypes: ['dinner'], category: 'vegetable' }),
    dish({ id: 2, name: '青菜B', mealTypes: ['dinner'], category: 'vegetable' }),
  ];
  mockState.mealSettingsData = [
    mealSetting({ id: 1, day: 0, meal: 'breakfast', enabled: false }),
    mealSetting({ id: 2, day: 0, meal: 'lunch', enabled: false }),
    mealSetting({ id: 3, day: 0, meal: 'dinner', vegetableCount: 1, meatCount: 0, soupCount: 0 }),
  ];

  render(<App />);
  const generateButton = await screen.findByRole('button', { name: '產生本週菜單' });

  fireEvent.click(generateButton);
  await waitFor(() => expect(mockState.weeklyPlansBulkAdd).toHaveBeenCalledTimes(1));
  const firstPlans = mockState.weeklyPlansBulkAdd.mock.calls[0][0] as WeeklyPlan[];
  const firstChoice = firstPlans[0].dishId!;
  expect([1, 2]).toContain(firstChoice);

  vi.setSystemTime(firstNow + 60_000);
  fireEvent.click(generateButton);
  await waitFor(() => expect(mockState.weeklyPlansBulkAdd).toHaveBeenCalledTimes(2));
  const secondPlans = mockState.weeklyPlansBulkAdd.mock.calls[1][0] as WeeklyPlan[];
  const secondChoice = secondPlans[0].dishId!;

  expect(secondChoice).not.toBe(firstChoice);

  vi.useRealTimers();
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run src/App.test.tsx -t "rotates picks across consecutive generations"`
Expected: PASS — first generation marks the chosen dish with `lastCookedAt = firstNow`, second generation now sees the other dish as older (`undefined < firstNow`) and picks it.

- [ ] **Step 3: Run the full test suite + build**

Run: `npx vitest run && npm run build`
Expected: 全部測試通過、TypeScript build 成功。

- [ ] **Step 4: Commit**

```bash
git add src/App.test.tsx
git commit -m "test: verify weekly menu rotates across consecutive generations"
```

---

## Manual Verification

實作完成後做以下手動驗證：

1. `npm run dev`，新增至少 6 道蔬菜（同 category=`vegetable`，mealTypes 含 `dinner`）。
2. 排餐設定開啟週一到週日晚餐，每天 2 菜。
3. 按「產生本週菜單」，觀察 14 個 slot 中 6 道蔬菜各出現一次、剩下 8 個顯示「尚未安排」（受其他分類影響不一定剛好如此，但同一道菜不應重複出現）。
4. 再按一次「產生本週菜單」，本週菜單會重新排，但因 `lastCookedAt` 都已更新，這次仍會公平輪替。
5. 加入足夠的菜（>=14 道蔬菜），連續產生兩次菜單，第二次優先選擇第一次沒被排到的菜。

## Self-Review Notes

- Spec coverage：本週去重（Task 2）、lastCookedAt 排序與「未煮過最舊」（Task 3）、平手隨機（Task 3）、shuffle bias 修正（Task 2 中 `pickByRotation` 用 random key sort 取代）、按下產生即更新 `lastCookedAt`（Task 4）、整合輪替（Task 5）皆有對應 task。
- 介面一致：`pickDishesForWeek` 在所有 task 中回傳 `{ plans, pickedDishIds }`，`PickResult` type 一致。`db.dishes.update(id, { lastCookedAt })` 在 mock 與實作中都用相同簽名。
- 風險點：`db.transaction` mock 的實作只是執行 callback，不驗 transaction stores。實作端把 `db.dishes` 加進 `db.transaction('rw', db.weeklyPlans, db.dishes, ...)`，運行期 Dexie 會驗，但 mock 不會——這是現有 test pattern，沿用即可。
