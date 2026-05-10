import { describe, expect, test, vi } from 'vitest';
import { createDefaultMealSettings, generateWeeklyPlans, pickDishesForWeek, type PlannerDish } from './planner';

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

  test('does not reuse the same dish across different meals in the same week', () => {
    const sharedDishes: PlannerDish[] = [{ id: 2, name: '青菜', mealTypes: ['lunch', 'dinner'], category: 'vegetable' }];

    const plans = generateWeeklyPlans(sharedDishes, [setting({ meal: 'lunch' }), setting({ meal: 'dinner' })]);

    expect(plans).toEqual([
      { day: 0, meal: 'lunch', slot: 0, dishId: 2 },
      { day: 0, meal: 'dinner', slot: 0 },
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

describe('pickDishesForWeek', () => {
  test('does not place the same dish twice in the same week', () => {
    const dinnerVegSetting = (day: number) =>
      setting({ day, meal: 'dinner', vegetableCount: 2, meatCount: 0, soupCount: 0 });

    const dishes: PlannerDish[] = [
      { id: 11, name: '青菜A', mealTypes: ['dinner'], category: 'vegetable' },
      { id: 12, name: '青菜B', mealTypes: ['dinner'], category: 'vegetable' },
      { id: 13, name: '青菜C', mealTypes: ['dinner'], category: 'vegetable' },
    ];

    const { plans, pickedDishIds } = pickDishesForWeek(dishes, [
      dinnerVegSetting(0),
      dinnerVegSetting(1),
      dinnerVegSetting(2),
    ]);

    const placedIds = plans.map((plan) => plan.dishId).filter((id): id is number => id !== undefined);
    expect(new Set(placedIds).size).toBe(placedIds.length);
    expect(placedIds).toHaveLength(3);
    expect([...pickedDishIds].sort()).toEqual([11, 12, 13]);

    const unfilled = plans.filter((plan) => plan.dishId === undefined);
    expect(unfilled).toHaveLength(3);
  });

  test('returns plans plus the dish ids actually placed into slots', () => {
    const result = pickDishesForWeek(
      [
        { id: 1, name: '早餐蛋餅', mealTypes: ['breakfast'], category: 'uncategorized' },
        { id: 2, name: '青菜', mealTypes: ['dinner'], category: 'vegetable' },
      ],
      [
        setting({ meal: 'breakfast' }),
        setting({ meal: 'dinner', vegetableCount: 2, meatCount: 0, soupCount: 0 }),
      ],
    );

    expect(result.plans).toEqual([
      { day: 0, meal: 'breakfast', slot: 0, dishId: 1 },
      { day: 0, meal: 'dinner', slot: 0, dishId: 2 },
      { day: 0, meal: 'dinner', slot: 1 },
    ]);
    expect(result.pickedDishIds).toEqual([1, 2]);
  });

  test('prefers the dish with the oldest lastCookedAt', () => {
    const dishes: PlannerDish[] = [
      { id: 21, name: '舊菜', mealTypes: ['dinner'], category: 'vegetable', lastCookedAt: 1000 },
      { id: 22, name: '中菜', mealTypes: ['dinner'], category: 'vegetable', lastCookedAt: 2000 },
      { id: 23, name: '新菜', mealTypes: ['dinner'], category: 'vegetable', lastCookedAt: 3000 },
    ];

    const { plans } = pickDishesForWeek(dishes, [setting({ meal: 'dinner', vegetableCount: 1, meatCount: 0, soupCount: 0 })]);

    expect(plans).toEqual([{ day: 0, meal: 'dinner', slot: 0, dishId: 21 }]);
  });

  test('treats dishes without lastCookedAt as the oldest', () => {
    const dishes: PlannerDish[] = [
      { id: 31, name: '煮過', mealTypes: ['dinner'], category: 'vegetable', lastCookedAt: 1000 },
      { id: 32, name: '沒煮過', mealTypes: ['dinner'], category: 'vegetable' },
    ];

    const { plans } = pickDishesForWeek(dishes, [setting({ meal: 'dinner', vegetableCount: 1, meatCount: 0, soupCount: 0 })]);

    expect(plans).toEqual([{ day: 0, meal: 'dinner', slot: 0, dishId: 32 }]);
  });

  test('breaks ties on lastCookedAt randomly across runs', () => {
    const dishes: PlannerDish[] = [
      { id: 41, name: 'A', mealTypes: ['dinner'], category: 'vegetable' },
      { id: 42, name: 'B', mealTypes: ['dinner'], category: 'vegetable' },
      { id: 43, name: 'C', mealTypes: ['dinner'], category: 'vegetable' },
    ];

    const seen = new Set<number>();
    const randomMock = vi.spyOn(Math, 'random');

    const sequences: Array<[number, number, number]> = [
      [0.1, 0.5, 0.9],
      [0.5, 0.1, 0.9],
      [0.5, 0.9, 0.1],
    ];

    for (const seq of sequences) {
      randomMock.mockReset();
      seq.forEach((value) => randomMock.mockReturnValueOnce(value));
      const { pickedDishIds } = pickDishesForWeek(dishes, [setting({ meal: 'dinner', vegetableCount: 1, meatCount: 0, soupCount: 0 })]);
      expect(pickedDishIds).toHaveLength(1);
      seen.add(pickedDishIds[0]);
    }

    randomMock.mockRestore();

    expect(seen).toEqual(new Set([41, 42, 43]));
  });
});
