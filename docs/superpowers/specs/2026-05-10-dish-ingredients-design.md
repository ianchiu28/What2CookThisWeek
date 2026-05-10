# Dish Ingredients & Shopping List — Design

**Date:** 2026-05-10
**Status:** Approved (brainstorming)

## Goal

讓使用者在「菜品設定」中為每道菜記錄材料，並在「本週菜單」中顯示每道菜的材料；同時提供一鍵彙整本週採買清單，可複製到剪貼簿。

## Non-Goals

- 不做材料分類（蔬菜／肉／調味料等）
- 不做數量／單位（"番茄 2 顆"），只記材料名稱
- 不做跨菜共用的材料庫（每道菜的材料字串獨立儲存）
- 不影響 `planner.ts` 既有的選菜邏輯

## Section 1 — Data Model

### 型別

`src/db.ts` 中的 `Dish` 新增必有欄位：

```ts
export type Dish = {
  id?: number;
  name: string;
  lastCookedAt?: number;
  mealTypes: MealType[];
  category: DishCategory;
  ingredients: string[]; // 新增；空陣列代表沒設材料
};
```

### Dexie schema migration

升到 v5。索引欄位不變，只在 `upgrade` 中為現有 dish 補預設值：

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

`mealSettings`、`weeklyPlans`、`planner.ts` 不變。

### Utility 模組

新增 `src/ingredients.ts`，包含兩個 pure function：

```ts
export function parseIngredients(input: string): string[];
export function aggregateShoppingList(
  plans: WeeklyPlan[],
  dishes: Dish[],
): string[];
```

`parseIngredients`：
- 用正則 `/[\s,，、;；]+/` 切割（涵蓋空白／半形與全形逗號／頓號／半形與全形分號／換行）
- 對每個 token `trim()` 並濾掉空字串
- 依序去重（保留第一次出現的順序）
- 空字串 / 全是分隔符 → `[]`

`aggregateShoppingList`：
- 把 `plans` 中的 `dishId` 映射到 dish，找不到 dish 就忽略該 plan
- 攤平所有 `dish.ingredients`
- 用 `Set` 去重
- 用 `new Intl.Collator('zh-Hant-TW', { collation: 'stroke' }).compare` 排序
- 回傳排好序的字串陣列

## Section 2 — DishForm 輸入

`src/components/DishForm.tsx`：

- `DishFormValue` 新增 `ingredients: string[]`
- `defaultDish` 加 `ingredients: []`
- 內部 state 多一個 `const [ingredientsText, setIngredientsText] = useState('')`
  - 編輯既有菜時，把 `initialDish.ingredients` 用 `'、'` 串成 string 作為初始值
  - 為什麼用 string state（不是 string[]）：使用者打字過程中會有逗號／空白未完成輸入，若每次 onChange 都 split 會干擾游標
- 新增 textarea field（在「分類」欄位下方、`modal-actions` 之上）：

```jsx
<label className="field">
  <span>材料（可選）</span>
  <textarea
    value={ingredientsText}
    onChange={(e) => setIngredientsText(e.target.value)}
    placeholder="用空白、頓號、逗號分開，例如：番茄 蛋 蔥"
    rows={2}
  />
</label>
```

- submit 時呼叫 `parseIngredients(ingredientsText)` 得到 `ingredients`，連同其他欄位丟進 `onSubmitDish`
- 重設表單時把 `ingredientsText` 設回 initial 值

`canSubmit` 條件**不變**（材料是可選的）。

## Section 3 — DishList 顯示

`src/components/DishList.tsx` 不在列表 row 顯示材料（避免擁擠）。要看完整材料就點編輯按鈕。

`dishMetadata()` 不變。

## Section 4 — WeeklyPlanner 顯示

`src/components/WeeklyPlanner.tsx`：

- `dishNames: Map<number, string>` 改成 `dishesById: Map<number, Dish>`
- 菜單 `<li>` 改成兩層結構：

