# Weekly Menu Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `本週菜單` the primary view, move dish management and weekly meal rules into bottom tabs, and generate menus from persisted weekday/meal/slot settings.

**Architecture:** Keep the app as a single-page React PWA with local active-tab state. Store dishes, weekly meal settings, and generated menu entries in Dexie tables. Put pure scheduling logic in `src/planner.ts`, UI-only tab layout in `src/App.tsx`, and focused settings/menu components under `src/components/`.

**Tech Stack:** React 18, TypeScript, Dexie, Vite, Vitest, Testing Library, jsdom.

---

## File Structure

- Modify `src/db.ts`
  - Add `MealType`, `MealSetting`, and expanded `WeeklyPlan` types.
  - Add Dexie schema version 2 with `mealSettings` and expanded `weeklyPlans` indexes.
- Modify `src/planner.ts`
  - Replace one-dish-per-day generation with meal-setting-driven slot generation.
  - Export `MEAL_TYPES`, `DAYS`, and `createDefaultMealSettings`.
- Modify `src/planner.test.ts`
  - Replace old seven-dinner tests with tests for defaults, per-meal slots, no duplicate within a meal, reuse across meals, and unassigned shortage slots.
- Modify `src/App.tsx`
  - Load dishes, weekly plans, and meal settings.
  - Initialize default meal settings when none exist.
  - Add bottom-tab state.
  - Route visible content by active tab.
  - Save meal-setting changes immediately.
- Modify `src/App.test.tsx`
  - Update the mock Dexie object for `mealSettings` and expanded plans.
  - Add layout/tab tests.
- Modify `src/components/WeeklyPlanner.tsx`
  - Rename UI to `本週菜單`.
  - Render plans grouped by day and meal slots.
- Create `src/components/MealSettings.tsx`
  - Render seven days and breakfast/lunch/dinner controls.
  - Call `onChangeSetting` immediately when enabled/count changes.
- Modify `src/components/DishForm.tsx`
  - Keep behavior; no required behavior change.
- Modify `src/components/DishList.tsx`
  - Keep behavior; no required behavior change.
- Modify `src/App.css`
  - Make the menu view visually primary.
  - Add a full-width, bottom-edge app-style tab bar.
  - Style the active tab with emphasized orange text and a top indicator line instead of a filled button background.
  - Add meal-settings form styles.

---

### Task 1: Planner Types, Defaults, and Generation

**Files:**
- Modify: `src/db.ts`
- Modify: `src/planner.ts`
- Modify: `src/planner.test.ts`

- [ ] **Step 1: Replace planner tests with setting-driven failing tests**

Replace `src/planner.test.ts` with:

