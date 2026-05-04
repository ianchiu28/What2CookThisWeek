# Codebase Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the current React/TypeScript app and tests so dish management, weekly plan rendering, and test setup are easier to maintain while preserving the existing UI behavior and IndexedDB schema.

**Architecture:** Keep `App.tsx` as the data-loading and top-level navigation coordinator. Move repeated dish form behavior into reusable form props and small pure helpers, and make weekly menu grouping use indexed lookups instead of repeated linear scans during render. Tests should keep user-visible behavior coverage but centralize mock data and interaction helpers.

**Tech Stack:** React 18, TypeScript, Vite, Dexie, Vitest, Testing Library, fake-indexeddb.

---

## File Structure

- Modify `src/components/DishForm.tsx`
  - Make the form reusable for both create and edit flows.
  - Add props for `title`, `submitLabel`, `initialDish`, `categoryInputName`, and `onSubmitDish`.
  - Keep `onAddDish` behavior available only if it remains simpler during migration, then remove it after callers are updated.

- Modify `src/components/DishList.tsx`
  - Remove duplicated edit-form JSX.
  - Use shared `DishForm` for add and edit modals.
  - Keep filtering and modal state local to this component.
  - Extract small pure helpers only when they directly replace repeated logic in this file.

- Modify `src/components/WeeklyPlanner.tsx`
  - Use `useMemo` for dish name lookup and visible day grouping.
  - Avoid repeated `dishes.find`, repeated `weeklyPlans.filter`, and repeated sorting in render loops.

- Modify `src/App.test.tsx`
  - Extract fixture builders and tab/modal interaction helpers inside the test file.
  - Keep assertions user-facing where possible.
  - Preserve coverage for add, edit, delete, filters, default meal settings, generate menu, and rendered menu.

- Modify `src/planner.test.ts`
  - Reduce repeated inline setting objects with a tiny local builder.
  - Preserve all behavioral assertions.

- Modify `src/pwa-assets.test.ts`
  - Read manifest, HTML, and service worker once per file instead of repeating file reads per test.

- Do not modify `src/db.ts` schema unless a test exposes a real bug.
- Do not change rendered Traditional Chinese labels, tab names, icon text, or public PWA asset paths.

---

### Task 1: Make `DishForm` reusable for add and edit

**Files:**
- Modify: `src/components/DishForm.tsx`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Add a failing regression test for editing through the shared form contract**

Update `src/App.test.tsx` test `edits a dish in a modal` to assert that the edit dialog has a submit button named `儲存`, because the reusable form must support a custom submit label.

```tsx
  test('edits a dish in a modal', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '菜品設定' }));

    const row = screen.getByText('番茄炒蛋').closest('li')!;
    fireEvent.click(within(row).getByRole('button', { name: '編輯 番茄炒蛋' }));

    const dialog = screen.getByRole('dialog', { name: '編輯菜品' });
    expect(within(dialog).getByRole('button', { name: '儲存' })).toBeInTheDocument();
    fireEvent.change(within(dialog).getByDisplayValue('番茄炒蛋'), { target: { value: '番茄牛肉湯' } });
    fireEvent.click(within(dialog).getByLabelText('肉'));
    fireEvent.click(within(dialog).getByLabelText('午餐'));
    fireEvent.click(within(dialog).getByRole('button', { name: '儲存' }));

    await waitFor(() => expect(mockState.dishesPut).toHaveBeenCalledTimes(1));
    expect(mockState.dishesPut).toHaveBeenCalledWith({
      id: 1,
      name: '番茄牛肉湯',
      mealTypes: ['dinner', 'lunch'],
      category: 'meat',
    });
    expect(screen.queryByRole('dialog', { name: '編輯菜品' })).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the focused test before implementation**

Run:

```bash
npm test -- src/App.test.tsx -t "edits a dish in a modal"
```

Expected: PASS before refactor. This is a characterization test that locks existing behavior before changing internals.

- [ ] **Step 3: Replace `DishForm` implementation with a reusable contract**

Replace the contents of `src/components/DishForm.tsx` with:

```tsx
import { FormEvent, useState } from 'react';
import type { DishCategory, MealType } from '../db';
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

    await onSubmitDish({ name: trimmedName, mealTypes, category });
    setName(initialDish.name);
    setMealTypes(initialDish.mealTypes);
    setCategory(initialDish.category);
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

