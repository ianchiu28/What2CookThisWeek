import { describe, expect, test } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

describe('PWA icon assets', () => {
  test('manifest provides PNG icons for app installation', () => {
    const manifest = JSON.parse(readFileSync(join(root, 'public/manifest.webmanifest'), 'utf-8'));
    const icons = manifest.icons as Array<{ src: string; sizes: string; type: string }>;

    expect(icons).toEqual([
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ]);
    expect(existsSync(join(root, 'public/icon-192.png'))).toBe(true);
    expect(existsSync(join(root, 'public/icon-512.png'))).toBe(true);
    expect(existsSync(join(root, 'public/icon.svg'))).toBe(false);
  });

  test('html declares PNG browser and apple touch icons', () => {
    const html = readFileSync(join(root, 'index.html'), 'utf-8');

    expect(html).toContain('<link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />');
    expect(html).toContain('<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />');
    expect(existsSync(join(root, 'public/apple-touch-icon.png'))).toBe(true);
  });

  test('service worker uses semver cache and does not precache removed SVG icon', () => {
    const serviceWorker = readFileSync(join(root, 'public/sw.js'), 'utf-8');

    expect(serviceWorker).toContain("const CACHE_NAME = 'what2cookthisweek-v1.0.1';");
    expect(serviceWorker).toContain("'/manifest.webmanifest'");
    expect(serviceWorker).toContain("'/icon-192.png'");
    expect(serviceWorker).toContain("'/icon-512.png'");
    expect(serviceWorker).toContain("'/apple-touch-icon.png'");
    expect(serviceWorker).not.toContain("'/icon.svg'");
  });
});
