# Meal Settings Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 改版排餐設定頁，讓早餐只保留啟用設定，午餐與晚餐可設定幾菜、幾肉、幾湯，並讓排菜單依新規則產生結果。

**Architecture:** 保留現有 React + Dexie 架構，將 `MealSetting` 從單一 `dishCount` 擴充為分類數量，並讓 planner 依餐別與分類挑選菜品。UI 維持單一 `MealSettings` component，新增日卡片總開關與餐別列，CSS 沿用既有 card/chip 風格。

**Tech Stack:** React 18、TypeScript、Dexie、Vite、Vitest、Testing Library。

---

## 注意事項

使用者明確要求 **no commit**。本計畫不包含 `git commit` 步驟；每個 task 的最後一步改為檢查 `git status --short` 與測試結果。

## File Structure

- Modify: `src/db.ts`
  - 更新 `MealSetting` type，新增 `vegetableCount`、`meatCount`、`soupCount`。
  - 新增 Dexie version migration，將舊 `dishCount` 轉成 `vegetableCount`。
- Modify: `src/planner.ts`
  - 更新 `PlannerDish` type，納入 `mealTypes` 與 `category`。
  - 更新 `createDefaultMealSettings` 與 `generateWeeklyPlans`。
- Modify: `src/planner.test.ts`
  - 改寫 planner tests，覆蓋早餐、午餐、晚餐分類 slot 行為。
- Modify: `src/App.test.tsx`
  - 更新 mock data 與 UI tests，覆蓋整天關閉/開啟與分類數量設定。
- Modify: `src/components/MealSettings.tsx`
  - 改成日卡片總開關與餐別列 UI。
- Modify: `src/App.css`
  - 新增日卡片、餐別列、數量控制樣式。
- Modify: `src/app-style.test.ts`
  - 新增 CSS 結構測試，避免排餐設定退回表格或陽春 layout。

---

### Task 1: 更新 MealSetting 資料模型與預設設定

**Files:**
- Modify: `src/db.ts`
- Modify: `src/planner.ts`
- Test: `src/planner.test.ts`

- [ ] **Step 1: Write failing tests for default categorized meal settings**

Replace the `createDefaultMealSettings` describe block in `src/planner.test.ts` with:

```ts
describe('createDefaultMealSettings', () => {
  test('enables only weekday dinners with one vegetable and no meat or soup', () => {
    const settings = createDefaultMealSettings();

    expect(settings).toHaveLength(21);
    expect(settings.filter((setting) => setting.enabled)).toEqual([
      { day: 0, meal: 'dinner', enabled: true, vegetableCount: 1, meatCount: 0, soupCount: 0 },
      { day: 1, meal: 'dinner', enabled: true, vegetableCount: 1, meatCount: 0, soupCount: 0 },
      { day: 2, meal: 'dinner', enabled: true, vegetableCount: 1, meatCount: 0, soupCount: 0 },
      { day: 3, meal: 'dinner', enabled: true, vegetableCount: 1, meatCount: 0, soupCount: 0 },
      { day: 4, meal: 'dinner', enabled: true, vegetableCount: 1, meatCount: 0, soupCount: 0 },
    ]);
    expect(settings.filter((setting) => setting.meal !== 'dinner').every((setting) => !setting.enabled)).toBe(true);
    expect(settings.filter((setting) => setting.day > 4).every((setting) => !setting.enabled)).toBe(true);
    expect(settings.every((setting) => setting.meal === 'dinner' || setting.vegetableCount === 0)).toBe(true);
  });
});
```

Also replace the `setting` helper at the top of `src/planner.test.ts` with:

```ts
function setting(
  overrides: {
    day?: number;
    meal?: 'breakfast' | 'lunch' | 'dinner';
    enabled?: boolean;
    vegetableCount?: number;
    meatCount?: number;
    soupCount?: number;
  },
) {
  return {
    day: 0,
    meal: 'dinner' as const,
    enabled: true,
    vegetableCount: 1,
    meatCount: 0,
    soupCount: 0,
    ...overrides,
  };
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/planner.test.ts
```

