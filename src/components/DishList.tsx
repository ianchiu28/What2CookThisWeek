import { FormEvent, useMemo, useState } from 'react';
import type { Dish, DishCategory, MealType } from '../db';
import { MEAL_TYPES } from '../planner';
import { DISH_CATEGORIES, DishForm } from './DishForm';

type MealFilter = MealType | 'all';
type CategoryFilter = DishCategory | 'all';

type DishListProps = {
  dishes: Dish[];
  onAddDish: (dish: { name: string; mealTypes: MealType[]; category: DishCategory }) => Promise<void>;
  onDeleteDish: (id: number) => Promise<void>;
  onUpdateDish: (dish: Dish) => Promise<void>;
};

function mealLabel(value: MealType) {
  return MEAL_TYPES.find((mealType) => mealType.value === value)?.label ?? value;
}

function categoryLabel(value: DishCategory) {
  return DISH_CATEGORIES.find((category) => category.value === value)?.label ?? value;
}

function dishMetadata(dish: Dish) {
  return `${dish.mealTypes.map(mealLabel).join('、')} · ${categoryLabel(dish.category)}`;
}

export function DishList({ dishes, onAddDish, onDeleteDish, onUpdateDish }: DishListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [mealFilter, setMealFilter] = useState<MealFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [editingDish, setEditingDish] = useState<Dish | null>(null);
  const [isAddingDish, setIsAddingDish] = useState(false);
  const [editName, setEditName] = useState('');
  const [editMealTypes, setEditMealTypes] = useState<MealType[]>([]);
  const [editCategory, setEditCategory] = useState<DishCategory>('uncategorized');

  const filteredDishes = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return dishes.filter((dish) => {
      const matchesSearch = normalizedSearch.length === 0 || dish.name.toLowerCase().includes(normalizedSearch);
      const matchesMeal = mealFilter === 'all' || dish.mealTypes.includes(mealFilter);
      const matchesCategory = categoryFilter === 'all' || dish.category === categoryFilter;
      return matchesSearch && matchesMeal && matchesCategory;
    });
  }, [categoryFilter, dishes, mealFilter, searchTerm]);

  const canSave = editName.trim().length > 0 && editMealTypes.length > 0;
  const activeFilterCount = Number(mealFilter !== 'all') + Number(categoryFilter !== 'all');

  function startEditing(dish: Dish) {
    setEditingDish(dish);
    setEditName(dish.name);
    setEditMealTypes(dish.mealTypes);
    setEditCategory(dish.category);
  }

  function toggleEditMealType(mealType: MealType) {
    setEditMealTypes((current) =>
      current.includes(mealType) ? current.filter((item) => item !== mealType) : [...current, mealType],
    );
  }

  async function handleAddDish(dish: { name: string; mealTypes: MealType[]; category: DishCategory }) {
    await onAddDish(dish);
    setIsAddingDish(false);
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingDish || !canSave) return;

    await onUpdateDish({ ...editingDish, name: editName.trim(), mealTypes: editMealTypes, category: editCategory });
    setEditingDish(null);
  }

  return (
    <section className="card">
      <div className="section-heading">
        <h2>菜品列表</h2>
        <button type="button" className="compact-button" onClick={() => setIsAddingDish(true)}>
          新增
        </button>
      </div>
      <div className="list-toolbar">
        <div className="search-filter-control">
          <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="搜尋菜名" />
          <button
            type="button"
            className="icon-button filter-icon-button"
            aria-label={activeFilterCount > 0 ? `篩選 · ${activeFilterCount}` : '篩選'}
            onClick={() => setShowFilters((current) => !current)}
          >
            {activeFilterCount > 0 ? activeFilterCount : '⌯'}
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="filter-panel">
          <label className="field compact-field">
            <span>餐別篩選</span>
            <select value={mealFilter} onChange={(event) => setMealFilter(event.target.value as MealFilter)} aria-label="餐別篩選">
              <option value="all">全部餐別</option>
              {MEAL_TYPES.map((mealType) => (
                <option key={mealType.value} value={mealType.value}>
                  {mealType.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field compact-field">
            <span>分類篩選</span>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value as CategoryFilter)}
              aria-label="分類篩選"
            >
              <option value="all">全部分類</option>
              {DISH_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {dishes.length === 0 ? (
        <p className="muted">還沒有菜，先新增幾道會做的菜。</p>
      ) : filteredDishes.length === 0 ? (
        <p className="muted">找不到符合條件的菜品。</p>
      ) : (
        <ul className="dish-list">
          {filteredDishes.map((dish) => (
            <li key={dish.id} className="dish-item">
              <div className="dish-details">
                <strong>{dish.name}</strong>
                <span className="dish-metadata">{dishMetadata(dish)}</span>
              </div>
              <div className="dish-actions">
                <button type="button" className="icon-button" aria-label={`編輯 ${dish.name}`} onClick={() => startEditing(dish)}>
                  ✎
                </button>
                <button
                  type="button"
                  className="icon-button danger-icon-button"
                  aria-label={`刪除 ${dish.name}`}
                  onClick={() => dish.id && onDeleteDish(dish.id)}
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {isAddingDish && (
        <div className="modal-backdrop">
          <div className="modal-card" role="dialog" aria-modal="true" aria-label="新增菜品">
            <DishForm className="dish-form" onAddDish={handleAddDish} onCancel={() => setIsAddingDish(false)} />
          </div>
        </div>
      )}

      {editingDish && (
        <div className="modal-backdrop">
          <form className="modal-card" role="dialog" aria-modal="true" aria-label="編輯菜品" onSubmit={handleEditSubmit}>
            <h2>編輯菜品</h2>
            <label className="field">
              <span>菜名</span>
              <input value={editName} onChange={(event) => setEditName(event.target.value)} />
            </label>

            <fieldset className="option-group">
              <legend>適用餐別</legend>
              <div className="option-row">
                {MEAL_TYPES.map((mealType) => (
                  <label key={mealType.value} className="choice-chip">
                    <input
                      type="checkbox"
                      checked={editMealTypes.includes(mealType.value)}
                      onChange={() => toggleEditMealType(mealType.value)}
                    />
                    {mealType.label}
                  </label>
                ))}
              </div>
              {editMealTypes.length === 0 && <p className="form-error">至少選一個餐別</p>}
            </fieldset>

            <fieldset className="option-group">
              <legend>分類</legend>
              <div className="option-row">
                {DISH_CATEGORIES.map((item) => (
                  <label key={item.value} className="choice-chip">
                    <input
                      type="radio"
                      name="edit-dish-category"
                      checked={editCategory === item.value}
                      onChange={() => setEditCategory(item.value)}
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="modal-actions">
              <button type="button" className="neutral" onClick={() => setEditingDish(null)}>
                取消
              </button>
              <button type="submit" disabled={!canSave}>
                儲存
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
