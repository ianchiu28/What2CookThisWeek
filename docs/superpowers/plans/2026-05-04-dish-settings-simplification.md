# Dish Settings Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the `菜品設定` tab so the dish list is the primary visual focus while preserving add, edit, search, and filter capabilities.

**Architecture:** Keep the existing React tab architecture and move add-dish UI state into `DishList`, which already owns list filters and edit modal state. Reuse `DishForm` as a modal-safe form by making its wrapper class/title configurable, while `App.tsx` continues to own persistence callbacks.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Testing Library, CSS.

---

## File Structure

- Modify `src/App.tsx`: stop rendering the standalone add form and pass `onAddDish` into `DishList`.
- Modify `src/components/DishForm.tsx`: allow reuse inside the add modal without forcing a card wrapper.
- Modify `src/components/DishList.tsx`: add add modal state, collapsed filter panel, compact metadata line, and icon buttons.
- Modify `src/App.css`: replace large tag/button list styling with compact row, toolbar, filter panel, metadata, and icon button styling.
- Modify `src/App.test.tsx`: update behavior tests for add modal, hidden filters by default, active filter count, icon labels, and compact page structure.
- Modify `src/app-style.test.ts`: update CSS regression expectations from large tags to compact metadata/icon/filter styles.

---

### Task 1: Move Add Dish Into Modal

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/DishForm.tsx`
- Modify: `src/components/DishList.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Update tests for add modal behavior**

In `src/App.test.tsx`, replace the `switches between bottom tabs` test with:

```ts
  test('shows dish list as the primary dish management view', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: '本週菜單' });

    fireEvent.click(screen.getByRole('button', { name: '菜品設定' }));

    expect(screen.getByRole('heading', { name: '菜品列表' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '新增' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: '新增菜品' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '排餐設定' }));
    expect(screen.getByRole('heading', { name: '排餐設定' })).toBeInTheDocument();
  });
```

Replace the `adds a new dish with dinner and uncategorized defaults` test with:

```ts
  test('adds a new dish from a modal with dinner and uncategorized defaults', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '菜品設定' }));
    fireEvent.click(screen.getByRole('button', { name: '新增' }));

    const dialog = screen.getByRole('dialog', { name: '新增菜品' });
    fireEvent.change(within(dialog).getByPlaceholderText('例如：番茄炒蛋'), { target: { value: '香煎雞腿' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '新增' }));

    await waitFor(() => expect(mockState.dishesAdd).toHaveBeenCalledTimes(1));
    expect(mockState.dishesAdd).toHaveBeenCalledWith({
      name: '香煎雞腿',
      mealTypes: ['dinner'],
      category: 'uncategorized',
    });
    expect(screen.queryByRole('dialog', { name: '新增菜品' })).not.toBeInTheDocument();
  });
```

Replace the `does not add a dish when no meal type is selected` test with:

