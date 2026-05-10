import { useState } from 'react';

type ShoppingListModalProps = {
  items: string[];
  onClose: () => void;
};

export function ShoppingListModal({ items, onClose }: ShoppingListModalProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');

  async function handleCopy() {
    if (items.length === 0) return;
    await navigator.clipboard.writeText(items.join('\n'));
    setCopyState('copied');
    setTimeout(() => setCopyState('idle'), 2000);
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card" role="dialog" aria-modal="true" aria-label="本週採買清單">
        <h2>本週採買清單</h2>
        {items.length === 0 ? (
          <p className="muted">目前菜單中的菜品都沒有設定材料。</p>
        ) : (
          <ul className="shopping-list">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
        <div className="modal-actions">
          <button type="button" className="neutral" onClick={onClose}>
            關閉
          </button>
          <button type="button" disabled={items.length === 0} onClick={handleCopy}>
            {copyState === 'copied' ? '已複製 ✓' : '複製清單'}
          </button>
        </div>
      </div>
    </div>
  );
}
