import { useMemo } from 'react';
import type { Dish, MealType, WeeklyPlan } from '../db';
import { DAYS, MEAL_TYPES } from '../planner';

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
  const dishNames = useMemo(() => new Map(dishes.map((dish) => [dish.id, dish.name])), [dishes]);

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

  function getDishName(plan: WeeklyPlan) {
    return dishNames.get(plan.dishId) ?? '尚未安排';
  }

  return (
    <section className="card menu-card">
      <div className="section-heading">
        <h2>本週菜單</h2>
        <button type="button" onClick={onGenerate} disabled={!canGenerate}>
          產生本週菜單
        </button>
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
                    {meal.plans.map((plan) => (
                      <li key={`${plan.day}-${plan.meal}-${plan.slot}`}>{getDishName(plan)}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
