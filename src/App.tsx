import { useEffect, useState } from 'react';
import { DishList } from './components/DishList';
import { MealSettings } from './components/MealSettings';
import { WeeklyPlanner } from './components/WeeklyPlanner';
import { db, type Dish, type DishCategory, type MealSetting, type MealType, type WeeklyPlan } from './db';
import { createDefaultMealSettings, generateWeeklyPlans } from './planner';

type ActiveTab = 'menu' | 'dishes' | 'settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('menu');
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [weeklyPlans, setWeeklyPlans] = useState<WeeklyPlan[]>([]);
  const [mealSettings, setMealSettings] = useState<MealSetting[]>([]);

  async function loadData() {
    const [storedDishes, storedPlans, storedSettings] = await Promise.all([
      db.dishes.orderBy('name').toArray(),
      db.weeklyPlans.orderBy('[day+meal+slot]').toArray(),
      db.mealSettings.orderBy('[day+meal]').toArray(),
    ]);

    setDishes(storedDishes);
    setWeeklyPlans(storedPlans);

    if (storedSettings.length === 0) {
      const defaultSettings = createDefaultMealSettings();
      await db.mealSettings.bulkAdd(defaultSettings);
      const savedDefaultSettings = await db.mealSettings.orderBy('[day+meal]').toArray();
      setMealSettings(savedDefaultSettings);
      return;
    }

    setMealSettings(storedSettings);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function addDish(dish: { name: string; mealTypes: MealType[]; category: DishCategory }) {
    await db.dishes.add(dish);
    await loadData();
  }

  async function updateDish(dish: Dish) {
    await db.dishes.put(dish);
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
    const plans = generateWeeklyPlans(dishes, mealSettings);
    await db.transaction('rw', db.weeklyPlans, async () => {
      await db.weeklyPlans.clear();
      await db.weeklyPlans.bulkAdd(plans);
    });
    await loadData();
  }

  async function updateMealSetting(setting: MealSetting) {
    await db.mealSettings.put(setting);
    await loadData();
  }

  return (
    <main className="app-shell">
      <header>
        <p className="eyebrow">What2CookThisWeek</p>
        <h1>這週煮什麼？</h1>
      </header>

      {activeTab === 'menu' && (
        <WeeklyPlanner dishes={dishes} weeklyPlans={weeklyPlans} onGenerate={generatePlans} canGenerate={dishes.length > 0} />
      )}

      {activeTab === 'dishes' && <DishList dishes={dishes} onAddDish={addDish} onDeleteDish={deleteDish} onUpdateDish={updateDish} />}

      {activeTab === 'settings' && <MealSettings settings={mealSettings} onChangeSetting={updateMealSetting} />}

      <nav className="bottom-tabs" aria-label="主要功能">
        <button type="button" className={activeTab === 'menu' ? 'active' : ''} onClick={() => setActiveTab('menu')}>
          本週菜單
        </button>
        <button type="button" className={activeTab === 'dishes' ? 'active' : ''} onClick={() => setActiveTab('dishes')}>
          菜品設定
        </button>
        <button type="button" className={activeTab === 'settings' ? 'active' : ''} onClick={() => setActiveTab('settings')}>
          排餐設定
        </button>
      </nav>
    </main>
  );
}
