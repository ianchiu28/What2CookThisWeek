import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { Dish, MealSetting, WeeklyPlan } from './db';
import App from './App';

function dish(overrides: Partial<Dish> & Pick<Dish, 'id' | 'name'>): Dish {
  return {
    mealTypes: ['dinner'],
    category: 'uncategorized',
    ingredients: [],
    ...overrides,
  };
}

function mealSetting(overrides: Partial<MealSetting> & Pick<MealSetting, 'day' | 'meal'>): MealSetting {
  return {
    enabled: true,
    vegetableCount: 1,
    meatCount: 0,
    soupCount: 0,
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
  const dishesUpdate = vi.fn(async (id: number, changes: Partial<Dish>) => {
    mockState.dishesData = mockState.dishesData.map((item) => (item.id === id ? { ...item, ...changes } : item));
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
    dishesData: [{ id: 1, name: '番茄炒蛋', mealTypes: ['dinner'], category: 'uncategorized', ingredients: [] }] as Dish[],
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
    dishesUpdate,
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
      update: mockState.dishesUpdate,
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
      ingredients: [],
    });
    expect(screen.queryByRole('dialog', { name: '新增菜品' })).not.toBeInTheDocument();
  });

  test('adds a dish with ingredients parsed from a textarea', async () => {
    render(<App />);
    await openDishSettings();
    fireEvent.click(screen.getByRole('button', { name: '新增' }));

    const dialog = screen.getByRole('dialog', { name: '新增菜品' });
    fireEvent.change(within(dialog).getByPlaceholderText('例如：番茄炒蛋'), { target: { value: '番茄炒蛋' } });
    fireEvent.change(within(dialog).getByLabelText('材料（可選）'), { target: { value: '番茄、蛋 蔥, 番茄' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '新增' }));

    await waitFor(() => expect(mockState.dishesAdd).toHaveBeenCalledTimes(1));
    expect(mockState.dishesAdd).toHaveBeenCalledWith({
      name: '番茄炒蛋',
      mealTypes: ['dinner'],
      category: 'uncategorized',
      ingredients: ['番茄', '蛋', '蔥'],
    });
  });

  test('edits a dish prefills ingredients joined with 、', async () => {
    mockState.dishesData = [
      dish({ id: 1, name: '番茄炒蛋', ingredients: ['番茄', '蛋', '蔥'] }),
    ];

    render(<App />);
    await openDishSettings();
    fireEvent.click(within(rowForDish('番茄炒蛋')).getByRole('button', { name: '編輯 番茄炒蛋' }));

    const dialog = screen.getByRole('dialog', { name: '編輯菜品' });
    expect(within(dialog).getByLabelText('材料（可選）')).toHaveValue('番茄、蛋、蔥');

    fireEvent.change(within(dialog).getByLabelText('材料（可選）'), { target: { value: '番茄, 蛋, 蔥, 薑' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '儲存' }));

    await waitFor(() => expect(mockState.dishesPut).toHaveBeenCalledTimes(1));
    expect(mockState.dishesPut).toHaveBeenCalledWith(expect.objectContaining({
      id: 1,
      ingredients: ['番茄', '蛋', '蔥', '薑'],
    }));
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
      ingredients: [],
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
      { day: 0, meal: 'dinner', enabled: true, vegetableCount: 2, meatCount: 1, soupCount: 0 },
      { day: 1, meal: 'dinner', enabled: true, vegetableCount: 2, meatCount: 1, soupCount: 0 },
      { day: 2, meal: 'dinner', enabled: true, vegetableCount: 2, meatCount: 1, soupCount: 0 },
      { day: 3, meal: 'dinner', enabled: true, vegetableCount: 2, meatCount: 1, soupCount: 0 },
      { day: 4, meal: 'dinner', enabled: true, vegetableCount: 2, meatCount: 1, soupCount: 0 },
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

  test('turns an entire day off and reopens it with dinner only', async () => {
    mockState.mealSettingsData = [
      mealSetting({ id: 1, day: 0, meal: 'breakfast', enabled: true, vegetableCount: 0 }),
      mealSetting({ id: 2, day: 0, meal: 'lunch', enabled: true, vegetableCount: 2, meatCount: 1 }),
      mealSetting({ id: 3, day: 0, meal: 'dinner', enabled: false }),
    ];

    render(<App />);
    await openMealSettings();

    const monday = screen.getByRole('group', { name: '週一排餐設定' });
    fireEvent.click(within(monday).getByLabelText('週一開伙'));

    await waitFor(() => expect(mockState.mealSettingsPut).toHaveBeenCalledTimes(3));
    expect(mockState.mealSettingsPut.mock.calls.map((call) => call[0])).toEqual([
      expect.objectContaining({ day: 0, meal: 'breakfast', enabled: false }),
      expect.objectContaining({ day: 0, meal: 'lunch', enabled: false }),
      expect.objectContaining({ day: 0, meal: 'dinner', enabled: false }),
    ]);

    mockState.mealSettingsData = mockState.mealSettingsData.map((setting) => ({ ...setting, enabled: false }));
    mockState.mealSettingsPut.mockClear();
    fireEvent.click(screen.getByRole('button', { name: '本週菜單' }));
    await openMealSettings();
    fireEvent.click(within(screen.getByRole('group', { name: '週一排餐設定' })).getByLabelText('週一開伙'));

    await waitFor(() => expect(mockState.mealSettingsPut).toHaveBeenCalledTimes(1));
    expect(mockState.mealSettingsPut).toHaveBeenCalledWith(expect.objectContaining({ day: 0, meal: 'dinner', enabled: true }));
  });

  test('shows meal controls in one row and hides disabled meal options', async () => {
    mockState.mealSettingsData = [
      mealSetting({ id: 1, day: 0, meal: 'breakfast', enabled: true, vegetableCount: 0 }),
      mealSetting({ id: 2, day: 0, meal: 'lunch', enabled: true, vegetableCount: 1, meatCount: 1, soupCount: 1 }),
      mealSetting({ id: 3, day: 0, meal: 'dinner', enabled: false }),
    ];

    render(<App />);
    await openMealSettings();

    const monday = screen.getByRole('group', { name: '週一排餐設定' });
    const breakfastRow = within(monday).getByRole('group', { name: '週一早餐設定' });
    const lunchRow = within(monday).getByRole('group', { name: '週一午餐設定' });
    const dinnerRow = within(monday).getByRole('group', { name: '週一晚餐設定' });

    expect(within(breakfastRow).getByText('固定1樣')).toBeInTheDocument();
    expect(within(lunchRow).queryByText('1菜1肉1湯')).not.toBeInTheDocument();
    expect(within(lunchRow).getByLabelText('週一午餐菜數')).toBeInTheDocument();
    expect(within(lunchRow).getByLabelText('週一午餐肉數')).toBeInTheDocument();
    expect(within(lunchRow).getByLabelText('週一午餐湯數')).toBeInTheDocument();
    expect(within(dinnerRow).queryByText(/菜|肉|湯/)).not.toBeInTheDocument();
    expect(within(dinnerRow).queryByLabelText('週一晚餐菜數')).not.toBeInTheDocument();
    expect(within(monday).queryByLabelText('週一早餐菜數')).not.toBeInTheDocument();

    fireEvent.change(within(lunchRow).getByLabelText('週一午餐菜數'), { target: { value: '0' } });

    await waitFor(() => expect(mockState.mealSettingsPut).toHaveBeenCalled());
    expect(mockState.mealSettingsPut.mock.calls.at(-1)?.[0]).toMatchObject({
      day: 0,
      meal: 'lunch',
      vegetableCount: 0,
      meatCount: 1,
      soupCount: 1,
    });
  });

  test('shows 未安排 placeholder for disabled meals on enabled days', async () => {
    mockState.mealSettingsData = [
      mealSetting({ id: 1, day: 0, meal: 'breakfast', enabled: true, vegetableCount: 0 }),
      mealSetting({ id: 2, day: 0, meal: 'lunch', enabled: false, vegetableCount: 0 }),
      mealSetting({ id: 3, day: 0, meal: 'dinner', enabled: true, vegetableCount: 1 }),
    ];

    render(<App />);
    await openMealSettings();

    const monday = screen.getByRole('group', { name: '週一排餐設定' });
    const lunchRow = within(monday).getByRole('group', { name: '週一午餐設定' });

    expect(within(lunchRow).getByText('未安排')).toBeInTheDocument();
    expect(within(lunchRow).queryByLabelText('週一午餐菜數')).not.toBeInTheDocument();
  });

  test('generates the weekly menu from saved settings', async () => {
    mockState.dishesData = [
      dish({ id: 1, name: '早餐蛋餅', mealTypes: ['breakfast'], category: 'uncategorized' }),
      dish({ id: 2, name: '番茄炒蛋', mealTypes: ['dinner'], category: 'vegetable' }),
    ];
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
      { day: 0, meal: 'dinner', slot: 0, dishId: 2 },
    ]);
  });

  test('updates lastCookedAt on dishes placed in the generated menu', async () => {
    const fixedNow = 1_700_000_000_000;
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(fixedNow);

    mockState.dishesData = [
      dish({ id: 1, name: '早餐蛋餅', mealTypes: ['breakfast'], category: 'uncategorized' }),
      dish({ id: 2, name: '青菜', mealTypes: ['dinner'], category: 'vegetable' }),
      dish({ id: 3, name: '不會被選的菜', mealTypes: ['lunch'], category: 'vegetable', lastCookedAt: 999 }),
    ];
    mockState.mealSettingsData = [
      mealSetting({ id: 1, day: 0, meal: 'breakfast' }),
      mealSetting({ id: 2, day: 0, meal: 'lunch', enabled: false }),
      mealSetting({ id: 3, day: 0, meal: 'dinner', vegetableCount: 1, meatCount: 0, soupCount: 0 }),
    ];

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '產生本週菜單' }));

    await waitFor(() => expect(mockState.dishesUpdate).toHaveBeenCalledTimes(2));
    const updatedIds = mockState.dishesUpdate.mock.calls.map((call) => call[0]).sort();
    expect(updatedIds).toEqual([1, 2]);
    for (const call of mockState.dishesUpdate.mock.calls) {
      expect(call[1]).toEqual({ lastCookedAt: fixedNow });
    }

    nowSpy.mockRestore();
  });

  test('rotates picks across consecutive generations', async () => {
    const firstNow = 1_700_000_000_000;
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(firstNow);

    mockState.dishesData = [
      dish({ id: 1, name: '青菜A', mealTypes: ['dinner'], category: 'vegetable' }),
      dish({ id: 2, name: '青菜B', mealTypes: ['dinner'], category: 'vegetable' }),
    ];
    mockState.mealSettingsData = [
      mealSetting({ id: 1, day: 0, meal: 'breakfast', enabled: false }),
      mealSetting({ id: 2, day: 0, meal: 'lunch', enabled: false }),
      mealSetting({ id: 3, day: 0, meal: 'dinner', vegetableCount: 1, meatCount: 0, soupCount: 0 }),
    ];

    render(<App />);
    const generateButton = await screen.findByRole('button', { name: '產生本週菜單' });

    fireEvent.click(generateButton);
    await waitFor(() => expect(mockState.weeklyPlansBulkAdd).toHaveBeenCalledTimes(1));
    const firstPlans = mockState.weeklyPlansBulkAdd.mock.calls[0][0] as WeeklyPlan[];
    const firstChoice = firstPlans[0].dishId!;
    expect([1, 2]).toContain(firstChoice);

    nowSpy.mockReturnValue(firstNow + 60_000);
    fireEvent.click(generateButton);
    await waitFor(() => expect(mockState.weeklyPlansBulkAdd).toHaveBeenCalledTimes(2));
    const secondPlans = mockState.weeklyPlansBulkAdd.mock.calls[1][0] as WeeklyPlan[];
    const secondChoice = secondPlans[0].dishId!;

    expect(secondChoice).not.toBe(firstChoice);

    nowSpy.mockRestore();
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
    expect(within(menuCard).getByLabelText('早餐')).toHaveTextContent('早');
    expect(within(menuCard).getByText('番茄炒蛋')).toBeInTheDocument();
    expect(within(menuCard).getByLabelText('晚餐')).toHaveTextContent('晚');
    expect(within(menuCard).getByText('尚未安排')).toBeInTheDocument();
  });

  test('shopping list button opens modal with deduped ingredients and copy works', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    mockState.dishesData = [
      dish({ id: 1, name: 'A', ingredients: ['番茄', '蛋', '蔥'] }),
      dish({ id: 2, name: 'B', ingredients: ['番茄', '薑'] }),
    ];
    mockState.weeklyPlansData = [
      weeklyPlan({ id: 1, day: 0, meal: 'dinner', slot: 0, dishId: 1 }),
      weeklyPlan({ id: 2, day: 0, meal: 'dinner', slot: 1, dishId: 2 }),
    ];

    render(<App />);
    const shoppingButton = await screen.findByRole('button', { name: '採買清單' });
    fireEvent.click(shoppingButton);

    const dialog = await screen.findByRole('dialog', { name: '本週採買清單' });
    const items = within(dialog).getAllByRole('listitem').map((li) => li.textContent);
    expect(items.length).toBe(4);
    expect(new Set(items)).toEqual(new Set(['番茄', '蛋', '蔥', '薑']));

    fireEvent.click(within(dialog).getByRole('button', { name: '複製清單' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const copied = writeText.mock.calls[0][0] as string;
    expect(new Set(copied.split('\n'))).toEqual(new Set(['番茄', '蛋', '蔥', '薑']));

    fireEvent.click(within(dialog).getByRole('button', { name: '關閉' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '本週採買清單' })).not.toBeInTheDocument());
  });

  test('shopping list button is disabled when there is no weekly plan', async () => {
    mockState.weeklyPlansData = [];

    render(<App />);
    const shoppingButton = await screen.findByRole('button', { name: '採買清單' });
    expect(shoppingButton).toBeDisabled();
  });

  test('renders dish ingredients under each menu item', async () => {
    mockState.dishesData = [
      dish({ id: 1, name: '番茄炒蛋', ingredients: ['番茄', '蛋', '蔥'] }),
      dish({ id: 2, name: '清炒青菜', ingredients: [] }),
    ];
    mockState.weeklyPlansData = [
      weeklyPlan({ id: 1, day: 0, meal: 'dinner', slot: 0, dishId: 1 }),
      weeklyPlan({ id: 2, day: 0, meal: 'dinner', slot: 1, dishId: 2 }),
    ];

    render(<App />);
    const menu = await screen.findByRole('heading', { name: '本週菜單' });
    const menuCard = menu.closest('section')!;

    const tomatoRow = within(menuCard).getByText('番茄炒蛋').closest('.menu-row')!;
    expect(within(tomatoRow as HTMLElement).getByText('番茄・蛋・蔥')).toBeInTheDocument();

    const veggieRow = within(menuCard).getByText('清炒青菜').closest('.menu-row')!;
    expect(within(veggieRow as HTMLElement).queryByText(/・/)).not.toBeInTheDocument();
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
    const dishNames = Array.from(menuCard.querySelectorAll('.menu-dish-name')).map(
      (node) => node.textContent,
    );

    expect(dishNames).toEqual(['第一道', '第二道']);
  });
});
