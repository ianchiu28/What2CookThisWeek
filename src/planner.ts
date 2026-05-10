import type { DishCategory, MealSetting, MealType, WeeklyPlan } from './db';

export type PlannerDish = {
  id?: number;
  name: string;
  lastCookedAt?: number;
  mealTypes: MealType[];
  category: DishCategory;
};

export const DAYS = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'] as const;

export const MEAL_TYPES: Array<{ value: MealType; label: string }> = [
  { value: 'breakfast', label: '早餐' },
  { value: 'lunch', label: '午餐' },
  { value: 'dinner', label: '晚餐' },
];


export function createDefaultMealSettings(): MealSetting[] {
  return DAYS.flatMap((_, day) =>
    MEAL_TYPES.map(({ value }) => ({
      day,
      meal: value,
      enabled: day < 5 && value === 'dinner',
      vegetableCount: value === 'breakfast' ? 0 : 2,
      meatCount: value === 'breakfast' ? 0 : 1,
      soupCount: 0,
    })),
  );
}

function pickByRotation(candidates: PlannerDish[]): PlannerDish | undefined {
  if (candidates.length === 0) return undefined;
  return [...candidates]
    .map((dish) => ({ dish, randomKey: Math.random() }))
    .sort((a, b) => {
      const keyA = a.dish.lastCookedAt ?? Number.NEGATIVE_INFINITY;
      const keyB = b.dish.lastCookedAt ?? Number.NEGATIVE_INFINITY;
      if (keyA !== keyB) return keyA - keyB;
      return a.randomKey - b.randomKey;
    })[0]?.dish;
}

function candidatesFor(
  dishes: PlannerDish[],
  meal: MealType,
  category: DishCategory,
  used: Set<number>,
): PlannerDish[] {
  return dishes.filter(
    (dish) =>
      typeof dish.id === 'number' &&
      !used.has(dish.id) &&
      dish.mealTypes.includes(meal) &&
      dish.category === category,
  );
}

type PlanSlot = WeeklyPlan & { category: DishCategory };

function createSlots(setting: MealSetting, categoryCounts: Array<{ category: DishCategory; count: number }>): PlanSlot[] {
  let slot = 0;

  return categoryCounts.flatMap(({ category, count }) =>
    Array.from({ length: count }, () => ({
      day: setting.day,
      meal: setting.meal,
      slot: slot++,
      category,
    })),
  );
}

export type PickResult = {
  plans: WeeklyPlan[];
  pickedDishIds: number[];
};

export function pickDishesForWeek(dishes: PlannerDish[], settings: MealSetting[]): PickResult {
  const plans: WeeklyPlan[] = [];
  const pickedDishIds: number[] = [];
  const usedDishIds = new Set<number>();

  function placeSlot(plan: WeeklyPlan, candidates: PlannerDish[]) {
    const chosen = pickByRotation(candidates);
    plans.push({
      ...plan,
      ...(chosen ? { dishId: chosen.id } : {}),
    });
    if (chosen?.id !== undefined) {
      usedDishIds.add(chosen.id);
      pickedDishIds.push(chosen.id);
    }
  }

  for (const setting of settings) {
    if (!setting.enabled) continue;

    if (setting.meal === 'breakfast') {
      const candidates = candidatesFor(dishes, 'breakfast', 'uncategorized', usedDishIds);
      placeSlot({ day: setting.day, meal: setting.meal, slot: 0 }, candidates);
      continue;
    }

    const slots = createSlots(setting, [
      { category: 'vegetable', count: setting.vegetableCount },
      { category: 'meat', count: setting.meatCount },
      { category: 'soup', count: setting.soupCount },
    ]);

    for (const { category, ...slot } of slots) {
      const candidates = candidatesFor(dishes, setting.meal, category, usedDishIds);
      placeSlot(slot, candidates);
    }
  }

  return { plans, pickedDishIds };
}

export function generateWeeklyPlans(dishes: PlannerDish[], settings: MealSetting[]): WeeklyPlan[] {
  return pickDishesForWeek(dishes, settings).plans;
}
