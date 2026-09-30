import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/');
  await expect(page).toHaveTitle(/Volt.*simulator/i);
  await expect(
    page.getByRole('heading', { name: 'What does your next charge change?' }),
  ).toBeVisible();
  (page as Page & { appErrors: string[] }).appErrors = errors;
});
test.afterEach(async ({ page }) => {
  expect((page as Page & { appErrors: string[] }).appErrors).toEqual([]);
});

test('recalculates inputs, persists, rejects unsupported endpoints and exports assumptions', async ({
  page,
}) => {
  const summary = page.getByTestId('plan-summary');
  await expect(summary).toContainText('$22.70');
  await page
    .getByLabel('Starting battery percentage', { exact: true })
    .fill('90');
  await expect(
    page.getByText('Inputs changed.', { exact: false }),
  ).toBeVisible();
  await expect(summary).toContainText('$22.70');
  await page.getByRole('button', { name: 'Build my route' }).click();
  await expect(summary).not.toContainText('$22.70');
  const updated = await summary.innerText();
  await page.reload();
  await expect(summary).toHaveText(updated, { useInnerText: true });
  await page.getByLabel('Destination', { exact: true }).fill('San Diego');
  await page.getByRole('button', { name: 'Build my route' }).click();
  await expect(page.getByRole('alert')).toContainText('Only the Los Angeles');
  await expect(summary).toHaveText(updated, { useInnerText: true });
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON' }).click();
  const exported = await download;
  expect(exported.suggestedFilename()).toBe('volt-simulation.json');
  const stream = await exported.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  expect(JSON.parse(Buffer.concat(chunks).toString())).toMatchObject({
    dataMode: 'SIMULATION',
    methodology: 'volt-energy-v1',
    state: { startingChargePercent: 90, destination: 'San Francisco, CA' },
  });
});
test('profile, reserve and infeasible inputs affect real results', async ({
  page,
}) => {
  await page.getByLabel('Vehicle profile').selectOption('compact');
  await page.getByLabel('Minimum arrival battery percentage').fill('25');
  await page.getByRole('button', { name: 'Build my route' }).click();
  await expect(page.getByTestId('plan-summary')).toContainText('28%');
  await expect(page.getByText('60 kWh · 240 mi assumed range')).toBeVisible();
  await page
    .getByLabel('Starting battery percentage', { exact: true })
    .fill('10');
  await page.getByRole('button', { name: 'Build my route' }).click();
  await expect(page.getByTestId('infeasible')).toContainText(
    'No feasible plan',
  );
  await expect(page.getByTestId('plan-summary')).toHaveCount(0);
  await page.getByRole('button', { name: 'Reset settings' }).click();
  await expect(page.getByTestId('plan-summary')).toContainText('$22.70');
});
test('custom replacement recalculates and invalid replacement preserves it', async ({
  page,
}) => {
  await page
    .getByLabel('Starting battery percentage', { exact: true })
    .fill('90');
  await page.getByRole('button', { name: 'Build my route' }).click();
  await page
    .getByLabel('Replace stop 1', { exact: true })
    .selectOption('harris-ranch');
  await expect(page.getByTestId('stop-card')).toContainText('Coalinga');
  await expect(page.getByTestId('plan-summary')).toContainText('Custom stops');
  const custom = await page.getByTestId('plan-summary').innerText();
  await page
    .getByLabel('Replace stop 1', { exact: true })
    .selectOption('san-jose');
  await expect(page.getByRole('alert')).toContainText('Cannot reach');
  await expect(page.getByTestId('plan-summary')).toHaveText(custom, {
    useInnerText: true,
  });
  await expect(page.getByLabel('Replace stop 1', { exact: true })).toHaveValue(
    'harris-ranch',
  );
});
test('station filters, empty results and model guide are usable', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Stations', exact: true }).click();
  await page.getByLabel('Minimum power (kW)').fill('300');
  await page.getByLabel('Amenity', { exact: true }).selectOption('coffee');
  await page.getByRole('button', { name: 'Filter stations' }).click();
  await expect(page.getByTestId('station-card')).toHaveCount(2);
  await page.getByLabel('Minimum power (kW)').fill('400');
  await page.getByRole('button', { name: 'Filter stations' }).click();
  await expect(page.getByTestId('station-card')).toHaveCount(0);
  await expect(
    page.getByText('No sample stations match these filters.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'How it works' }).click();
  await expect(
    page.getByRole('heading', { name: 'Energy and time' }),
  ).toBeVisible();
});
test('tool registrations survive lifecycle and sequential tools update visible state', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const registered = new Map<
      string,
      { execute: (input: unknown) => unknown }
    >();
    Object.defineProperty(document, 'modelContext', {
      value: {
        registerTool(
          tool: { name: string; execute: (input: unknown) => unknown },
          { signal }: { signal: AbortSignal },
        ) {
          if (registered.has(tool.name)) throw new Error('Duplicate tool');
          registered.set(tool.name, tool);
          signal.addEventListener('abort', () => registered.delete(tool.name));
        },
      },
    });
    Object.assign(window, { testTools: registered });
  });
  await page.reload();
  await expect(page.getByTestId('tool-status')).toHaveText(
    '7 agent tools ready',
  );
  const run = async (name: string, args: Record<string, unknown> = {}) =>
    page.evaluate(
      ({ name, args }) => {
        const host = window as Window & {
          testTools?: Map<string, { execute: (input: unknown) => unknown }>;
        };
        return host.testTools!.get(name)!.execute(args);
      },
      { name, args },
    );
  expect(await run('list_vehicle_profiles')).toMatchObject({ ok: true });
  expect(
    await run('set_trip_preferences', {
      vehicleId: 'compact',
      minimumArrivalPercent: 25,
    }),
  ).toMatchObject({ ok: true });
  expect(
    await run('create_trip_plan', {
      startingChargePercent: 85,
      routeStyle: 'fastest',
    }),
  ).toMatchObject({ ok: true });
  await expect(page.getByLabel('Vehicle profile')).toHaveValue('compact');
  await expect(page.getByTestId('plan-summary')).toContainText('25%');
  expect(await run('get_trip_context')).toMatchObject({
    data: { state: { vehicleId: 'compact', startingChargePercent: 85 } },
  });
  expect(await run('compare_route_options')).toMatchObject({ ok: true });
  expect(
    await run('replace_charging_stop', { stopIndex: 0, chargerId: 'san-jose' }),
  ).toMatchObject({ ok: false });
  expect(await run('find_chargers', { minimumPowerKw: 400 })).toMatchObject({
    data: { count: 0 },
  });
  await expect(page.getByTestId('station-result-count')).toContainText(
    '0 stations',
  );
  await page.evaluate(() => {
    window.dispatchEvent(
      new PageTransitionEvent('pagehide', { persisted: true }),
    );
    window.dispatchEvent(
      new PageTransitionEvent('pageshow', { persisted: true }),
    );
  });
  await expect(page.getByTestId('tool-status')).toHaveText(
    '7 agent tools ready',
  );
  expect(await run('get_trip_context')).toMatchObject({
    data: { state: { vehicleId: 'compact' } },
  });
  await page.reload();
  await expect(page.getByTestId('tool-status')).toHaveText(
    '7 agent tools ready',
  );
});
test('blocked storage reports limitation and still recalculates', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error('Storage blocked');
    };
  });
  await page.reload();
  await page.getByRole('button', { name: 'Build my route' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Browser storage is unavailable',
  );
  await expect(page.getByTestId('plan-summary')).toContainText('$22.70');
});
test('desktop and mobile layout and manual fallback', async ({ page }) => {
  const screenshots = process.env.VOLT_SCREENSHOT_DIR;
  if (screenshots) await mkdir(screenshots, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.getByTestId('tool-status')).toContainText('Manual mode', {
    timeout: 10000,
  });
  if (screenshots)
    await page.screenshot({
      path: path.join(screenshots, 'volt-desktop.png'),
      fullPage: true,
    });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByLabel('Starting battery percentage', { exact: true })
    .fill('90');
  await page.getByRole('button', { name: 'Build my route' }).click();
  await expect(page.getByTestId('plan-summary')).not.toContainText('$22.70');
  await page.getByRole('button', { name: 'Reset settings' }).click();
  if (screenshots)
    await page.screenshot({
      path: path.join(screenshots, 'volt-mobile.png'),
      fullPage: true,
    });
});
