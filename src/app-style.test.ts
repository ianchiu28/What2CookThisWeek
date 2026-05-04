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
});