```ts
  test('does not add a dish from the modal when no meal type is selected', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '菜品設定' }));
    fireEvent.click(screen.getByRole('button', { name: '新增' }));

    const dialog = screen.getByRole('dialog', { name: '新增菜品' });
    fireEvent.change(within(dialog).getByPlaceholderText('例如：番茄炒蛋'), { target: { value: '清炒青菜' } });
    fireEvent.click(within(dialog).getByLabelText('晚餐'));

    expect(within(dialog).getByText('至少選一個餐別')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '新增' })).toBeDisabled();
    expect(mockState.dishesAdd).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run add modal tests to verify they fail**

Run: `npm test -- src/App.test.tsx -t "dish list as the primary|adds a new dish from a modal|does not add a dish from the modal"`

Expected: FAIL because `DishForm` is still rendered as a standalone card and no add modal exists.

- [ ] **Step 3: Make `DishForm` reusable inside a modal**

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
  className?: string;
  onCancel?: () => void;
};

export function DishForm({ onAddDish, className = 'card dish-form', onCancel }: DishFormProps) {
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
    <form className={className} onSubmit={handleSubmit}>
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

      <div className="modal-actions">
        {onCancel && (
          <button type="button" className="neutral" onClick={onCancel}>
            取消
          </button>
        )}
        <button type="submit" disabled={!canSubmit}>
          新增
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Move add modal into `DishList`**

In `src/components/DishList.tsx`, change the import from:

```ts
import { DISH_CATEGORIES } from './DishForm';
```

to:

```ts
import { DISH_CATEGORIES, DishForm } from './DishForm';
```

Change `DishListProps` to:

```ts
type DishListProps = {
  dishes: Dish[];
  onAddDish: (dish: { name: string; mealTypes: MealType[]; category: DishCategory }) => Promise<void>;
  onDeleteDish: (id: number) => Promise<void>;
  onUpdateDish: (dish: Dish) => Promise<void>;
};
```

Change the function signature to:

```ts
export function DishList({ dishes, onAddDish, onDeleteDish, onUpdateDish }: DishListProps) {
```

Add this state after `editingDish`:

```ts
  const [isAddingDish, setIsAddingDish] = useState(false);
```

Add this function before `handleEditSubmit`:

```ts
  async function handleAddDish(dish: { name: string; mealTypes: MealType[]; category: DishCategory }) {
    await onAddDish(dish);
    setIsAddingDish(false);
  }
```

Replace the opening heading area:

```tsx
      <h2>菜品列表</h2>
```

with:

```tsx
      <div className="section-heading">
        <h2>菜品列表</h2>
        <button type="button" onClick={() => setIsAddingDish(true)}>
          新增
        </button>
      </div>
```

Add this modal block before `{editingDish && (`:

```tsx
      {isAddingDish && (
        <div className="modal-backdrop">
          <div className="modal-card" role="dialog" aria-modal="true" aria-label="新增菜品">
            <DishForm className="dish-form" onAddDish={handleAddDish} onCancel={() => setIsAddingDish(false)} />
          </div>
        </div>
      )}
```

- [ ] **Step 5: Stop rendering standalone `DishForm` from `App.tsx`**

In `src/App.tsx`, remove:

```ts
import { DishForm } from './components/DishForm';
```

Replace:

```tsx
      {activeTab === 'dishes' && (
        <>
          <DishForm onAddDish={addDish} />
          <DishList dishes={dishes} onDeleteDish={deleteDish} onUpdateDish={updateDish} />
        </>
      )}
```

with:

```tsx
      {activeTab === 'dishes' && <DishList dishes={dishes} onAddDish={addDish} onDeleteDish={deleteDish} onUpdateDish={updateDish} />}
```

- [ ] **Step 6: Run add modal tests**

Run: `npm test -- src/App.test.tsx -t "dish list as the primary|adds a new dish from a modal|does not add a dish from the modal"`

Expected: PASS.

- [ ] **Step 7: Run full test suite**

Run: `npm test`

Expected: Some filter/icon tests may still fail until later tasks update behavior.

---

### Task 2: Collapse Filters Behind a Filter Button

**Files:**
- Modify: `src/components/DishList.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Update filter tests**

Replace the `filters dishes by meal type and category` test in `src/App.test.tsx` with:

```ts
  test('hides filters by default and applies filters from the filter panel', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '菜品設定' }));

    expect(screen.getByPlaceholderText('搜尋菜名')).toBeInTheDocument();
    expect(screen.queryByLabelText('餐別篩選')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('分類篩選')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '篩選' }));
    fireEvent.change(screen.getByLabelText('餐別篩選'), { target: { value: 'dinner' } });
    fireEvent.change(screen.getByLabelText('分類篩選'), { target: { value: 'soup' } });

    expect(screen.getByRole('button', { name: '篩選 · 2' })).toBeInTheDocument();
    expect(screen.getByText('玉米濃湯')).toBeInTheDocument();
    expect(screen.queryByText('紅燒牛肉')).not.toBeInTheDocument();
    expect(screen.queryByText('早餐蛋餅')).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run filter test to verify it fails**

Run: `npm test -- src/App.test.tsx -t "hides filters by default"`

Expected: FAIL because filter selects are visible by default and no `篩選` toggle exists.

- [ ] **Step 3: Add collapsed filter panel state and active count**

In `src/components/DishList.tsx`, add this state after `categoryFilter`:

```ts
  const [showFilters, setShowFilters] = useState(false);
```

Add this derived value after `canSave`:

```ts
  const activeFilterCount = Number(mealFilter !== 'all') + Number(categoryFilter !== 'all');
```

- [ ] **Step 4: Replace filter markup**

Replace the whole `<div className="list-filters">...</div>` block with:

```tsx
      <div className="list-toolbar">
        <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="搜尋菜名" />
        <button type="button" className="neutral compact-button" onClick={() => setShowFilters((current) => !current)}>
          {activeFilterCount > 0 ? `篩選 · ${activeFilterCount}` : '篩選'}
        </button>
      </div>

      {showFilters && (
        <div className="filter-panel">
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
      )}
```

- [ ] **Step 5: Run filter test**

Run: `npm test -- src/App.test.tsx -t "hides filters by default"`

Expected: PASS.

- [ ] **Step 6: Run search test**

Run: `npm test -- src/App.test.tsx -t "searches dishes by name"`

Expected: PASS.

---

### Task 3: Compact Rows and Icon Buttons

**Files:**
- Modify: `src/components/DishList.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Add compact row and icon button test**

Add this test after the search test in `src/App.test.tsx`:

```ts
  test('shows compact dish metadata and icon actions', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '菜品設定' }));

    const row = screen.getByText('玉米濃湯').closest('li')!;

    expect(within(row).getByText('午餐、晚餐 · 湯')).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: '編輯 玉米濃湯' })).toHaveTextContent('✎');
    expect(within(row).getByRole('button', { name: '刪除 玉米濃湯' })).toHaveTextContent('×');
  });
```

- [ ] **Step 2: Run compact row test to verify it fails**

Run: `npm test -- src/App.test.tsx -t "compact dish metadata"`

Expected: FAIL because rows still use tag elements and text button labels.

- [ ] **Step 3: Add metadata formatter**

In `src/components/DishList.tsx`, add this helper after `categoryLabel`:

```ts
function dishMetadata(dish: Dish) {
  return `${dish.mealTypes.map(mealLabel).join('、')} · ${categoryLabel(dish.category)}`;
}
```

- [ ] **Step 4: Replace row metadata and action buttons**

Replace this block:

```tsx
                <div className="tag-row">
                  {dish.mealTypes.map((mealType) => (
                    <span key={mealType} className="tag">
                      {mealLabel(mealType)}
                    </span>
                  ))}
                  <span className="tag category-tag">{categoryLabel(dish.category)}</span>
                </div>
```

with:

```tsx
                <span className="dish-metadata">{dishMetadata(dish)}</span>
```

Replace this block:

```tsx
                <button type="button" onClick={() => startEditing(dish)}>
                  編輯
                </button>
                <button type="button" className="secondary" onClick={() => dish.id && onDeleteDish(dish.id)}>
                  刪除
                </button>
```

with:

```tsx
                <button type="button" className="icon-button" aria-label={`編輯 ${dish.name}`} onClick={() => startEditing(dish)}>
                  ✎
                </button>
                <button
                  type="button"
                  className="icon-button danger-icon-button"
                  aria-label={`刪除 ${dish.name}`}
                  onClick={() => dish.id && onDeleteDish(dish.id)}
                >
                  ×
                </button>
```

- [ ] **Step 5: Update edit test to use icon label**

In `src/App.test.tsx`, replace this line in the edit test:

```ts
    fireEvent.click(within(row).getByRole('button', { name: '編輯' }));
```

with:

```ts
    fireEvent.click(within(row).getByRole('button', { name: '編輯 番茄炒蛋' }));
```

- [ ] **Step 6: Add delete icon behavior test**

Add this test after the edit test:

```ts
  test('deletes a dish from the icon button', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '菜品設定' }));

    const row = screen.getByText('紅燒牛肉').closest('li')!;
    fireEvent.click(within(row).getByRole('button', { name: '刪除 紅燒牛肉' }));

    await waitFor(() => expect(mockState.dishesDelete).toHaveBeenCalledWith(4));
  });
```

- [ ] **Step 7: Run compact/icon tests**

Run: `npm test -- src/App.test.tsx -t "compact dish metadata|edits a dish|deletes a dish"`

Expected: PASS.

---

### Task 4: Simplified Styling

**Files:**
- Modify: `src/App.css`
- Modify: `src/app-style.test.ts`

- [ ] **Step 1: Replace CSS regression test**

In `src/app-style.test.ts`, replace the `includes dish management modal and tag styles` test with:

```ts
  test('includes simplified dish management styles', () => {
    expect(css).toContain('.list-toolbar');
    expect(css).toContain('.filter-panel');
    expect(css).toContain('.dish-metadata');
    expect(css).toContain('.icon-button');
    expect(css).toContain('.compact-button');
    expect(css).not.toContain('.category-tag');
  });
```

- [ ] **Step 2: Run style test to verify it fails**

Run: `npm test -- src/app-style.test.ts -t "simplified dish management"`

Expected: FAIL because new compact styles do not exist and `.category-tag` still exists.

- [ ] **Step 3: Replace filter/tag CSS with compact styles**

In `src/App.css`, replace:

```css
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
```

with:

```css
.option-row,
.dish-actions,
.modal-actions,
.list-toolbar,
.filter-panel {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.choice-chip {
  align-items: center;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 999px;
  display: inline-flex;
  gap: 0.35rem;
  padding: 0.45rem 0.7rem;
}
```

Delete these blocks:

```css
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
```

Add after `.form-error`:

```css
.list-toolbar {
  align-items: center;
  margin: 1rem 0 0.75rem;
}

.list-toolbar input {
  min-width: 12rem;
}

.filter-panel {
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 14px;
  margin-bottom: 0.75rem;
  padding: 0.75rem;
}

.compact-button {
  padding: 0.65rem 0.85rem;
}

.dish-metadata {
  color: #9a3412;
  font-size: 0.82rem;
}

.icon-button {
  align-items: center;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 999px;
  color: #9a3412;
  display: inline-flex;
  height: 2rem;
  justify-content: center;
  padding: 0;
  width: 2rem;
}

.danger-icon-button {
  background: #fff1f2;
  border-color: #fecdd3;
  color: #be123c;
}
```

- [ ] **Step 4: Update mobile styles**

In the `@media (max-width: 560px)` block, replace `.list-filters` with `.list-toolbar` in the flex-direction rule:

```css
  .row,
  .section-heading,
  .dish-actions,
  .modal-actions,
  .list-toolbar {
    align-items: stretch;
    flex-direction: column;
  }
```

Do not add `.icon-button` to the full-width button rule; icon buttons should remain compact.

- [ ] **Step 5: Run style test**

Run: `npm test -- src/app-style.test.ts -t "simplified dish management"`

Expected: PASS.

- [ ] **Step 6: Run full tests**

Run: `npm test`

Expected: PASS.

---

### Task 5: Build and Verification

**Files:**
- No source edits expected unless verification finds a defect.

- [ ] **Step 1: Run final test and build command**

Run: `npm test && npm run build`

Expected: PASS with 0 failed tests and Vite production build success.

- [ ] **Step 2: Start or reuse dev server**

Run: `npm run dev`

Expected: Vite starts and prints a local URL. If an existing dev server is already running, use that local URL instead.

- [ ] **Step 3: Manual browser verification**

Open the local Vite URL and verify:

1. `菜品設定` initially shows one card focused on `菜品列表`.
2. The add form is not visible by default.
3. Search input and `篩選` button are visible.
4. Meal/category selects are hidden until `篩選` is clicked.
5. Applying two filters changes the button text to `篩選 · 2`.
6. Dish rows show compact metadata text instead of large tags.
7. Edit/delete actions are compact icon buttons.
8. Clicking `新增` opens `新增菜品` modal.
9. Adding a dish closes the modal and updates the list.
10. Editing and deleting still work.

- [ ] **Step 4: If a defect is found, add a failing test first**

If manual verification finds a defect, add or update a focused test in `src/App.test.tsx` or `src/app-style.test.ts`, run it to fail, fix the source, and rerun the focused test.

- [ ] **Step 5: Run final verification again after any fixes**

Run: `npm test && npm run build`

Expected: PASS.

---

## Execution Notes

The user has previously requested no commits during execution. When executing this plan for this user, skip all commit actions even if an execution skill suggests commits.

## Self-Review

- Spec coverage: add modal, list-first layout, compact metadata, icon buttons, visible search, collapsed filters, active filter count, and unchanged filter semantics are covered.
- Placeholder scan: no placeholders, TBDs, or vague implementation steps remain.
- Type consistency: `Dish`, `DishCategory`, `MealType`, `onAddDish`, `onUpdateDish`, `DISH_CATEGORIES`, `MealFilter`, and `CategoryFilter` are used consistently across tasks.
