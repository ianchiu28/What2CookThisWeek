import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ShoppingListModal } from './ShoppingListModal';

describe('ShoppingListModal', () => {
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
  });

  afterEach(() => {
    cleanup();
  });

  test('renders items as a list', () => {
    render(<ShoppingListModal items={['番茄', '蛋', '蔥']} onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: '本週採買清單' });
    expect(within(dialog).getByText('番茄')).toBeInTheDocument();
    expect(within(dialog).getByText('蛋')).toBeInTheDocument();
    expect(within(dialog).getByText('蔥')).toBeInTheDocument();
  });

  test('shows empty message and disables copy when items is empty', () => {
    render(<ShoppingListModal items={[]} onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: '本週採買清單' });
    expect(within(dialog).getByText('目前菜單中的菜品都沒有設定材料。')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '複製清單' })).toBeDisabled();
  });

  test('close button calls onClose', () => {
    const onClose = vi.fn();
    render(<ShoppingListModal items={['番茄']} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: '關閉' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('copy button writes newline-joined items to clipboard', async () => {
    render(<ShoppingListModal items={['番茄', '蛋', '蔥']} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: '複製清單' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText).toHaveBeenCalledWith('番茄\n蛋\n蔥');
  });

  test('copy button shows confirmation text after success', async () => {
    render(<ShoppingListModal items={['番茄']} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: '複製清單' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '已複製 ✓' })).toBeInTheDocument();
    });
  });
});