- [ ] **Step 4: Update `DishList` add modal to use the new prop name**

In `src/components/DishList.tsx`, change the add modal form call from:

```tsx
<DishForm className="dish-form" onAddDish={handleAddDish} onCancel={() => setIsAddingDish(false)} />
```

to:

```tsx
<DishForm className="dish-form" onSubmitDish={handleAddDish} onCancel={() => setIsAddingDish(false)} />
```

- [ ] **Step 5: Run add dish test**

Run:

```bash
npm test -- src/App.test.tsx -t "adds a new dish"
```

Expected: PASS.

- [ ] **Step 6: Commit this task**

Only commit if the user has explicitly asked for commits in the current session. Otherwise skip this step.

```bash
git add src/components/DishForm.tsx src/components/DishList.tsx src/App.test.tsx
git commit -m "refactor: make dish form reusable"
```

---

### Task 2: Replace duplicated edit form JSX with `DishForm`

**Files:**
- Modify: `src/components/DishList.tsx`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Add local submit helper for edit values**

In `src/components/DishList.tsx`, change the imports from:

```tsx
import { FormEvent, useMemo, useState } from 'react';
```

to:

```tsx
import { useMemo, useState } from 'react';
```

Then replace `handleEditSubmit` with:

```tsx
  async function handleEditDish(dish: { name: string; mealTypes: MealType[]; category: DishCategory }) {
    if (!editingDish) return;

    await onUpdateDish({ ...editingDish, ...dish });
    setEditingDish(null);
  }
```

- [ ] **Step 2: Remove edit-only duplicated state and helpers**

In `src/components/DishList.tsx`, delete these state declarations:

```tsx
  const [editName, setEditName] = useState('');
  const [editMealTypes, setEditMealTypes] = useState<MealType[]>([]);
  const [editCategory, setEditCategory] = useState<DishCategory>('uncategorized');
```

Delete this derived value:

```tsx
  const canSave = editName.trim().length > 0 && editMealTypes.length > 0;
```

Replace `startEditing` with:

```tsx
  function startEditing(dish: Dish) {
    setEditingDish(dish);
  }
```

Delete `toggleEditMealType` completely.

- [ ] **Step 3: Replace edit modal JSX with `DishForm`**

Replace the full edit modal block in `src/components/DishList.tsx`:

```tsx
      {editingDish && (
        <div className="modal-backdrop">
          <form className="modal-card" role="dialog" aria-modal="true" aria-label="編輯菜品" onSubmit={handleEditSubmit}>
            <h2>編輯菜品</h2>
            <label className="field">
              <span>菜名</span>
              <input value={editName} onChange={(event) => setEditName(event.target.value)} />
            </label>

            <fieldset className="option-group">
              <legend>適用餐別</legend>
              <div className="option-row">
                {MEAL_TYPES.map((mealType) => (
                  <label key={mealType.value} className="choice-chip">
                    <input
                      type="checkbox"
                      checked={editMealTypes.includes(mealType.value)}
                      onChange={() => toggleEditMealType(mealType.value)}
                    />
                    {mealType.label}
                  </label>
                ))}
              </div>
              {editMealTypes.length === 0 && <p className="form-error">至少選一個餐別</p>}
            </fieldset>

            <fieldset className="option-group">
              <legend>分類</legend>
              <div className="option-row">
                {DISH_CATEGORIES.map((item) => (
                  <label key={item.value} className="choice-chip">
                    <input
                      type="radio"
                      name="edit-dish-category"
                      checked={editCategory === item.value}
                      onChange={() => setEditCategory(item.value)}
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="modal-actions">
              <button type="button" className="neutral" onClick={() => setEditingDish(null)}>
                取消
              </button>
              <button type="submit" disabled={!canSave}>
                儲存
              </button>
            </div>
          </form>
        </div>
      )}
```

