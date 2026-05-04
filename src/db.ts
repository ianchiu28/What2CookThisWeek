import Dexie, { type Table } from 'dexie';

export type MealType = 'breakfast' | 'lunch' | 'dinner';
export type DishCategory = 'vegetable' | 'meat' | 'soup' | 'uncategorized';

export type Dish = {
  id?: number;
  name: string;
  lastCookedAt?: number;
  mealTypes: MealType[];
  category: DishCategory;
};

export type MealSetting = {
  id?: number;
  day: number;
  meal: MealType;
  enabled: boolean;
  vegetableCount: number;
  meatCount: number;
  soupCount: number;
};

export type WeeklyPlan = {
  id?: number;
  day: number;
  meal: MealType;
  slot: number;
  dishId?: number;
};

class CookDb extends Dexie {
  dishes!: Table<Dish, number>;
  weeklyPlans!: Table<WeeklyPlan, number>;
  mealSettings!: Table<MealSetting, number>;

  constructor() {
    super('What2CookThisWeek');
    this.version(1).stores({
      dishes: '++id, name, lastCookedAt',
      weeklyPlans: '++id, day, dishId',
    });
    this.version(2).stores({
      dishes: '++id, name, lastCookedAt',
      weeklyPlans: '++id, [day+meal+slot], day, meal, dishId',
      mealSettings: '++id, [day+meal], day, meal',
    });
    this.version(3)
      .stores({
        dishes: '++id, name, lastCookedAt, category',
        weeklyPlans: '++id, [day+meal+slot], day, meal, dishId',
        mealSettings: '++id, [day+meal], day, meal',
      })
      .upgrade(async (transaction) => {
        await transaction
          .table<Dish, number>('dishes')
          .toCollection()
          .modify((dish) => {
            dish.mealTypes = dish.mealTypes?.length ? dish.mealTypes : ['dinner'];
            dish.category = dish.category ?? 'uncategorized';
          });
      });
    this.version(4)
      .stores({
        dishes: '++id, name, lastCookedAt, category',
        weeklyPlans: '++id, [day+meal+slot], day, meal, dishId',
        mealSettings: '++id, [day+meal], day, meal',
      })
      .upgrade(async (transaction) => {
        await transaction
          .table<MealSetting & { dishCount?: number }, number>('mealSettings')
          .toCollection()
          .modify((setting) => {
            setting.vegetableCount = setting.dishCount ?? 0;
            setting.meatCount = 0;
            setting.soupCount = 0;
            delete setting.dishCount;
          });
      });
  }
}

export const db = new CookDb();
