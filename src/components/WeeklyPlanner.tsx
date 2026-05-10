import { useMemo, useState } from 'react';
import type { Dish, MealType, WeeklyPlan } from '../db';
import { aggregateShoppingList } from '../ingredients';
import { DAYS, MEAL_TYPES } from '../planner';
import { ShoppingListModal } from './ShoppingListModal';

type WeeklyPlannerProps = {
  dishes: Dish[];
  weeklyPlans: WeeklyPlan[];
  onGenerate: () => Promise<void>;
  canGenerate: boolean;
};

type VisibleMeal = {
  meal: MealType;
  label: string;
  plans: WeeklyPlan[];
};

type VisibleDay = {
  day: number;
  dayName: string;
  meals: VisibleMeal[];
};

function planKey(day: number, meal: MealType) {
  return `${day}-${meal}`;
}

export function WeeklyPlanner({ dishes, weeklyPlans, onGenerate, canGenerate }: WeeklyPlannerProps) {
  const [showShoppingList, setShowShoppingList] = useState(false);

  const dishesById = useMemo(() => {
    const map = new Map<number, Dish>();
    for (const dish of dishes) {
      if (typeof dish.id === 'number') map.set(dish.id, dish);
    }
    return map;
  }, [dishes]);

  const visibleDays = useMemo<VisibleDay[]>(() => {
    const plansByMeal = new Map<string, WeeklyPlan[]>();

    weeklyPlans.forEach((plan) => {
      const key = planKey(plan.day, plan.meal);
      plansByMeal.set(key, [...(plansByMeal.get(key) ?? []), plan]);
    });

    plansByMeal.forEach((plans) => {
      plans.sort((a, b) => a.slot - b.slot);
    });

    return DAYS.map((dayName, day) => ({
      day,
      dayName,
      meals: MEAL_TYPES.map(({ value, label }) => ({
        meal: value,
        label,
        plans: plansByMeal.get(planKey(day, value)) ?? [],
      })).filter((meal) => meal.plans.length > 0),
    })).filter((day) => day.meals.length > 0);
  }, [weeklyPlans]);

  const shoppingItems = useMemo(() => aggregateShoppingList(weeklyPlans, dishes), [weeklyPlans, dishes]);
  const hasPlans = weeklyPlans.length > 0;

  return (
    <section className="card menu-card">
      <div className="section-heading">
        <h2>本週菜單</h2>
        <div className="menu-actions">
          <button
            type="button"
            className="neutral"
            disabled={!hasPlans}
            onClick={() => setShowShoppingList(true)}
          >
            採買清單
          </button>
          <button type="button" onClick={onGenerate} disabled={!canGenerate}>
            產生本週菜單
          </button>
        </div>
      </div>
      {!canGenerate && <p className="muted">新增至少一道菜後就可以自動排菜。</p>}
      {visibleDays.length === 0 ? (
        <p className="muted">尚未產生菜單，請先確認排餐設定後產生本週菜單。</p>
      ) : (
        <div className="week-menu">
          {visibleDays.map((day) => (
            <div className="day-card" key={day.dayName}>
              <strong>{day.dayName}</strong>
              {day.meals.map((meal) => (
                <div className="meal-block" key={meal.meal}>
                  <span className="meal-label">{meal.label}</span>
                  <ul className="menu-dishes">
                    {meal.plans.map((plan) => {
                      const dish = plan.dishId !== undefined ? dishesById.get(plan.dishId) : undefined;
                      const name = dish?.name ?? '尚未安排';
                      const ingredients = dish?.ingredients ?? [];
                      return (
                        <li key={`${plan.day}-${plan.meal}-${plan.slot}`}>
                          <span className="dish-name">{name}</span>
                          {ingredients.length > 0 && (
                            <span className="dish-ingredients">{ingredients.join('・')}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {showShoppingList && (
        <ShoppingListModal items={shoppingItems} onClose={() => setShowShoppingList(false)} />
      )}
    </section>
  );
}
