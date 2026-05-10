# 本週菜單智慧排菜設計

## 背景

`本週菜單` 頁的「產生本週菜單」目前已能依排餐設定（菜/肉/湯）從菜品列表中隨機挑選排出菜單，但有兩個問題：

- 同一道菜可能在本週內被排到多餐，造成重複。
- `Dish.lastCookedAt` 欄位存在卻從未被使用，無法做菜色輪替。

這次改版要讓排菜更貼近使用者的初衷——「幫我選出本週要煮什麼」——同時保留隨機因素。

## 目標

- 一道菜在本週菜單內最多出現 1 次。
- 排菜時優先挑選「最久沒煮過」的菜品（含從未煮過的，視為最舊）。
- 平手時以隨機決定，保留原本「驚喜感」。
- 按下「產生本週菜單」時，被選中菜品的 `lastCookedAt` 自動更新為當下時間。
- 修掉現有 `shuffle` 的 bias（`Math.random() - 0.5` 的非均勻分布）。

## 非目標

- 不新增「我真的煮了」的手動勾選 UI；`lastCookedAt` 只在產生菜單時更新。
- 不調整 `本週菜單` 頁的呈現方式。
- 不調整 `菜品設定` 與 `排餐設定` 頁的 UI 與資料模型。
- 不改 IndexedDB schema（`lastCookedAt` 欄位已存在）。
- 不做 backtracking 求最大填滿率；候選不足時直接留 `尚未安排`。

## 排菜演算法

### 規則

1. 依現有 settings 順序展開 slots：星期一 → 星期日，breakfast → lunch → dinner，分類順序 vegetable → meat → soup。
2. 維護 `usedDishIds: Set<number>` 紀錄本週已被排上的菜品。
3. 對每個 slot，候選池為：
   - **早餐**：`mealTypes` 包含 `breakfast` 且 `category === 'uncategorized'` 的菜品。
   - **午餐 / 晚餐**：`mealTypes` 包含該餐別且 `category` 等於該 slot 分類的菜品。
   - 並從候選池中扣除已在 `usedDishIds` 內的菜品。
4. 從候選池中挑選排序鍵最小的菜品：
   - 主鍵：`lastCookedAt ?? -Infinity` 升冪（`undefined` 視為最舊）。
   - 平手鍵：隨機數，使每筆候選擁有獨立隨機 key 後一次排序，避免 `Math.random() - 0.5` 的 bias。
5. 候選池為空 → 該 slot 不帶 `dishId`，UI 顯示 `尚未安排`。
6. 候選不為空 → 取首位，加入 `usedDishIds`，寫入該 slot。

### 「先到先選」順序的後果

如果某分類的可用菜品數量小於本週需求，先排到的 meal 會拿到菜，後排到的 meal 會留空。這是可接受的 trade-off，符合使用者已選的「本週完全不重複，菜不夠就留空」原則。

## 模組邊界

### `src/planner.ts`

新增純函式：

```ts
export function pickDishesForWeek(
  dishes: PlannerDish[],
  settings: MealSetting[],
  now: number,
): {
  plans: WeeklyPlan[];
  pickedDishIds: number[];
};
```

- `now` 由呼叫端注入，方便測試以 fake timers 控制。
- 函式為純函式，不存取 IndexedDB。
- `pickedDishIds` 只包含確實被排上的菜品 id，留空的 slot 不算。

`generateWeeklyPlans` 保留為 thin wrapper：

```ts
export function generateWeeklyPlans(dishes, settings) {
  return pickDishesForWeek(dishes, settings, Date.now()).plans;
}
```

讓既有 import 與測試不需要全面改寫。

修掉 shuffle bias：候選池排序時，每筆候選一次性產生 random key 後排序（穩定可預測），不再用 `sort(() => Math.random() - 0.5)`。

### `src/App.tsx`

`generatePlans` 改為：

1. 呼叫 `pickDishesForWeek(dishes, mealSettings, Date.now())`。
2. 在單一 `db.transaction('rw', db.weeklyPlans, db.dishes, ...)` 中：
   - `db.weeklyPlans.clear()`
   - `db.weeklyPlans.bulkAdd(plans)`
   - 對 `pickedDishIds` 中的每筆 dish 執行 `db.dishes.update(id, { lastCookedAt: now })`。
3. `await loadData()`。

### `src/components/WeeklyPlanner.tsx`

UI 不變。

## 測試計畫

### `src/planner.test.ts`

- **本週去重**：5 道蔬菜，晚餐每天 2 菜共 10 個 slots → 5 道菜各出現 1 次，剩餘 5 個 slot 留空。
- **lastCookedAt 輪替**：3 道蔬菜 A/B/C，A 最舊 → 1 菜 slot 必選 A；把 A 改成最新後再排 → 必選 B。
- **平手隨機**：3 道蔬菜全是 `undefined` lastCookedAt；以 `vi.spyOn(Math, 'random')` 控制不同回傳值，驗證每道菜都有機會被選中。
- **新菜永遠優先**：1 道蔬菜有 lastCookedAt、1 道沒有 → 必選沒有 lastCookedAt 的。
- **早餐維持規則**：早餐只挑 `uncategorized` + 含 breakfast；本週去重同樣適用早餐。
- **跨餐去重**：午餐 1 菜 + 晚餐 1 菜、同分類只有 1 道菜可用 → 一餐拿到、另一餐留空。
- **`pickDishesForWeek` 回傳 pickedDishIds**：只包含真的被排上的 dish id。

### `src/App.test.tsx`

- **產生菜單後寫回 lastCookedAt**：以 `vi.useFakeTimers()` 控制時間，按下「產生本週菜單」後，被排上的菜品在 db 裡 `lastCookedAt` 等於 mock 時間；未被排上的菜品保持原值。
- **重新產生會輪替**：先產生一次再產生第二次，第二次優先排上第一次沒被選到的菜品。

### 手動驗證

- `npm run dev` 後新增足夠菜品，連續按「產生本週菜單」幾次，觀察輪替與隨機是否符合直覺。
- `npm run build` 通過 TypeScript 檢查。

## 實作邊界

- 沿用既有 React、Dexie、Vitest、Testing Library 技術棧。
- 不新增任何外部依賴。
- 不改 IndexedDB schema。
