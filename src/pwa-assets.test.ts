import { describe, expect, test } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

describe('PWA icon assets', () => {
  test('manifest provides PNG icons for app installation', () => {
    const manifest = JSON.parse(readFileSync(join(root, 'public/manifest.webmanifest'), 'utf-8'));
    const iconSources = manifest.icons.map((icon: { src: string }) => icon.src);

    expect(iconSources).toContain('/icon-192.png');
    expect(iconSources).toContain('/icon-512.png');
    expect(existsSync(join(root, 'public/icon-192.png'))).toBe(true);
    expect(existsSync(join(root, 'public/icon-512.png'))).toBe(true);
  });

  test('html declares an apple touch icon for iOS home screen', () => {
    const html = readFileSync(join(root, 'index.html'), 'utf-8');

    expect(html).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />');
    expect(existsSync(join(root, 'public/apple-touch-icon.png'))).toBe(true);
  });

  test('html declares the browser favicon explicitly', () => {
    const html = readFileSync(join(root, 'index.html'), 'utf-8');

    expect(html).toContain('<link rel="icon" type="image/svg+xml" href="/icon.svg" />');
    expect(existsSync(join(root, 'public/icon.svg'))).toBe(true);
  });
});
