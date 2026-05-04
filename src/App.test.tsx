import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { MealSetting, WeeklyPlan } from './db';
import App from './App';

const mockState = vi.hoisted(() => {
  let weeklyPlansData: WeeklyPlan[] = [];
  let mealSettingsData: MealSetting[] = [];

  const dishesAdd = vi.fn();
  const dishesDelete = vi.fn();
  const weeklyPlansClear = vi.fn(async () => {
    weeklyPlansData = [];
  });
  const weeklyPlansBulkAdd = vi.fn(async (plans: WeeklyPlan[]) => {
    weeklyPlansData = plans;
  });
  const mealSettingsBulkAdd = vi.fn(async (settings: MealSetting[]) => {
    mealSettingsData = settings.map((setting, index) => ({ ...setting, id: index + 1 }));
  });
  const mealSettingsPut = vi.fn(async (setting: MealSetting) => {
    mealSettingsData = mealSettingsData.map((item) => (item.id === setting.id ? setting : item));
  });

  return {
    dishesData: [{ id: 1, name: '番茄炒蛋' }],
    get weeklyPlansData() {
      return weeklyPlansData;
    },
    set weeklyPlansData(value: WeeklyPlan[]) {
      weeklyPlansData = value;
    },
    get mealSettingsData() {
      return mealSettingsData;
    },
    set mealSettingsData(value: MealSetting[]) {
      mealSettingsData = value;
    },
    dishesAdd,
    dishesDelete,
    weeklyPlansClear,
    weeklyPlansBulkAdd,
    mealSettingsBulkAdd,
    mealSettingsPut,
  };
});

vi.mock('./db', () => ({
  db: {
    dishes: {
      orderBy: () => ({ toArray: () => Promise.resolve(mockState.dishesData) }),
      add: mockState.dishesAdd,
      delete: mockState.dishesDelete,
    },
    weeklyPlans: {
      orderBy: () => ({ toArray: () => Promise.resolve(mockState.weeklyPlansData) }),
      where: () => ({ equals: () => ({ delete: vi.fn() }) }),
      clear: mockState.weeklyPlansClear,
      bulkAdd: mockState.weeklyPlansBulkAdd,
    },
    mealSettings: {
      orderBy: () => ({ toArray: () => Promise.resolve(mockState.mealSettingsData) }),
      bulkAdd: mockState.mealSettingsBulkAdd,
      put: mockState.mealSettingsPut,
    },
    transaction: vi.fn(async (_mode: string, ...args: unknown[]) => {
      const callback = args[args.length - 1] as () => Promise<void>;
      await callback();
    }),
  },
}));

describe('App', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mockState.weeklyPlansData = [];
    mockState.mealSettingsData = [];
    vi.clearAllMocks();
  });

  test('shows the app title as 這週煮什麼？', async () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: '這週煮什麼？' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '本週菜單' })).toBeInTheDocument();
  });

  test('uses 本週菜單 as the default view and moves dish management out of the primary view', async () => {
    render(<App />);

    expect(await screen.findByRole('heading', { name: '本週菜單' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '新增菜' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '菜列表' })).not.toBeInTheDocument();
    expect(screen.queryByText('本週晚餐')).not.toBeInTheDocument();
  });

  test('switches between bottom tabs', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: '本週菜單' });

    fireEvent.click(screen.getByRole('button', { name: '菜品設定' }));
    expect(screen.getByRole('heading', { name: '新增菜' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '菜列表' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '排餐設定' }));
    expect(screen.getByRole('heading', { name: '排餐設定' })).toBeInTheDocument();
  });

  test('initializes default meal settings when none are saved', async () => {
    render(<App />);

    await waitFor(() => expect(mockState.mealSettingsBulkAdd).toHaveBeenCalledTimes(1));
    const savedSettings = mockState.mealSettingsBulkAdd.mock.calls[0][0] as MealSetting[];

    expect(savedSettings.filter((setting) => setting.enabled)).toEqual([
      { day: 0, meal: 'dinner', enabled: true, dishCount: 1 },
      { day: 1, meal: 'dinner', enabled: true, dishCount: 1 },
      { day: 2, meal: 'dinner', enabled: true, dishCount: 1 },
      { day: 3, meal: 'dinner', enabled: true, dishCount: 1 },
      { day: 4, meal: 'dinner', enabled: true, dishCount: 1 },
    ]);
  });

  test('persists meal setting changes immediately', async () => {
    render(<App />);
    await waitFor(() => expect(mockState.mealSettingsBulkAdd).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: '排餐設定' }));
    fireEvent.click(screen.getAllByLabelText('早餐')[0]);

    await waitFor(() => expect(mockState.mealSettingsPut).toHaveBeenCalled());
    expect(mockState.mealSettingsPut.mock.calls.at(-1)?.[0]).toMatchObject({ day: 0, meal: 'breakfast', enabled: true });
  });

  test('generates the weekly menu from saved settings', async () => {
    mockState.mealSettingsData = [
      { id: 1, day: 0, meal: 'breakfast', enabled: true, dishCount: 1 },
      { id: 2, day: 0, meal: 'lunch', enabled: false, dishCount: 1 },
      { id: 3, day: 0, meal: 'dinner', enabled: true, dishCount: 1 },
    ];

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '產生本週菜單' }));

    await waitFor(() => expect(mockState.weeklyPlansBulkAdd).toHaveBeenCalledTimes(1));
    expect(mockState.weeklyPlansBulkAdd.mock.calls[0][0]).toEqual([
      { day: 0, meal: 'breakfast', slot: 0, dishId: 1 },
      { day: 0, meal: 'dinner', slot: 0, dishId: 1 },
    ]);
  });

  test('renders generated meals grouped under 本週菜單', async () => {
    mockState.weeklyPlansData = [
      { id: 1, day: 0, meal: 'breakfast', slot: 0, dishId: 1 },
      { id: 2, day: 0, meal: 'dinner', slot: 0 },
    ];

    render(<App />);
    const menu = await screen.findByRole('heading', { name: '本週菜單' });
    const menuCard = menu.closest('section')!;

    expect(within(menuCard).getByText('週一')).toBeInTheDocument();
    expect(within(menuCard).getByText('早餐')).toBeInTheDocument();
    expect(within(menuCard).getByText('番茄炒蛋')).toBeInTheDocument();
    expect(within(menuCard).getByText('晚餐')).toBeInTheDocument();
    expect(within(menuCard).getByText('尚未安排')).toBeInTheDocument();
  });
});
