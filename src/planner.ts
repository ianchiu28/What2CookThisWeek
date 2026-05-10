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

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

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

function matchingDishes(dishes: PlannerDish[], meal: MealType, category: DishCategory) {
  return shuffle(dishes.filter((dish) => typeof dish.id === 'number' && dish.mealTypes.includes(meal) && dish.category === category));
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

export function generateWeeklyPlans(dishes: PlannerDish[], settings: MealSetting[]): WeeklyPlan[] {
  return settings.flatMap((setting) => {
    if (!setting.enabled) return [];

    if (setting.meal === 'breakfast') {
      const dish = matchingDishes(dishes, setting.meal, 'uncategorized')[0];
      return [
        {
          day: setting.day,
          meal: setting.meal,
          slot: 0,
          ...(dish ? { dishId: dish.id } : {}),
        },
      ];
    }

    const slots = createSlots(setting, [
      { category: 'vegetable', count: setting.vegetableCount },
      { category: 'meat', count: setting.meatCount },
      { category: 'soup', count: setting.soupCount },
    ]);

    const dishesByCategory = new Map<DishCategory, PlannerDish[]>([
      ['vegetable', matchingDishes(dishes, setting.meal, 'vegetable')],
      ['meat', matchingDishes(dishes, setting.meal, 'meat')],
      ['soup', matchingDishes(dishes, setting.meal, 'soup')],
    ]);

    return slots.map(({ category, ...plan }) => {
      const dish = dishesByCategory.get(category)?.shift();
      return {
        ...plan,
        ...(dish ? { dishId: dish.id } : {}),
      };
    });
  });
}
