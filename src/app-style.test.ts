import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const css = readFileSync(join(process.cwd(), 'src/App.css'), 'utf-8');

describe('bottom app tabs styles', () => {
  test('sticks the tab bar to the bottom edge without rounded corners', () => {
    const bottomTabsRule = css.match(/\.bottom-tabs \{(?<body>[\s\S]*?)\n\}/)?.groups?.body;

    expect(bottomTabsRule).toContain('bottom: 0;');
    expect(bottomTabsRule).toContain('left: 0;');
    expect(bottomTabsRule).toContain('right: 0;');
    expect(bottomTabsRule).toContain('border-radius: 0;');
    expect(bottomTabsRule).toContain('width: 100%;');
    expect(bottomTabsRule).not.toContain('transform: translateX(-50%);');
  });

  test('includes simplified dish management styles', () => {
    expect(css).toContain('.list-toolbar');
    expect(css).toContain('.search-filter-control');
    expect(css).toContain('.filter-panel');
    expect(css).toContain('.dish-metadata');
    expect(css).toContain('.icon-button');
    expect(css).toContain('.compact-button');
    expect(css).not.toContain('.category-tag');
  });

  test('keeps dish action icons compact on small screens', () => {
    const mobileRule = css.match(/@media \(max-width: 560px\) \{(?<body>[\s\S]*?)\n\}/)?.groups?.body;

    expect(mobileRule).not.toContain('.dish-actions button');
  });

  test('uses a compact single-row dish list layout', () => {
    const dishItemRule = css.match(/\.dish-item \{(?<body>[\s\S]*?)\n\}/)?.groups?.body;
    const dishDetailsRule = css.match(/\.dish-details \{(?<body>[\s\S]*?)\n\}/)?.groups?.body;
    const dishActionsRule = css.match(/\.dish-actions \{(?<body>[\s\S]*?)\n\}/)?.groups?.body;
    const mobileRule = css.match(/@media \(max-width: 560px\) \{(?<body>[\s\S]*?)\n\}/)?.groups?.body;

    expect(dishItemRule).toContain('display: grid;');
    expect(dishItemRule).toContain('grid-template-columns: minmax(0, 1fr) auto;');
    expect(dishDetailsRule).toContain('display: flex;');
    expect(dishActionsRule).toContain('flex-wrap: nowrap;');
    expect(mobileRule).not.toContain('.section-heading,');
    expect(mobileRule).not.toContain('.list-toolbar');
    expect(mobileRule).not.toContain('.dish-actions,');
  });

  test('combines search and filter into one bordered control', () => {
    const controlRule = css.match(/\.search-filter-control \{(?<body>[\s\S]*?)\n\}/)?.groups?.body;
    const controlInputRule = css.match(/\.search-filter-control input \{(?<body>[\s\S]*?)\n\}/)?.groups?.body;
    const filterButtonRule = css.match(/\.search-filter-control \.filter-icon-button \{(?<body>[\s\S]*?)\n\}/)?.groups?.body;

    expect(controlRule).toContain('border: 1px solid #fed7aa;');
    expect(controlRule).toContain('border-radius: 10px;');
    expect(controlInputRule).toContain('border: 0;');
    expect(filterButtonRule).toContain('border-left: 1px solid #fed7aa;');
    expect(filterButtonRule).toContain('border-radius: 0;');
    expect(filterButtonRule).toContain('border-top: 0;');
    expect(filterButtonRule).toContain('border-right: 0;');
    expect(filterButtonRule).toContain('border-bottom: 0;');
    expect(filterButtonRule).toContain('font-size: 1.2rem;');
  });

  test('uses app-style active tab emphasis instead of filled button styling', () => {
    const activeRule = css.match(/\.bottom-tabs button\.active \{(?<body>[\s\S]*?)\n\}/)?.groups?.body;
    const activeIndicatorRule = css.match(/\.bottom-tabs button\.active::before \{(?<body>[\s\S]*?)\n\}/)?.groups?.body;

    expect(activeRule).toContain('background: transparent;');
    expect(activeRule).toContain('color: #f97316;');
    expect(activeRule).toContain('font-weight: 700;');
    expect(activeRule).not.toContain('background: #f97316;');
    expect(activeRule).not.toContain('color: white;');
    expect(activeIndicatorRule).toContain('background: #f97316;');
    expect(activeIndicatorRule).toContain('height: 3px;');
  });

  test('uses compact day cards and meal count controls for meal settings', () => {
    expect(css).toContain('.meal-settings-card');
    expect(css).toContain('.settings-day-header');
    expect(css).toContain('.settings-day-disabled');
    expect(css).toContain('.meal-setting-list');
    expect(css).toContain('.meal-setting-row');
    expect(css).toContain('.meal-count-panel');
    expect(css).toContain('.count-field');
    expect(css).toContain('.meal-warning');
    expect(css).toContain('.switch-toggle');
    expect(css).toContain('.meal-setting-main');
    expect(css).toContain('.meal-summary');

    const mealRowRule = css.match(/\.meal-setting-row \{(?<body>[\s\S]*?)\n\}/)?.groups?.body;
    const mealMainRule = css.match(/\.meal-setting-main \{(?<body>[\s\S]*?)\n\}/)?.groups?.body;
    const switchRule = css.match(/\.switch-toggle span \{(?<body>[\s\S]*?)\n\}/)?.groups?.body;
    const mealToggleRule = css.match(/\.meal-toggle \{(?<body>[\s\S]*?)\n\}/)?.groups?.body;

    expect(mealRowRule).toContain('display: grid;');
    expect(mealMainRule).toContain('justify-content: space-between;');
    expect(mealMainRule).toContain('grid-template-columns: auto minmax(0, 1fr);');
    expect(switchRule).toContain('border-radius: 999px;');
    expect(mealToggleRule).toContain('border-radius: 10px;');
    expect(css).not.toContain('table-layout');
  });
});