```ts
import { describe, expect, test } from 'vitest';
import { createDefaultMealSettings, generateWeeklyPlans, type PlannerDish } from './planner';

const dishes: PlannerDish[] = [
  { id: 1, name: '番茄炒蛋' },
  { id: 2, name: '滷肉' },
  { id: 3, name: '青菜' },
];

describe('createDefaultMealSettings', () => {
  test('enables only weekday dinners with one dish', () => {
    const settings = createDefaultMealSettings();

    expect(settings).toHaveLength(21);
    expect(settings.filter((setting) => setting.enabled)).toEqual([
      { day: 0, meal: 'dinner', enabled: true, dishCount: 1 },
      { day: 1, meal: 'dinner', enabled: true, dishCount: 1 },
      { day: 2, meal: 'dinner', enabled: true, dishCount: 1 },
      { day: 3, meal: 'dinner', enabled: true, dishCount: 1 },
      { day: 4, meal: 'dinner', enabled: true, dishCount: 1 },
    ]);
    expect(settings.filter((setting) => setting.meal !== 'dinner').every((setting) => !setting.enabled)).toBe(true);
    expect(settings.filter((setting) => setting.day > 4).every((setting) => !setting.enabled)).toBe(true);
  });
});

describe('generateWeeklyPlans', () => {
  test('creates slots for enabled meals only', () => {
    const settings = [
      { day: 0, meal: 'breakfast' as const, enabled: true, dishCount: 2 },
      { day: 0, meal: 'lunch' as const, enabled: false, dishCount: 1 },
      { day: 0, meal: 'dinner' as const, enabled: true, dishCount: 1 },
    ];

    const plans = generateWeeklyPlans(dishes, settings);

    expect(plans).toHaveLength(3);
    expect(plans.map(({ day, meal, slot }) => ({ day, meal, slot }))).toEqual([
      { day: 0, meal: 'breakfast', slot: 0 },
      { day: 0, meal: 'breakfast', slot: 1 },
      { day: 0, meal: 'dinner', slot: 0 },
    ]);
  });

  test('does not repeat dishes within the same meal', () => {
    const plans = generateWeeklyPlans(dishes, [
      { day: 0, meal: 'dinner' as const, enabled: true, dishCount: 3 },
    ]);

    expect(new Set(plans.map((plan) => plan.dishId)).size).toBe(3);
  });

  test('allows the same dish across different meals', () => {
    const plans = generateWeeklyPlans([{ id: 1, name: '番茄炒蛋' }], [
      { day: 0, meal: 'breakfast' as const, enabled: true, dishCount: 1 },
      { day: 0, meal: 'dinner' as const, enabled: true, dishCount: 1 },
    ]);

    expect(plans).toEqual([
      { day: 0, meal: 'breakfast', slot: 0, dishId: 1 },
      { day: 0, meal: 'dinner', slot: 0, dishId: 1 },
    ]);
  });

  test('leaves extra slots unassigned when a meal needs more dishes than available', () => {
    const plans = generateWeeklyPlans([{ id: 1, name: '番茄炒蛋' }], [
      { day: 0, meal: 'dinner' as const, enabled: true, dishCount: 3 },
    ]);

    expect(plans).toEqual([
      { day: 0, meal: 'dinner', slot: 0, dishId: 1 },
      { day: 0, meal: 'dinner', slot: 1 },
      { day: 0, meal: 'dinner', slot: 2 },
    ]);
  });
});
```

- [ ] **Step 2: Run planner tests to verify they fail**

Run:

```bash
npm test -- src/planner.test.ts
```

Expected: FAIL because `createDefaultMealSettings` is not exported and `generateWeeklyPlans` still accepts only dishes.

- [ ] **Step 3: Expand database types**

Replace `src/db.ts` with:

```ts
import Dexie, { type Table } from 'dexie';

export type Dish = {
  id?: number;
  name: string;
  lastCookedAt?: number;
};

export type MealType = 'breakfast' | 'lunch' | 'dinner';

export type MealSetting = {
  id?: number;
  day: number;
  meal: MealType;
  enabled: boolean;
  dishCount: number;
};

export type WeeklyPlan = {
  id?: number;
  day: number;
  meal: MealType;
  slot: number;
  dishId?: number;
};

class CookDb extends Dexie {
  dishes!: Table<Dish, number>;
  weeklyPlans!: Table<WeeklyPlan, number>;
  mealSettings!: Table<MealSetting, number>;

  constructor() {
    super('What2CookThisWeek');
    this.version(1).stores({
      dishes: '++id, name, lastCookedAt',
      weeklyPlans: '++id, day, dishId',
    });
    this.version(2).stores({
      dishes: '++id, name, lastCookedAt',
      weeklyPlans: '++id, [day+meal+slot], day, meal, dishId',
      mealSettings: '++id, [day+meal], day, meal',
    });
  }
}

export const db = new CookDb();
```

- [ ] **Step 4: Implement planner defaults and generation**

Replace `src/planner.ts` with:

