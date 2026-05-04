import { FormEvent, useState } from 'react';
import type { DishCategory, MealType } from '../db';
import { MEAL_TYPES } from '../planner';

export const DISH_CATEGORIES: Array<{ value: DishCategory; label: string }> = [
  { value: 'uncategorized', label: '無分類' },
  { value: 'vegetable', label: '菜' },
  { value: 'meat', label: '肉' },
  { value: 'soup', label: '湯' },
];

type DishFormProps = {
  onAddDish: (dish: { name: string; mealTypes: MealType[]; category: DishCategory }) => Promise<void>;
  className?: string;
  onCancel?: () => void;
};

export function DishForm({ onAddDish, className = 'card dish-form', onCancel }: DishFormProps) {
  const [name, setName] = useState('');
  const [mealTypes, setMealTypes] = useState<MealType[]>(['dinner']);
  const [category, setCategory] = useState<DishCategory>('uncategorized');

  const canSubmit = name.trim().length > 0 && mealTypes.length > 0;

  function toggleMealType(mealType: MealType) {
    setMealTypes((current) =>
      current.includes(mealType) ? current.filter((item) => item !== mealType) : [...current, mealType],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || mealTypes.length === 0) return;

    await onAddDish({ name: trimmedName, mealTypes, category });
    setName('');
    setMealTypes(['dinner']);
    setCategory('uncategorized');
  }

  return (
    <form className={className} onSubmit={handleSubmit}>
      <h2>新增菜品</h2>
      <label className="field">
        <span>菜名</span>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：番茄炒蛋" />
      </label>

      <fieldset className="option-group">
        <legend>適用餐別</legend>
        <div className="option-row">
          {MEAL_TYPES.map((mealType) => (
            <label key={mealType.value} className="choice-chip">
              <input
                type="checkbox"
                checked={mealTypes.includes(mealType.value)}
                onChange={() => toggleMealType(mealType.value)}
              />
              {mealType.label}
            </label>
          ))}
        </div>
        {mealTypes.length === 0 && <p className="form-error">至少選一個餐別</p>}
      </fieldset>

      <fieldset className="option-group">
        <legend>分類</legend>
        <div className="option-row">
          {DISH_CATEGORIES.map((item) => (
            <label key={item.value} className="choice-chip">
              <input
                type="radio"
                name="dish-category"
                checked={category === item.value}
                onChange={() => setCategory(item.value)}
              />
              {item.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="modal-actions">
        {onCancel && (
          <button type="button" className="neutral" onClick={onCancel}>
            取消
          </button>
        )}
        <button type="submit" disabled={!canSubmit}>
          新增
        </button>
      </div>
    </form>
  );
}
