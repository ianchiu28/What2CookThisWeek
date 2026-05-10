import type { Dish, WeeklyPlan } from './db';

const SEPARATOR = /[\s,，、;；]+/;

const strokeCollator = new Intl.Collator('zh-Hant-TW', { collation: 'stroke' });

export function aggregateShoppingList(plans: WeeklyPlan[], dishes: Dish[]): string[] {
  const dishById = new Map<number, Dish>();
  for (const dish of dishes) {
    if (typeof dish.id === 'number') dishById.set(dish.id, dish);
  }
  const seen = new Set<string>();
  for (const plan of plans) {
    if (plan.dishId === undefined) continue;
    const dish = dishById.get(plan.dishId);
    if (!dish) continue;
    for (const ingredient of dish.ingredients) {
      seen.add(ingredient);
    }
  }
  return Array.from(seen).sort(strokeCollator.compare);
}

export function parseIngredients(input: string): string[] {
  const tokens = input.split(SEPARATOR).map((token) => token.trim()).filter((token) => token.length > 0);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const token of tokens) {
    if (seen.has(token)) continue;
    seen.add(token);
    result.push(token);
  }
  return result;
}
