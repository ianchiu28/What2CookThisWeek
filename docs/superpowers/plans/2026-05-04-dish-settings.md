# Dish Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the `菜品設定` tab so dishes can be added, searched, filtered, and edited with meal applicability and category metadata.

**Architecture:** Keep the existing Vite/React tab-based app and Dexie storage. Add dish metadata at the database/type boundary, keep add/edit form behavior inside dish UI components, and let `App.tsx` own persistence callbacks and data reloads.

**Tech Stack:** React 18, TypeScript, Dexie, Vite, Vitest, Testing Library, CSS.

---

## File Structure

- Modify `src/db.ts`: add `DishCategory`, extend `Dish`, and add Dexie version 3 migration that backfills old dishes.
- Modify `src/App.tsx`: update add callback to accept full dish metadata and add update callback for edit modal saves.
- Modify `src/components/DishForm.tsx`: replace name-only form with metadata-aware add form.
- Modify `src/components/DishList.tsx`: add search/filter UI, metadata labels, and edit modal.
- Modify `src/App.css`: add styles for form fields, checkbox/radio groups, filters, tags, list rows, and modal.
- Modify `src/App.test.tsx`: update db mock and add integration tests for defaults, validation, search/filter, and edit.
- Create `src/db.test.ts`: verify Dexie migration backfills old dish records.

---

### Task 1: Dish Metadata Types and Migration

**Files:**
- Modify: `src/db.ts`
- Create: `src/db.test.ts`

- [ ] **Step 1: Write the failing migration test**

Create `src/db.test.ts` with:

```ts
import Dexie from 'dexie';
import { afterEach, describe, expect, test } from 'vitest';
import { db } from './db';

describe('dish metadata migration', () => {
  afterEach(async () => {
    await db.delete();
    await Dexie.delete('What2CookThisWeek');
  });

  test('backfills old dishes with dinner and uncategorized defaults', async () => {
    await db.delete();
    await Dexie.delete('What2CookThisWeek');

    const legacyDb = new Dexie('What2CookThisWeek');
    legacyDb.version(2).stores({
      dishes: '++id, name, lastCookedAt',
      weeklyPlans: '++id, [day+meal+slot], day, meal, dishId',
      mealSettings: '++id, [day+meal], day, meal',
    });

    await legacyDb.table('dishes').add({ name: '番茄炒蛋' });
    await legacyDb.close();

    await db.open();
    const dishes = await db.dishes.toArray();

    expect(dishes).toEqual([
      {
        id: 1,
        name: '番茄炒蛋',
        mealTypes: ['dinner'],
        category: 'uncategorized',
      },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/db.test.ts`

Expected: FAIL because `mealTypes` and `category` are not backfilled.

- [ ] **Step 3: Add dish metadata types and migration**

Modify `src/db.ts` to:

```ts
import Dexie, { type Table } from 'dexie';

export type MealType = 'breakfast' | 'lunch' | 'dinner';
export type DishCategory = 'vegetable' | 'meat' | 'soup' | 'uncategorized';

export type Dish = {
  id?: number;
  name: string;
  lastCookedAt?: number;
  mealTypes: MealType[];
  category: DishCategory;
};

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
    this.version(3)
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
            dish.mealTypes = dish.mealTypes?.length ? dish.mealTypes : ['dinner'];
            dish.category = dish.category ?? 'uncategorized';
          });
      });
  }
}

export const db = new CookDb();
```

- [ ] **Step 4: Run migration test to verify it passes**

Run: `npm test -- src/db.test.ts`

Expected: PASS.

- [ ] **Step 5: Run full tests**

Run: `npm test`

Expected: Existing tests may fail where mock dishes do not include new required metadata. Fix those in later tasks unless TypeScript blocks compilation immediately.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/db.ts src/db.test.ts
git commit -m "feat: add dish metadata migration"
```

---

### Task 2: Metadata-Aware Add Dish Form

**Files:**
- Modify: `src/components/DishForm.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Update App test mock data and add default submission test**

In `src/App.test.tsx`, change the db import type line to:

```ts
import type { Dish, MealSetting, WeeklyPlan } from './db';
```

Change `mockState.dishesData` to:

```ts
    dishesData: [{ id: 1, name: '番茄炒蛋', mealTypes: ['dinner'], category: 'uncategorized' }] as Dish[],
```

