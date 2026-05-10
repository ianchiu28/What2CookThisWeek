# Dish Ingredients & Shopping List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional ingredients list per dish, render it under each dish in the weekly menu, and provide a one-click deduplicated shopping list modal that copies to clipboard.

**Architecture:** Store `ingredients: string[]` on each `Dish` (Dexie schema v5 migration). Two pure functions in `src/ingredients.ts` handle parsing the user's input string and aggregating the weekly shopping list (deduplicated, sorted by Chinese stroke count via `Intl.Collator`). `DishForm` gains a textarea; `WeeklyPlanner` gets a header button that opens a new `ShoppingListModal` component.

**Tech Stack:** React 18, TypeScript, Dexie 4, Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-05-10-dish-ingredients-design.md`

---

## File Structure

**Create:**
- `src/ingredients.ts` — `parseIngredients()` and `aggregateShoppingList()` pure functions
- `src/ingredients.test.ts` — unit tests
- `src/components/ShoppingListModal.tsx` — modal UI

**Modify:**
- `src/db.ts` — add `ingredients` to `Dish`, bump schema to v5
- `src/components/DishForm.tsx` — textarea field, plumb `ingredients` through
- `src/components/DishList.tsx` — pass `ingredients` through (no UI change)
- `src/components/WeeklyPlanner.tsx` — render ingredients, header button, host modal
- `src/App.test.tsx` — add ingredient + shopping list integration tests; update test helpers
- `src/App.css` — add `.dish-ingredients` and `.shopping-list` styles

---

## Task 1: parseIngredients utility (TDD)

**Files:**
- Create: `src/ingredients.ts`
- Create: `src/ingredients.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/ingredients.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { parseIngredients } from './ingredients';

