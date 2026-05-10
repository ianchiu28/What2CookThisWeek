# 排餐設定頁面 UI 翻修 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `MealSettings.tsx` 從目前「checkbox + 數字輸入框」的散裝樣式，改成 spec A2 設計：餐別 pill 即 toggle、數量 chip 內嵌 `<input>` + focus-within 觸發橘框與 mini stepper。

**Architecture:** 純 UI 改寫。`<input type="number">` 永遠存在於每個 chip 內，編輯態用純 CSS `:focus-within` 觸發（無需在 React 裡追蹤 editing state）。Stepper 按鈕透過 `onMouseDown preventDefault` 不搶走 input focus。`MealSettings` props 與 `MealSetting` 資料結構不動。

**Tech Stack:** React 18, TypeScript, vitest, @testing-library/react, vanilla CSS.

**Spec:** `docs/superpowers/specs/2026-05-10-meal-settings-ui-refresh-design.md`

> **使用者特別指示：本 plan 執行期間不要做任何 git commit。**所有 commit step 都標註為「跳過」，但保留檢查點供之後手動整理。

---

## File Structure

- Modify: `src/components/MealSettings.tsx` — 換掉內部 JSX，新增 stepper handler；props 介面不變。
- Modify: `src/App.css` — 在現有檔案內新增 `.meal-pill`、`.count-chip`、`.count-stepper`、`.empty-text` 規則；移除/收斂只在排餐設定使用的舊樣式（`.meal-toggle`、`.count-field`、`.meal-count-panel`、`.meal-setting-main` 在 768px 以下的 grid 寫法）。`.choice-chip` 維持現狀（其他頁面仍在用）。
- Touch: `src/App.test.tsx` — 大部分測試應該能直接通過。新增一個測試確認「餐別關閉時顯示『未安排』」。

---

## Task 1: 新增測試 — 餐別關閉時顯示『未安排』

**Files:**
- Modify: `src/App.test.tsx` (在現有 `describe('Meal settings', ...)` 區塊內新增 test)

- [ ] **Step 1: 在 `App.test.tsx` 找到 `shows meal controls in one row and hides disabled meal options` 測試（約 331 行），於其後新增以下 test**

打開 `src/App.test.tsx`，在 `test('shows meal controls in one row and hides disabled meal options', ...)` 結束的大括號後面、同一個 `describe` 內，貼上：

```tsx
  test('shows 未安排 placeholder for disabled meals on enabled days', async () => {
    mockState.mealSettingsData = [
      mealSetting({ id: 1, day: 0, meal: 'breakfast', enabled: true, vegetableCount: 0 }),
      mealSetting({ id: 2, day: 0, meal: 'lunch', enabled: false, vegetableCount: 0 }),
      mealSetting({ id: 3, day: 0, meal: 'dinner', enabled: true, vegetableCount: 1 }),
    ];

    render(<App />);
    await openMealSettings();

    const monday = screen.getByRole('group', { name: '週一排餐設定' });
    const lunchRow = within(monday).getByRole('group', { name: '週一午餐設定' });

    expect(within(lunchRow).getByText('未安排')).toBeInTheDocument();
    expect(within(lunchRow).queryByLabelText('週一午餐菜數')).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: 執行新測試，確認它失敗**

Run:
```bash
npx vitest run src/App.test.tsx -t "shows 未安排 placeholder"
```

Expected: FAIL — 找不到「未安排」文字（現行 UI 沒有這個 placeholder）。

- [ ] **Step 3: Commit — 跳過（per user request）**

跳過 commit。如要紀錄，可在自己的 working notes 標記「Task 1 完成」。

---

## Task 2: 在 `App.css` 新增 A2 樣式

**Files:**
- Modify: `src/App.css`

- [ ] **Step 1: 在 `App.css` 中找到 `.meal-warning { ... }` 區塊（約 493–498 行），於其後加入新樣式**

打開 `src/App.css`，在 `.meal-warning { ... }` 規則的 `}` 結尾後（約第 498 行），第 499 空行 / `.bottom-tabs` 前面，貼上：

```css
.meal-pill {
  background: #f97316;
  border: 1.5px solid transparent;
  border-radius: 999px;
  color: #fff;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.95rem;
  font-weight: 700;
  padding: 0.4rem 0.95rem;
  transition: background 0.15s ease, color 0.15s ease, opacity 0.15s ease;
}

