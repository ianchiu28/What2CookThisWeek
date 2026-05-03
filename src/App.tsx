import { useEffect, useState } from 'react';
import { DishForm } from './components/DishForm';
import { DishList } from './components/DishList';
import { WeeklyPlanner } from './components/WeeklyPlanner';
import { db, type Dish, type WeeklyPlan } from './db';
import { generateWeeklyPlans } from './planner';

export default function App() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [weeklyPlans, setWeeklyPlans] = useState<WeeklyPlan[]>([]);

  async function loadData() {
    const [storedDishes, storedPlans] = await Promise.all([
      db.dishes.orderBy('name').toArray(),
      db.weeklyPlans.orderBy('day').toArray(),
    ]);
    setDishes(storedDishes);
    setWeeklyPlans(storedPlans);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function addDish(name: string) {
    await db.dishes.add({ name });
    await loadData();
  }

  async function deleteDish(id: number) {
    await db.transaction('rw', db.dishes, db.weeklyPlans, async () => {
      await db.dishes.delete(id);
      await db.weeklyPlans.where('dishId').equals(id).delete();
    });
    await loadData();
  }

  async function generatePlans() {
    const plans = generateWeeklyPlans(dishes);
    await db.transaction('rw', db.weeklyPlans, async () => {
      await db.weeklyPlans.clear();
      await db.weeklyPlans.bulkAdd(plans);
    });
    await loadData();
  }

  return (
    <main className="app-shell">
      <header>
        <p className="eyebrow">What2CookThisWeek</p>
        <h1>每週煮菜排程</h1>
      </header>
      <DishForm onAddDish={addDish} />
      <DishList dishes={dishes} onDeleteDish={deleteDish} />
      <WeeklyPlanner dishes={dishes} weeklyPlans={weeklyPlans} onGenerate={generatePlans} />
    </main>
  );
}
