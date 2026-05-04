import type { MealSetting } from '../db';
import { DAYS, MEAL_TYPES } from '../planner';

type MealSettingsProps = {
  settings: MealSetting[];
  onChangeSetting: (setting: MealSetting) => Promise<void>;
};

export function MealSettings({ settings, onChangeSetting }: MealSettingsProps) {
  function findSetting(day: number, meal: MealSetting['meal']) {
    return settings.find((setting) => setting.day === day && setting.meal === meal);
  }

  return (
    <section className="card">
      <h2>排餐設定</h2>
      <div className="settings-grid">
        {DAYS.map((dayName, day) => (
          <div className="settings-day" key={dayName}>
            <h3>{dayName}</h3>
            {MEAL_TYPES.map(({ value, label }) => {
              const setting = findSetting(day, value);
              if (!setting) return null;

              return (
                <label className="meal-setting" key={value}>
                  <input
                    type="checkbox"
                    checked={setting.enabled}
                    onChange={(event) => onChangeSetting({ ...setting, enabled: event.target.checked })}
                  />
                  <span>{label}</span>
                  <input
                    aria-label={`${dayName}${label}道數`}
                    type="number"
                    min="1"
                    value={setting.dishCount}
                    disabled={!setting.enabled}
                    onChange={(event) =>
                      onChangeSetting({
                        ...setting,
                        dishCount: Math.max(1, Number(event.target.value) || 1),
                      })
                    }
                  />
                </label>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