with:

```tsx
      {editingDish && (
        <div className="modal-backdrop">
          <div className="modal-card" role="dialog" aria-modal="true" aria-label="編輯菜品">
            <DishForm
              className="dish-form"
              title="編輯菜品"
              submitLabel="儲存"
              initialDish={editingDish}
              categoryInputName="edit-dish-category"
              onSubmitDish={handleEditDish}
              onCancel={() => setEditingDish(null)}
            />
          </div>
        </div>
      )}
```

- [ ] **Step 4: Run edit tests**

Run:

```bash
npm test -- src/App.test.tsx -t "edits a dish in a modal"
```

Expected: PASS.

- [ ] **Step 5: Run full App tests**

Run:

```bash
npm test -- src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit this task**

Only commit if the user has explicitly asked for commits in the current session. Otherwise skip this step.

```bash
git add src/components/DishList.tsx src/App.test.tsx
git commit -m "refactor: reuse dish form for editing"
```

---

### Task 3: Improve weekly planner render efficiency

**Files:**
- Modify: `src/components/WeeklyPlanner.tsx`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Add characterization test for sorted slots**

Add this test near `renders generated meals grouped under 本週菜單` in `src/App.test.tsx`:

```tsx
  test('renders generated meal slots in slot order', async () => {
    mockState.dishesData = [
      { id: 1, name: '第一道', mealTypes: ['dinner'], category: 'uncategorized' },
      { id: 2, name: '第二道', mealTypes: ['dinner'], category: 'uncategorized' },
    ];
    mockState.weeklyPlansData = [
      { id: 1, day: 0, meal: 'dinner', slot: 1, dishId: 2 },
      { id: 2, day: 0, meal: 'dinner', slot: 0, dishId: 1 },
    ];

    render(<App />);
    const menu = await screen.findByRole('heading', { name: '本週菜單' });
    const menuCard = menu.closest('section')!;
    const items = within(menuCard).getAllByRole('listitem').map((item) => item.textContent);

    expect(items).toEqual(['第一道', '第二道']);
  });
```

- [ ] **Step 2: Run the new focused test**

Run:

```bash
npm test -- src/App.test.tsx -t "renders generated meal slots in slot order"
```

Expected: PASS before refactor. This locks current ordering behavior.

- [ ] **Step 3: Refactor `WeeklyPlanner` to use memoized lookup maps**

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
  const dishNames = useMemo(() => new Map(dishes.map((dish) => [dish.id, dish.name])), [dishes]);

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

  function getDishName(plan: WeeklyPlan) {
    return dishNames.get(plan.dishId) ?? '尚未安排';
  }

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

- [ ] **Step 4: Run weekly planner tests through App coverage**

Run:

```bash
npm test -- src/App.test.tsx -t "renders generated"
```

Expected: PASS for both generated menu rendering tests.

- [ ] **Step 5: Commit this task**

Only commit if the user has explicitly asked for commits in the current session. Otherwise skip this step.

```bash
git add src/components/WeeklyPlanner.tsx src/App.test.tsx
git commit -m "refactor: memoize weekly planner grouping"
```

---

### Task 4: Clean up App test fixtures and interactions

**Files:**
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Add fixture builders at the top of `src/App.test.tsx`**

After the imports, add:

```tsx
function dish(overrides: Partial<Dish> & Pick<Dish, 'id' | 'name'>): Dish {
  return {
    mealTypes: ['dinner'],
    category: 'uncategorized',
    ...overrides,
  };
}

function mealSetting(overrides: Partial<MealSetting> & Pick<MealSetting, 'day' | 'meal'>): MealSetting {
  return {
    enabled: true,
    dishCount: 1,
    ...overrides,
  };
}