Change `dishesAdd` to:

```ts
  const dishesAdd = vi.fn(async (dish: Omit<Dish, 'id'>) => {
    mockState.dishesData = [...mockState.dishesData, { ...dish, id: mockState.dishesData.length + 1 }];
  });
```

Add this test inside `describe('App', () => { ... })`:

```ts
  test('adds a new dish with dinner and uncategorized defaults', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '菜品設定' }));

    fireEvent.change(screen.getByPlaceholderText('例如：番茄炒蛋'), { target: { value: '香煎雞腿' } });
    fireEvent.click(screen.getByRole('button', { name: '新增' }));

    await waitFor(() => expect(mockState.dishesAdd).toHaveBeenCalledTimes(1));
    expect(mockState.dishesAdd).toHaveBeenCalledWith({
      name: '香煎雞腿',
      mealTypes: ['dinner'],
      category: 'uncategorized',
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/App.test.tsx -t "adds a new dish"`

Expected: FAIL because `DishForm` still calls `onAddDish(name)`.

- [ ] **Step 3: Update `DishForm.tsx`**

Replace `src/components/DishForm.tsx` with:

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

type DishFormProps = {
  onAddDish: (dish: { name: string; mealTypes: MealType[]; category: DishCategory }) => Promise<void>;
};

export function DishForm({ onAddDish }: DishFormProps) {
  const [name, setName] = useState('');
  const [mealTypes, setMealTypes] = useState<MealType[]>(['dinner']);
  const [category, setCategory] = useState<DishCategory>('uncategorized');

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

    await onAddDish({ name: trimmedName, mealTypes, category });
    setName('');
    setMealTypes(['dinner']);
    setCategory('uncategorized');
  }

  return (
    <form className="card dish-form" onSubmit={handleSubmit}>
      <h2>新增菜品</h2>
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
                name="dish-category"
                checked={category === item.value}
                onChange={() => setCategory(item.value)}
              />
              {item.label}
            </label>
          ))}
        </div>
      </fieldset>

      <button type="submit" disabled={!canSubmit}>
        新增
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Update `App.tsx` add callback**

In `src/App.tsx`, change the import line to:

```ts
import { db, type Dish, type DishCategory, type MealSetting, type MealType, type WeeklyPlan } from './db';
```

Replace `addDish` with:

```ts
  async function addDish(dish: { name: string; mealTypes: MealType[]; category: DishCategory }) {
    await db.dishes.add(dish);
    await loadData();
  }
```

- [ ] **Step 5: Run default add test**

Run: `npm test -- src/App.test.tsx -t "adds a new dish"`

Expected: PASS.

- [ ] **Step 6: Add validation test for zero meal types**

Add this test to `src/App.test.tsx`:

```ts
  test('does not add a dish when no meal type is selected', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '菜品設定' }));

    fireEvent.change(screen.getByPlaceholderText('例如：番茄炒蛋'), { target: { value: '清炒青菜' } });
    fireEvent.click(screen.getByLabelText('晚餐'));

    expect(screen.getByText('至少選一個餐別')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '新增' })).toBeDisabled();
    expect(mockState.dishesAdd).not.toHaveBeenCalled();
  });
```

- [ ] **Step 7: Run validation test**

Run: `npm test -- src/App.test.tsx -t "does not add a dish"`

Expected: PASS.

- [ ] **Step 8: Update old heading expectations**

In `src/App.test.tsx`, replace all heading expectations for `新增菜` with `新增菜品`.

- [ ] **Step 9: Run full tests**

Run: `npm test`

Expected: PASS or only failures for list/edit functionality not implemented yet.

- [ ] **Step 10: Commit**

Run:

```bash
git add src/components/DishForm.tsx src/App.tsx src/App.test.tsx
git commit -m "feat: add dish metadata form"
```

---

### Task 3: Search and Filter Dish List

**Files:**
- Modify: `src/components/DishList.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Add list search and filter tests**

In `src/App.test.tsx`, change `beforeEach` so it resets `mockState.dishesData`:

```ts
  beforeEach(() => {
    mockState.dishesData = [
      { id: 1, name: '番茄炒蛋', mealTypes: ['dinner'], category: 'uncategorized' },
      { id: 2, name: '早餐蛋餅', mealTypes: ['breakfast'], category: 'vegetable' },
      { id: 3, name: '玉米濃湯', mealTypes: ['lunch', 'dinner'], category: 'soup' },
      { id: 4, name: '紅燒牛肉', mealTypes: ['dinner'], category: 'meat' },
    ];
    mockState.weeklyPlansData = [];
    mockState.mealSettingsData = [];
    vi.clearAllMocks();
  });
