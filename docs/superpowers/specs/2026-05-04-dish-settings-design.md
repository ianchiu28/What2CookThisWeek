# Dish Settings Design

## Goal

Upgrade the `菜品設定` tab from a minimal dish-name-only flow into a single-page dish management UI that supports richer metadata, fast lookup, and editing.

## Scope

- Add meal applicability to each dish: breakfast, lunch, dinner.
- Require at least one meal type; new and migrated dishes default to dinner.
- Add one dish category: vegetable, meat, soup, or uncategorized.
- Require exactly one category; new and migrated dishes default to uncategorized.
- Add dish list search by name.
- Add dish list filters for meal type and category.
- Add edit support through a modal.
- Keep the existing tab-based app structure and avoid routing changes.

## Data Model

`Dish` will include:

- `name: string`
- `lastCookedAt?: number`
- `mealTypes: MealType[]`
- `category: DishCategory`

`MealType` continues to use the existing `breakfast | lunch | dinner` values.

`DishCategory` will be:

- `vegetable`
- `meat`
- `soup`
- `uncategorized`

Dexie will add a new database version. During migration, existing dishes without the new fields will be updated to:

- `mealTypes: ['dinner']`
- `category: 'uncategorized'`

## UI Design

The `菜品設定` tab remains a single management page.

### Add Dish Card

The top card provides:

- Dish name input.
- Meal type checkboxes for breakfast, lunch, and dinner.
- Dinner selected by default.
- Category radio buttons for uncategorized, vegetable, meat, and soup.
- Uncategorized selected by default.
- Add button.

The add action is disabled or ignored unless the dish name is non-empty and at least one meal type is selected.

### Dish List Card

The list card provides:

- Name search input.
- Meal type filter with an all option.
- Category filter with an all option.
- A list of matching dishes.

Each dish row shows:

- Dish name.
- Meal type labels.
- Category label.
- Edit button.
- Delete button.

### Edit Modal

Clicking edit opens a modal with the same fields as the add form:

- Dish name.
- Meal type checkboxes.
- Category radio buttons.

Saving updates the dish, closes the modal, and reloads the displayed list. Cancelling closes the modal without changes.

## Filtering Behavior

Filtering applies in this order conceptually, though implementation may combine the predicates:

1. Name search: case-insensitive substring match against `dish.name`.
2. Meal type filter: all means no restriction; otherwise show dishes whose `mealTypes` includes the selected meal.
3. Category filter: all means no restriction; otherwise show dishes whose `category` matches the selected category.

## Validation

The UI must prevent invalid writes at the app boundary:

- Trimmed dish name must be non-empty.
- At least one meal type must be selected.
- Category must be one of the supported single-select values.

The stored dish object should always include complete metadata after migration, add, or edit.

## Testing

Tests should cover:

- New dish defaults to dinner and uncategorized.
- A dish cannot be submitted with zero selected meal types.
- Search filters by dish name.
- Meal type filter matches dishes containing the selected meal type.
- Category filter matches the selected category.
- Edit modal updates name, meal types, and category.
- Dexie migration backfills old dishes with dinner and uncategorized.

## Non-goals

- No new routing or separate edit page.
- No advanced search beyond dish name substring matching.
- No changes to weekly plan generation behavior in this iteration.
- No meal composition rules such as three vegetables and one soup yet.
