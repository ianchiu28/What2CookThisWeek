import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { Dish, MealSetting, WeeklyPlan } from './db';
import App from './App';

function dish(overrides: Partial<Dish> & Pick<Dish, 'id' | 'name'>): Dish {
  return {
    mealTypes: ['dinner'],
    category: 'uncategorized',
    ...overrides,
  };
}

function mealSetting(overrides: Partial<MealSetting> & Pick<MealSetting, 'day' | 'meal'>): MealSetting {
  return {
    enabled: true,
    dishCount: 1,
    ...overrides,
  };
}

function weeklyPlan(overrides: Partial<WeeklyPlan> & Pick<WeeklyPlan, 'day' | 'meal' | 'slot'>): WeeklyPlan {
  return overrides;
}

const mockState = vi.hoisted(() => {
  let weeklyPlansData: WeeklyPlan[] = [];
  let mealSettingsData: MealSetting[] = [];

  const dishesAdd = vi.fn(async (dish: Omit<Dish, 'id'>) => {
    mockState.dishesData = [...mockState.dishesData, { ...dish, id: mockState.dishesData.length + 1 }];
  });
  const dishesDelete = vi.fn();
  const dishesPut = vi.fn(async (dish: Dish) => {
    mockState.dishesData = mockState.dishesData.map((item) => (item.id === dish.id ? dish : item));
  });
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
    dishesData: [{ id: 1, name: '番茄炒蛋', mealTypes: ['dinner'], category: 'uncategorized' }] as Dish[],
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
    dishesPut,
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
      put: mockState.dishesPut,
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
    mockState.dishesData = [
      dish({ id: 1, name: '番茄炒蛋' }),
      dish({ id: 2, name: '早餐蛋餅', mealTypes: ['breakfast'], category: 'vegetable' }),
      dish({ id: 3, name: '玉米濃湯', mealTypes: ['lunch', 'dinner'], category: 'soup' }),
      dish({ id: 4, name: '紅燒牛肉', category: 'meat' }),
    ];
    mockState.weeklyPlansData = [];
    mockState.mealSettingsData = [];
    vi.clearAllMocks();
  });

  async function openDishSettings() {
    fireEvent.click(await screen.findByRole('button', { name: '菜品設定' }));
  }

  async function openMealSettings() {
    await screen.findByRole('heading', { name: '本週菜單' });
    fireEvent.click(screen.getByRole('button', { name: '排餐設定' }));
  }

  function rowForDish(name: string) {
    return screen.getByText(name).closest('li')!;
  }

  test('shows the app title as 這週煮什麼？', async () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: '這週煮什麼？' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '本週菜單' })).toBeInTheDocument();
  });

  test('uses 本週菜單 as the default view and moves dish management out of the primary view', async () => {
    render(<App />);

    expect(await screen.findByRole('heading', { name: '本週菜單' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '新增菜品' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '菜品列表' })).not.toBeInTheDocument();
    expect(screen.queryByText('本週晚餐')).not.toBeInTheDocument();
  });

  test('shows dish list as the primary dish management view', async () => {
    render(<App />);
    await openDishSettings();

    expect(screen.getByRole('heading', { name: '菜品列表' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '新增' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: '新增菜品' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '排餐設定' }));
    expect(screen.getByRole('heading', { name: '排餐設定' })).toBeInTheDocument();
  });

  test('adds a new dish from a modal with dinner and uncategorized defaults', async () => {
    render(<App />);
    await openDishSettings();
    fireEvent.click(screen.getByRole('button', { name: '新增' }));

    const dialog = screen.getByRole('dialog', { name: '新增菜品' });
    fireEvent.change(within(dialog).getByPlaceholderText('例如：番茄炒蛋'), { target: { value: '香煎雞腿' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '新增' }));

    await waitFor(() => expect(mockState.dishesAdd).toHaveBeenCalledTimes(1));
    expect(mockState.dishesAdd).toHaveBeenCalledWith({
      name: '香煎雞腿',
      mealTypes: ['dinner'],
      category: 'uncategorized',
    });
    expect(screen.queryByRole('dialog', { name: '新增菜品' })).not.toBeInTheDocument();
  });

  test('does not add a dish from the modal when no meal type is selected', async () => {
    render(<App />);
    await openDishSettings();
    fireEvent.click(screen.getByRole('button', { name: '新增' }));

    const dialog = screen.getByRole('dialog', { name: '新增菜品' });
    fireEvent.change(within(dialog).getByPlaceholderText('例如：番茄炒蛋'), { target: { value: '清炒青菜' } });
    fireEvent.click(within(dialog).getByLabelText('晚餐'));

    expect(within(dialog).getByText('至少選一個餐別')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '新增' })).toBeDisabled();
    expect(mockState.dishesAdd).not.toHaveBeenCalled();
  });

  test('searches dishes by name', async () => {
    render(<App />);
    await openDishSettings();

    fireEvent.change(screen.getByPlaceholderText('搜尋菜名'), { target: { value: '湯' } });

    expect(screen.getByText('玉米濃湯')).toBeInTheDocument();
    expect(screen.queryByText('番茄炒蛋')).not.toBeInTheDocument();
    expect(screen.queryByText('早餐蛋餅')).not.toBeInTheDocument();
  });

  test('shows compact dish metadata and icon actions', async () => {
    render(<App />);
    await openDishSettings();

    const row = rowForDish('玉米濃湯');
    const details = row.querySelector('.dish-details')!;

    expect(details).toContainElement(within(row).getByText('玉米濃湯'));
    expect(details).toContainElement(within(row).getByText('午餐、晚餐 · 湯'));
    expect(within(row).getByRole('button', { name: '編輯 玉米濃湯' })).toHaveTextContent('✎');
    expect(within(row).getByRole('button', { name: '刪除 玉米濃湯' })).toHaveTextContent('×');
  });

  test('hides filters by default and applies filters from the filter panel', async () => {
    render(<App />);
    await openDishSettings();

    const searchInput = screen.getByPlaceholderText('搜尋菜名');
    expect(searchInput).toBeInTheDocument();
    expect(screen.queryByLabelText('餐別篩選')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('分類篩選')).not.toBeInTheDocument();

    const filterButton = screen.getByRole('button', { name: '篩選' });
    const searchFilterControl = searchInput.closest('.search-filter-control')!;
    expect(searchFilterControl).toContainElement(filterButton);
    expect(filterButton).not.toHaveTextContent('篩選');
    expect(filterButton).toHaveTextContent('⌯');

    fireEvent.click(filterButton);
    fireEvent.change(screen.getByLabelText('餐別篩選'), { target: { value: 'dinner' } });
    fireEvent.change(screen.getByLabelText('分類篩選'), { target: { value: 'soup' } });

    expect(screen.getByRole('button', { name: '篩選 · 2' })).toBeInTheDocument();
    expect(screen.getByText('玉米濃湯')).toBeInTheDocument();
    expect(screen.queryByText('紅燒牛肉')).not.toBeInTheDocument();
    expect(screen.queryByText('早餐蛋餅')).not.toBeInTheDocument();
  });

  test('edits a dish in a modal', async () => {
    render(<App />);
    await openDishSettings();

    const row = rowForDish('番茄炒蛋');
    fireEvent.click(within(row).getByRole('button', { name: '編輯 番茄炒蛋' }));

    const dialog = screen.getByRole('dialog', { name: '編輯菜品' });
    expect(within(dialog).getByRole('button', { name: '儲存' })).toBeInTheDocument();
    fireEvent.change(within(dialog).getByDisplayValue('番茄炒蛋'), { target: { value: '番茄牛肉湯' } });
    fireEvent.click(within(dialog).getByLabelText('肉'));
    fireEvent.click(within(dialog).getByLabelText('午餐'));
    fireEvent.click(within(dialog).getByRole('button', { name: '儲存' }));

    await waitFor(() => expect(mockState.dishesPut).toHaveBeenCalledTimes(1));
    expect(mockState.dishesPut).toHaveBeenCalledWith({
      id: 1,
      name: '番茄牛肉湯',
      mealTypes: ['dinner', 'lunch'],
      category: 'meat',
    });
    expect(screen.queryByRole('dialog', { name: '編輯菜品' })).not.toBeInTheDocument();
  });

  test('deletes a dish from the icon button', async () => {
    render(<App />);
    await openDishSettings();

    const row = rowForDish('紅燒牛肉');
    fireEvent.click(within(row).getByRole('button', { name: '刪除 紅燒牛肉' }));

    await waitFor(() => expect(mockState.dishesDelete).toHaveBeenCalledWith(4));
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

    await openMealSettings();
    fireEvent.click(screen.getAllByLabelText('早餐')[0]);

    await waitFor(() => expect(mockState.mealSettingsPut).toHaveBeenCalled());
    expect(mockState.mealSettingsPut.mock.calls.at(-1)?.[0]).toMatchObject({ day: 0, meal: 'breakfast', enabled: true });
  });

  test('generates the weekly menu from saved settings', async () => {
    mockState.dishesData = [dish({ id: 1, name: '番茄炒蛋' })];
    mockState.mealSettingsData = [
      mealSetting({ id: 1, day: 0, meal: 'breakfast' }),
      mealSetting({ id: 2, day: 0, meal: 'lunch', enabled: false }),
      mealSetting({ id: 3, day: 0, meal: 'dinner' }),
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
      weeklyPlan({ id: 1, day: 0, meal: 'breakfast', slot: 0, dishId: 1 }),
      weeklyPlan({ id: 2, day: 0, meal: 'dinner', slot: 0 }),
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

  test('renders generated meal slots in slot order', async () => {
    mockState.dishesData = [dish({ id: 1, name: '第一道' }), dish({ id: 2, name: '第二道' })];
    mockState.weeklyPlansData = [
      weeklyPlan({ id: 1, day: 0, meal: 'dinner', slot: 1, dishId: 2 }),
      weeklyPlan({ id: 2, day: 0, meal: 'dinner', slot: 0, dishId: 1 }),
    ];

    render(<App />);
    const menu = await screen.findByRole('heading', { name: '本週菜單' });
    const menuCard = menu.closest('section')!;
    const items = within(menuCard).getAllByRole('listitem').map((item) => item.textContent);

    expect(items).toEqual(['第一道', '第二道']);
  });
});
