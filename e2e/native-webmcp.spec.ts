import { test, expect, type Page } from '@playwright/test';

const names = [
  'compare_route_options',
  'create_trip_plan',
  'find_chargers',
  'get_trip_context',
  'list_vehicle_profiles',
  'replace_charging_stop',
  'set_trip_preferences',
];
const pageErrors = new WeakMap<Page, string[]>();
type DiscoveredTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: string | Record<string, unknown>;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  origin: string;
};
type NativeContext = {
  registerTool: (...args: unknown[]) => unknown;
  getTools: () => Promise<DiscoveredTool[]>;
  executeTool: (
    tool: DiscoveredTool,
    input: string | Record<string, unknown>,
  ) => Promise<unknown>;
};
type Reply = {
  ok?: boolean;
  data?: unknown;
  error?: { code: string; message: string };
  nativeError?: string;
};

// Every call goes through the browser's discovery and execution API. No shim
// or injected registerTool implementation participates in this suite.
async function call(page: Page, name: string, input = {}): Promise<Reply> {
  return page.evaluate(
    async ({ name, input }) => {
      const native = document.modelContext as unknown as NativeContext;
      const tool = (await native.getTools()).find(
        (entry) => entry.name === name,
      );
      if (!tool) throw new Error(`Native discovery did not return ${name}`);
      // Chrome 154 takes JSON strings; Chrome 155 changes execution to objects.
      const major = Number(navigator.userAgent.match(/Chrome\/(\d+)/)?.[1]);
      try {
        const result = await native.executeTool(
          tool,
          major < 155 ? JSON.stringify(input) : input,
        );
        return typeof result === 'string' ? JSON.parse(result) : result;
      } catch (error) {
        return { nativeError: (error as Error).message };
      }
    },
    { name, input },
  );
}

test.beforeEach(async ({ page, browser }, testInfo) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  await testInfo.attach('browser-version', {
    body: browser.version(),
    contentType: 'text/plain',
  });
  await page.goto('/');
  await expect(page).toHaveTitle(/Volt.*simulator/i);
  await expect(page.getByTestId('tool-status')).toHaveText(
    '7 agent tools ready',
  );
  expect(
    await page.evaluate(() => document.modelContext?.registerTool.toString()),
  ).toContain('[native code]');
});
test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page)).toEqual([]);
});

test('discovers seven native tools with usable schemas and annotations', async ({
  page,
}) => {
  const tools = await page.evaluate(async () => {
    const native = document.modelContext as unknown as NativeContext;
    return (await native.getTools()).map(
      ({ name, title, description, inputSchema, annotations, origin }) => ({
        name,
        title,
        description,
        inputSchema,
        annotations,
        origin,
      }),
    );
  });
  expect(tools.map((tool) => tool.name)).toEqual(names);
  for (const tool of tools) {
    expect(tool.title).not.toBe('');
    expect(tool.description).toContain('fictional');
    expect(tool.origin).toBe(new URL(page.url()).origin);
    const schema =
      typeof tool.inputSchema === 'string'
        ? JSON.parse(tool.inputSchema)
        : tool.inputSchema;
    expect(schema).toMatchObject({
      type: 'object',
      additionalProperties: false,
    });
    expect(tool.annotations.readOnlyHint).toBe(
      [
        'compare_route_options',
        'find_chargers',
        'get_trip_context',
        'list_vehicle_profiles',
      ].includes(tool.name),
    );
    expect(tool.annotations.untrustedContentHint).toBe(true);
  }
});

test('all seven native calls agree with visible results and persisted state', async ({
  page,
}) => {
  expect(await call(page, 'get_trip_context')).toMatchObject({
    ok: true,
    data: { plan: { cost: 22.7, totalMinutes: 422, arrivalPercent: 23 } },
  });
  expect(await call(page, 'list_vehicle_profiles')).toMatchObject({
    ok: true,
    data: {
      vehicles: [
        { id: 'compact' },
        { id: 'long-range' },
        { id: 'crossover' },
        { id: 'large-suv' },
      ],
    },
  });
  expect(
    await call(page, 'set_trip_preferences', {
      vehicleId: 'compact',
      minimumArrivalPercent: 25,
      preferAmenities: false,
    }),
  ).toMatchObject({ ok: true });
  expect(
    await call(page, 'create_trip_plan', {
      startingChargePercent: 85,
      routeStyle: 'fastest',
    }),
  ).toMatchObject({
    ok: true,
    data: {
      state: {
        vehicleId: 'compact',
        startingChargePercent: 85,
        minimumArrivalPercent: 25,
        preferAmenities: false,
      },
      plan: { feasible: true, arrivalPercent: 25 },
    },
  });
  await expect(page.getByLabel('Vehicle profile')).toHaveValue('compact');
  await expect(
    page.getByLabel('Starting battery percentage', { exact: true }),
  ).toHaveValue('85');
  await expect(page.getByTestId('plan-summary')).toContainText('25%');
  expect(await call(page, 'compare_route_options')).toMatchObject({
    ok: true,
    data: {
      routes: [
        { style: 'fastest' },
        { style: 'balanced' },
        { style: 'comfort' },
      ],
    },
  });
  await expect(page.getByTestId('route-comfort')).toBeVisible();
  expect(
    await call(page, 'find_chargers', {
      minimumPowerKw: 300,
      amenity: 'coffee',
    }),
  ).toMatchObject({ ok: true, data: { count: 2 } });
  await expect(page.getByTestId('station-card')).toHaveCount(2);
  expect(
    await call(page, 'find_chargers', { minimumPowerKw: 400 }),
  ).toMatchObject({ ok: true, data: { count: 0 } });
  await expect(page.getByTestId('station-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Reset settings' }).click();
  expect(
    await call(page, 'create_trip_plan', { startingChargePercent: 90 }),
  ).toMatchObject({
    ok: true,
    data: { plan: { cost: 18.8, totalMinutes: 417 } },
  });
  expect(
    await call(page, 'replace_charging_stop', {
      stopIndex: 0,
      chargerId: 'harris-ranch',
    }),
  ).toMatchObject({
    ok: true,
    data: {
      state: { customStopIds: ['harris-ranch'] },
      plan: { feasible: true, custom: true },
    },
  });
  await expect(page.getByTestId('stop-card')).toContainText('Coalinga');
  await expect(page.getByTestId('plan-summary')).toContainText('Custom stops');
  const custom = await call(page, 'get_trip_context');
  await page.reload();
  await expect(page.getByTestId('tool-status')).toHaveText(
    '7 agent tools ready',
  );
  expect(await call(page, 'get_trip_context')).toEqual(custom);
  await page
    .getByLabel('Starting battery percentage', { exact: true })
    .fill('95');
  await page.getByRole('button', { name: 'Build my route' }).click();
  expect(await call(page, 'get_trip_context')).toMatchObject({
    ok: true,
    data: { state: { startingChargePercent: 95, customStopIds: null } },
  });
});

