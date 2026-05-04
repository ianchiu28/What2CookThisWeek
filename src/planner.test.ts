import { describe, expect, test } from 'vitest';
import { createDefaultMealSettings, generateWeeklyPlans, type PlannerDish } from './planner';

const dishes: PlannerDish[] = [
  { id: 1, name: '番茄炒蛋' },
  { id: 2, name: '滷肉' },
  { id: 3, name: '青菜' },
];

function setting(overrides: { day?: number; meal?: 'breakfast' | 'lunch' | 'dinner'; enabled?: boolean; dishCount?: number }) {
  return {
    day: 0,
    meal: 'dinner' as const,
    enabled: true,
    dishCount: 1,
    ...overrides,
  };
}

describe('createDefaultMealSettings', () => {
  test('enables only weekday dinners with one dish', () => {
    const settings = createDefaultMealSettings();

    expect(settings).toHaveLength(21);
    expect(settings.filter((setting) => setting.enabled)).toEqual([
      { day: 0, meal: 'dinner', enabled: true, dishCount: 1 },
      { day: 1, meal: 'dinner', enabled: true, dishCount: 1 },
      { day: 2, meal: 'dinner', enabled: true, dishCount: 1 },
      { day: 3, meal: 'dinner', enabled: true, dishCount: 1 },
      { day: 4, meal: 'dinner', enabled: true, dishCount: 1 },
    ]);
    expect(settings.filter((setting) => setting.meal !== 'dinner').every((setting) => !setting.enabled)).toBe(true);
    expect(settings.filter((setting) => setting.day > 4).every((setting) => !setting.enabled)).toBe(true);
  });
});

describe('generateWeeklyPlans', () => {
  test('creates slots for enabled meals only', () => {
    const settings = [
      setting({ meal: 'breakfast', dishCount: 2 }),
      setting({ meal: 'lunch', enabled: false }),
      setting({ meal: 'dinner' }),
    ];

    const plans = generateWeeklyPlans(dishes, settings);

    expect(plans).toHaveLength(3);
    expect(plans.map(({ day, meal, slot }) => ({ day, meal, slot }))).toEqual([
      { day: 0, meal: 'breakfast', slot: 0 },
      { day: 0, meal: 'breakfast', slot: 1 },
      { day: 0, meal: 'dinner', slot: 0 },
    ]);
  });

  test('does not repeat dishes within the same meal', () => {
    const plans = generateWeeklyPlans(dishes, [setting({ dishCount: 3 })]);

    expect(new Set(plans.map((plan) => plan.dishId)).size).toBe(3);
  });

  test('allows the same dish across different meals', () => {
    const plans = generateWeeklyPlans([{ id: 1, name: '番茄炒蛋' }], [
      setting({ meal: 'breakfast' }),
      setting({ meal: 'dinner' }),
    ]);

    expect(plans).toEqual([
      { day: 0, meal: 'breakfast', slot: 0, dishId: 1 },
      { day: 0, meal: 'dinner', slot: 0, dishId: 1 },
    ]);
  });

  test('leaves extra slots unassigned when a meal needs more dishes than available', () => {
    const plans = generateWeeklyPlans([{ id: 1, name: '番茄炒蛋' }], [setting({ dishCount: 3 })]);

    expect(plans).toEqual([
      { day: 0, meal: 'dinner', slot: 0, dishId: 1 },
      { day: 0, meal: 'dinner', slot: 1 },
      { day: 0, meal: 'dinner', slot: 2 },
    ]);
  });
});
