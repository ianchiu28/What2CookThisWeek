import Dexie, { type Table } from 'dexie';

export type Dish = {
  id?: number;
  name: string;
  lastCookedAt?: number;
};

export type MealType = 'breakfast' | 'lunch' | 'dinner';

export type MealSetting = {
  id?: number;
  day: number;
  meal: MealType;
  enabled: boolean;
  dishCount: number;
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
  }
}

export const db = new CookDb();