```

Add this test:

```ts
  test('searches dishes by name', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '菜品設定' }));

    fireEvent.change(screen.getByPlaceholderText('搜尋菜名'), { target: { value: '湯' } });

    expect(screen.getByText('玉米濃湯')).toBeInTheDocument();
    expect(screen.queryByText('番茄炒蛋')).not.toBeInTheDocument();
    expect(screen.queryByText('早餐蛋餅')).not.toBeInTheDocument();
  });

  test('filters dishes by meal type and category', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '菜品設定' }));

    fireEvent.change(screen.getByLabelText('餐別篩選'), { target: { value: 'dinner' } });
    fireEvent.change(screen.getByLabelText('分類篩選'), { target: { value: 'soup' } });

    expect(screen.getByText('玉米濃湯')).toBeInTheDocument();
    expect(screen.queryByText('紅燒牛肉')).not.toBeInTheDocument();
    expect(screen.queryByText('早餐蛋餅')).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/App.test.tsx -t "searches dishes|filters dishes"`

Expected: FAIL because search/filter controls do not exist.

- [ ] **Step 3: Replace `DishList.tsx` with searchable/filterable list**

Replace `src/components/DishList.tsx` with:

```tsx
import { useMemo, useState } from 'react';
import type { Dish, DishCategory, MealType } from '../db';
import { DISH_CATEGORIES } from './DishForm';
import { MEAL_TYPES } from '../planner';

type MealFilter = MealType | 'all';
type CategoryFilter = DishCategory | 'all';

type DishListProps = {
  dishes: Dish[];
  onDeleteDish: (id: number) => Promise<void>;
};

function mealLabel(value: MealType) {
  return MEAL_TYPES.find((mealType) => mealType.value === value)?.label ?? value;
}

function categoryLabel(value: DishCategory) {
  return DISH_CATEGORIES.find((category) => category.value === value)?.label ?? value;
}

