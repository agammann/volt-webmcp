import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_STATE,
  VEHICLES,
  compareRoutes,
  currentPlan,
  findChargers,
  replaceStop,
  simulate,
  validateState,
} from '../src/planner';
import { registerTools, toolsFor, type ModelContext } from '../src/webmcp';
import { restoreTrip, serializeTrip } from '../src/storage';

describe('energy calculations', () => {
  it('matches an independently calculated one-stop trip', () => {
    const p = simulate({ ...DEFAULT_STATE, routeStyle: 'fastest' }, [
      'kettleman-city',
    ]);
    // 387/310*75 - 78%*75 + 20%*75 = 50.129 battery kWh.
    expect(p.feasible).toBe(true);
    expect(p.stops[0].batteryAddedKwh).toBe(50.13);
    expect(p.stops[0].purchasedKwh).toBe(55.7);
    expect(p.stops[0].chargingMinutes).toBe(28);
    expect(p.cost).toBe(21.72);
    expect(p.arrivalPercent).toBe(20);
    expect(p.totalMinutes).toBe(420);
  });
  it.each(VEHICLES.map((v) => v.id))(
    '%s respects energy, power and reserve limits',
    (vehicleId) => {
      const vehicle = VEHICLES.find((v) => v.id === vehicleId)!;
      for (const p of compareRoutes({ ...DEFAULT_STATE, vehicleId })) {
        expect(p.feasible).toBe(true);
        expect(p.arrivalPercent!).toBeGreaterThanOrEqual(20);
        let charge = DEFAULT_STATE.startingChargePercent;
        for (const stop of p.stops) {
          expect(stop.arrivalPercent).toBeCloseTo(
            charge - (stop.legMiles / vehicle.range) * 100,
            1,
          );
          expect(stop.arrivalPercent).toBeGreaterThanOrEqual(20);
          expect(stop.departurePercent).toBeLessThanOrEqual(100);
          expect(stop.batteryAddedKwh).toBeCloseTo(
            ((stop.departurePercent - stop.arrivalPercent) / 100) *
              vehicle.battery,
            1,
          );
          expect(stop.chargingMinutes).toBeGreaterThan(0);
          charge = stop.departurePercent;
        }
        expect(p.totalMinutes).toBe(
          387 + p.chargeMinutes! + p.stops.length * 5,
        );
        expect(p.cost).toBeCloseTo(
          p.stops.reduce((n, s) => n + s.cost, 0),
          2,
        );
      }
    },
  );
  it('higher starting charge reduces purchased energy and cost for the same stop', () => {
    const a = simulate(DEFAULT_STATE, ['kettleman-city']);
    const b = simulate({ ...DEFAULT_STATE, startingChargePercent: 90 }, [
      'kettleman-city',
    ]);
    expect(b.cost!).toBeLessThan(a.cost!);
    expect(b.stops[0].purchasedKwh).toBeLessThan(a.stops[0].purchasedKwh);
  });
  it('a higher reserve increases energy and final charge', () => {
    const p = currentPlan({ ...DEFAULT_STATE, minimumArrivalPercent: 30 });
    expect(p.feasible).toBe(true);
    expect(p.arrivalPercent!).toBeGreaterThanOrEqual(30);
    expect(p.cost).not.toBe(currentPlan(DEFAULT_STATE).cost);
  });
  it('low start has no fictitious totals', () => {
    for (const p of compareRoutes({
      ...DEFAULT_STATE,
      startingChargePercent: 10,
    })) {
      expect(p.feasible).toBe(false);
      expect([p.cost, p.totalMinutes, p.arrivalPercent]).toEqual([
        null,
        null,
        null,
      ]);
      expect(p.reason).toContain('Cannot reach');
    }
  });
  it('rejects a leg beyond available capacity', () => {
    expect(
      simulate(
        {
          ...DEFAULT_STATE,
          vehicleId: 'compact',
          startingChargePercent: 100,
          minimumArrivalPercent: 50,
        },
        ['santa-clarita'],
      ).feasible,
    ).toBe(false);
  });
  it('rejects unnecessary charging stops', () => {
    expect(
      simulate({ ...DEFAULT_STATE, startingChargePercent: 100 }, [
        'santa-clarita',
        'tejon-ranch',
        'kettleman-city',
      ]).reason,
    ).toContain('adds no energy');
  });
  it('rejects an unreachable replacement without mutating inputs', () => {
    const before = structuredClone(DEFAULT_STATE);
    expect(() => replaceStop(DEFAULT_STATE, 0, 'san-jose')).toThrow();
    expect(DEFAULT_STATE).toEqual(before);
  });
  it.each([-1, 0.5, 99, '0'])('rejects invalid stop index %s', (index) => {
    expect(() => replaceStop(DEFAULT_STATE, index, 'tejon-ranch')).toThrow();
  });
  it('filters stations including empty results', () => {
    expect(
      findChargers({ minimumPowerKw: 300, amenity: 'coffee' }).map((s) => s.id),
    ).toEqual(['tejon-ranch', 'san-jose']);
    expect(findChargers({ minimumPowerKw: 400 })).toEqual([]);
    expect(findChargers({})).toHaveLength(6);
  });
  it.each([
    { destination: 'New York' },
    { startingChargePercent: '90' },
    { minimumArrivalPercent: NaN },
    { preferAmenities: 1 },
    { vehicleId: 'unknown' },
    { routeStyle: 'cheap' },
    { extra: true },
    { customStopIds: ['gilroy', 'tejon-ranch'] },
    { customStopIds: ['gilroy', 'gilroy'] },
  ])('rejects invalid settings %j', (patch) => {
    expect(() => validateState({ ...DEFAULT_STATE, ...patch })).toThrow();
  });
});

