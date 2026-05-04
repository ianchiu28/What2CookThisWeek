import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import App from './App';

vi.mock('./db', () => ({
  db: {
    dishes: {
      orderBy: () => ({ toArray: () => Promise.resolve([]) }),
      add: vi.fn(),
      delete: vi.fn(),
    },
    weeklyPlans: {
      orderBy: () => ({ toArray: () => Promise.resolve([]) }),
      where: () => ({ equals: () => ({ delete: vi.fn() }) }),
      clear: vi.fn(),
      bulkAdd: vi.fn(),
    },
    transaction: vi.fn(),
  },
}));

describe('App', () => {
  test('shows the app title as 這週煮什麼？', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: '這週煮什麼？' })).toBeInTheDocument();
  });
});