```ts
import type { MealSetting, MealType, WeeklyPlan } from './db';

export type PlannerDish = {
  id?: number;
  name: string;
  lastCookedAt?: number;
};

export const DAYS = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'] as const;

export const MEAL_TYPES: Array<{ value: MealType; label: string }> = [
  { value: 'breakfast', label: '早餐' },
  { value: 'lunch', label: '午餐' },
  { value: 'dinner', label: '晚餐' },
];

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

export function createDefaultMealSettings(): MealSetting[] {
  return DAYS.flatMap((_, day) =>
    MEAL_TYPES.map(({ value }) => ({
      day,
      meal: value,
      enabled: day < 5 && value === 'dinner',
      dishCount: 1,
    })),
  );
}

export function generateWeeklyPlans(dishes: PlannerDish[], settings: MealSetting[]): WeeklyPlan[] {
  const availableDishes = dishes.filter((dish) => typeof dish.id === 'number');

  return settings.flatMap((setting) => {
    if (!setting.enabled) return [];

    const shuffled = shuffle(availableDishes);

    return Array.from({ length: setting.dishCount }, (_, slot) => {
      const dish = shuffled[slot];
      return {
        day: setting.day,
        meal: setting.meal,
        slot,
        ...(dish ? { dishId: dish.id } : {}),
      };
    });
  });
}
```

- [ ] **Step 5: Run planner tests to verify they pass**

Run:

```bash
npm test -- src/planner.test.ts
```

Expected: PASS, 5 tests pass.

- [ ] **Step 6: Commit Task 1**

Run:

```bash
git add src/db.ts src/planner.ts src/planner.test.ts
git commit -m "feat: generate menu from meal settings"
```

---

### Task 2: Weekly Menu Rendering Component

**Files:**
- Modify: `src/components/WeeklyPlanner.tsx`
- Create: `src/components/MealSettings.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Add focused WeeklyPlanner component tests via App tests later**

This task uses component implementation first only because no standalone component test file exists yet and Task 3 adds App-level failing tests for the visible behavior before integrating this component. Do not change `App.tsx` in this task.

- [ ] **Step 2: Update WeeklyPlanner rendering**

Replace `src/components/WeeklyPlanner.tsx` with:

```tsx
import type { Dish, WeeklyPlan } from '../db';
import { DAYS, MEAL_TYPES } from '../planner';

type WeeklyPlannerProps = {
  dishes: Dish[];
  weeklyPlans: WeeklyPlan[];
  onGenerate: () => Promise<void>;
  canGenerate: boolean;
};