describe('saved settings and agent contract', () => {
  it('round-trips versioned settings and rejects broken storage', () => {
    expect(restoreTrip(serializeTrip(DEFAULT_STATE))).toEqual(DEFAULT_STATE);
    expect(restoreTrip(null)).toEqual(DEFAULT_STATE);
    for (const value of [
      'invalid',
      '{}',
      JSON.stringify({ version: 2, state: DEFAULT_STATE }),
      'x'.repeat(10001),
    ])
      expect(() => restoreTrip(value)).toThrow();
  });
  function fixture() {
    let state = structuredClone(DEFAULT_STATE);
    const showChargers = vi.fn();
    const showComparison = vi.fn();
    const tools = toolsFor({
      get: () => state,
      apply: (s) => {
        state = s;
      },
      showChargers,
      showComparison,
    });
    const call = (name: string, input: unknown = {}) =>
      tools.find((t) => t.name === name)!.execute(input) as {
        ok: boolean;
        dataMode: string;
        data: Record<string, unknown>;
      };
    return { tools, call, state: () => state, showChargers, showComparison };
  }
  it('seven tools share current state and expose bounded schemas', () => {
    const f = fixture();
    expect(f.tools).toHaveLength(7);
    expect(f.tools.filter((t) => !t.annotations.readOnlyHint)).toHaveLength(3);
    for (const tool of f.tools)
      expect(tool.inputSchema.additionalProperties).toBe(false);
    expect(
      f.call('set_trip_preferences', {
        vehicleId: 'compact',
        minimumArrivalPercent: 25,
      }).ok,
    ).toBe(true);
    expect(
      f.call('create_trip_plan', {
        startingChargePercent: 85,
        routeStyle: 'fastest',
      }).ok,
    ).toBe(true);
    expect(f.call('get_trip_context').data.state).toMatchObject({
      vehicleId: 'compact',
      minimumArrivalPercent: 25,
      startingChargePercent: 85,
    });
    expect(f.call('list_vehicle_profiles').data.vehicles).toHaveLength(4);
    expect(f.call('find_chargers', { minimumPowerKw: 400 }).data.count).toBe(0);
    expect(f.showChargers).toHaveBeenCalledWith([]);
    expect(f.call('compare_route_options').data.routes).toHaveLength(3);
    expect(f.showComparison).toHaveBeenCalledOnce();
    const ids = currentPlan(f.state()).stops.map((s) => s.charger.id);
    expect(
      f.call('replace_charging_stop', { stopIndex: 0, chargerId: ids[0] }).ok,
    ).toBe(true);
    expect(f.state().customStopIds).toEqual(ids);
  });
  it('invalid agent calls preserve all state', () => {
    const f = fixture();
    const before = structuredClone(f.state());
    for (const tool of f.tools)
      expect(tool.execute({ surprise: true })).toMatchObject({
        ok: false,
        dataMode: 'SIMULATION',
      });
    expect(f.call('create_trip_plan', { destination: 'San Diego' }).ok).toBe(
      false,
    );
    expect(
      f.call('set_trip_preferences', { minimumArrivalPercent: null }).ok,
    ).toBe(false);
    expect(
      f.call('replace_charging_stop', { stopIndex: 0, chargerId: 'san-jose' })
        .ok,
    ).toBe(false);
    expect(f.state()).toEqual(before);
  });
  it('agent results are detached copies', () => {
    const f = fixture();
    const result = f.call('get_trip_context');
    (result.data.state as { vehicleId: string }).vehicleId = 'bad';
    expect(f.state().vehicleId).toBe(DEFAULT_STATE.vehicleId);
  });
  it('registers through lifecycle signals and supports missing hosts', async () => {
    const f = fixture();
    const controller = new AbortController();
    const registerTool = vi.fn();
    expect(
      await registerTools(
        { modelContext: { registerTool } },
        f.tools,
        controller.signal,
      ),
    ).toBe(7);
    expect(registerTool).toHaveBeenCalledTimes(7);
    expect(registerTool.mock.calls[0][1].signal).toBe(controller.signal);
    controller.abort();
    expect(
      await registerTools(
        { modelContext: { registerTool } },
        f.tools,
        controller.signal,
      ),
    ).toBe(0);
    expect(
      await registerTools({}, f.tools, new AbortController().signal, 0),
    ).toBe(0);
  });
  it('accepts a host that arrives after the page', async () => {
    vi.useFakeTimers();
    const target: { modelContext?: ModelContext } = {};
    const pending = registerTools(
      target,
      fixture().tools,
      new AbortController().signal,
      500,
    );
    target.modelContext = { registerTool: vi.fn() };
    await vi.advanceTimersByTimeAsync(100);
    expect(await pending).toBe(7);
    vi.useRealTimers();
  });
});