describe('parseIngredients', () => {
  test('empty string returns empty array', () => {
    expect(parseIngredients('')).toEqual([]);
  });

  test('whitespace only returns empty array', () => {
    expect(parseIngredients('   \n\t  ')).toEqual([]);
  });

  test('splits by mixed separators (space, tab, newline, half/full-width comma, dunhao, half/full-width semicolon)', () => {
    expect(parseIngredients('番茄、蛋 蔥,薑；蒜\n醬油\t糖，鹽;醋')).toEqual([
      '番茄', '蛋', '蔥', '薑', '蒜', '醬油', '糖', '鹽', '醋',
    ]);
  });

  test('collapses consecutive separators (no empty tokens)', () => {
    expect(parseIngredients('番茄,,，、 蛋')).toEqual(['番茄', '蛋']);
  });

  test('trims and dedupes preserving first-seen order', () => {
    expect(parseIngredients('  番茄 , 蛋 , 番茄 , 蔥 , 蛋 ')).toEqual(['番茄', '蛋', '蔥']);
  });

  test('single ingredient with no separators', () => {
    expect(parseIngredients('番茄')).toEqual(['番茄']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/ingredients.test.ts`
Expected: FAIL with "Cannot find module './ingredients'" (or similar import error).

- [ ] **Step 3: Write minimal implementation**

Create `src/ingredients.ts`:

```ts
const SEPARATOR = /[\s,，、;；]+/;

export function parseIngredients(input: string): string[] {
  const tokens = input.split(SEPARATOR).map((token) => token.trim()).filter((token) => token.length > 0);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const token of tokens) {
    if (seen.has(token)) continue;
    seen.add(token);
    result.push(token);
  }
  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/ingredients.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ingredients.ts src/ingredients.test.ts
git commit -m "feat: add parseIngredients utility"
```

---

## Task 2: aggregateShoppingList utility (TDD)

**Files:**
- Modify: `src/ingredients.ts`
- Modify: `src/ingredients.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/ingredients.test.ts`:

```ts
import type { Dish, WeeklyPlan } from './db';
import { aggregateShoppingList } from './ingredients';

function makeDish(overrides: Partial<Dish> & Pick<Dish, 'id' | 'name'>): Dish {
  return {
    mealTypes: ['dinner'],
    category: 'uncategorized',
    ingredients: [],
    ...overrides,
  };
}

function makePlan(overrides: Partial<WeeklyPlan> & Pick<WeeklyPlan, 'day' | 'meal' | 'slot'>): WeeklyPlan {
  return overrides;
}

describe('aggregateShoppingList', () => {
  test('empty plans returns empty array', () => {
    expect(aggregateShoppingList([], [])).toEqual([]);
  });

  test('ignores plans whose dishId does not resolve to a dish', () => {
    const dishes = [makeDish({ id: 1, name: '番茄炒蛋', ingredients: ['番茄', '蛋'] })];
    const plans = [
      makePlan({ day: 0, meal: 'dinner', slot: 0, dishId: 1 }),
      makePlan({ day: 0, meal: 'dinner', slot: 1, dishId: 999 }),
      makePlan({ day: 0, meal: 'dinner', slot: 2 }),
    ];
    const result = aggregateShoppingList(plans, dishes);
    expect(result.length).toBe(2);
    expect(new Set(result)).toEqual(new Set(['番茄', '蛋']));
  });

  test('dedupes ingredients across dishes', () => {
    const dishes = [
      makeDish({ id: 1, name: 'A', ingredients: ['番茄', '蛋', '蔥'] }),
      makeDish({ id: 2, name: 'B', ingredients: ['番茄', '薑'] }),
    ];
    const plans = [
      makePlan({ day: 0, meal: 'dinner', slot: 0, dishId: 1 }),
      makePlan({ day: 0, meal: 'dinner', slot: 1, dishId: 2 }),
    ];
    const result = aggregateShoppingList(plans, dishes);
    expect(new Set(result)).toEqual(new Set(['番茄', '蛋', '蔥', '薑']));
    expect(result.length).toBe(4);
  });

  test('sorts by Chinese stroke count (一 before 二 before 蛋)', () => {
    const dishes = [makeDish({ id: 1, name: 'A', ingredients: ['蛋', '一', '二'] })];
    const plans = [makePlan({ day: 0, meal: 'dinner', slot: 0, dishId: 1 })];
    expect(aggregateShoppingList(plans, dishes)).toEqual(['一', '二', '蛋']);
  });

  test('skips dishes with empty ingredients arrays', () => {
    const dishes = [
      makeDish({ id: 1, name: 'A', ingredients: [] }),
      makeDish({ id: 2, name: 'B', ingredients: ['鹽'] }),
    ];
    const plans = [
      makePlan({ day: 0, meal: 'dinner', slot: 0, dishId: 1 }),
      makePlan({ day: 0, meal: 'dinner', slot: 1, dishId: 2 }),
    ];
    expect(aggregateShoppingList(plans, dishes)).toEqual(['鹽']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/ingredients.test.ts`
Expected: FAIL with "aggregateShoppingList is not exported" (or import error).

Note: `Dish` does not yet have `ingredients`. TypeScript will complain. Either temporarily cast in helper, or skip ahead to Task 3 first. Recommended: do Task 3 first (it's safe and unblocks both tests). Update plan execution order if needed.

> **Execution note:** If TypeScript blocks compilation here, switch to Task 3 first (which adds `ingredients` to the `Dish` type), then return to Task 2 Step 2.

- [ ] **Step 3: Write minimal implementation**

Append to `src/ingredients.ts`:

```ts
import type { Dish, WeeklyPlan } from './db';

const strokeCollator = new Intl.Collator('zh-Hant-TW', { collation: 'stroke' });

export function aggregateShoppingList(plans: WeeklyPlan[], dishes: Dish[]): string[] {
  const dishById = new Map(dishes.filter((dish): dish is Dish & { id: number } => typeof dish.id === 'number').map((dish) => [dish.id, dish]));
  const seen = new Set<string>();
  for (const plan of plans) {
    if (plan.dishId === undefined) continue;
    const dish = dishById.get(plan.dishId);
    if (!dish) continue;
    for (const ingredient of dish.ingredients) {
      seen.add(ingredient);
    }
  }
  return Array.from(seen).sort(strokeCollator.compare);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/ingredients.test.ts`
Expected: PASS (all tests in file).

- [ ] **Step 5: Commit**

```bash
git add src/ingredients.ts src/ingredients.test.ts
git commit -m "feat: add aggregateShoppingList utility"
```

---

## Task 3: Update Dish type and Dexie schema v5

**Files:**
- Modify: `src/db.ts`

- [ ] **Step 1: Add `ingredients` to Dish type**

In `src/db.ts`, change the `Dish` type (around line 6-12) to:

```ts
export type Dish = {
  id?: number;
  name: string;
  lastCookedAt?: number;
  mealTypes: MealType[];
  category: DishCategory;
  ingredients: string[];
};
```

- [ ] **Step 2: Add Dexie schema version 5**

In `src/db.ts`, after the existing `this.version(4)` block (around line 79), append:

```ts
this.version(5)
  .stores({
    dishes: '++id, name, lastCookedAt, category',
    weeklyPlans: '++id, [day+meal+slot], day, meal, dishId',
    mealSettings: '++id, [day+meal], day, meal',
  })
  .upgrade(async (transaction) => {
    await transaction
      .table<Dish, number>('dishes')
      .toCollection()
      .modify((dish) => {
        dish.ingredients = dish.ingredients ?? [];
      });
  });
```

- [ ] **Step 3: Verify type errors surface in dependent code**

Run: `npx tsc -b`
Expected: Errors in `App.test.tsx`, `DishForm.tsx`, `DishList.tsx` because helpers/forms construct `Dish` without `ingredients`. These will be fixed in subsequent tasks.

> **Execution note:** Do NOT try to fix all TypeScript errors here — they'll be fixed task-by-task. If you want a green build at this commit, instead minimally update each call site to pass `ingredients: []`. Otherwise commit and proceed; later tasks will green it.

- [ ] **Step 4: Make existing test helpers compile (minimal patch)**

In `src/App.test.tsx`, update the `dish()` helper (around lines 6-12) to:

```ts
function dish(overrides: Partial<Dish> & Pick<Dish, 'id' | 'name'>): Dish {
  return {
    mealTypes: ['dinner'],
    category: 'uncategorized',
    ingredients: [],
    ...overrides,
  };
}
```

Also update the inline literal in `mockState.dishesData` initial value (around line 56):

```ts
dishesData: [{ id: 1, name: '番茄炒蛋', mealTypes: ['dinner'], category: 'uncategorized', ingredients: [] }] as Dish[],
```

In `src/components/DishForm.tsx`, update `defaultDish` (around lines 28-32) to:

```ts
const defaultDish: DishFormValue = {
  name: '',
  mealTypes: ['dinner'],
  category: 'uncategorized',
  ingredients: [],
};
```

And update `DishFormValue` (around lines 12-16) to:

```ts
export type DishFormValue = {
  name: string;
  mealTypes: MealType[];
  category: DishCategory;
  ingredients: string[];
};
```

In `src/components/DishList.tsx`, update the `onAddDish` and `handleAddDish`/`handleEditDish` types (around lines 11, 53, 58) — change every `{ name: string; mealTypes: MealType[]; category: DishCategory }` to `{ name: string; mealTypes: MealType[]; category: DishCategory; ingredients: string[] }`. Or replace with `DishFormValue` import for DRY:

```ts
import { DISH_CATEGORIES, DishForm, type DishFormValue } from './DishForm';
```

Then change the prop type:

```ts
onAddDish: (dish: DishFormValue) => Promise<void>;
```

And change the parameter types of `handleAddDish` and `handleEditDish` to `DishFormValue`.

In `src/App.tsx`, update `addDish` (around line 41) signature:

```ts
async function addDish(dish: { name: string; mealTypes: MealType[]; category: DishCategory; ingredients: string[] }) {
  await db.dishes.add(dish);
  await loadData();
}
```

- [ ] **Step 5: Verify build**

Run: `npx tsc -b`
Expected: PASS (no type errors).

Run: `npx vitest run`
Expected: PASS — existing tests should still pass with `ingredients: []` defaults.

- [ ] **Step 6: Commit**

```bash
git add src/db.ts src/App.tsx src/App.test.tsx src/components/DishForm.tsx src/components/DishList.tsx
git commit -m "feat: add ingredients field to Dish with schema v5 migration"
```

---

## Task 4: DishForm ingredients textarea (TDD)

**Files:**
- Modify: `src/components/DishForm.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write failing tests**

In `src/App.test.tsx`, add two tests inside the `describe('App', () => { ... })` block (place near the existing dish add/edit tests):

```ts
test('adds a dish with ingredients parsed from a textarea', async () => {
  render(<App />);
  await openDishSettings();
  fireEvent.click(screen.getByRole('button', { name: '新增' }));

  const dialog = screen.getByRole('dialog', { name: '新增菜品' });
  fireEvent.change(within(dialog).getByPlaceholderText('例如：番茄炒蛋'), { target: { value: '番茄炒蛋' } });
  fireEvent.change(within(dialog).getByLabelText('材料（可選）'), { target: { value: '番茄、蛋 蔥, 番茄' } });
  fireEvent.click(within(dialog).getByRole('button', { name: '新增' }));

  await waitFor(() => expect(mockState.dishesAdd).toHaveBeenCalledTimes(1));
  expect(mockState.dishesAdd).toHaveBeenCalledWith({
    name: '番茄炒蛋',
    mealTypes: ['dinner'],
    category: 'uncategorized',
    ingredients: ['番茄', '蛋', '蔥'],
  });
});

test('edits a dish prefills ingredients joined with 、', async () => {
  mockState.dishesData = [
    dish({ id: 1, name: '番茄炒蛋', ingredients: ['番茄', '蛋', '蔥'] }),
  ];

  render(<App />);
  await openDishSettings();
  fireEvent.click(within(rowForDish('番茄炒蛋')).getByRole('button', { name: '編輯 番茄炒蛋' }));

  const dialog = screen.getByRole('dialog', { name: '編輯菜品' });
  expect(within(dialog).getByLabelText('材料（可選）')).toHaveValue('番茄、蛋、蔥');

  fireEvent.change(within(dialog).getByLabelText('材料（可選）'), { target: { value: '番茄, 蛋, 蔥, 薑' } });
  fireEvent.click(within(dialog).getByRole('button', { name: '儲存' }));

  await waitFor(() => expect(mockState.dishesPut).toHaveBeenCalledTimes(1));
  expect(mockState.dishesPut).toHaveBeenCalledWith(expect.objectContaining({
    id: 1,
    ingredients: ['番茄', '蛋', '蔥', '薑'],
  }));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/App.test.tsx -t "ingredients"`
Expected: FAIL — `getByLabelText('材料（可選）')` not found.

- [ ] **Step 3: Implement textarea in DishForm**

Modify `src/components/DishForm.tsx`. Replace the entire file with:

```tsx
import { FormEvent, useState } from 'react';
import type { DishCategory, MealType } from '../db';
import { parseIngredients } from '../ingredients';
import { MEAL_TYPES } from '../planner';

export const DISH_CATEGORIES: Array<{ value: DishCategory; label: string }> = [
  { value: 'uncategorized', label: '無分類' },
  { value: 'vegetable', label: '菜' },
  { value: 'meat', label: '肉' },
  { value: 'soup', label: '湯' },
];

export type DishFormValue = {
  name: string;
  mealTypes: MealType[];
  category: DishCategory;
  ingredients: string[];
};

type DishFormProps = {
  onSubmitDish: (dish: DishFormValue) => Promise<void>;
  className?: string;
  title?: string;
  submitLabel?: string;
  initialDish?: DishFormValue;
  categoryInputName?: string;
  onCancel?: () => void;
};

const defaultDish: DishFormValue = {
  name: '',
  mealTypes: ['dinner'],
  category: 'uncategorized',
  ingredients: [],
};

export function DishForm({
  onSubmitDish,
  className = 'card dish-form',
  title = '新增菜品',
  submitLabel = '新增',
  initialDish = defaultDish,
  categoryInputName = 'dish-category',
  onCancel,
}: DishFormProps) {
  const [name, setName] = useState(initialDish.name);
  const [mealTypes, setMealTypes] = useState<MealType[]>(initialDish.mealTypes);
  const [category, setCategory] = useState<DishCategory>(initialDish.category);
  const [ingredientsText, setIngredientsText] = useState(initialDish.ingredients.join('、'));

  const canSubmit = name.trim().length > 0 && mealTypes.length > 0;

  function toggleMealType(mealType: MealType) {
    setMealTypes((current) =>
      current.includes(mealType) ? current.filter((item) => item !== mealType) : [...current, mealType],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || mealTypes.length === 0) return;

    await onSubmitDish({
      name: trimmedName,
      mealTypes,
      category,
      ingredients: parseIngredients(ingredientsText),
    });
    setName(initialDish.name);
    setMealTypes(initialDish.mealTypes);
    setCategory(initialDish.category);
    setIngredientsText(initialDish.ingredients.join('、'));
  }

  return (
    <form className={className} onSubmit={handleSubmit}>
      <h2>{title}</h2>
      <label className="field">
        <span>菜名</span>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：番茄炒蛋" />
      </label>

      <fieldset className="option-group">
        <legend>適用餐別</legend>
        <div className="option-row">
          {MEAL_TYPES.map((mealType) => (
            <label key={mealType.value} className="choice-chip">
              <input
                type="checkbox"
                checked={mealTypes.includes(mealType.value)}
                onChange={() => toggleMealType(mealType.value)}
              />
              {mealType.label}
            </label>
          ))}
        </div>
        {mealTypes.length === 0 && <p className="form-error">至少選一個餐別</p>}
      </fieldset>

      <fieldset className="option-group">
        <legend>分類</legend>
        <div className="option-row">
          {DISH_CATEGORIES.map((item) => (
            <label key={item.value} className="choice-chip">
              <input
                type="radio"
                name={categoryInputName}
                checked={category === item.value}
                onChange={() => setCategory(item.value)}
              />
              {item.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="field">
        <span>材料（可選）</span>
        <textarea
          value={ingredientsText}
          onChange={(event) => setIngredientsText(event.target.value)}
          placeholder="用空白、頓號、逗號分開，例如：番茄 蛋 蔥"
          rows={2}
        />
      </label>

      <div className="modal-actions">
        {onCancel && (
          <button type="button" className="neutral" onClick={onCancel}>
            取消
          </button>
        )}
        <button type="submit" disabled={!canSubmit}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/App.test.tsx -t "ingredients"`
Expected: PASS (both new tests).

Run: `npx vitest run`
Expected: PASS (full suite still green).

- [ ] **Step 5: Commit**

```bash
git add src/components/DishForm.tsx src/App.test.tsx
git commit -m "feat: add ingredients textarea to DishForm"
```

---

## Task 5: Render ingredients in WeeklyPlanner (TDD)

**Files:**
- Modify: `src/components/WeeklyPlanner.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Write the failing test**

In `src/App.test.tsx`, append inside the `describe('App', () => { ... })` block:

```ts
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

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/App.test.tsx -t "renders dish ingredients"`
Expected: FAIL — `番茄・蛋・蔥` not found.

- [ ] **Step 3: Implement ingredient rendering**

Replace `src/components/WeeklyPlanner.tsx` with:

```tsx
import { useMemo } from 'react';
import type { Dish, MealType, WeeklyPlan } from '../db';
import { DAYS, MEAL_TYPES } from '../planner';

type WeeklyPlannerProps = {
  dishes: Dish[];
  weeklyPlans: WeeklyPlan[];
  onGenerate: () => Promise<void>;
  canGenerate: boolean;
};

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

function planKey(day: number, meal: MealType) {
  return `${day}-${meal}`;
}

export function WeeklyPlanner({ dishes, weeklyPlans, onGenerate, canGenerate }: WeeklyPlannerProps) {
  const dishesById = useMemo(() => {
    const map = new Map<number, Dish>();
    for (const dish of dishes) {
      if (typeof dish.id === 'number') map.set(dish.id, dish);
    }
    return map;
  }, [dishes]);

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
                    {meal.plans.map((plan) => {
                      const dish = plan.dishId !== undefined ? dishesById.get(plan.dishId) : undefined;
                      const name = dish?.name ?? '尚未安排';
                      const ingredients = dish?.ingredients ?? [];
                      return (
                        <li key={`${plan.day}-${plan.meal}-${plan.slot}`}>
                          <span className="dish-name">{name}</span>
                          {ingredients.length > 0 && (
                            <span className="dish-ingredients">{ingredients.join('・')}</span>
                          )}
                        </li>
                      );
                    })}
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

- [ ] **Step 4: Add CSS for `.dish-ingredients`**

In `src/App.css`, after the `.menu-dishes` block (around line 344), append:

```css
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

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/App.test.tsx -t "renders dish ingredients"`
Expected: PASS.

Run: `npx vitest run`
Expected: PASS (full suite still green; existing menu rendering tests should still find dish names — verify the `getByText('番茄炒蛋')` and `getByText('尚未安排')` style assertions still match because they match `<span>` text content).

> **If existing tests break:** the `renders generated meals grouped under 本週菜單` and `renders generated meal slots in slot order` tests rely on `getByText` and `getAllByRole('listitem')`. The new structure wraps the name in a `<span>`, but `getByText` still finds it by text content. The `items.map(item => item.textContent)` test will read the full text — for a dish without ingredients, it's just the name; for one with ingredients, the textContent will concatenate name + ingredients. The existing slot-order test seeds dishes without ingredients, so it should still match `['第一道', '第二道']`. Verify before proceeding.

- [ ] **Step 6: Commit**

```bash
git add src/components/WeeklyPlanner.tsx src/App.css src/App.test.tsx
git commit -m "feat: render dish ingredients under each menu item"
```

---

## Task 6: ShoppingListModal component (TDD)

**Files:**
- Create: `src/components/ShoppingListModal.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/ShoppingListModal.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ShoppingListModal } from './ShoppingListModal';

describe('ShoppingListModal', () => {
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
  });

  afterEach(() => {
    cleanup();
  });

  test('renders items as a list', () => {
    render(<ShoppingListModal items={['番茄', '蛋', '蔥']} onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: '本週採買清單' });
    expect(within(dialog).getByText('番茄')).toBeInTheDocument();
    expect(within(dialog).getByText('蛋')).toBeInTheDocument();
    expect(within(dialog).getByText('蔥')).toBeInTheDocument();
  });

  test('shows empty message and disables copy when items is empty', () => {
    render(<ShoppingListModal items={[]} onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: '本週採買清單' });
    expect(within(dialog).getByText('目前菜單中的菜品都沒有設定材料。')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '複製清單' })).toBeDisabled();
  });

  test('close button calls onClose', () => {
    const onClose = vi.fn();
    render(<ShoppingListModal items={['番茄']} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: '關閉' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('copy button writes newline-joined items to clipboard', async () => {
    render(<ShoppingListModal items={['番茄', '蛋', '蔥']} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: '複製清單' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText).toHaveBeenCalledWith('番茄\n蛋\n蔥');
  });

  test('copy button shows confirmation text after success', async () => {
    render(<ShoppingListModal items={['番茄']} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: '複製清單' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '已複製 ✓' })).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/ShoppingListModal.test.tsx`
Expected: FAIL with import error.

- [ ] **Step 3: Implement the component**

Create `src/components/ShoppingListModal.tsx`:

```tsx
import { useState } from 'react';

type ShoppingListModalProps = {
  items: string[];
  onClose: () => void;
};

export function ShoppingListModal({ items, onClose }: ShoppingListModalProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');

  async function handleCopy() {
    if (items.length === 0) return;
    await navigator.clipboard.writeText(items.join('\n'));
    setCopyState('copied');
    setTimeout(() => setCopyState('idle'), 2000);
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card" role="dialog" aria-modal="true" aria-label="本週採買清單">
        <h2>本週採買清單</h2>
        {items.length === 0 ? (
          <p className="muted">目前菜單中的菜品都沒有設定材料。</p>
        ) : (
          <ul className="shopping-list">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
        <div className="modal-actions">
          <button type="button" className="neutral" onClick={onClose}>
            關閉
          </button>
          <button type="button" disabled={items.length === 0} onClick={handleCopy}>
            {copyState === 'copied' ? '已複製 ✓' : '複製清單'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add `.shopping-list` CSS**

In `src/App.css`, append at end of file:

```css
.shopping-list {
  display: grid;
  gap: 0.4rem;
  list-style: none;
  margin: 0;
  max-height: 60vh;
  overflow-y: auto;
  padding: 0;
}

.shopping-list li {
  border-bottom: 1px solid #ffedd5;
  padding: 0.5rem 0.25rem;
}

.shopping-list li:last-child {
  border-bottom: 0;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/ShoppingListModal.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/ShoppingListModal.tsx src/components/ShoppingListModal.test.tsx src/App.css
git commit -m "feat: add ShoppingListModal component"
```

---

## Task 7: Wire shopping list button into WeeklyPlanner (TDD)

**Files:**
- Modify: `src/components/WeeklyPlanner.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write the failing integration test**

In `src/App.test.tsx`, append inside the `describe('App', () => { ... })` block:

```ts
test('shopping list button opens modal with deduped, sorted ingredients and copy works', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });

  mockState.dishesData = [
    dish({ id: 1, name: 'A', ingredients: ['番茄', '蛋', '蔥'] }),
    dish({ id: 2, name: 'B', ingredients: ['番茄', '薑'] }),
  ];
  mockState.weeklyPlansData = [
    weeklyPlan({ id: 1, day: 0, meal: 'dinner', slot: 0, dishId: 1 }),
    weeklyPlan({ id: 2, day: 0, meal: 'dinner', slot: 1, dishId: 2 }),
  ];

  render(<App />);
  const shoppingButton = await screen.findByRole('button', { name: '採買清單' });
  fireEvent.click(shoppingButton);

  const dialog = await screen.findByRole('dialog', { name: '本週採買清單' });
  const items = within(dialog).getAllByRole('listitem').map((li) => li.textContent);
  expect(items.length).toBe(4);
  expect(new Set(items)).toEqual(new Set(['番茄', '蛋', '蔥', '薑']));

  fireEvent.click(within(dialog).getByRole('button', { name: '複製清單' }));
  await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
  const copied = writeText.mock.calls[0][0] as string;
  expect(new Set(copied.split('\n'))).toEqual(new Set(['番茄', '蛋', '蔥', '薑']));

  fireEvent.click(within(dialog).getByRole('button', { name: '關閉' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '本週採買清單' })).not.toBeInTheDocument());
});

test('shopping list button is disabled when there is no weekly plan', async () => {
  mockState.weeklyPlansData = [];

  render(<App />);
  const shoppingButton = await screen.findByRole('button', { name: '採買清單' });
  expect(shoppingButton).toBeDisabled();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/App.test.tsx -t "shopping list"`
Expected: FAIL — no `採買清單` button found.

- [ ] **Step 3: Wire the button and modal in WeeklyPlanner**

Replace `src/components/WeeklyPlanner.tsx` with:

```tsx
import { useMemo, useState } from 'react';
import type { Dish, MealType, WeeklyPlan } from '../db';
import { aggregateShoppingList } from '../ingredients';
import { DAYS, MEAL_TYPES } from '../planner';
import { ShoppingListModal } from './ShoppingListModal';

type WeeklyPlannerProps = {
  dishes: Dish[];
  weeklyPlans: WeeklyPlan[];
  onGenerate: () => Promise<void>;
  canGenerate: boolean;
};

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

function planKey(day: number, meal: MealType) {
  return `${day}-${meal}`;
}

export function WeeklyPlanner({ dishes, weeklyPlans, onGenerate, canGenerate }: WeeklyPlannerProps) {
  const [showShoppingList, setShowShoppingList] = useState(false);

  const dishesById = useMemo(() => {
    const map = new Map<number, Dish>();
    for (const dish of dishes) {
      if (typeof dish.id === 'number') map.set(dish.id, dish);
    }
    return map;
  }, [dishes]);

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

  const shoppingItems = useMemo(() => aggregateShoppingList(weeklyPlans, dishes), [weeklyPlans, dishes]);
  const hasPlans = weeklyPlans.length > 0;

  return (
    <section className="card menu-card">
      <div className="section-heading">
        <h2>本週菜單</h2>
        <div className="menu-actions">
          <button
            type="button"
            className="neutral"
            disabled={!hasPlans}
            onClick={() => setShowShoppingList(true)}
          >
            採買清單
          </button>
          <button type="button" onClick={onGenerate} disabled={!canGenerate}>
            產生本週菜單
          </button>
        </div>
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
                    {meal.plans.map((plan) => {
                      const dish = plan.dishId !== undefined ? dishesById.get(plan.dishId) : undefined;
                      const name = dish?.name ?? '尚未安排';
                      const ingredients = dish?.ingredients ?? [];
                      return (
                        <li key={`${plan.day}-${plan.meal}-${plan.slot}`}>
                          <span className="dish-name">{name}</span>
                          {ingredients.length > 0 && (
                            <span className="dish-ingredients">{ingredients.join('・')}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {showShoppingList && (
        <ShoppingListModal items={shoppingItems} onClose={() => setShowShoppingList(false)} />
      )}
    </section>
  );
}
```

- [ ] **Step 4: Add `.menu-actions` CSS**

In `src/App.css`, after the `.section-heading` block (around line 105), append:

```css
.menu-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/App.test.tsx -t "shopping list"`
Expected: PASS (2 tests).

Run: `npx vitest run`
Expected: PASS (full suite green).

- [ ] **Step 6: Commit**

```bash
git add src/components/WeeklyPlanner.tsx src/App.css src/App.test.tsx
git commit -m "feat: add shopping list button and modal to weekly planner"
```

---

## Task 8: Manual verification

**Files:** none (manual UI testing)

- [ ] **Step 1: Start dev server**

Run: `npm run dev`
Expected: Vite dev server starts; open browser to printed URL.

- [ ] **Step 2: Smoke test ingredients flow**

In browser:
1. Go to `菜品設定`. Click `新增`. Add a dish with name `番茄炒蛋`, ingredients `番茄、蛋、蔥`. Submit.
2. Edit it; confirm textarea shows `番茄、蛋、蔥`. Close.
3. Add another dish `紅燒牛肉` (`category=meat`) with ingredients `牛肉, 醬油 蔥`.
4. Go to `排餐設定`, ensure at least one slot is enabled with `meatCount` and `vegetableCount` covering both dishes.
5. Go to `本週菜單`, click `產生本週菜單`. Verify each dish in the menu shows its ingredients in muted small text under the name.
6. Click `採買清單`. Verify modal lists 5 unique ingredients (`番茄`, `蛋`, `蔥`, `牛肉`, `醬油`), with `蔥` appearing only once even though it's in both dishes.
7. Click `複製清單`. Paste into a text field. Verify newline-separated, no duplicates.
8. Confirm button momentarily reads `已複製 ✓`.
9. Close modal.

- [ ] **Step 3: Smoke test edge cases**

1. Create a dish with no ingredients. Verify weekly menu shows the dish with no second line. Verify shopping list excludes it.
2. With weekly menu empty, verify `採買清單` button is disabled.
3. With all dishes having no ingredients but a weekly menu present, click `採買清單`. Verify modal shows "目前菜單中的菜品都沒有設定材料。" and `複製清單` is disabled.

- [ ] **Step 4: Stop dev server**

Press `Ctrl+C` in the terminal running `npm run dev`.

- [ ] **Step 5: No-op commit (skip if no changes)**

Skip — no code changes were made in this task.

---

## Summary

After all tasks:
- `Dish.ingredients: string[]` persisted via Dexie schema v5
- DishForm has a textarea; submission parses with `parseIngredients`
- WeeklyPlanner shows ingredients beneath each dish name
- `採買清單` button on the menu header opens a modal with deduped, stroke-sorted ingredients and a clipboard copy button
- All new code covered by unit tests (`ingredients.test.ts`, `ShoppingListModal.test.tsx`) plus integration tests in `App.test.tsx`