export function WeeklyPlanner({ dishes, weeklyPlans, onGenerate, canGenerate }: WeeklyPlannerProps) {
  function getDishName(plan: WeeklyPlan) {
    const dish = dishes.find((item) => item.id === plan.dishId);
    return dish?.name ?? '尚未安排';
  }

  const visibleDays = DAYS.map((dayName, day) => ({
    day,
    dayName,
    meals: MEAL_TYPES.map(({ value, label }) => ({
      meal: value,
      label,
      plans: weeklyPlans
        .filter((plan) => plan.day === day && plan.meal === value)
        .sort((a, b) => a.slot - b.slot),
    })).filter((meal) => meal.plans.length > 0),
  })).filter((day) => day.meals.length > 0);

  return (
    <section className="card menu-card">
      <div className="section-heading">
        <h2>本週菜單</h2>
        <button type="button" onClick={onGenerate} disabled={!canGenerate}>
          產生本週菜單
        </button>
      </div>
      {!canGenerate && <p className="muted">新增至少一道菜後就可以自動排菜。</p>}
      {visibleDays.length === 0 ? (
        <p className="muted">尚未產生菜單，請先確認排餐設定後產生本週菜單。</p>
      ) : (
        <div className="week-menu">
          {visibleDays.map((day) => (
            <div className="day-card" key={day.dayName}>
              <strong>{day.dayName}</strong>
              {day.meals.map((meal) => (
                <div className="meal-block" key={meal.meal}>
                  <span className="meal-label">{meal.label}</span>
                  <ul className="menu-dishes">
                    {meal.plans.map((plan) => (
                      <li key={`${plan.day}-${plan.meal}-${plan.slot}`}>{getDishName(plan)}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Create MealSettings component**

Create `src/components/MealSettings.tsx` with:

```tsx
import type { MealSetting } from '../db';
import { DAYS, MEAL_TYPES } from '../planner';

type MealSettingsProps = {
  settings: MealSetting[];
  onChangeSetting: (setting: MealSetting) => Promise<void>;
};

export function MealSettings({ settings, onChangeSetting }: MealSettingsProps) {
  function findSetting(day: number, meal: MealSetting['meal']) {
    return settings.find((setting) => setting.day === day && setting.meal === meal);
  }

  return (
    <section className="card">
      <h2>排餐設定</h2>
      <div className="settings-grid">
        {DAYS.map((dayName, day) => (
          <div className="settings-day" key={dayName}>
            <h3>{dayName}</h3>
            {MEAL_TYPES.map(({ value, label }) => {
              const setting = findSetting(day, value);
              if (!setting) return null;

              return (
                <label className="meal-setting" key={value}>
                  <input
                    type="checkbox"
                    checked={setting.enabled}
                    onChange={(event) => onChangeSetting({ ...setting, enabled: event.target.checked })}
                  />
                  <span>{label}</span>
                  <input
                    aria-label={`${dayName}${label}道數`}
                    type="number"
                    min="1"
                    value={setting.dishCount}
                    disabled={!setting.enabled}
                    onChange={(event) =>
                      onChangeSetting({
                        ...setting,
                        dishCount: Math.max(1, Number(event.target.value) || 1),
                      })
                    }
                  />
                </label>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Add CSS for menu and settings UI**

Append to `src/App.css` before the media query:

```css
.menu-card {
  border-color: #fdba74;
  box-shadow: 0 16px 40px rgb(249 115 22 / 0.14);
}

.week-menu {
  display: grid;
  gap: 0.75rem;
  margin-top: 1rem;
}

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

.settings-grid {
  display: grid;
  gap: 0.75rem;
}

.settings-day {
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 14px;
  padding: 0.85rem;
}

.settings-day h3 {
  margin: 0 0 0.75rem;
}

.meal-setting {
  align-items: center;
  display: grid;
  gap: 0.5rem;
  grid-template-columns: auto 1fr 5rem;
  margin-top: 0.5rem;
}

.meal-setting input[type='number'] {
  width: 100%;
}
```

The fixed tab bar uses safe-area padding for devices with a bottom gesture area.

- [ ] **Step 5: Run typecheck/build to catch component errors**

Run:

```bash
npm run build
```

Expected: FAIL because `App.tsx` still calls `WeeklyPlanner` with the old props. This expected failure proves Task 2 component changes require Task 3 integration.

- [ ] **Step 6: Do not commit Task 2 yet**

Task 2 intentionally leaves the app unintegrated. Commit after Task 3 makes build pass.

---

### Task 3: Bottom Tabs, App Integration, and Settings Persistence

**Files:**
- Modify: `src/App.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Replace App tests with layout, tab, and persistence tests**

Replace `src/App.test.tsx` with:

```tsx
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { MealSetting, WeeklyPlan } from './db';
import App from './App';

const dishesData = [{ id: 1, name: '番茄炒蛋' }];
let weeklyPlansData: WeeklyPlan[] = [];
let mealSettingsData: MealSetting[] = [];

const dishesAdd = vi.fn();
const dishesDelete = vi.fn();
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

vi.mock('./db', () => ({
  db: {
    dishes: {
      orderBy: () => ({ toArray: () => Promise.resolve(dishesData) }),
      add: dishesAdd,
      delete: dishesDelete,
    },
    weeklyPlans: {
      orderBy: () => ({ toArray: () => Promise.resolve(weeklyPlansData) }),
      where: () => ({ equals: () => ({ delete: vi.fn() }) }),
      clear: weeklyPlansClear,
      bulkAdd: weeklyPlansBulkAdd,
    },
    mealSettings: {
      orderBy: () => ({ toArray: () => Promise.resolve(mealSettingsData) }),
      bulkAdd: mealSettingsBulkAdd,
      put: mealSettingsPut,
    },
    transaction: vi.fn(async (_mode: string, ...args: unknown[]) => {
      const callback = args[args.length - 1] as () => Promise<void>;
      await callback();
    }),
  },
}));

describe('App', () => {
  beforeEach(() => {
    weeklyPlansData = [];
    mealSettingsData = [];
    vi.clearAllMocks();
  });

  test('shows the app title as 這週煮什麼？', async () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: '這週煮什麼？' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '本週菜單' })).toBeInTheDocument();
  });

  test('uses 本週菜單 as the default view and moves dish management out of the primary view', async () => {
    render(<App />);

    expect(await screen.findByRole('heading', { name: '本週菜單' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '新增菜' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '菜列表' })).not.toBeInTheDocument();
    expect(screen.queryByText('本週晚餐')).not.toBeInTheDocument();
  });

  test('switches between bottom tabs', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: '本週菜單' });

    fireEvent.click(screen.getByRole('button', { name: '菜品設定' }));
    expect(screen.getByRole('heading', { name: '新增菜' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '菜列表' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '排餐設定' }));
    expect(screen.getByRole('heading', { name: '排餐設定' })).toBeInTheDocument();
  });

  test('initializes default meal settings when none are saved', async () => {
    render(<App />);

    await waitFor(() => expect(mealSettingsBulkAdd).toHaveBeenCalledTimes(1));
    const savedSettings = mealSettingsBulkAdd.mock.calls[0][0] as MealSetting[];

    expect(savedSettings.filter((setting) => setting.enabled)).toEqual([
      { day: 0, meal: 'dinner', enabled: true, dishCount: 1 },
      { day: 1, meal: 'dinner', enabled: true, dishCount: 1 },
      { day: 2, meal: 'dinner', enabled: true, dishCount: 1 },
      { day: 3, meal: 'dinner', enabled: true, dishCount: 1 },
      { day: 4, meal: 'dinner', enabled: true, dishCount: 1 },
    ]);
  });

  test('persists meal setting changes immediately', async () => {
    render(<App />);
    await waitFor(() => expect(mealSettingsBulkAdd).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: '排餐設定' }));
    fireEvent.click(screen.getByLabelText('早餐'));

    await waitFor(() => expect(mealSettingsPut).toHaveBeenCalled());
    expect(mealSettingsPut.mock.calls.at(-1)?.[0]).toMatchObject({ day: 0, meal: 'breakfast', enabled: true });
  });

  test('generates the weekly menu from saved settings', async () => {
    mealSettingsData = [
      { id: 1, day: 0, meal: 'breakfast', enabled: true, dishCount: 1 },
      { id: 2, day: 0, meal: 'lunch', enabled: false, dishCount: 1 },
      { id: 3, day: 0, meal: 'dinner', enabled: true, dishCount: 1 },
    ];

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '產生本週菜單' }));

    await waitFor(() => expect(weeklyPlansBulkAdd).toHaveBeenCalledTimes(1));
    expect(weeklyPlansBulkAdd.mock.calls[0][0]).toEqual([
      { day: 0, meal: 'breakfast', slot: 0, dishId: 1 },
      { day: 0, meal: 'dinner', slot: 0, dishId: 1 },
    ]);
  });

  test('renders generated meals grouped under 本週菜單', async () => {
    weeklyPlansData = [
      { id: 1, day: 0, meal: 'breakfast', slot: 0, dishId: 1 },
      { id: 2, day: 0, meal: 'dinner', slot: 0 },
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
});
```

- [ ] **Step 2: Run App tests to verify they fail**

Run:

```bash
npm test -- src/App.test.tsx
```

Expected: FAIL because App has no bottom tabs, no meal settings table integration, and still renders dish management on the default view.

- [ ] **Step 3: Integrate tabs and persistence in App**

Replace `src/App.tsx` with:

```tsx
import { useEffect, useState } from 'react';
import { DishForm } from './components/DishForm';
import { DishList } from './components/DishList';
import { MealSettings } from './components/MealSettings';
import { WeeklyPlanner } from './components/WeeklyPlanner';
import { db, type Dish, type MealSetting, type WeeklyPlan } from './db';
import { createDefaultMealSettings, generateWeeklyPlans } from './planner';

type ActiveTab = 'menu' | 'dishes' | 'settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('menu');
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [weeklyPlans, setWeeklyPlans] = useState<WeeklyPlan[]>([]);
  const [mealSettings, setMealSettings] = useState<MealSetting[]>([]);

  async function loadData() {
    const [storedDishes, storedPlans, storedSettings] = await Promise.all([
      db.dishes.orderBy('name').toArray(),
      db.weeklyPlans.orderBy('[day+meal+slot]').toArray(),
      db.mealSettings.orderBy('[day+meal]').toArray(),
    ]);

    setDishes(storedDishes);
    setWeeklyPlans(storedPlans);

    if (storedSettings.length === 0) {
      const defaultSettings = createDefaultMealSettings();
      await db.mealSettings.bulkAdd(defaultSettings);
      const savedDefaultSettings = await db.mealSettings.orderBy('[day+meal]').toArray();
      setMealSettings(savedDefaultSettings);
      return;
    }

    setMealSettings(storedSettings);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function addDish(name: string) {
    await db.dishes.add({ name });
    await loadData();
  }

  async function deleteDish(id: number) {
    await db.transaction('rw', db.dishes, db.weeklyPlans, async () => {
      await db.dishes.delete(id);
      await db.weeklyPlans.where('dishId').equals(id).delete();
    });
    await loadData();
  }

  async function generatePlans() {
    const plans = generateWeeklyPlans(dishes, mealSettings);
    await db.transaction('rw', db.weeklyPlans, async () => {
      await db.weeklyPlans.clear();
      await db.weeklyPlans.bulkAdd(plans);
    });
    await loadData();
  }

  async function updateMealSetting(setting: MealSetting) {
    await db.mealSettings.put(setting);
    await loadData();
  }

  return (
    <main className="app-shell">
      <header>
        <p className="eyebrow">What2CookThisWeek</p>
        <h1>這週煮什麼？</h1>
      </header>

      {activeTab === 'menu' && (
        <WeeklyPlanner dishes={dishes} weeklyPlans={weeklyPlans} onGenerate={generatePlans} canGenerate={dishes.length > 0} />
      )}

      {activeTab === 'dishes' && (
        <>
          <DishForm onAddDish={addDish} />
          <DishList dishes={dishes} onDeleteDish={deleteDish} />
        </>
      )}

      {activeTab === 'settings' && <MealSettings settings={mealSettings} onChangeSetting={updateMealSetting} />}

      <nav className="bottom-tabs" aria-label="主要功能">
        <button type="button" className={activeTab === 'menu' ? 'active' : ''} onClick={() => setActiveTab('menu')}>
          本週菜單
        </button>
        <button type="button" className={activeTab === 'dishes' ? 'active' : ''} onClick={() => setActiveTab('dishes')}>
          菜品設定
        </button>
        <button type="button" className={activeTab === 'settings' ? 'active' : ''} onClick={() => setActiveTab('settings')}>
          排餐設定
        </button>
      </nav>
    </main>
  );
}
```

- [ ] **Step 4: Add bottom tab CSS**

Append to `src/App.css` before the media query:

```css
.bottom-tabs {
  background: white;
  border: 1px solid #ffedd5;
  border-bottom: 0;
  border-radius: 0;
  bottom: 0;
  box-shadow: 0 -8px 24px rgb(249 115 22 / 0.12);
  display: grid;
  gap: 0.35rem;
  grid-template-columns: repeat(3, 1fr);
  left: 0;
  padding: 0.35rem calc(0.35rem + env(safe-area-inset-right)) calc(0.35rem + env(safe-area-inset-bottom)) calc(0.35rem + env(safe-area-inset-left));
  position: fixed;
  right: 0;
  width: 100%;
}

.bottom-tabs button {
  background: transparent;
  border-radius: 0;
  color: #9a3412;
  padding: 0.75rem 0.5rem 0.6rem;
  position: relative;
}

.bottom-tabs button.active {
  background: transparent;
  color: #f97316;
  font-weight: 700;
}

.bottom-tabs button.active::before {
  background: #f97316;
  content: '';
  height: 3px;
  left: 24%;
  position: absolute;
  right: 24%;
  top: 0;
}
```

Also change `.app-shell` in `src/App.css` from:

```css
.app-shell {
  margin: 0 auto;
  max-width: 780px;
  padding: 1.5rem;
}
```

to:

```css
.app-shell {
  margin: 0 auto;
  max-width: 780px;
  padding: 1.5rem 1.5rem 6rem;
}
```

And change the existing mobile `.app-shell` rule inside `@media (max-width: 560px)` from:

```css
  .app-shell {
    padding: 1rem;
  }
```

to:

```css
  .app-shell {
    padding: 1rem 1rem 6rem;
  }
```

- [ ] **Step 5: Run App tests to verify they pass**

Run:

```bash
npm test -- src/App.test.tsx
```

Expected: PASS, 7 tests pass.

- [ ] **Step 6: Run build to verify Task 2 and Task 3 integration**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit Tasks 2 and 3 together**

Run:

```bash
git add src/App.tsx src/App.css src/App.test.tsx src/components/WeeklyPlanner.tsx src/components/MealSettings.tsx
git commit -m "feat: add weekly menu tabs and settings"
```

---

### Task 4: Final Regression and UI Verification

**Files:**
- Verify all modified files.

- [ ] **Step 1: Run the full test suite**

Run:

```bash
npm test
```

Expected: PASS, all test files pass.

- [ ] **Step 2: Run production build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Start the dev server**

Run:

```bash
npm run dev
```

Expected: Vite starts and prints a local URL.

- [ ] **Step 4: Manually verify the UI in a browser**

Open the local URL printed by Vite and verify:

- Default view shows `這週煮什麼？` and `本週菜單`.
- `新增菜` and `菜列表` are not visible in the default view.
- Bottom tabs show `本週菜單`, `菜品設定`, and `排餐設定`.
- The bottom tab bar sits flush against the bottom edge with square corners.
- The active bottom tab uses orange text plus a top indicator line, not a filled orange button.
- `菜品設定` tab shows add-dish form and dish list.
- `排餐設定` tab shows all seven days with `早餐`, `午餐`, `晚餐`.
- Default checked settings are weekday dinners only.
- Enabling a meal and changing its dish count persists after refresh.
- `產生本週菜單` produces entries matching enabled settings.
- A meal requesting more dishes than available shows `尚未安排` for extra slots.

- [ ] **Step 5: Stop the dev server**

Stop the running Vite process with Ctrl+C or the session's task stop mechanism.

- [ ] **Step 6: Commit any verification fixes only if files changed**

If manual verification required fixes, run tests/build again, then commit specific changed files:

```bash
git add <changed-files>
git commit -m "fix: polish weekly menu settings"
```

If no files changed, do not create an empty commit.

---

## Self-Review Notes

- Spec coverage: The plan covers bottom tabs, `本週菜單` as primary view, dish settings tab, persisted weekly meal settings, weekday dinner defaults, menu generation rules, IndexedDB persistence, and tests.
- Placeholder scan: No TBD/TODO placeholders remain. Commands, file paths, and expected outcomes are explicit.
- Type consistency: `MealType`, `MealSetting`, `WeeklyPlan`, `generateWeeklyPlans`, `createDefaultMealSettings`, and component props are consistently named across tasks.
