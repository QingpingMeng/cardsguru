// Captures showcase screenshots of the running CardsGuru dev server with Playwright.
//
//   1. npm run dev            # serve on http://localhost:5173
//   2. npm i --no-save playwright && npx playwright install chromium
//   3. node scripts/screenshots.mjs
//
// Seeds a few cards through the real UI, then writes PNGs to docs/screenshots/.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const BASE = process.env.SHOT_BASE || 'http://localhost:5173';
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'screenshots');
mkdirSync(OUT, { recursive: true });

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function addCard(page, product, digits) {
  await page.goto(`${BASE}/#/cards`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '+ Add card' }).click();
  const modal = page.locator('.modal');
  await modal.getByRole('option', { name: new RegExp(escapeRegex(product)) }).click();
  await modal.getByLabel(/Last \d+ digits/).fill(digits);
  await modal.getByRole('button', { name: 'Add card' }).click();
  await modal.waitFor({ state: 'detached' }).catch(() => {});
  await page.waitForTimeout(350);
}

async function shoot(page, hash, file) {
  await page.goto(`${BASE}/#/${hash}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700); // let the glass/wallpaper settle
  await page.screenshot({ path: path.join(OUT, file), type: 'jpeg', quality: 86 });
  console.log(`wrote docs/screenshots/${file}`);
}

const CARDS = [
  ['The Platinum Card', '12345'],
  ['American Express Gold Card', '67890'],
  ['Chase Sapphire Reserve', '4021'],
  ['World of Hyatt Credit Card', '5150'],
];

const browser = await chromium.launch();
try {
  // ---- Desktop (dark) ------------------------------------------------------
  const desktop = await browser.newContext({
    viewport: { width: 1360, height: 860 },
    deviceScaleFactor: 1.6,
    colorScheme: 'dark',
  });
  const page = await desktop.newPage();

  for (const [name, digits] of CARDS) await addCard(page, name, digits);

  // Enrich the dashboard: complete one credit, auto-enable another.
  await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Mark as used' }).first().click().catch(() => {});
  await page.getByRole('switch').nth(1).click().catch(() => {});
  await page.waitForTimeout(300);

  await shoot(page, '', 'dashboard.jpg');
  await shoot(page, 'expiring', 'expiring.jpg');
  await shoot(page, 'cards', 'cards.jpg');
  await shoot(page, 'settings', 'settings.jpg');
  await shoot(page, 'connect', 'connect.jpg');

  // ---- Mobile: reuse the same (seeded) context; layout is width-driven -----
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, 'mobile-dashboard.jpg'), type: 'jpeg', quality: 86 });
  console.log('wrote docs/screenshots/mobile-dashboard.jpg');

  await desktop.close();
} finally {
  await browser.close();
}