function weeklyPlan(overrides: Partial<WeeklyPlan> & Pick<WeeklyPlan, 'day' | 'meal' | 'slot'>): WeeklyPlan {
  return overrides;
}
```

- [ ] **Step 2: Update default mock dish data to use builders**

In `mockState`, replace:

```tsx
    dishesData: [{ id: 1, name: '番茄炒蛋', mealTypes: ['dinner'], category: 'uncategorized' }] as Dish[],
```

with:

```tsx
    dishesData: [dish({ id: 1, name: '番茄炒蛋' })],
```

In `beforeEach`, replace the `mockState.dishesData` array with:

```tsx
    mockState.dishesData = [
      dish({ id: 1, name: '番茄炒蛋' }),
      dish({ id: 2, name: '早餐蛋餅', mealTypes: ['breakfast'], category: 'vegetable' }),
      dish({ id: 3, name: '玉米濃湯', mealTypes: ['lunch', 'dinner'], category: 'soup' }),
      dish({ id: 4, name: '紅燒牛肉', category: 'meat' }),
    ];
```

- [ ] **Step 3: Add interaction helpers below `beforeEach`**

Inside the `describe('App', () => { ... })` block, after `beforeEach`, add:

```tsx
  async function openDishSettings() {
    fireEvent.click(await screen.findByRole('button', { name: '菜品設定' }));
  }

  async function openMealSettings() {
    await screen.findByRole('heading', { name: '本週菜單' });
    fireEvent.click(screen.getByRole('button', { name: '排餐設定' }));
  }

  function rowForDish(name: string) {
    return screen.getByText(name).closest('li')!;
  }
```

- [ ] **Step 4: Replace repeated tab navigation and row lookup calls**

In `src/App.test.tsx`, replace repeated patterns:

```tsx
fireEvent.click(await screen.findByRole('button', { name: '菜品設定' }));
```

with:

```tsx
await openDishSettings();
```

Replace:

```tsx
await screen.findByRole('heading', { name: '本週菜單' });
fireEvent.click(screen.getByRole('button', { name: '排餐設定' }));
```

with:

```tsx
await openMealSettings();
```

Replace row lookups like:

```tsx
const row = screen.getByText('玉米濃湯').closest('li')!;
```

with:

```tsx
const row = rowForDish('玉米濃湯');
```

- [ ] **Step 5: Replace inline meal setting and weekly plan objects with builders**

In the generate and render tests, replace inline objects with builder calls. Example:

```tsx
    mockState.mealSettingsData = [
      mealSetting({ id: 1, day: 0, meal: 'breakfast' }),
      mealSetting({ id: 2, day: 0, meal: 'lunch', enabled: false }),
      mealSetting({ id: 3, day: 0, meal: 'dinner' }),
    ];
```

Example weekly plans:

```tsx
    mockState.weeklyPlansData = [
      weeklyPlan({ id: 1, day: 0, meal: 'breakfast', slot: 0, dishId: 1 }),
      weeklyPlan({ id: 2, day: 0, meal: 'dinner', slot: 0 }),
    ];
```

- [ ] **Step 6: Run App tests**

Run:

```bash
npm test -- src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit this task**

Only commit if the user has explicitly asked for commits in the current session. Otherwise skip this step.

```bash
git add src/App.test.tsx
git commit -m "test: simplify app test fixtures"
```

---

### Task 5: Clean up pure planner and asset tests

**Files:**
- Modify: `src/planner.test.ts`
- Modify: `src/pwa-assets.test.ts`

- [ ] **Step 1: Add a local meal setting builder in `planner.test.ts`**

After the `dishes` constant in `src/planner.test.ts`, add:

```ts
function setting(overrides: { day?: number; meal?: 'breakfast' | 'lunch' | 'dinner'; enabled?: boolean; dishCount?: number }) {
  return {
    day: 0,
    meal: 'dinner' as const,
    enabled: true,
    dishCount: 1,
    ...overrides,
  };
}
```

- [ ] **Step 2: Replace repeated setting objects in `planner.test.ts`**

Replace:

