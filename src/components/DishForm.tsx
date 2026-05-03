import { FormEvent, useState } from 'react';

type DishFormProps = {
  onAddDish: (name: string) => Promise<void>;
};

export function DishForm({ onAddDish }: DishFormProps) {
  const [name, setName] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    await onAddDish(trimmedName);
    setName('');
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h2>新增菜</h2>
      <div className="row">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：番茄炒蛋" />
        <button type="submit">新增</button>
      </div>
    </form>
  );
}