Expected: FAIL because `MealSetting` still uses `dishCount`, and default settings do not include `vegetableCount`, `meatCount`, or `soupCount`.

- [ ] **Step 3: Update `MealSetting` type and Dexie migration**

In `src/db.ts`, replace the `MealSetting` type with:

```ts
export type MealSetting = {
  id?: number;
  day: number;
  meal: MealType;
  enabled: boolean;
  vegetableCount: number;
  meatCount: number;
  soupCount: number;
};
```

Then add Dexie version 4 after the existing version 3 chain:

```ts
    this.version(4)
      .stores({
        dishes: '++id, name, lastCookedAt, category',
        weeklyPlans: '++id, [day+meal+slot], day, meal, dishId',
        mealSettings: '++id, [day+meal], day, meal',
      })
      .upgrade(async (transaction) => {
        await transaction
          .table<MealSetting & { dishCount?: number }, number>('mealSettings')
          .toCollection()
          .modify((setting) => {
            setting.vegetableCount = setting.dishCount ?? 0;
            setting.meatCount = 0;
            setting.soupCount = 0;
            delete setting.dishCount;
          });
      });
```

- [ ] **Step 4: Update default meal settings**

In `src/planner.ts`, replace `createDefaultMealSettings` with:

```ts
export function createDefaultMealSettings(): MealSetting[] {
  return DAYS.flatMap((_, day) =>
    MEAL_TYPES.map(({ value }) => ({
      day,
      meal: value,
      enabled: day < 5 && value === 'dinner',
      vegetableCount: value === 'dinner' ? 1 : 0,
      meatCount: 0,
      soupCount: 0,
    })),
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run:

```bash
npm test -- src/planner.test.ts
```

Expected: PASS for the default settings test. Existing `generateWeeklyPlans` tests may still fail until Task 2 because they still assume `dishCount`.

- [ ] **Step 6: Check working tree**

Run:

```bash
git status --short
```

Expected: modified `src/db.ts`, `src/planner.ts`, and `src/planner.test.ts`; no commit.

---

### Task 2: 更新 planner 依餐別與分類產生 slots

**Files:**
- Modify: `src/planner.ts`
- Test: `src/planner.test.ts`

- [ ] **Step 1: Replace planner test dishes with categorized dishes**

At the top of `src/planner.test.ts`, replace the `dishes` constant with:

```ts
const dishes: PlannerDish[] = [
  { id: 1, name: '早餐蛋餅', mealTypes: ['breakfast'], category: 'uncategorized' },
  { id: 2, name: '青菜', mealTypes: ['lunch', 'dinner'], category: 'vegetable' },
  { id: 3, name: '滷肉', mealTypes: ['lunch', 'dinner'], category: 'meat' },
  { id: 4, name: '玉米濃湯', mealTypes: ['lunch', 'dinner'], category: 'soup' },
  { id: 5, name: '晚餐炒飯', mealTypes: ['dinner'], category: 'uncategorized' },
];
```

- [ ] **Step 2: Replace `generateWeeklyPlans` tests**

Replace the full `describe('generateWeeklyPlans', ...)` block in `src/planner.test.ts` with:

```ts
describe('generateWeeklyPlans', () => {
  test('creates one breakfast slot using uncategorized breakfast dishes only', () => {
    const plans = generateWeeklyPlans(dishes, [setting({ meal: 'breakfast', vegetableCount: 9, meatCount: 9, soupCount: 9 })]);

    expect(plans).toHaveLength(1);
    expect(plans).toEqual([{ day: 0, meal: 'breakfast', slot: 0, dishId: 1 }]);
  });

  test('creates lunch and dinner slots from vegetable, meat, and soup counts', () => {
    const plans = generateWeeklyPlans(dishes, [setting({ meal: 'lunch', vegetableCount: 2, meatCount: 1, soupCount: 1 })]);

    expect(plans).toHaveLength(4);
    expect(plans.map(({ day, meal, slot }) => ({ day, meal, slot }))).toEqual([
      { day: 0, meal: 'lunch', slot: 0 },
      { day: 0, meal: 'lunch', slot: 1 },
      { day: 0, meal: 'lunch', slot: 2 },
      { day: 0, meal: 'lunch', slot: 3 },
    ]);
    expect(plans.map((plan) => plan.dishId)).toEqual([2, undefined, 3, 4]);
  });

  test('does not create slots for disabled meals or enabled meals with zero category counts', () => {
    const plans = generateWeeklyPlans(dishes, [
      setting({ meal: 'lunch', enabled: false, vegetableCount: 1, meatCount: 1, soupCount: 1 }),
      setting({ meal: 'dinner', vegetableCount: 0, meatCount: 0, soupCount: 0 }),
    ]);

    expect(plans).toEqual([]);
  });

  test('allows the same dish across different meals', () => {
    const sharedDishes: PlannerDish[] = [{ id: 2, name: '青菜', mealTypes: ['lunch', 'dinner'], category: 'vegetable' }];

    const plans = generateWeeklyPlans(sharedDishes, [setting({ meal: 'lunch' }), setting({ meal: 'dinner' })]);

    expect(plans).toEqual([
      { day: 0, meal: 'lunch', slot: 0, dishId: 2 },
      { day: 0, meal: 'dinner', slot: 0, dishId: 2 },
    ]);
  });

  test('leaves extra category slots unassigned when a meal needs more dishes than available', () => {
    const plans = generateWeeklyPlans([{ id: 2, name: '青菜', mealTypes: ['dinner'], category: 'vegetable' }], [
      setting({ meal: 'dinner', vegetableCount: 3 }),
    ]);

    expect(plans).toEqual([
      { day: 0, meal: 'dinner', slot: 0, dishId: 2 },
      { day: 0, meal: 'dinner', slot: 1 },
      { day: 0, meal: 'dinner', slot: 2 },
    ]);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
npm test -- src/planner.test.ts
```

Expected: FAIL because `PlannerDish` does not require `mealTypes`/`category`, and `generateWeeklyPlans` still uses `setting.dishCount`.

- [ ] **Step 4: Update planner implementation**

In `src/planner.ts`, replace the imports and `PlannerDish` type with:

```ts
import type { DishCategory, MealSetting, MealType, WeeklyPlan } from './db';

export type PlannerDish = {
  id?: number;
  name: string;
  lastCookedAt?: number;
  mealTypes: MealType[];
  category: DishCategory;
};
```

Add these helpers above `generateWeeklyPlans`:

```ts
function matchingDishes(dishes: PlannerDish[], meal: MealType, category: DishCategory) {
  return shuffle(dishes.filter((dish) => typeof dish.id === 'number' && dish.mealTypes.includes(meal) && dish.category === category));
}

function createSlots(setting: MealSetting, categoryCounts: Array<{ category: DishCategory; count: number }>): WeeklyPlan[] {
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
```

Then replace `generateWeeklyPlans` with:

```ts
export function generateWeeklyPlans(dishes: PlannerDish[], settings: MealSetting[]): WeeklyPlan[] {
  return settings.flatMap((setting) => {
    if (!setting.enabled) return [];

    if (setting.meal === 'breakfast') {
      const dish = matchingDishes(dishes, setting.meal, 'uncategorized')[0];
      return [
        {
          day: setting.day,
          meal: setting.meal,
          slot: 0,
          ...(dish ? { dishId: dish.id } : {}),
        },
      ];
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

    return slots.map(({ category, ...plan }) => {
      const dish = dishesByCategory.get(category)?.shift();
      return {
        ...plan,
        ...(dish ? { dishId: dish.id } : {}),
      };
    });
  });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run:

```bash
npm test -- src/planner.test.ts
```

Expected: PASS.

- [ ] **Step 6: Check working tree**

Run:

```bash
git status --short
```

Expected: modified planner files; no commit.

---

### Task 3: 更新 App tests 與 mock settings 資料

**Files:**
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Update `mealSetting` test helper**

In `src/App.test.tsx`, replace `mealSetting` with:

```ts
function mealSetting(overrides: Partial<MealSetting> & Pick<MealSetting, 'day' | 'meal'>): MealSetting {
  return {
    enabled: true,
    vegetableCount: 1,
    meatCount: 0,
    soupCount: 0,
    ...overrides,
  };
}
```

- [ ] **Step 2: Update default settings expectations**

Replace the enabled settings expectation in `initializes default meal settings when none are saved` with:

```ts
expect(savedSettings.filter((setting) => setting.enabled)).toEqual([
  { day: 0, meal: 'dinner', enabled: true, vegetableCount: 1, meatCount: 0, soupCount: 0 },
  { day: 1, meal: 'dinner', enabled: true, vegetableCount: 1, meatCount: 0, soupCount: 0 },
  { day: 2, meal: 'dinner', enabled: true, vegetableCount: 1, meatCount: 0, soupCount: 0 },
  { day: 3, meal: 'dinner', enabled: true, vegetableCount: 1, meatCount: 0, soupCount: 0 },
  { day: 4, meal: 'dinner', enabled: true, vegetableCount: 1, meatCount: 0, soupCount: 0 },
]);
```

- [ ] **Step 3: Add UI tests for day toggle and categorized counts**

Add these tests after `persists meal setting changes immediately`:

```ts
test('turns an entire day off and reopens it with dinner only', async () => {
  mockState.mealSettingsData = [
    mealSetting({ id: 1, day: 0, meal: 'breakfast', enabled: true, vegetableCount: 0 }),
    mealSetting({ id: 2, day: 0, meal: 'lunch', enabled: true, vegetableCount: 2, meatCount: 1 }),
    mealSetting({ id: 3, day: 0, meal: 'dinner', enabled: false }),
  ];

  render(<App />);
  await openMealSettings();

  const monday = screen.getByRole('group', { name: '週一排餐設定' });
  fireEvent.click(within(monday).getByLabelText('週一開伙'));

  await waitFor(() => expect(mockState.mealSettingsPut).toHaveBeenCalledTimes(3));
  expect(mockState.mealSettingsPut.mock.calls.map((call) => call[0])).toEqual([
    expect.objectContaining({ day: 0, meal: 'breakfast', enabled: false }),
    expect.objectContaining({ day: 0, meal: 'lunch', enabled: false }),
    expect.objectContaining({ day: 0, meal: 'dinner', enabled: false }),
  ]);

  mockState.mealSettingsPut.mockClear();
  fireEvent.click(within(monday).getByLabelText('週一開伙'));

  await waitFor(() => expect(mockState.mealSettingsPut).toHaveBeenCalledTimes(1));
  expect(mockState.mealSettingsPut).toHaveBeenCalledWith(expect.objectContaining({ day: 0, meal: 'dinner', enabled: true }));
});

test('shows breakfast as a fixed single item and updates lunch category counts including zero', async () => {
  mockState.mealSettingsData = [
    mealSetting({ id: 1, day: 0, meal: 'breakfast', enabled: true, vegetableCount: 0 }),
    mealSetting({ id: 2, day: 0, meal: 'lunch', enabled: true, vegetableCount: 1, meatCount: 1, soupCount: 1 }),
    mealSetting({ id: 3, day: 0, meal: 'dinner', enabled: false }),
  ];

  render(<App />);
  await openMealSettings();

  const monday = screen.getByRole('group', { name: '週一排餐設定' });
  expect(within(monday).getByText('固定 1 樣')).toBeInTheDocument();
  expect(within(monday).queryByLabelText('週一早餐菜數')).not.toBeInTheDocument();

  fireEvent.change(within(monday).getByLabelText('週一午餐菜數'), { target: { value: '0' } });

  await waitFor(() => expect(mockState.mealSettingsPut).toHaveBeenCalled());
  expect(mockState.mealSettingsPut.mock.calls.at(-1)?.[0]).toMatchObject({
    day: 0,
    meal: 'lunch',
    vegetableCount: 0,
    meatCount: 1,
    soupCount: 1,
  });
});
```

- [ ] **Step 4: Update weekly menu generation test data and expectation**

In `generates the weekly menu from saved settings`, replace `mockState.dishesData` with:

```ts
mockState.dishesData = [
  dish({ id: 1, name: '早餐蛋餅', mealTypes: ['breakfast'], category: 'uncategorized' }),
  dish({ id: 2, name: '番茄炒蛋', mealTypes: ['dinner'], category: 'vegetable' }),
];
```

Replace its expected plans with:

```ts
expect(mockState.weeklyPlansBulkAdd.mock.calls[0][0]).toEqual([
  { day: 0, meal: 'breakfast', slot: 0, dishId: 1 },
  { day: 0, meal: 'dinner', slot: 0, dishId: 2 },
]);
```

- [ ] **Step 5: Run App tests to verify they fail before UI implementation**

Run:

```bash
npm test -- src/App.test.tsx
```

Expected: FAIL because `MealSettings` does not expose day groups, day toggles, or categorized count inputs yet.

---

### Task 4: 實作 MealSettings 日卡片與分類數量 UI

**Files:**
- Modify: `src/components/MealSettings.tsx`

- [ ] **Step 1: Replace `MealSettings.tsx` implementation**

Replace the full content of `src/components/MealSettings.tsx` with:

```tsx
import type { MealSetting, MealType } from '../db';
import { DAYS, MEAL_TYPES } from '../planner';

type MealSettingsProps = {
  settings: MealSetting[];
  onChangeSetting: (setting: MealSetting) => Promise<void>;
};

type CountField = 'vegetableCount' | 'meatCount' | 'soupCount';

const COUNT_FIELDS: Array<{ field: CountField; label: string }> = [
  { field: 'vegetableCount', label: '菜' },
  { field: 'meatCount', label: '肉' },
  { field: 'soupCount', label: '湯' },
];

function mealLabel(meal: MealType) {
  return MEAL_TYPES.find((item) => item.value === meal)?.label ?? meal;
}

function mealTotal(setting: MealSetting) {
  return setting.vegetableCount + setting.meatCount + setting.soupCount;
}

export function MealSettings({ settings, onChangeSetting }: MealSettingsProps) {
  function findSetting(day: number, meal: MealSetting['meal']) {
    return settings.find((setting) => setting.day === day && setting.meal === meal);
  }

  async function setDayEnabled(daySettings: MealSetting[], enabled: boolean) {
    if (enabled) {
      const dinner = daySettings.find((setting) => setting.meal === 'dinner');
      if (dinner) await onChangeSetting({ ...dinner, enabled: true });
      return;
    }

    await Promise.all(daySettings.map((setting) => onChangeSetting({ ...setting, enabled: false })));
  }

  return (
    <section className="card meal-settings-card">
      <h2>排餐設定</h2>
      <p className="muted">先選哪些天開伙，再設定每餐要安排的內容。</p>
      <div className="settings-grid">
        {DAYS.map((dayName, day) => {
          const daySettings = MEAL_TYPES.map(({ value }) => findSetting(day, value)).filter(
            (setting): setting is MealSetting => Boolean(setting),
          );
          const dayEnabled = daySettings.some((setting) => setting.enabled);
          const enabledMeals = daySettings.filter((setting) => setting.enabled).map((setting) => mealLabel(setting.meal));
          const summary = enabledMeals.length > 0 ? enabledMeals.join('、') : '不開伙';

          return (
            <fieldset className={dayEnabled ? 'settings-day' : 'settings-day settings-day-disabled'} key={dayName} aria-label={`${dayName}排餐設定`}>
              <div className="settings-day-header">
                <legend>
                  {dayName} <span className="dish-metadata">· {summary}</span>
                </legend>
                <label className="choice-chip day-toggle">
                  <input type="checkbox" aria-label={`${dayName}開伙`} checked={dayEnabled} onChange={(event) => setDayEnabled(daySettings, event.target.checked)} />
                  開伙
                </label>
              </div>

              {dayEnabled && (
                <div className="meal-setting-list">
                  {daySettings.map((setting) => {
                    const label = mealLabel(setting.meal);

                    return (
                      <div className="meal-setting-row" key={setting.meal}>
                        <label className="choice-chip meal-toggle">
                          <input
                            type="checkbox"
                            aria-label={label}
                            checked={setting.enabled}
                            onChange={(event) => onChangeSetting({ ...setting, enabled: event.target.checked })}
                          />
                          {label}
                        </label>

                        {setting.meal === 'breakfast' ? (
                          <span className="meal-note">固定 1 樣</span>
                        ) : (
                          <div className="meal-count-panel" aria-label={`${dayName}${label}分類數量`}>
                            {COUNT_FIELDS.map(({ field, label: countLabel }) => (
                              <label className="count-field" key={field}>
                                <span>{countLabel}</span>
                                <input
                                  aria-label={`${dayName}${label}${countLabel}數`}
                                  type="number"
                                  min="0"
                                  value={setting[field]}
                                  disabled={!setting.enabled}
                                  onChange={(event) =>
                                    onChangeSetting({
                                      ...setting,
                                      [field]: Math.max(0, Number(event.target.value) || 0),
                                    })
                                  }
                                />
                              </label>
                            ))}
                            {setting.enabled && mealTotal(setting) === 0 && <p className="meal-warning">這餐不會安排菜品</p>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </fieldset>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Run App tests**

Run:

```bash
npm test -- src/App.test.tsx
```

Expected: Most UI tests PASS. If `turns an entire day off...` fails because mock data does not update DOM after `put`, adjust only the test flow to assert `mealSettingsPut` calls; do not add local UI state to `MealSettings`.

- [ ] **Step 3: Run TypeScript build**

Run:

```bash
npm run build
```

Expected: May still fail until CSS tests are updated, but TypeScript should not report type errors.

---

### Task 5: 更新 CSS 與 CSS tests

**Files:**
- Modify: `src/App.css`
- Test: `src/app-style.test.ts`

- [ ] **Step 1: Write failing CSS tests**

Add this test to `describe('bottom app tabs styles', ...)` in `src/app-style.test.ts`:

```ts
test('uses compact day cards and meal count controls for meal settings', () => {
  expect(css).toContain('.meal-settings-card');
  expect(css).toContain('.settings-day-header');
  expect(css).toContain('.settings-day-disabled');
  expect(css).toContain('.meal-setting-list');
  expect(css).toContain('.meal-setting-row');
  expect(css).toContain('.meal-count-panel');
  expect(css).toContain('.count-field');
  expect(css).toContain('.meal-warning');

  const mealRowRule = css.match(/\.meal-setting-row \{(?<body>[\s\S]*?)\n\}/)?.groups?.body;
  const countPanelRule = css.match(/\.meal-count-panel \{(?<body>[\s\S]*?)\n\}/)?.groups?.body;

  expect(mealRowRule).toContain('display: grid;');
  expect(countPanelRule).toContain('display: flex;');
  expect(css).not.toContain('table-layout');
});
```

- [ ] **Step 2: Run CSS test to verify it fails**

Run:

```bash
npm test -- src/app-style.test.ts
```

Expected: FAIL because new class names are not styled yet.

- [ ] **Step 3: Replace old meal settings CSS block**

In `src/App.css`, replace lines that currently define `.settings-grid`, `.settings-day`, `.settings-day h3`, `.meal-setting`, and `.meal-setting input[type='number']` with:

```css
.meal-settings-card {
  display: grid;
  gap: 0.75rem;
}

.meal-settings-card h2,
.meal-settings-card p {
  margin-bottom: 0;
}

.settings-grid {
  display: grid;
  gap: 0.75rem;
}

.settings-day {
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 14px;
  display: grid;
  gap: 0.75rem;
  margin: 0;
  padding: 0.85rem;
}

.settings-day-disabled {
  background: #fffbeb;
  opacity: 0.72;
}

.settings-day-header {
  align-items: center;
  display: flex;
  gap: 0.75rem;
  justify-content: space-between;
}

.settings-day legend {
  color: #1f2937;
  font-size: 1.05rem;
  font-weight: 700;
  padding: 0;
}

.day-toggle,
.meal-toggle {
  flex: 0 0 auto;
}

.meal-setting-list {
  display: grid;
  gap: 0.65rem;
}

.meal-setting-row {
  align-items: start;
  display: grid;
  gap: 0.6rem;
  grid-template-columns: 5.5rem minmax(0, 1fr);
}

.meal-note {
  align-self: center;
  color: #9a3412;
  font-size: 0.9rem;
}

.meal-count-panel {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.count-field {
  align-items: center;
  background: white;
  border: 1px solid #fed7aa;
  border-radius: 999px;
  display: inline-flex;
  gap: 0.35rem;
  padding: 0.3rem 0.35rem 0.3rem 0.7rem;
}

.count-field span {
  color: #9a3412;
  font-weight: 700;
}

.count-field input {
  border-radius: 999px;
  padding: 0.35rem 0.45rem;
  text-align: center;
  width: 4rem;
}

.meal-warning {
  color: #b91c1c;
  flex-basis: 100%;
  font-size: 0.86rem;
  margin: 0;
}
```

Inside the existing `@media (max-width: 560px)` block, add:

```css
  .settings-day-header,
  .meal-setting-row {
    align-items: stretch;
    grid-template-columns: 1fr;
  }

  .settings-day-header {
    display: grid;
  }

  .day-toggle,
  .meal-toggle {
    width: fit-content;
  }
```

- [ ] **Step 4: Run CSS test to verify it passes**

Run:

```bash
npm test -- src/app-style.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run App tests again**

Run:

```bash
npm test -- src/App.test.tsx
```

Expected: PASS.

---

### Task 6: Final verification and manual UI check

**Files:**
- No planned source edits unless verification exposes a bug.

- [ ] **Step 1: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 2: Run production build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Start dev server for UI verification**

Run:

```bash
npm run dev
```

Expected: Vite prints a local URL such as `http://localhost:5173/`. Keep the server running while checking the UI.

- [ ] **Step 4: Verify UI manually in browser**

Open the Vite local URL and check:

1. Bottom tab `排餐設定` opens the redesigned page.
2. A closed day shows only day heading, summary, and `開伙` switch.
3. Opening a closed day enables only dinner.
4. Breakfast row shows `早餐` and `固定 1 樣`, with no number input.
5. Lunch and dinner rows show `菜 / 肉 / 湯` number controls.
6. Setting lunch `菜` to `0` is allowed and persists after changing tabs away and back.
7. Enabling a lunch/dinner meal with all counts `0` shows `這餐不會安排菜品`.
8. The layout remains readable at mobile width.

- [ ] **Step 5: Stop dev server**

Stop the Vite process with Ctrl-C in the terminal where it is running.

- [ ] **Step 6: Check final working tree**

Run:

```bash
git status --short
```

Expected: source/test/spec/plan files modified or untracked, no commit.

---

## Self-Review

- Spec coverage: data model, migration, day toggle behavior, breakfast fixed slot, lunch/dinner categorized counts, zero counts, planner category matching, UI layout, CSS style, and tests are covered by Tasks 1-6.
- Placeholder scan: no TBD/TODO/fill-later placeholders remain.
- Type consistency: plan consistently uses `vegetableCount`, `meatCount`, `soupCount`, `MealSetting`, `PlannerDish`, `DishCategory`, and existing `WeeklyPlan` without adding new persisted slot category fields.
