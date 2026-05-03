import { describe, expect, test } from 'vitest';
import { generateWeeklyPlans } from './planner';

describe('generateWeeklyPlans', () => {
  test('creates seven dinner plans with no repeated dishes when enough dishes exist', () => {
    const dishes = Array.from({ length: 7 }, (_, index) => ({
      id: index + 1,
      name: `Dish ${index + 1}`,
    }));

    const plans = generateWeeklyPlans(dishes);

    expect(plans).toHaveLength(7);
    expect(plans.map((plan) => plan.day)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(new Set(plans.map((plan) => plan.dishId)).size).toBe(7);
  });

  test('allows repeated dishes when fewer than seven dishes exist', () => {
    const dishes = [
      { id: 1, name: '番茄炒蛋' },
      { id: 2, name: '滷肉' },
    ];

    const plans = generateWeeklyPlans(dishes);

    expect(plans).toHaveLength(7);
    expect(plans.every((plan) => [1, 2].includes(plan.dishId))).toBe(true);
  });

  test('returns no plans when there are no dishes', () => {
    expect(generateWeeklyPlans([])).toEqual([]);
  });
});