export function DishList({ dishes, onDeleteDish }: DishListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [mealFilter, setMealFilter] = useState<MealFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

  const filteredDishes = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return dishes.filter((dish) => {
      const matchesSearch = normalizedSearch.length === 0 || dish.name.toLowerCase().includes(normalizedSearch);
      const matchesMeal = mealFilter === 'all' || dish.mealTypes.includes(mealFilter);
      const matchesCategory = categoryFilter === 'all' || dish.category === categoryFilter;
      return matchesSearch && matchesMeal && matchesCategory;
    });
  }, [categoryFilter, dishes, mealFilter, searchTerm]);

  return (
    <section className="card">
      <h2>菜品列表</h2>
      <div className="list-filters">
        <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="搜尋菜名" />
        <label className="field compact-field">
          <span>餐別篩選</span>
          <select value={mealFilter} onChange={(event) => setMealFilter(event.target.value as MealFilter)} aria-label="餐別篩選">
            <option value="all">全部餐別</option>
            {MEAL_TYPES.map((mealType) => (
              <option key={mealType.value} value={mealType.value}>
                {mealType.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field compact-field">
          <span>分類篩選</span>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value as CategoryFilter)}
            aria-label="分類篩選"
          >
            <option value="all">全部分類</option>
            {DISH_CATEGORIES.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {dishes.length === 0 ? (
        <p className="muted">還沒有菜，先新增幾道會做的菜。</p>
      ) : filteredDishes.length === 0 ? (
        <p className="muted">找不到符合條件的菜品。</p>
      ) : (
        <ul className="dish-list">
          {filteredDishes.map((dish) => (
            <li key={dish.id} className="dish-item">
              <div className="dish-main">
                <strong>{dish.name}</strong>
                <div className="tag-row">
                  {dish.mealTypes.map((mealType) => (
                    <span key={mealType} className="tag">
                      {mealLabel(mealType)}
                    </span>
                  ))}
                  <span className="tag category-tag">{categoryLabel(dish.category)}</span>
                </div>
              </div>
              <div className="dish-actions">
                <button type="button">編輯</button>
                <button type="button" className="secondary" onClick={() => dish.id && onDeleteDish(dish.id)}>
                  刪除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run search/filter tests**

Run: `npm test -- src/App.test.tsx -t "searches dishes|filters dishes"`

Expected: PASS.

- [ ] **Step 5: Run full tests**

Run: `npm test`

Expected: Existing tests may fail only where multiple dishes affect weekly-plan expectations. If the weekly generation test sees more dishes, constrain its setup by setting `mockState.dishesData = [{ id: 1, name: '番茄炒蛋', mealTypes: ['dinner'], category: 'uncategorized' }];` inside that test before render.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/components/DishList.tsx src/App.test.tsx
git commit -m "feat: add dish list filters"
```

---

### Task 4: Edit Dish Modal

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/DishList.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Add db mock support for updates and edit test**

In `src/App.test.tsx`, add this mock function after `dishesDelete`:

```ts
  const dishesPut = vi.fn(async (dish: Dish) => {
    mockState.dishesData = mockState.dishesData.map((item) => (item.id === dish.id ? dish : item));
  });
```

Add `dishesPut` to the returned object:

```ts
    dishesPut,
```

Add `put` to the `db.dishes` mock:

```ts
      put: mockState.dishesPut,
```

Add this test:

```ts
  test('edits a dish in a modal', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '菜品設定' }));

    const row = screen.getByText('番茄炒蛋').closest('li')!;
    fireEvent.click(within(row).getByRole('button', { name: '編輯' }));

    const dialog = screen.getByRole('dialog', { name: '編輯菜品' });
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

- [ ] **Step 2: Run edit test to verify it fails**

Run: `npm test -- src/App.test.tsx -t "edits a dish"`

Expected: FAIL because edit button does not open a modal and `App` has no update callback.

- [ ] **Step 3: Update `App.tsx` with update callback**

Add this function after `addDish`:

```ts
  async function updateDish(dish: Dish) {
    await db.dishes.put(dish);
    await loadData();
  }
```

Change the `DishList` usage to:

```tsx
          <DishList dishes={dishes} onDeleteDish={deleteDish} onUpdateDish={updateDish} />
```

- [ ] **Step 4: Add edit modal logic to `DishList.tsx`**

Replace `src/components/DishList.tsx` with:

```tsx
import { FormEvent, useMemo, useState } from 'react';
import type { Dish, DishCategory, MealType } from '../db';
import { MEAL_TYPES } from '../planner';
import { DISH_CATEGORIES } from './DishForm';

type MealFilter = MealType | 'all';
type CategoryFilter = DishCategory | 'all';

type DishListProps = {
  dishes: Dish[];
  onDeleteDish: (id: number) => Promise<void>;
  onUpdateDish: (dish: Dish) => Promise<void>;
};

function mealLabel(value: MealType) {
  return MEAL_TYPES.find((mealType) => mealType.value === value)?.label ?? value;
}

function categoryLabel(value: DishCategory) {
  return DISH_CATEGORIES.find((category) => category.value === value)?.label ?? value;
}

export function DishList({ dishes, onDeleteDish, onUpdateDish }: DishListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [mealFilter, setMealFilter] = useState<MealFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [editingDish, setEditingDish] = useState<Dish | null>(null);
  const [editName, setEditName] = useState('');
  const [editMealTypes, setEditMealTypes] = useState<MealType[]>([]);
  const [editCategory, setEditCategory] = useState<DishCategory>('uncategorized');

  const filteredDishes = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return dishes.filter((dish) => {
      const matchesSearch = normalizedSearch.length === 0 || dish.name.toLowerCase().includes(normalizedSearch);
      const matchesMeal = mealFilter === 'all' || dish.mealTypes.includes(mealFilter);
      const matchesCategory = categoryFilter === 'all' || dish.category === categoryFilter;
      return matchesSearch && matchesMeal && matchesCategory;
    });
  }, [categoryFilter, dishes, mealFilter, searchTerm]);

  const canSave = editName.trim().length > 0 && editMealTypes.length > 0;

  function startEditing(dish: Dish) {
    setEditingDish(dish);
    setEditName(dish.name);
    setEditMealTypes(dish.mealTypes);
    setEditCategory(dish.category);
  }

  function toggleEditMealType(mealType: MealType) {
    setEditMealTypes((current) =>
      current.includes(mealType) ? current.filter((item) => item !== mealType) : [...current, mealType],
    );
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingDish || !canSave) return;

    await onUpdateDish({ ...editingDish, name: editName.trim(), mealTypes: editMealTypes, category: editCategory });
    setEditingDish(null);
  }

  return (
    <section className="card">
      <h2>菜品列表</h2>
      <div className="list-filters">
        <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="搜尋菜名" />
        <label className="field compact-field">
          <span>餐別篩選</span>
          <select value={mealFilter} onChange={(event) => setMealFilter(event.target.value as MealFilter)} aria-label="餐別篩選">
            <option value="all">全部餐別</option>
            {MEAL_TYPES.map((mealType) => (
              <option key={mealType.value} value={mealType.value}>
                {mealType.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field compact-field">
          <span>分類篩選</span>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value as CategoryFilter)}
            aria-label="分類篩選"
          >
            <option value="all">全部分類</option>
            {DISH_CATEGORIES.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {dishes.length === 0 ? (
        <p className="muted">還沒有菜，先新增幾道會做的菜。</p>
      ) : filteredDishes.length === 0 ? (
        <p className="muted">找不到符合條件的菜品。</p>
      ) : (
        <ul className="dish-list">
          {filteredDishes.map((dish) => (
            <li key={dish.id} className="dish-item">
              <div className="dish-main">
                <strong>{dish.name}</strong>
                <div className="tag-row">
                  {dish.mealTypes.map((mealType) => (
                    <span key={mealType} className="tag">
                      {mealLabel(mealType)}
                    </span>
                  ))}
                  <span className="tag category-tag">{categoryLabel(dish.category)}</span>
                </div>
              </div>
              <div className="dish-actions">
                <button type="button" onClick={() => startEditing(dish)}>
                  編輯
                </button>
                <button type="button" className="secondary" onClick={() => dish.id && onDeleteDish(dish.id)}>
                  刪除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

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
    </section>
  );
}
```

- [ ] **Step 5: Run edit test**

Run: `npm test -- src/App.test.tsx -t "edits a dish"`

Expected: PASS.

- [ ] **Step 6: Run full tests**

Run: `npm test`

Expected: PASS except style tests if CSS selectors need new rules in Task 5.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/App.tsx src/components/DishList.tsx src/App.test.tsx
git commit -m "feat: edit dishes in modal"
```

---

### Task 5: Dish Management Styling

**Files:**
- Modify: `src/App.css`
- Modify: `src/app-style.test.ts`

- [ ] **Step 1: Add style regression test for modal and tags**

Add this test to `src/app-style.test.ts`:

```ts
  test('includes dish management modal and tag styles', () => {
    expect(css).toContain('.modal-backdrop');
    expect(css).toContain('.modal-card');
    expect(css).toContain('.tag-row');
    expect(css).toContain('.category-tag');
    expect(css).toContain('.list-filters');
  });
```

- [ ] **Step 2: Run style test to verify it fails**

Run: `npm test -- src/app-style.test.ts -t "dish management modal"`

Expected: FAIL because the CSS classes do not exist yet.

- [ ] **Step 3: Update base form element styles**

In `src/App.css`, change:

```css
button,
input {
  font: inherit;
}
```

to:

```css
button,
input,
select {
  font: inherit;
}
```

Change:

```css
input {
  border: 1px solid #fed7aa;
  border-radius: 10px;
  flex: 1;
  min-width: 0;
  padding: 0.75rem 1rem;
}
```

to:

```css
input,
select {
  border: 1px solid #fed7aa;
  border-radius: 10px;
  min-width: 0;
  padding: 0.75rem 1rem;
}

input {
  flex: 1;
}
```

Add after `button.secondary`:

```css
button.neutral {
  background: #f3f4f6;
  color: #374151;
}
```

- [ ] **Step 4: Add dish management CSS**

Add after `.muted`:

```css
.dish-form,
.field,
.option-group {
  display: grid;
  gap: 0.75rem;
}

.field span,
.option-group legend {
  color: #9a3412;
  font-weight: 700;
}

.compact-field {
  gap: 0.35rem;
}

.option-group {
  border: 0;
  margin: 0;
  padding: 0;
}

.option-row,
.tag-row,
.dish-actions,
.modal-actions,
.list-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.choice-chip,
.tag {
  align-items: center;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 999px;
  display: inline-flex;
  gap: 0.35rem;
  padding: 0.45rem 0.7rem;
}

.form-error {
  color: #b91c1c;
  margin: 0;
}

.category-tag {
  background: #ffedd5;
  color: #9a3412;
  font-weight: 700;
}

.list-filters {
  margin-bottom: 1rem;
}

.list-filters input {
  min-width: 12rem;
}

.dish-item {
  gap: 0.75rem;
}

.dish-main {
  display: grid;
  gap: 0.45rem;
}

.modal-backdrop {
  align-items: center;
  background: rgb(31 41 55 / 0.45);
  bottom: 0;
  display: flex;
  justify-content: center;
  left: 0;
  padding: 1rem;
  position: fixed;
  right: 0;
  top: 0;
  z-index: 10;
}

.modal-card {
  background: white;
  border-radius: 18px;
  box-shadow: 0 24px 60px rgb(31 41 55 / 0.25);
  display: grid;
  gap: 1rem;
  max-width: 520px;
  padding: 1rem;
  width: min(100%, 520px);
}

.modal-actions {
  justify-content: flex-end;
}
```

- [ ] **Step 5: Adjust mobile styles**

In the existing `@media (max-width: 560px)` block, change:

```css
  .row,
  .section-heading {
    align-items: stretch;
    flex-direction: column;
  }
```

to:

```css
  .row,
  .section-heading,
  .dish-actions,
  .modal-actions,
  .list-filters {
    align-items: stretch;
    flex-direction: column;
  }
```

Change:

```css
  .section-heading button,
  .row button {
    width: 100%;
  }
```

to:

```css
  .section-heading button,
  .row button,
  .dish-actions button,
  .modal-actions button {
    width: 100%;
  }
```

- [ ] **Step 6: Run style test**

Run: `npm test -- src/app-style.test.ts -t "dish management modal"`

Expected: PASS.

- [ ] **Step 7: Run full tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add src/App.css src/app-style.test.ts
git commit -m "feat: style dish management UI"
```

---

### Task 6: Build and Browser Verification

**Files:**
- No source edits expected unless verification finds a defect.

- [ ] **Step 1: Run production build**

Run: `npm run build`

Expected: PASS with TypeScript and Vite build output.

- [ ] **Step 2: Start dev server**

Run: `npm run dev`

Expected: Vite starts and prints a local URL.

- [ ] **Step 3: Verify UI manually in browser**

Open the local Vite URL and verify:

1. Go to `菜品設定`.
2. Confirm `新增菜品` shows name input, three meal checkboxes, four category radios, and default dinner/uncategorized.
3. Add `香煎雞腿` with dinner/meat.
4. Add `玉米濃湯` with lunch + dinner/soup.
5. Search `湯` and confirm only `玉米濃湯` remains.
6. Filter meal type to `晚餐` and category to `湯`; confirm `玉米濃湯` remains.
7. Click edit on `玉米濃湯`, rename it to `雞蓉玉米湯`, save, and confirm modal closes and row updates.
8. Edit again, uncheck all meal types, and confirm save is disabled and `至少選一個餐別` appears.
9. Cancel the modal and confirm no changes are saved.
10. Delete one test dish and confirm it disappears.

- [ ] **Step 4: Fix any verification defects with tests first**

If a defect is found, add or update the relevant test in `src/App.test.tsx` or `src/app-style.test.ts`, run it to fail, fix the source file, then rerun the focused test.

- [ ] **Step 5: Run final test suite**

Run: `npm test && npm run build`

Expected: PASS.

- [ ] **Step 6: Commit verification fixes if any**

If Step 4 changed files, run:

```bash
git add src/App.tsx src/components/DishForm.tsx src/components/DishList.tsx src/App.css src/App.test.tsx src/app-style.test.ts src/db.ts src/db.test.ts
git commit -m "fix: polish dish management flow"
```

If Step 4 did not change files, do not create an empty commit.

---

## Self-Review

- Spec coverage: data model, migration defaults, add form defaults, required meal type validation, category single-select, search, meal/category filters, edit modal, tests, and no routing changes are covered.
- Placeholder scan: no placeholders, TBDs, or generic implementation-only steps remain.
- Type consistency: `DishCategory`, `MealType`, `mealTypes`, `category`, `onAddDish`, `onUpdateDish`, `DISH_CATEGORIES`, and test mock names are consistent across tasks.
