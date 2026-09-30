import {
  AMENITIES,
  ASSUMPTIONS,
  CHARGERS,
  VEHICLES,
  STYLES,
  compareRoutes,
  currentPlan,
  findChargers,
  record,
  replaceStop,
  validateState,
  type TripState,
} from './planner';
export type Tool = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
};
export type ModelContext = {
  registerTool(tool: Tool, options: { signal: AbortSignal }): unknown;
};
declare global {
  interface Document {
    modelContext?: ModelContext;
  }
}
type Hooks = {
  get: () => TripState;
  apply: (state: TripState, message: string) => void;
  showChargers: (ids: string[]) => void;
  showComparison: () => void;
};
export function toolsFor(hooks: Hooks): Tool[] {
  const schema = (
    properties: Record<string, unknown>,
    required: string[] = [],
  ) => ({ type: 'object', properties, required, additionalProperties: false });
  const wrap = (fn: (input: unknown) => unknown) => (input: unknown) => {
    try {
      return structuredClone({ ok: true, ...ASSUMPTIONS, data: fn(input) });
    } catch (error) {
      return {
        ok: false,
        dataMode: 'SIMULATION',
        error: {
          code: 'INVALID_INPUT',
          message: error instanceof Error ? error.message : 'Invalid request.',
        },
      };
    }
  };
  const empty = (input: unknown) => record(input, []);
  const title = (
    name: string,
    label: string,
    description: string,
    properties: Record<string, unknown>,
    readOnlyHint: boolean,
    execute: (input: unknown) => unknown,
    required: string[] = [],
  ): Tool => ({
    name,
    title: label,
    description: `${description} Uses fictional sample stations and an assumed energy model; not navigation or live charger data.`,
    inputSchema: schema(properties, required),
    annotations: { readOnlyHint, untrustedContentHint: true },
    execute: wrap(execute),
  });
  return [
    title(
      'get_trip_context',
      'Get trip context',
      'Read the applied inputs, calculated plan, and assumptions.',
      {},
      true,
      (input) => {
        empty(input);
        return { state: hooks.get(), plan: currentPlan(hooks.get()) };
      },
    ),
    title(
      'list_vehicle_profiles',
      'List sample vehicle profiles',
      'Read generic sample range, battery capacity, and peak charging power assumptions.',
      {},
      true,
      (input) => {
        empty(input);
        return { vehicles: VEHICLES };
      },
    ),
    title(
      'find_chargers',
      'Find sample corridor chargers',
      'Filter sample stations and show matching cards on the page.',
      {
        minimumPowerKw: {
          type: 'number',
          minimum: 50,
          maximum: 400,
          description: 'Minimum sample station rated power in kW.',
        },
        amenity: {
          type: 'string',
          enum: AMENITIES,
          description: 'Required sample amenity.',
        },
      },
      true,
      (input) => {
        const chargers = findChargers(input);
        hooks.showChargers(chargers.map((charger) => charger.id));
        return { chargers, count: chargers.length };
      },
    ),
    title(
      'compare_route_options',
      'Compare calculated route options',
      'Calculate three route styles for the applied vehicle, charge, and reserve; display the comparison.',
      {},
      true,
      (input) => {
        empty(input);
        hooks.showComparison();
        return { routes: compareRoutes(hooks.get()) };
      },
    ),
    title(
      'create_trip_plan',
      'Create simulated trip plan',
      'Apply optional inputs and calculate a plan. Unsupported endpoints return an error. A physically infeasible plan is explicitly marked infeasible. Clears custom stop replacements.',
      {
        origin: {
          type: 'string',
          maxLength: 120,
          description: 'Only Los Angeles or Los Angeles, CA is supported.',
        },
        destination: {
          type: 'string',
          maxLength: 120,
          description: 'Only San Francisco or San Francisco, CA is supported.',
        },
        routeStyle: {
          type: 'string',
          enum: STYLES,
          description: 'Objective used to select charging stops.',
        },
        startingChargePercent: {
          type: 'number',
          minimum: 10,
          maximum: 100,
          description: 'Starting battery state of charge in percent.',
        },
      },
      false,
      (input) => {
        const patch = record(input, [
          'origin',
          'destination',
          'routeStyle',
          'startingChargePercent',
        ]);
        const next = validateState({
          ...hooks.get(),
          ...patch,
          customStopIds: null,
        });
        const plan = currentPlan(next);
        hooks.apply(
          next,
          plan.feasible
            ? 'Agent recalculated the sample trip.'
            : 'Agent inputs applied; no feasible plan meets this reserve.',
        );
        return { applied: true, state: next, plan };
      },
    ),
    title(
      'set_trip_preferences',
      'Set trip preferences',
      'Apply sample vehicle, reserve, or amenity preference and recalculate the current plan.',
      {
        vehicleId: {
          type: 'string',
          enum: VEHICLES.map((vehicle) => vehicle.id),
          description: 'Generic profile ID from list_vehicle_profiles.',
        },
        minimumArrivalPercent: {
          type: 'number',
          minimum: 5,
          maximum: 50,
          description: 'Minimum reserve at every stop and at the destination.',
        },
        preferAmenities: {
          type: 'boolean',
          description:
            'Penalize stops without both coffee and restrooms in the route objective.',
        },
      },
      false,
      (input) => {
        const patch = record(input, [
          'vehicleId',
          'minimumArrivalPercent',
          'preferAmenities',
        ]);
        const next = validateState({ ...hooks.get(), ...patch });
        const plan = currentPlan(next);
        hooks.apply(next, 'Agent preferences applied and plan recalculated.');
        return { applied: true, state: next, plan };
      },
    ),
    title(
      'replace_charging_stop',
      'Replace a charging stop',
      'Replace one current stop and recalculate energy, time, and cost. Reject duplicate, backward, unnecessary, or unreachable stops without changing the plan.',
      {
        stopIndex: {
          type: 'integer',
          minimum: 0,
          maximum: 5,
          description: 'Zero-based index from the current feasible plan.',
        },
        chargerId: {
          type: 'string',
          enum: CHARGERS.map((charger) => charger.id),
          description: 'Replacement sample station ID.',
        },
      },
      false,
      (input) => {
        const value = record(input, ['stopIndex', 'chargerId']);
        const next = replaceStop(hooks.get(), value.stopIndex, value.chargerId);
        hooks.apply(
          next,
          'Agent replaced a stop and recalculated the custom plan.',
        );
        return { applied: true, state: next, plan: currentPlan(next) };
      },
      ['stopIndex', 'chargerId'],
    ),
  ];
}
export async function registerTools(
  target: { modelContext?: ModelContext },
  tools: Tool[],
  signal: AbortSignal,
  waitMs = 8000,
) {
  const deadline = Date.now() + waitMs;
  while (
    !target.modelContext?.registerTool &&
    Date.now() < deadline &&
    !signal.aborted
  )
    await new Promise((resolve) => setTimeout(resolve, 100));
  if (signal.aborted || !target.modelContext?.registerTool) return 0;
  for (const tool of tools) {
    if (signal.aborted) return 0;
    await target.modelContext.registerTool(tool, { signal });
  }
  return tools.length;
}
