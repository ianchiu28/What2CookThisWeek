import type { MealSetting, MealType } from '../db';
import { DAYS, MEAL_TYPES } from '../planner';

type MealSettingsProps = {
  settings: MealSetting[];
  onChangeSetting: (setting: MealSetting) => Promise<void>;
};

type CountField = 'vegetableCount' | 'meatCount' | 'soupCount';

const COUNT_FIELDS: Array<{ field: CountField; label: string }> = [
  { field: 'vegetableCount', label: '菜' },
  { field: 'meatCount', label: '肉' },
  { field: 'soupCount', label: '湯' },
];

function mealLabel(meal: MealType) {
  return MEAL_TYPES.find((item) => item.value === meal)?.label ?? meal;
}

function mealTotal(setting: MealSetting) {
  return setting.vegetableCount + setting.meatCount + setting.soupCount;
}

export function MealSettings({ settings, onChangeSetting }: MealSettingsProps) {
  function findSetting(day: number, meal: MealSetting['meal']) {
    return settings.find((setting) => setting.day === day && setting.meal === meal);
  }

  async function setDayEnabled(daySettings: MealSetting[], enabled: boolean) {
    if (enabled) {
      const dinner = daySettings.find((setting) => setting.meal === 'dinner');
      if (dinner) await onChangeSetting({ ...dinner, enabled: true });
      return;
    }

    await Promise.all(daySettings.map((setting) => onChangeSetting({ ...setting, enabled: false })));
  }

  return (
    <section className="card meal-settings-card">
      <h2>排餐設定</h2>
      <p className="muted">先選哪些天開伙，再設定每餐要安排的內容。</p>
      <div className="settings-grid">
        {DAYS.map((dayName, day) => {
          const daySettings = MEAL_TYPES.map(({ value }) => findSetting(day, value)).filter(
            (setting): setting is MealSetting => Boolean(setting),
          );
          const dayEnabled = daySettings.some((setting) => setting.enabled);
          const enabledMeals = daySettings.filter((setting) => setting.enabled).map((setting) => mealLabel(setting.meal));
          const summary = enabledMeals.length > 0 ? enabledMeals.join('、') : '不開伙';

          return (
            <fieldset
              className={dayEnabled ? 'settings-day' : 'settings-day settings-day-disabled'}
              key={dayName}
              aria-label={`${dayName}排餐設定`}
            >
              <div className="settings-day-header">
                <legend>
                  {dayName} <span className="dish-metadata">· {summary}</span>
                </legend>
                <label className="switch-toggle day-toggle">
                  <input
                    type="checkbox"
                    aria-label={`${dayName}開伙`}
                    checked={dayEnabled}
                    onChange={(event) => setDayEnabled(daySettings, event.target.checked)}
                  />
                  <span aria-hidden="true" />
                </label>
              </div>

              {dayEnabled && (
                <div className="meal-setting-list">
                  {daySettings.map((setting) => {
                    const label = mealLabel(setting.meal);

                    return (
                      <div className="meal-row" key={setting.meal} role="group" aria-label={`${dayName}${label}設定`}>
                        <button
                          type="button"
                          className={setting.enabled ? 'meal-pill' : 'meal-pill off'}
                          aria-label={label}
                          aria-pressed={setting.enabled}
                          onClick={() => onChangeSetting({ ...setting, enabled: !setting.enabled })}
                        >
                          {label}
                        </button>

                        {!setting.enabled && <span className="empty-text">未安排</span>}

                        {setting.enabled && setting.meal === 'breakfast' && <span className="meal-summary">固定1樣</span>}

                        {setting.enabled && setting.meal !== 'breakfast' && (
                          <CountChips dayName={dayName} mealLabel={label} setting={setting} onChangeSetting={onChangeSetting} />
                        )}

                        {setting.enabled && setting.meal !== 'breakfast' && mealTotal(setting) === 0 && (
                          <p className="meal-warning">這餐不會安排菜品</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </fieldset>
          );
        })}
      </div>
    </section>
  );
}

type CountChipsProps = {
  dayName: string;
  mealLabel: string;
  setting: MealSetting;
  onChangeSetting: (setting: MealSetting) => Promise<void>;
};

function CountChips({ dayName, mealLabel, setting, onChangeSetting }: CountChipsProps) {
  function update(field: CountField, next: number) {
    const value = Math.max(0, Math.floor(Number.isFinite(next) ? next : 0));
    if (value === setting[field]) return;
    void onChangeSetting({ ...setting, [field]: value });
  }

  return (
    <div className="count-list">
      {COUNT_FIELDS.map(({ field, label: countLabel }) => {
        const value = setting[field];
        return (
          <label
            key={field}
            className={value === 0 ? 'count-chip zero' : 'count-chip'}
          >
            <span className="lbl">{countLabel}</span>
            <input
              aria-label={`${dayName}${mealLabel}${countLabel}數`}
              type="number"
              min="0"
              inputMode="numeric"
              value={value}
              onChange={(event) => update(field, Number(event.target.value))}
              onFocus={(event) => event.currentTarget.select()}
            />
            <span className="count-stepper" aria-hidden="true">
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => update(field, value + 1)}
              >
                ▲
              </button>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => update(field, value - 1)}
                disabled={value === 0}
              >
                ▼
              </button>
            </span>
          </label>
        );
      })}
    </div>
  );
}
