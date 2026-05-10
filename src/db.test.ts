import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, test } from 'vitest';
import { db } from './db';

describe('dish metadata migration', () => {
  afterEach(async () => {
    await db.delete();
    await Dexie.delete('What2CookThisWeek');
  });

  test('backfills old dishes with dinner and uncategorized defaults', async () => {
    await db.delete();
    await Dexie.delete('What2CookThisWeek');

    const legacyDb = new Dexie('What2CookThisWeek');
    legacyDb.version(2).stores({
      dishes: '++id, name, lastCookedAt',
      weeklyPlans: '++id, [day+meal+slot], day, meal, dishId',
      mealSettings: '++id, [day+meal], day, meal',
    });

    await legacyDb.table('dishes').add({ name: '番茄炒蛋' });
    await legacyDb.close();

    await db.open();
    const dishes = await db.dishes.toArray();

    expect(dishes).toEqual([
      {
        id: 1,
        name: '番茄炒蛋',
        mealTypes: ['dinner'],
        category: 'uncategorized',
        ingredients: [],
      },
    ]);
  });
});