```jsx
<li key={`${plan.day}-${plan.meal}-${plan.slot}`}>
  <span className="dish-name">{dish?.name ?? '尚未安排'}</span>
  {dish && dish.ingredients.length > 0 && (
    <span className="dish-ingredients">{dish.ingredients.join('・')}</span>
  )}
</li>
```

- 在 `App.css` 新增 `.dish-ingredients`：比 `.dish-name` 小一級、顏色淺一階（沿用 `.muted` 風格的灰）、`display: block`

## Section 5 — 採買清單 Modal

### 進入點

`src/components/WeeklyPlanner.tsx` 的 `section-heading`：

```
本週菜單             [採買清單] [產生本週菜單]
```

- 「採買清單」按鈕在「產生本週菜單」左邊
- 沿用次要樣式（`compact-button` 或 `neutral`，依 `App.css` 既有變體選用）
- `weeklyPlans.length === 0` 時 disabled

### 元件

新增 `src/components/ShoppingListModal.tsx`：

```ts
type Props = {
  items: string[]; // 已彙整、排序、去重的材料清單
  onClose: () => void;
};
```

- 沿用 `.modal-backdrop` / `.modal-card`，與 DishList 既有 modal pattern 一致
- `role="dialog" aria-modal="true" aria-label="本週採買清單"`
- 內容：
  - `<h2>本週採買清單</h2>`
  - 若 `items.length === 0`：顯示 `<p className="muted">目前菜單中的菜品都沒有設定材料。</p>`，「複製清單」按鈕 disabled
  - 否則：`<ul>` 一行一個 `<li>`
- `modal-actions`：`[關閉]` 與 `[複製清單]`
- 「複製清單」按鈕：
  - 點擊後呼叫 `navigator.clipboard.writeText(items.join('\n'))`
  - 成功後按鈕文字暫時改為「已複製 ✓」，2 秒後 reset
  - 用 local `useState<'idle' | 'copied'>('idle')` 控制

### 串接

`WeeklyPlanner` 多一個 state `const [showShoppingList, setShowShoppingList] = useState(false)`。彙整在 render 時計算（用 `useMemo`），把結果丟進 modal。

## Section 6 — 測試

### `src/ingredients.test.ts`（新檔）

- `parseIngredients`
  - 空字串、純空白 → `[]`
  - 混合分隔符切割正確（`'番茄、蛋 蔥,薑；蒜\n醬油'` → `['番茄','蛋','蔥','薑','蒜','醬油']`）
  - 連續分隔符不產生空 token
  - 依序去重（`'番茄, 蛋, 番茄'` → `['番茄','蛋']`）
  - 全形逗號／頓號處理正確
- `aggregateShoppingList`
  - 跨 dish 去重
  - 忽略 `dishId` 對不到 dish 的 plan
  - 空 `plans` → `[]`
  - 筆劃排序：用幾個筆劃差異明顯的字驗證（例：`['蛋','一','二']` 經過排序後為 `['一','二','蛋']`）

### `src/App.test.tsx`（既有檔加 1 個 case）

整合測試：
1. 加兩道有重疊材料的菜（A: 番茄・蛋・蔥；B: 番茄・薑）
2. 設定餐別、產生本週菜單
3. 點「採買清單」按鈕 → 看到 modal 出現
4. 驗證 modal 中列出的 `<li>` 共 4 項（番茄、蛋、蔥、薑），且番茄僅出現一次（具體順序由 `Intl.Collator` stroke 排序決定，測試斷言用 set equality 而非順序）
5. 點「複製清單」→ 用 `vi.spyOn(navigator.clipboard, 'writeText')` 驗證有以 `\n` join 的字串被呼叫，且字串切割後集合等於上述 4 項

clipboard 在 jsdom 中需要 mock `navigator.clipboard`：

```ts
Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
```

## Out-of-Scope（未來可能）

- 材料分類／用量
- 材料 autocomplete（從既有材料中提示）
- 採買清單匯出（CSV、分享 Line）
- 已採買打勾持久化
