export type PlannerDish = {
  id?: number;
  name: string;
  lastCookedAt?: number;
};

export type GeneratedPlan = {
  day: number;
  dishId: number;
};

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

export function generateWeeklyPlans(dishes: PlannerDish[]): GeneratedPlan[] {
  const availableDishes = dishes.filter((dish) => typeof dish.id === 'number');
  if (availableDishes.length === 0) return [];

  const shuffled = shuffle(availableDishes);

  return Array.from({ length: 7 }, (_, day) => {
    const dish = availableDishes.length >= 7 ? shuffled[day] : shuffled[day % shuffled.length];
    return { day, dishId: dish.id! };
  });
}
