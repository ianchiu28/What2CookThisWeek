import type { Dish, WeeklyPlan } from '../db';

const DAYS = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];

type WeeklyPlannerProps = {
  dishes: Dish[];
  weeklyPlans: WeeklyPlan[];
  onGenerate: () => Promise<void>;
};

export function WeeklyPlanner({ dishes, weeklyPlans, onGenerate }: WeeklyPlannerProps) {
  function getDishName(day: number) {
    const plan = weeklyPlans.find((item) => item.day === day);
    const dish = dishes.find((item) => item.id === plan?.dishId);
    return dish?.name ?? '尚未安排';
  }

  return (
    <section className="card">
      <div className="section-heading">
        <h2>本週晚餐</h2>
        <button type="button" onClick={onGenerate} disabled={dishes.length === 0}>
          產生本週菜單
        </button>
      </div>
      {dishes.length === 0 && <p className="muted">新增至少一道菜後就可以自動排菜。</p>}
      <div className="week-grid">
        {DAYS.map((dayName, day) => (
          <div className="day-card" key={dayName}>
            <strong>{dayName}</strong>
            <span>{getDishName(day)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
