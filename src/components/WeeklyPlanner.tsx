import { useMemo, useState } from 'react';
import type { Dish, MealType, WeeklyPlan } from '../db';
import { aggregateShoppingList } from '../ingredients';
import { DAYS, MEAL_TYPES } from '../planner';
import { ShoppingListModal } from './ShoppingListModal';

const MEAL_PILL_LABELS: Record<MealType, string> = {
  breakfast: '早',
  lunch: '午',
  dinner: '晚',
};

const MEAL_FULL_LABELS: Record<MealType, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
};

type WeeklyPlannerProps = {
  dishes: Dish[];
  weeklyPlans: WeeklyPlan[];
  onGenerate: () => Promise<void>;
  canGenerate: boolean;
};

type VisibleRow = {
  meal: MealType;
  plan: WeeklyPlan;
};

type VisibleDay = {
  day: number;
  dayName: string;
  rows: VisibleRow[];
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

    return DAYS.map((dayName, day) => {
      const rows = MEAL_TYPES.flatMap(({ value }) =>
        (plansByMeal.get(planKey(day, value)) ?? []).map((plan) => ({ meal: value, plan })),
      );
      return { day, dayName, rows };
    }).filter((day) => day.rows.length > 0);
  }, [weeklyPlans]);

  const shoppingItems = useMemo(() => aggregateShoppingList(weeklyPlans, dishes), [weeklyPlans, dishes]);
  const hasPlans = weeklyPlans.length > 0;

  return (
    <>
      <section className="card menu-card">
        <div className="section-heading">
          <h2>本週菜單</h2>
          <button
            type="button"
            className="compact-button neutral"
            aria-label="採買清單"
            disabled={!hasPlans}
            onClick={() => setShowShoppingList(true)}
          >
            🛒 採買清單
          </button>
        </div>

        {!canGenerate && <p className="menu-empty">新增至少一道菜後就可以自動排菜。</p>}

        {canGenerate && visibleDays.length === 0 && (
          <p className="menu-empty">尚未產生菜單，請按右下「產生本週菜單」。</p>
        )}

        {visibleDays.length > 0 && (
          <div>
            {visibleDays.map((day) => (
              <div className="day-section" key={day.dayName}>
                <div className="day-head">
                  <span className="day-name">{day.dayName}</span>
                  <span className="day-count">{day.rows.length} 道</span>
                </div>
                {day.rows.map(({ meal, plan }) => {
                  const dish = plan.dishId !== undefined ? dishesById.get(plan.dishId) : undefined;
                  const name = dish?.name ?? '尚未安排';
                  const ingredients = dish?.ingredients ?? [];
                  const isUnassigned = !dish;
                  return (
                    <div className="menu-row" key={`${plan.day}-${plan.meal}-${plan.slot}`}>
                      <span className="menu-pill" aria-label={MEAL_FULL_LABELS[meal]}>
                        {MEAL_PILL_LABELS[meal]}
                      </span>
                      <div>
                        <div className={isUnassigned ? 'menu-dish-name unassigned' : 'menu-dish-name'}>
                          {name}
                        </div>
                        {ingredients.length > 0 && (
                          <div className="menu-dish-ing">{ingredients.join('・')}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </section>

      <button
        type="button"
        className="menu-fab"
        aria-label="產生本週菜單"
        disabled={!canGenerate}
        onClick={onGenerate}
      >
        {hasPlans ? '↻ 重新產生' : '產生本週菜單'}
      </button>

      {showShoppingList && (
        <ShoppingListModal items={shoppingItems} onClose={() => setShowShoppingList(false)} />
      )}
    </>
  );
}
