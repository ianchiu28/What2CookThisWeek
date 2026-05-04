# Dish Settings Simplification Design

## Goal

Simplify the `菜品設定` tab so the dish list is the primary visual focus while preserving add, edit, search, and filter capabilities.

## Scope

- Move add dish from an always-visible card into a modal opened by an `新增` button.
- Keep edit dish as a modal.
- Show one main dish list card instead of separate add and list cards.
- Reduce visual weight of dish metadata.
- Replace full-size edit/delete text buttons with compact icon buttons.
- Keep search visible.
- Move meal/category filters into a collapsed panel opened by a `篩選` button.

## Page Structure

The `菜品設定` tab will render a single dish management card.

The card header contains:

- Left: `菜品列表` heading.
- Right: primary `新增` button.

Clicking `新增` opens a `新增菜品` modal with the same fields and validation as the current add form:

- Dish name.
- Meal type checkboxes.
- Category radio buttons.
- Default dinner and uncategorized.
- At least one meal type required.

After a successful add, the modal closes and the list refreshes.

## Dish Row Design

Each row becomes compact:

- Primary line: dish name.
- Secondary metadata line: meal labels and category in plain small text, such as `晚餐 · 肉` or `午餐、晚餐 · 湯`.
- No large pill tags in the list rows.

The row action area uses compact icon buttons:

- Edit icon button: visual text icon `✎`, accessible label `編輯 <dish name>`.
- Delete icon button: visual text icon `×`, accessible label `刪除 <dish name>`.

The icon buttons should be visually small, but remain actual buttons for keyboard and screen-reader accessibility.

## Search and Filters

The search input remains visible above the list.

Meal and category filters move into a collapsed filter panel:

- A compact secondary `篩選` button toggles the panel.
- The panel contains the current meal type select and category select.
- By default, the panel is collapsed.
- If any filter is active, the button shows active state text: `篩選 · 1` or `篩選 · 2`.

Filtering behavior does not change:

- Search matches dish name by case-insensitive substring.
- Meal filter matches dishes whose `mealTypes` includes the selected meal.
- Category filter matches dishes whose `category` equals the selected category.

## Testing

Tests should cover:

- The add form is not visible by default on the `菜品設定` tab.
- Clicking `新增` opens the add modal.
- Adding a dish from the modal persists dinner and uncategorized defaults, then closes the modal.
- Existing edit modal behavior still works through the edit icon button.
- Search is visible by default.
- Filter selects are hidden by default and appear after clicking `篩選`.
- Active filters update the filter button count.
- Delete remains available through the delete icon button.

## Non-goals

- No data model changes.
- No change to filtering semantics.
- No new routing.
- No removal of meal/category filtering.
