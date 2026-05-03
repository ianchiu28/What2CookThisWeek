import Dexie, { type Table } from 'dexie';

export type Dish = {
  id?: number;
  name: string;
  lastCookedAt?: number;
};

export type WeeklyPlan = {
  id?: number;
  day: number;
  dishId: number;
};

class CookDb extends Dexie {
  dishes!: Table<Dish, number>;
  weeklyPlans!: Table<WeeklyPlan, number>;

  constructor() {
    super('What2CookThisWeek');
    this.version(1).stores({
      dishes: '++id, name, lastCookedAt',
      weeklyPlans: '++id, day, dishId',
    });
  }
}

export const db = new CookDb();