.meal-pill.off {
  background: transparent;
  border-color: #fed7aa;
  color: #c2855a;
  opacity: 0.7;
}

.meal-pill:focus-visible {
  outline: 2px solid #f97316;
  outline-offset: 2px;
}

.empty-text {
  color: #c2855a;
  font-size: 0.85rem;
  font-weight: 700;
  opacity: 0.7;
}

.meal-row {
  align-items: center;
  display: flex;
  gap: 0.55rem;
  justify-content: space-between;
  padding: 0.5rem 0;
}

.meal-row + .meal-row {
  border-top: 1px dashed #fed7aa;
}

.count-list {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  justify-content: flex-end;
  min-width: 0;
}

.count-chip {
  align-items: center;
  background: #fff;
  border: 1.5px solid #fed7aa;
  border-radius: 999px;
  box-sizing: border-box;
  cursor: text;
  display: inline-flex;
  gap: 0.32rem;
  height: 1.85rem;
  justify-content: center;
  min-width: 2.85rem;
  padding: 0.3rem 0.75rem;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.count-chip .lbl {
  color: #9a3412;
  font-size: 0.88rem;
  font-weight: 700;
}

.count-chip input {
  background: transparent;
  border: 0;
  color: #1f2937;
  font: inherit;
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  outline: none;
  padding: 0;
  text-align: center;
  width: 1.4rem;
  /* hide native spin buttons; we use our own stepper */
  appearance: textfield;
  -moz-appearance: textfield;
}

.count-chip input::-webkit-outer-spin-button,
.count-chip input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.count-chip.zero input {
  color: #c2855a;
}

.count-chip:focus-within {
  border-color: #f97316;
  box-shadow: 0 0 0 3px rgb(249 115 22 / 0.18);
  padding-right: 0.2rem;
}

.count-chip:focus-within.zero input {
  color: #1f2937;
}

.count-stepper {
  display: none;
  flex-direction: column;
  gap: 1px;
  margin-left: 0.05rem;
}

.count-chip:focus-within .count-stepper {
  display: inline-flex;
}

.count-stepper button {
  align-items: center;
  background: #fff7ed;
  border: 0;
  border-radius: 4px;
  color: #9a3412;
  cursor: pointer;
  display: inline-flex;
  font-size: 0.6rem;
  height: 0.72rem;
  justify-content: center;
  line-height: 1;
  padding: 0;
  position: relative;
  width: 1.05rem;
}

.count-stepper button::after {
  content: '';
  inset: -0.4rem -0.5rem;
  position: absolute;
}

.count-stepper button:hover {
  background: #fed7aa;
}

.count-stepper button:disabled {
  color: #fed7aa;
  cursor: default;
}
```

`.count-stepper button::after` 是用透明 pseudo-element 把命中區域擴展到約 `2rem × 1.4rem`，達成 spec 中提到的觸控可達性。

- [ ] **Step 2: 在 `App.css` 中找到 `.count-field input` 區塊（約 486–491 行）並刪除整個 `.count-field` 與 `.count-field input` 規則（約 471–491 行）**

刪除這兩個區塊：

```css
.count-field {
  align-items: center;
  background: white;
  border: 1px solid #fed7aa;
  border-radius: 999px;
  display: inline-flex;
  gap: 0.25rem;
  padding: 0.25rem 0.3rem 0.25rem 0.55rem;
}

.count-field span {
  color: #9a3412;
  font-weight: 700;
}

.count-field input {
  border-radius: 999px;
  padding: 0.3rem 0.35rem;
  text-align: center;
  width: 3.2rem;
}
```

也刪除 `.meal-count-panel` 區塊（約 462–469 行）：

```css
.meal-count-panel {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  justify-content: flex-end;
  min-width: 0;
}
```

也刪除 `.meal-setting-row`、`.meal-setting-main`、`.meal-toggle`（約 432–454 行）。逐塊核對後刪除：

```css
.meal-toggle {
  border-radius: 10px;
  flex: 0 0 auto;
}
```

```css
.meal-setting-row {
  align-items: stretch;
  display: grid;
  gap: 0.45rem;
}
```

```css
.meal-setting-main {
  align-items: center;
  display: grid;
  gap: 0.75rem;
  grid-template-columns: auto minmax(0, 1fr);
  justify-content: space-between;
}
```

**保留** `.meal-summary` 規則（仍用於早餐「固定1樣」文字）：

```css
.meal-summary {
  color: #9a3412;
  font-size: 0.9rem;
  font-weight: 700;
}
```

也保留 `.meal-setting-list`（仍會用作每日的 row container）。

- [ ] **Step 3: 在 `App.css` 中清掉 768px media query 的孤兒規則（約 558–575 行）**

把這幾條過時規則整段刪掉（新版用 flex `space-between` 不需要這些）：

```css
  .meal-setting-main {
    align-items: stretch;
    display: grid;
    grid-template-columns: auto 1fr;
  }

  .meal-summary {
    align-self: center;
    justify-self: end;
  }

  .meal-toggle {
    width: fit-content;
  }
```

`.settings-day-header` 那條規則保留。

- [ ] **Step 4: 確認 CSS 還是可以 build（無 syntax error）**

Run:
```bash
npx vitest run src/app-style.test.ts
```

Expected: PASS（這個 test 大致上只在驗 CSS load，不會破）。如果 fail 訊息是說某個被刪除的 class 找不到，回頭調整 `app-style.test.ts`。

- [ ] **Step 5: Commit — 跳過（per user request）**

---

## Task 3: 改寫 `MealSettings.tsx` — 餐別 Pill

**Files:**
- Modify: `src/components/MealSettings.tsx`

目標：拿掉 `.choice-chip` + `<input type="checkbox">` 的餐別 toggle，改用 `<button>` pill。

- [ ] **Step 1: 開啟 `src/components/MealSettings.tsx`，將整個 JSX return 換成下列版本（保留 imports、helper 函式、props）**

把第 40 行（`return (`）開始到結尾的 JSX 全部替換為：

```tsx
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
            <fieldset
              className={dayEnabled ? 'settings-day' : 'settings-day settings-day-disabled'}
              key={dayName}
              aria-label={`${dayName}排餐設定`}
            >
              <div className="settings-day-header">
                <legend>
                  {dayName} <span className="dish-metadata">· {summary}</span>
                </legend>
                <label className="switch-toggle day-toggle">
                  <input
                    type="checkbox"
                    aria-label={`${dayName}開伙`}
                    checked={dayEnabled}
                    onChange={(event) => setDayEnabled(daySettings, event.target.checked)}
                  />
                  <span aria-hidden="true" />
                </label>
              </div>

              {dayEnabled && (
                <div className="meal-setting-list">
                  {daySettings.map((setting) => {
                    const label = mealLabel(setting.meal);

                    return (
                      <div className="meal-row" key={setting.meal} role="group" aria-label={`${dayName}${label}設定`}>
                        <button
                          type="button"
                          className={setting.enabled ? 'meal-pill' : 'meal-pill off'}
                          aria-label={label}
                          aria-pressed={setting.enabled}
                          onClick={() => onChangeSetting({ ...setting, enabled: !setting.enabled })}
                        >
                          {label}
                        </button>

                        {!setting.enabled && <span className="empty-text">未安排</span>}

                        {setting.enabled && setting.meal === 'breakfast' && <span className="meal-summary">固定1樣</span>}

                        {setting.enabled && setting.meal !== 'breakfast' && (
                          <CountChips dayName={dayName} mealLabel={label} setting={setting} onChangeSetting={onChangeSetting} />
                        )}

                        {setting.enabled && setting.meal !== 'breakfast' && mealTotal(setting) === 0 && (
                          <p className="meal-warning">這餐不會安排菜品</p>
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

注意：上面引用了一個尚未定義的 `<CountChips>` component，下一步會建立。`.meal-summary` 還是用在「固定1樣」處，視覺上等同 spec 的 `.fixed-text`，不需另外加 class。`<span className="empty-text">未安排</span>` 是 Task 1 測試斷言的目標。

- [ ] **Step 2: 確認 TypeScript 還沒 compile（CountChips 未定義）**

Run:
```bash
npx tsc --noEmit
```

Expected: FAIL — `Cannot find name 'CountChips'`。下一個 Task 補上。

- [ ] **Step 3: Commit — 跳過**

---

## Task 4: 新增 `CountChips` 子元件

**Files:**
- Modify: `src/components/MealSettings.tsx`

目標：把每餐三顆數量 chip 拆成獨立元件，內含一律渲染的 `<input>` 與 stepper 按鈕。

- [ ] **Step 1: 在 `MealSettings.tsx` 檔案最底端、`MealSettings` function 之後，新增 `CountChips` 子元件**

把以下 code 貼到檔案最後（`}` 之後）：

```tsx
type CountChipsProps = {
  dayName: string;
  mealLabel: string;
  setting: MealSetting;
  onChangeSetting: (setting: MealSetting) => Promise<void>;
};

function CountChips({ dayName, mealLabel, setting, onChangeSetting }: CountChipsProps) {
  function update(field: CountField, next: number) {
    const value = Math.max(0, Math.floor(Number.isFinite(next) ? next : 0));
    if (value === setting[field]) return;
    void onChangeSetting({ ...setting, [field]: value });
  }

  return (
    <div className="count-list">
      {COUNT_FIELDS.map(({ field, label: countLabel }) => {
        const value = setting[field];
        return (
          <label
            key={field}
            className={value === 0 ? 'count-chip zero' : 'count-chip'}
          >
            <span className="lbl">{countLabel}</span>
            <input
              aria-label={`${dayName}${mealLabel}${countLabel}數`}
              type="number"
              min="0"
              inputMode="numeric"
              value={value}
              onChange={(event) => update(field, Number(event.target.value))}
              onFocus={(event) => event.currentTarget.select()}
            />
            <span className="count-stepper" aria-hidden="true">
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => update(field, value + 1)}
              >
                ▲
              </button>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => update(field, value - 1)}
                disabled={value === 0}
              >
                ▼
              </button>
            </span>
          </label>
        );
      })}
    </div>
  );
}
```

`onMouseDown preventDefault` 確保點 stepper 按鈕時 input 不會 blur，chip 維持 focus-within（橘框與 stepper 都不會閃掉）。`onFocus event.currentTarget.select()` 讓使用者點下去就能直接覆寫數字，符合 spec。

- [ ] **Step 2: 確認 TypeScript 編譯通過**

Run:
```bash
npx tsc --noEmit
```

Expected: PASS（無錯誤）。

- [ ] **Step 3: 執行所有單元測試**

Run:
```bash
npm run test
```

Expected: 全部 PASS，包含 Task 1 加的 `shows 未安排 placeholder for disabled meals on enabled days`。

如果有失敗：

- 若 `App.test.tsx` 內 `screen.getAllByLabelText('早餐')[0]` 找不到元素：確認 `MealSettings.tsx` 中 pill `<button>` 的 `aria-label={label}` 真的存在且值為 `'早餐'`。
- 若 `getByLabelText('週一午餐菜數')` 找不到：確認 `CountChips` 內 `<input>` 的 `aria-label` 模板是 `${dayName}${mealLabel}${countLabel}數`。
- 若 `固定1樣` 的測試失敗：確認 breakfast 行用的是 `'固定1樣'`（沒有空格，與既有 test 一致）。

- [ ] **Step 4: Commit — 跳過**

---

## Task 5: 手動視覺驗證

**Files:** 無檔案修改，純手動操作。

- [ ] **Step 1: 啟動 dev server**

Run:
```bash
npm run dev
```

Expected：Vite 啟動成功，印出 `http://localhost:5173/`（或類似）。

- [ ] **Step 2: 在桌機 Chrome 開啟並切到「排餐設定」頁，逐項檢查 spec 驗收條件**

對照 `docs/superpowers/specs/2026-05-10-meal-settings-ui-refresh-design.md` 的「驗收條件」段落，逐條打勾：

1. `[ ]` 視窗 ≥768px：每行內容不換行、不溢出。
2. `[ ]` 視窗 375px（DevTools 切 iPhone SE）：每行不換行、3 個 chip 不擠壓變形。
3. `[ ]` 點餐別 pill 立即切換實心橘 ↔ 灰邊；資料持久化（重整後狀態保留）。
4. `[ ]` 點數量 chip：橘色光暈出現、上下箭頭出現；點 ▲ 數字 +1、點 ▼ 數字 -1（0 時 ▼ disabled）；鍵盤可直接打數字覆寫。
5. `[ ]` 點 chip 之外：橘框消失、stepper 隱藏。
6. `[ ]` 0 時數字呈現 dim（`#c2855a`），非 0 恢復深色。
7. `[ ]` 把午餐三項全設為 0：「這餐不會安排菜品」紅字出現。
8. `[ ]` 關掉週一某一餐（例如關午餐）：該行右邊出現「未安排」灰字，無 chip。
9. `[ ]` 整天關掉（日 toggle off）：日卡片折疊只剩標題列、變淡。
10. `[ ]` Tab 鍵測試：tab 順序 = 日 toggle → 早餐 pill → 午餐 pill → 菜 chip → 肉 chip → 湯 chip → 晚餐 pill → ...。

- [ ] **Step 3: 若以上 10 條全打勾，停止 dev server**

按 Ctrl-C 結束 `npm run dev`。

- [ ] **Step 4: Commit — 跳過**

---

## Task 6: 完工檢查

- [ ] **Step 1: 跑一次完整 test + type check**

Run:
```bash
npm run test && npx tsc --noEmit
```

Expected：兩者都 0 錯誤。

- [ ] **Step 2: 列出本次改動的檔案，提供給使用者作為 review reference**

Run:
```bash
git status -s
git diff --stat
```

預期變動：

```
 src/App.css                 | (數十行 ±)
 src/App.test.tsx            | (新增約 18 行)
 src/components/MealSettings.tsx | (約 60–80 行 ±)
 .gitignore                  | (上一階段已加 .superpowers/)
 docs/superpowers/specs/2026-05-10-meal-settings-ui-refresh-design.md | (新增)
 docs/superpowers/plans/2026-05-10-meal-settings-ui-refresh-plan.md   | (新增)
```

不主動 commit。把 `git status` 的內容貼給使用者，由他決定後續。

---

## Self-Review

**Spec coverage check（spec 章節 → task 對應）：**

- 視覺結構 / 元件規格 → Task 2（CSS） + Task 3（pill） + Task 4（chip）。
- 餐別 Pill 行為（aria-pressed、onClick toggle） → Task 3。
- 數量 chip 預設態 / 編輯態 / mini stepper / 觸控命中區域 → Task 2（CSS）+ Task 4（input + stepper handlers）。
- 0 時 dim → Task 2（`.count-chip.zero` rule）+ Task 4（套 `zero` class）。
- 餐別關閉時「未安排」佔位 → Task 1（測試）+ Task 3（JSX）+ Task 2（`.empty-text` CSS）。
- 早餐「固定1樣」 → 沿用既有 `.meal-summary` + `'固定1樣'` 字串（Task 3）。
- 整日 disabled 折疊 → 沿用既有 `.settings-day-disabled`，未變動。
- 0 樣警告紅字 → 沿用既有 `.meal-warning` + 既有條件判斷（Task 3）。
- 互動模型不變 → Task 4 內 `update()` 仍然透過 `onChangeSetting` 寫回 `MealSetting`，不動 `setDayEnabled`。
- CSS 變更總覽 → Task 2 步驟 2、3 對應移除規則；步驟 1 對應新增規則。
- 驗收條件 → Task 5 逐條檢查。

**Placeholder scan：**沒有 TBD/TODO；每個 step 都有具體 code 或 command。

**Type / class consistency check：**

- pill 使用 `meal-pill` / `meal-pill off`（Task 2 CSS、Task 3 JSX 一致）。
- chip 使用 `count-chip` / `count-chip zero`（Task 2、Task 4 一致）。
- stepper 用 `count-stepper`（Task 2、Task 4 一致）。
- 「未安排」class 是 `empty-text`（Task 2 CSS、Task 3 JSX 一致）。
- 「固定1樣」沿用既有 `.meal-summary` class（Task 2 保留該 base rule、Task 3 仍以 `className="meal-summary"` 渲染、無空格字串符合既有測試）。
- aria-label `${dayName}${mealLabel}${countLabel}數` 與既有測試 `'週一午餐菜數'` 一致（dayName=`週一` mealLabel=`午餐` countLabel=`菜`）。

Inline 修正紀錄：原本誤把 `.meal-summary` 列入 Task 2 Step 2 的刪除清單，導致與 Task 3 JSX 衝突；已修正為保留 base rule、僅刪除 768px media query 中的 grid 位置規則。