test('native invalid calls preserve applied state and infeasibility is explicit', async ({
  page,
}) => {
  const before = await call(page, 'get_trip_context');
  const invalid: [string, Record<string, unknown>][] = [
    ...names.map(
      (name) => [name, { unknown: true }] as [string, Record<string, unknown>],
    ),
    ['create_trip_plan', { destination: 'San Diego' }],
    ['create_trip_plan', { startingChargePercent: 101 }],
    ['create_trip_plan', { startingChargePercent: '90' }],
    ['set_trip_preferences', { vehicleId: 'missing' }],
    ['set_trip_preferences', { minimumArrivalPercent: 51 }],
    ['set_trip_preferences', { preferAmenities: 'true' }],
    ['find_chargers', { minimumPowerKw: 49 }],
    ['find_chargers', { amenity: 'missing' }],
    ['replace_charging_stop', {}],
    ['replace_charging_stop', { stopIndex: 0.5, chargerId: 'gilroy' }],
    ['replace_charging_stop', { stopIndex: 0, chargerId: 'san-jose' }],
  ];
  for (const [name, args] of invalid) {
    const result = await call(page, name, args);
    expect(
      result.ok === false || !!result.nativeError,
      `${name}: ${JSON.stringify(args)}`,
    ).toBe(true);
    expect(await call(page, 'get_trip_context')).toEqual(before);
  }
  expect(
    await call(page, 'create_trip_plan', { startingChargePercent: 10 }),
  ).toMatchObject({
    ok: true,
    data: {
      applied: true,
      plan: {
        feasible: false,
        cost: null,
        totalMinutes: null,
        arrivalPercent: null,
      },
    },
  });
  await expect(page.getByTestId('infeasible')).toContainText(
    'No feasible plan',
  );
  await expect(page.getByTestId('plan-summary')).toHaveCount(0);
});

test('native registration cleans up and survives restored lifecycle and navigation', async ({
  page,
}, testInfo) => {
  await call(page, 'create_trip_plan', { startingChargePercent: 90 });
  await page.evaluate(() =>
    window.dispatchEvent(
      new PageTransitionEvent('pagehide', { persisted: true }),
    ),
  );
  expect(
    await page.evaluate(async () =>
      (document.modelContext as unknown as NativeContext)
        .getTools()
        .then((tools) => tools.length),
    ),
  ).toBe(0);
  await page.evaluate(() =>
    window.dispatchEvent(
      new PageTransitionEvent('pageshow', { persisted: true }),
    ),
  );
  await expect(page.getByTestId('tool-status')).toHaveText(
    '7 agent tools ready',
  );
  expect(await call(page, 'get_trip_context')).toMatchObject({
    ok: true,
    data: { state: { startingChargePercent: 90 } },
  });
  await page.evaluate(() => {
    const events: boolean[] = [];
    Object.assign(window, { voltNativePageShows: events });
    window.addEventListener('pageshow', (event) =>
      events.push(event.persisted),
    );
  });
  await page.goto('/llms.txt');
  await page.goBack({ waitUntil: 'commit' });
  await expect(page.getByTestId('tool-status')).toHaveText(
    '7 agent tools ready',
  );
  expect(await call(page, 'get_trip_context')).toMatchObject({
    ok: true,
    data: { state: { startingChargePercent: 90 } },
  });
  const restored = await page.evaluate(
    () =>
      (
        window as Window & { voltNativePageShows?: boolean[] }
      ).voltNativePageShows?.includes(true) ?? false,
  );
  await testInfo.attach('navigation-restoration', {
    body: JSON.stringify({ backForwardCacheRestored: restored }),
    contentType: 'application/json',
  });
  if (!process.env.VOLT_WEBMCP_URL) expect(restored).toBe(true);
  await page.reload();
  await expect(page.getByTestId('tool-status')).toHaveText(
    '7 agent tools ready',
  );
  expect(await call(page, 'get_trip_context')).toMatchObject({ ok: true });
});
