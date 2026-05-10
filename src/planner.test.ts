import { describe, expect, test } from 'vitest';
import { createDefaultMealSettings, generateWeeklyPlans, type PlannerDish } from './planner';

const dishes: PlannerDish[] = [
  { id: 1, name: '早餐蛋餅', mealTypes: ['breakfast'], category: 'uncategorized' },
  { id: 2, name: '青菜', mealTypes: ['lunch', 'dinner'], category: 'vegetable' },
  { id: 3, name: '滷肉', mealTypes: ['lunch', 'dinner'], category: 'meat' },
  { id: 4, name: '玉米濃湯', mealTypes: ['lunch', 'dinner'], category: 'soup' },
  { id: 5, name: '晚餐炒飯', mealTypes: ['dinner'], category: 'uncategorized' },
];

function setting(
  overrides: {
    day?: number;
    meal?: 'breakfast' | 'lunch' | 'dinner';
    enabled?: boolean;
    vegetableCount?: number;
    meatCount?: number;
    soupCount?: number;
  },
) {
  return {
    day: 0,
    meal: 'dinner' as const,
    enabled: true,
    vegetableCount: 1,
    meatCount: 0,
    soupCount: 0,
    ...overrides,
  };
}

describe('createDefaultMealSettings', () => {
  test('enables only weekday dinners and presets lunch/dinner counts to 2 vegetables and 1 meat', () => {
    const settings = createDefaultMealSettings();

    expect(settings).toHaveLength(21);
    expect(settings.filter((setting) => setting.enabled)).toEqual([
      { day: 0, meal: 'dinner', enabled: true, vegetableCount: 2, meatCount: 1, soupCount: 0 },
      { day: 1, meal: 'dinner', enabled: true, vegetableCount: 2, meatCount: 1, soupCount: 0 },
      { day: 2, meal: 'dinner', enabled: true, vegetableCount: 2, meatCount: 1, soupCount: 0 },
      { day: 3, meal: 'dinner', enabled: true, vegetableCount: 2, meatCount: 1, soupCount: 0 },
      { day: 4, meal: 'dinner', enabled: true, vegetableCount: 2, meatCount: 1, soupCount: 0 },
    ]);
    expect(settings.filter((setting) => setting.meal !== 'dinner').every((setting) => !setting.enabled)).toBe(true);
    expect(settings.filter((setting) => setting.day > 4).every((setting) => !setting.enabled)).toBe(true);
    expect(
      settings
        .filter((setting) => setting.meal === 'lunch')
        .every((setting) => setting.vegetableCount === 2 && setting.meatCount === 1 && setting.soupCount === 0),
    ).toBe(true);
    expect(
      settings
        .filter((setting) => setting.meal === 'breakfast')
        .every((setting) => setting.vegetableCount === 0 && setting.meatCount === 0 && setting.soupCount === 0),
    ).toBe(true);
  });
});

describe('generateWeeklyPlans', () => {
  test('creates one breakfast slot using uncategorized breakfast dishes only', () => {
    const plans = generateWeeklyPlans(dishes, [setting({ meal: 'breakfast', vegetableCount: 9, meatCount: 9, soupCount: 9 })]);

    expect(plans).toHaveLength(1);
    expect(plans).toEqual([{ day: 0, meal: 'breakfast', slot: 0, dishId: 1 }]);
  });

  test('creates lunch and dinner slots from vegetable, meat, and soup counts', () => {
    const plans = generateWeeklyPlans(dishes, [setting({ meal: 'lunch', vegetableCount: 2, meatCount: 1, soupCount: 1 })]);

    expect(plans).toHaveLength(4);
    expect(plans.map(({ day, meal, slot }) => ({ day, meal, slot }))).toEqual([
      { day: 0, meal: 'lunch', slot: 0 },
      { day: 0, meal: 'lunch', slot: 1 },
      { day: 0, meal: 'lunch', slot: 2 },
      { day: 0, meal: 'lunch', slot: 3 },
    ]);
    expect(plans.map((plan) => plan.dishId)).toEqual([2, undefined, 3, 4]);
  });

  test('does not create slots for disabled meals or enabled meals with zero category counts', () => {
    const plans = generateWeeklyPlans(dishes, [
      setting({ meal: 'lunch', enabled: false, vegetableCount: 1, meatCount: 1, soupCount: 1 }),
      setting({ meal: 'dinner', vegetableCount: 0, meatCount: 0, soupCount: 0 }),
    ]);

    expect(plans).toEqual([]);
  });

  test('allows the same dish across different meals', () => {
    const sharedDishes: PlannerDish[] = [{ id: 2, name: '青菜', mealTypes: ['lunch', 'dinner'], category: 'vegetable' }];

    const plans = generateWeeklyPlans(sharedDishes, [setting({ meal: 'lunch' }), setting({ meal: 'dinner' })]);

    expect(plans).toEqual([
      { day: 0, meal: 'lunch', slot: 0, dishId: 2 },
      { day: 0, meal: 'dinner', slot: 0, dishId: 2 },
    ]);
  });

  test('leaves extra category slots unassigned when a meal needs more dishes than available', () => {
    const plans = generateWeeklyPlans([{ id: 2, name: '青菜', mealTypes: ['dinner'], category: 'vegetable' }], [
      setting({ meal: 'dinner', vegetableCount: 3 }),
    ]);

    expect(plans).toEqual([
      { day: 0, meal: 'dinner', slot: 0, dishId: 2 },
      { day: 0, meal: 'dinner', slot: 1 },
      { day: 0, meal: 'dinner', slot: 2 },
    ]);
  });
});
