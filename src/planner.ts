import type { MealSetting, MealType, WeeklyPlan } from './db';

export type PlannerDish = {
  id?: number;
  name: string;
  lastCookedAt?: number;
};

export const DAYS = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'] as const;

export const MEAL_TYPES: Array<{ value: MealType; label: string }> = [
  { value: 'breakfast', label: '早餐' },
  { value: 'lunch', label: '午餐' },
  { value: 'dinner', label: '晚餐' },
];

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

export function createDefaultMealSettings(): MealSetting[] {
  return DAYS.flatMap((_, day) =>
    MEAL_TYPES.map(({ value }) => ({
      day,
      meal: value,
      enabled: day < 5 && value === 'dinner',
      dishCount: 1,
    })),
  );
}

export function generateWeeklyPlans(dishes: PlannerDish[], settings: MealSetting[]): WeeklyPlan[] {
  const availableDishes = dishes.filter((dish) => typeof dish.id === 'number');

  return settings.flatMap((setting) => {
    if (!setting.enabled) return [];

    const shuffled = shuffle(availableDishes);

    return Array.from({ length: setting.dishCount }, (_, slot) => {
      const dish = shuffled[slot];
      return {
        day: setting.day,
        meal: setting.meal,
        slot,
        ...(dish ? { dishId: dish.id } : {}),
      };
    });
  });
}
