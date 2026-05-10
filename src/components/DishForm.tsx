import { FormEvent, useState } from 'react';
import type { DishCategory, MealType } from '../db';
import { parseIngredients } from '../ingredients';
import { MEAL_TYPES } from '../planner';

export const DISH_CATEGORIES: Array<{ value: DishCategory; label: string }> = [
  { value: 'uncategorized', label: '無分類' },
  { value: 'vegetable', label: '菜' },
  { value: 'meat', label: '肉' },
  { value: 'soup', label: '湯' },
];

export type DishFormValue = {
  name: string;
  mealTypes: MealType[];
  category: DishCategory;
  ingredients: string[];
};

type DishFormProps = {
  onSubmitDish: (dish: DishFormValue) => Promise<void>;
  className?: string;
  title?: string;
  submitLabel?: string;
  initialDish?: DishFormValue;
  categoryInputName?: string;
  onCancel?: () => void;
};

const defaultDish: DishFormValue = {
  name: '',
  mealTypes: ['dinner'],
  category: 'uncategorized',
  ingredients: [],
};

export function DishForm({
  onSubmitDish,
  className = 'card dish-form',
  title = '新增菜品',
  submitLabel = '新增',
  initialDish = defaultDish,
  categoryInputName = 'dish-category',
  onCancel,
}: DishFormProps) {
  const [name, setName] = useState(initialDish.name);
  const [mealTypes, setMealTypes] = useState<MealType[]>(initialDish.mealTypes);
  const [category, setCategory] = useState<DishCategory>(initialDish.category);
  const [ingredientsText, setIngredientsText] = useState(initialDish.ingredients.join('、'));

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

    await onSubmitDish({
      name: trimmedName,
      mealTypes,
      category,
      ingredients: parseIngredients(ingredientsText),
    });
    setName(initialDish.name);
    setMealTypes(initialDish.mealTypes);
    setCategory(initialDish.category);
    setIngredientsText(initialDish.ingredients.join('、'));
  }

  return (
    <form className={className} onSubmit={handleSubmit}>
      <h2>{title}</h2>
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
                name={categoryInputName}
                checked={category === item.value}
                onChange={() => setCategory(item.value)}
              />
              {item.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="field">
        <span>材料（可選）</span>
        <textarea
          value={ingredientsText}
          onChange={(event) => setIngredientsText(event.target.value)}
          placeholder="用空白、頓號、逗號分開，例如：番茄 蛋 蔥"
          rows={2}
        />
      </label>

      <div className="modal-actions">
        {onCancel && (
          <button type="button" className="neutral" onClick={onCancel}>
            取消
          </button>
        )}
        <button type="submit" disabled={!canSubmit}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
