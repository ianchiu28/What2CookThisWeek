import { describe, expect, test } from 'vitest';
import type { Dish, WeeklyPlan } from './db';
import { aggregateShoppingList, parseIngredients } from './ingredients';

function makeDish(overrides: Partial<Dish> & Pick<Dish, 'id' | 'name'>): Dish {
  return {
    mealTypes: ['dinner'],
    category: 'uncategorized',
    ingredients: [],
    ...overrides,
  };
}

function makePlan(overrides: Partial<WeeklyPlan> & Pick<WeeklyPlan, 'day' | 'meal' | 'slot'>): WeeklyPlan {
  return overrides;
}

describe('parseIngredients', () => {
  test('empty string returns empty array', () => {
    expect(parseIngredients('')).toEqual([]);
  });

  test('whitespace only returns empty array', () => {
    expect(parseIngredients('   \n\t  ')).toEqual([]);
  });

  test('splits by mixed separators (space, tab, newline, half/full-width comma, dunhao, half/full-width semicolon)', () => {
    expect(parseIngredients('番茄、蛋 蔥,薑；蒜\n醬油\t糖，鹽;醋')).toEqual([
      '番茄', '蛋', '蔥', '薑', '蒜', '醬油', '糖', '鹽', '醋',
    ]);
  });

  test('collapses consecutive separators (no empty tokens)', () => {
    expect(parseIngredients('番茄,,，、 蛋')).toEqual(['番茄', '蛋']);
  });

  test('trims and dedupes preserving first-seen order', () => {
    expect(parseIngredients('  番茄 , 蛋 , 番茄 , 蔥 , 蛋 ')).toEqual(['番茄', '蛋', '蔥']);
  });

  test('single ingredient with no separators', () => {
    expect(parseIngredients('番茄')).toEqual(['番茄']);
  });
});

describe('aggregateShoppingList', () => {
  test('empty plans returns empty array', () => {
    expect(aggregateShoppingList([], [])).toEqual([]);
  });

  test('ignores plans whose dishId does not resolve to a dish', () => {
    const dishes = [makeDish({ id: 1, name: '番茄炒蛋', ingredients: ['番茄', '蛋'] })];
    const plans = [
      makePlan({ day: 0, meal: 'dinner', slot: 0, dishId: 1 }),
      makePlan({ day: 0, meal: 'dinner', slot: 1, dishId: 999 }),
      makePlan({ day: 0, meal: 'dinner', slot: 2 }),
    ];
    const result = aggregateShoppingList(plans, dishes);
    expect(result.length).toBe(2);
    expect(new Set(result)).toEqual(new Set(['番茄', '蛋']));
  });

  test('dedupes ingredients across dishes', () => {
    const dishes = [
      makeDish({ id: 1, name: 'A', ingredients: ['番茄', '蛋', '蔥'] }),
      makeDish({ id: 2, name: 'B', ingredients: ['番茄', '薑'] }),
    ];
    const plans = [
      makePlan({ day: 0, meal: 'dinner', slot: 0, dishId: 1 }),
      makePlan({ day: 0, meal: 'dinner', slot: 1, dishId: 2 }),
    ];
    const result = aggregateShoppingList(plans, dishes);
    expect(new Set(result)).toEqual(new Set(['番茄', '蛋', '蔥', '薑']));
    expect(result.length).toBe(4);
  });

  test('sorts low-stroke characters before high-stroke ones', () => {
    const dishes = [makeDish({ id: 1, name: 'A', ingredients: ['蛋', '一', '二'] })];
    const plans = [makePlan({ day: 0, meal: 'dinner', slot: 0, dishId: 1 })];
    expect(aggregateShoppingList(plans, dishes)).toEqual(['一', '二', '蛋']);
  });

  test('skips dishes with empty ingredients arrays', () => {
    const dishes = [
      makeDish({ id: 1, name: 'A', ingredients: [] }),
      makeDish({ id: 2, name: 'B', ingredients: ['鹽'] }),
    ];
    const plans = [
      makePlan({ day: 0, meal: 'dinner', slot: 0, dishId: 1 }),
      makePlan({ day: 0, meal: 'dinner', slot: 1, dishId: 2 }),
    ];
    expect(aggregateShoppingList(plans, dishes)).toEqual(['鹽']);
  });
});
