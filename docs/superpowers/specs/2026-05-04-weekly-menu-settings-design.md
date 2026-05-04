# Weekly Menu Settings Design

## Goal

Make the weekly menu the visual focus of the app and move dish management plus weekly meal planning rules into separate bottom-tab settings areas.

## Information Architecture

The app remains a single-page PWA with three bottom tabs:

- `本週菜單`
- `菜品設定`
- `排餐設定`

The tab bar is fixed to the bottom edge like a mobile app tab bar, spans the full viewport width, and has square corners. Active tabs use emphasized orange text with a top indicator line instead of a filled button background.

The default tab is `本週菜單`. The app header remains `這週煮什麼？`.

## 本週菜單

`本週菜單` replaces the current `本週晚餐` section and becomes the primary view.

It contains:

- A main card titled `本週菜單`.
- A primary action button labeled `產生本週菜單`.
- Generated menu entries grouped by day and meal.
- Each enabled meal displays its assigned dishes in order.
- Missing dish slots display `尚未安排`.

The current `新增菜` and `菜列表` sections are removed from the default view.

## 菜品設定

`菜品設定` is a dedicated tab for dish management.

It contains:

- The existing add-dish form currently labeled `新增菜`.
- The existing dish list currently labeled `菜列表`.
- Delete behavior remains the same: deleting a dish also removes existing generated plan entries that reference it.

This tab only manages available dishes and does not show weekly scheduling controls.

## 排餐設定

`排餐設定` is a dedicated tab for rules that determine what the generated weekly menu should contain.

It shows all seven days, each with fixed meal types:

- `早餐`
- `午餐`
- `晚餐`

Each day/meal setting has:

- An enabled/disabled control for whether that meal should be cooked.
- A dish-count control for how many dishes to generate for that meal.
- Dish count is editable only when the meal is enabled.
- Enabled meal dish count must be at least 1.

Changes save immediately to IndexedDB. There is no separate save button.

## Default Weekly Meal Settings

When no saved user setting exists, initialize with:

- 週一 through 週五 `晚餐` enabled with 1 dish.
- 週六 and 週日 `晚餐` disabled.
- All `早餐` and `午餐` settings disabled.

After the user changes settings, those settings persist locally and are used on future app loads instead of the defaults.

## Data Model

Extend weekly planning from one dish per day to dish slots defined by:

- day index
- meal type
- slot index within that meal
- dish id when assigned

Persist weekly meal settings separately from generated weekly menu entries. The generated menu should be replaceable without losing the user's saved weekly meal settings.

## Menu Generation Rules

When the user clicks `產生本週菜單`:

1. Load the current saved weekly meal settings.
2. Clear existing generated weekly menu entries.
3. For each enabled day/meal, create the requested number of dish slots.
4. Within the same meal, do not repeat the same dish.
5. Across different meals, the same dish may be reused.
6. If a meal requests more dishes than the number of available dishes, fill as many unique dishes as possible and leave remaining slots unassigned.
7. Disabled meals are not shown in `本週菜單`.

## Testing Strategy

Add or update tests using the existing Vitest and Testing Library setup.

Cover:

- Default layout shows `本週菜單` as the primary tab.
- `新增菜` and `菜列表` are not shown on the default `本週菜單` view.
- Bottom tabs switch to `菜品設定` and `排餐設定`.
- `本週晚餐` text is replaced by `本週菜單`.
- Default meal settings enable only weekday dinners with one dish.
- Menu generation follows saved meal settings.
- Same meal does not duplicate dishes.
- Different meals may reuse dishes.
- Dish shortages leave `尚未安排` slots.
- User meal settings persist and are loaded on the next app load.

## Implementation Boundaries

Use the existing React, Dexie, Vitest, and Testing Library stack.

Do not add React Router or new external dependencies. Keep the app as a single-page PWA with local state for active tab and IndexedDB for persistent dish, setting, and menu data.