```ts
    const settings = [
      { day: 0, meal: 'breakfast' as const, enabled: true, dishCount: 2 },
      { day: 0, meal: 'lunch' as const, enabled: false, dishCount: 1 },
      { day: 0, meal: 'dinner' as const, enabled: true, dishCount: 1 },
    ];
```

with:

```ts
    const settings = [
      setting({ meal: 'breakfast', dishCount: 2 }),
      setting({ meal: 'lunch', enabled: false }),
      setting({ meal: 'dinner' }),
    ];
```

Replace other inline settings similarly:

```ts
    const plans = generateWeeklyPlans(dishes, [setting({ dishCount: 3 })]);
```

```ts
    const plans = generateWeeklyPlans([{ id: 1, name: '番茄炒蛋' }], [
      setting({ meal: 'breakfast' }),
      setting({ meal: 'dinner' }),
    ]);
```

```ts
    const plans = generateWeeklyPlans([{ id: 1, name: '番茄炒蛋' }], [setting({ dishCount: 3 })]);
```

- [ ] **Step 3: Read PWA assets once per file**

In `src/pwa-assets.test.ts`, replace the top constants with:

```ts
const root = process.cwd();
const manifest = JSON.parse(readFileSync(join(root, 'public/manifest.webmanifest'), 'utf-8'));
const html = readFileSync(join(root, 'index.html'), 'utf-8');
const serviceWorker = readFileSync(join(root, 'public/sw.js'), 'utf-8');
```

Then remove repeated local declarations of `manifest`, `html`, and `serviceWorker` from individual tests.

- [ ] **Step 4: Run focused tests**

Run:

```bash
npm test -- src/planner.test.ts src/pwa-assets.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit this task**

Only commit if the user has explicitly asked for commits in the current session. Otherwise skip this step.

```bash
git add src/planner.test.ts src/pwa-assets.test.ts
git commit -m "test: reduce repeated test setup"
```

---

### Task 6: Run full verification and inspect diff

**Files:**
- Verify all modified files.

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

- [ ] **Step 3: Inspect final diff**

Run:

```bash
git diff -- src/components/DishForm.tsx src/components/DishList.tsx src/components/WeeklyPlanner.tsx src/App.test.tsx src/planner.test.ts src/pwa-assets.test.ts
```

Expected: Diff only contains refactoring and test cleanup. It must not change user-facing labels, IndexedDB schema, PWA asset paths, or app navigation behavior.

- [ ] **Step 4: Manual UI smoke check if component markup changed**

Run:

```bash
npm run dev
```

Then open the local Vite URL and verify:

1. App opens on `本週菜單`.
2. `菜品設定` shows the dish list.
3. `新增` opens the add modal, can add a dish, and closes.
4. Editing an existing dish opens `編輯菜品`, saves, and closes.
5. Filters still hide by default and filter by meal/category.
6. `排餐設定` can toggle a meal.
7. `產生本週菜單` still renders grouped meals.

Expected: All flows behave as before.

- [ ] **Step 5: Final commit**

Only commit if the user has explicitly asked for commits in the current session. Otherwise skip this step.

```bash
git add src/components/DishForm.tsx src/components/DishList.tsx src/components/WeeklyPlanner.tsx src/App.test.tsx src/planner.test.ts src/pwa-assets.test.ts
git commit -m "refactor: simplify dish management and tests"
```

---

## Self-Review

- Spec coverage: The plan covers shared add/edit `DishForm`, `DishList` duplicate JSX removal, `WeeklyPlanner` lookup/grouping efficiency, App test fixture cleanup, planner test cleanup, PWA asset test file-read cleanup, and full verification.
- Placeholder scan: No `TBD`, `TODO`, undefined future functions, or vague implementation steps remain.
- Type consistency: `DishFormValue`, `DishCategory`, `MealType`, `WeeklyPlan`, `MealSetting`, and helper names are consistent across tasks.
- Scope check: The plan preserves IndexedDB schema and user-facing behavior, and avoids unrelated repository/hook abstractions.
