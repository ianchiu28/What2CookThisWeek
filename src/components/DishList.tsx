import type { Dish } from '../db';

type DishListProps = {
  dishes: Dish[];
  onDeleteDish: (id: number) => Promise<void>;
};

export function DishList({ dishes, onDeleteDish }: DishListProps) {
  return (
    <section className="card">
      <h2>菜列表</h2>
      {dishes.length === 0 ? (
        <p className="muted">還沒有菜，先新增幾道會做的菜。</p>
      ) : (
        <ul className="dish-list">
          {dishes.map((dish) => (
            <li key={dish.id}>
              <span>{dish.name}</span>
              <button type="button" className="secondary" onClick={() => dish.id && onDeleteDish(dish.id)}>
                刪除
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
