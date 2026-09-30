export const VEHICLES = [
  {
    id: 'compact',
    name: 'Compact EV (sample)',
    range: 240,
    battery: 60,
    maxPowerKw: 120,
  },
  {
    id: 'long-range',
    name: 'Long-range EV (sample)',
    range: 310,
    battery: 75,
    maxPowerKw: 200,
  },
  {
    id: 'crossover',
    name: 'Crossover EV (sample)',
    range: 280,
    battery: 85,
    maxPowerKw: 160,
  },
  {
    id: 'large-suv',
    name: 'Large SUV (sample)',
    range: 350,
    battery: 130,
    maxPowerKw: 220,
  },
];
export const AMENITIES = [
  'coffee',
  'restrooms',
  'food',
  'shopping',
  'lounge',
  'hotel',
] as const;
export const CHARGERS = [
  {
    id: 'santa-clarita',
    city: 'Santa Clarita',
    site: 'Sample station A',
    mile: 35,
    powerKw: 150,
    price: 0.42,
    amenities: ['coffee', 'restrooms', 'food'],
  },
  {
    id: 'tejon-ranch',
    city: 'Tejon Ranch',
    site: 'Sample station B',
    mile: 85,
    powerKw: 350,
    price: 0.48,
    amenities: ['coffee', 'restrooms', 'shopping'],
  },
  {
    id: 'kettleman-city',
    city: 'Kettleman City',
    site: 'Sample station C',
    mile: 175,
    powerKw: 250,
    price: 0.39,
    amenities: ['coffee', 'restrooms', 'food', 'lounge'],
  },
  {
    id: 'harris-ranch',
    city: 'Coalinga',
    site: 'Sample station D',
    mile: 195,
    powerKw: 350,
    price: 0.46,
    amenities: ['restrooms', 'food', 'hotel'],
  },
  {
    id: 'gilroy',
    city: 'Gilroy',
    site: 'Sample station E',
    mile: 310,
    powerKw: 150,
    price: 0.36,
    amenities: ['coffee', 'restrooms', 'food'],
  },
  {
    id: 'san-jose',
    city: 'San Jose',
    site: 'Sample station F',
    mile: 345,
    powerKw: 350,
    price: 0.52,
    amenities: ['coffee', 'restrooms', 'shopping'],
  },
];
export type Charger = (typeof CHARGERS)[number];
export type Style = 'fastest' | 'balanced' | 'comfort';
export const STYLES: Style[] = ['fastest', 'balanced', 'comfort'];
export const LABELS = {
  fastest: 'Fastest',
  balanced: 'Balanced',
  comfort: 'Comfort',
};
export const ASSUMPTIONS = {
  dataMode: 'SIMULATION',
  methodology: 'volt-energy-v1',
  distanceMiles: 387,
  speedMph: 60,
  chargingEfficiency: 0.9,
  averagePowerFactor: 0.6,
  overheadMinutesPerStop: 5,
  limitations: [
    'Fixed Los Angeles to San Francisco sample corridor. Station locations, prices, and vehicle profiles are assumptions, not verified infrastructure or manufacturer specifications.',
    'No live availability, connector compatibility, traffic, elevation, weather, battery degradation, or navigation. All sample chargers are assumed compatible and available.',
    'Charging uses constant effective power, not a measured charging curve. Cost covers electricity purchased at sample stops only; initial battery energy, taxes, and other fees are excluded.',
  ],
};
export type TripState = {
  origin: string;
  destination: string;
  vehicleId: string;
  startingChargePercent: number;
  minimumArrivalPercent: number;
  preferAmenities: boolean;
  routeStyle: Style;
  customStopIds: string[] | null;
};
export const DEFAULT_STATE: TripState = {
  origin: 'Los Angeles, CA',
  destination: 'San Francisco, CA',
  vehicleId: 'long-range',
  startingChargePercent: 78,
  minimumArrivalPercent: 20,
  preferAmenities: true,
  routeStyle: 'balanced',
  customStopIds: null,
};
export type Stop = {
  charger: Charger;
  legMiles: number;
  arrivalPercent: number;
  departurePercent: number;
  batteryAddedKwh: number;
  purchasedKwh: number;
  chargingMinutes: number;
  cost: number;
};
export type Plan = {
  style: Style;
  feasible: boolean;
  reason: string | null;
  custom: boolean;
  distance: number;
  totalMinutes: number | null;
  chargeMinutes: number | null;
  cost: number | null;
  arrivalPercent: number | null;
  stops: Stop[];
  finalLegMiles: number;
  requiredStartPercent: number;
};
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export function record(
  input: unknown,
  allowed: string[],
): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Input must be an object.');
  const value = input as Record<string, unknown>;
  for (const key of Object.keys(value))
    if (!allowed.includes(key)) throw new Error(`Unknown field: ${key}.`);
  return value;
}
export function numberIn(
  value: unknown,
  name: string,
  min: number,
  max: number,
) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    throw new Error(`${name} must be a number from ${min} to ${max}.`);
  return value;
}
export function validateState(input: unknown): TripState {
  const state = record(input, Object.keys(DEFAULT_STATE));
  const normalized = (value: unknown) =>
    typeof value === 'string'
      ? value.trim().toLowerCase().replace(/\s+/g, ' ')
      : '';
  if (
    !['los angeles', 'los angeles, ca'].includes(normalized(state.origin)) ||
    !['san francisco', 'san francisco, ca'].includes(
      normalized(state.destination),
    )
  )
    throw new Error(
      'Only the Los Angeles → San Francisco sample corridor is supported.',
    );
  if (!VEHICLES.some((vehicle) => vehicle.id === state.vehicleId))
    throw new Error('Choose a listed sample vehicle profile.');
  numberIn(state.startingChargePercent, 'Starting charge', 10, 100);
  numberIn(state.minimumArrivalPercent, 'Arrival reserve', 5, 50);
  if (typeof state.preferAmenities !== 'boolean')
    throw new Error('Amenity preference must be a boolean.');
  if (!STYLES.includes(state.routeStyle as Style))
    throw new Error('Choose fastest, balanced, or comfort.');
  if (state.customStopIds !== null) validateStopIds(state.customStopIds);
  return {
    ...state,
    origin: DEFAULT_STATE.origin,
    destination: DEFAULT_STATE.destination,
  } as TripState;
}
export function validateStopIds(input: unknown): string[] {
  if (
    !Array.isArray(input) ||
    input.length > 6 ||
    input.some(
      (id) =>
        typeof id !== 'string' ||
        !CHARGERS.some((charger) => charger.id === id),
    )
  )
    throw new Error('Choose up to six known corridor stops.');
  const ids = input as string[];
  const miles = ids.map(
    (id) => CHARGERS.find((charger) => charger.id === id)!.mile,
  );
  if (miles.some((mile, index) => index > 0 && mile <= miles[index - 1]))
    throw new Error('Stops must be unique and in forward corridor order.');
  return [...ids];
}
export function simulate(
  state: TripState,
  ids: string[],
  style = state.routeStyle,
): Plan {
  validateState(state);
  validateStopIds(ids);
  const vehicle = VEHICLES.find((item) => item.id === state.vehicleId)!;
  const chargers = ids.map((id) => CHARGERS.find((item) => item.id === id)!);
  const firstLeg = chargers[0]?.mile ?? ASSUMPTIONS.distanceMiles;
  // Round up to the form's 0.1% step so the suggested minimum is sufficient.
  const requiredStartPercent =
    Math.ceil(
      ((firstLeg / vehicle.range) * 100 + state.minimumArrivalPercent) * 10,
    ) / 10;
  const result: Plan = {
    style,
    feasible: false,
    reason: null,
    custom: state.customStopIds !== null,
    distance: ASSUMPTIONS.distanceMiles,
    totalMinutes: null,
    chargeMinutes: null,
    cost: null,
    arrivalPercent: null,
    stops: [],
    finalLegMiles: 0,
    requiredStartPercent,
  };
  let charge = state.startingChargePercent,
    mile = 0;
  const buffer = style === 'comfort' ? 10 : style === 'balanced' ? 3 : 0;
  const reserve = state.minimumArrivalPercent;
  for (let index = 0; index <= chargers.length; index++) {
    const charger = chargers[index];
    const nextMile = charger?.mile ?? ASSUMPTIONS.distanceMiles;
    const legMiles = nextMile - mile;
    charge -= (legMiles / vehicle.range) * 100;
    if (charge + 1e-8 < reserve) {
      result.reason = `Cannot reach ${charger?.city ?? 'the destination'} with the ${reserve}% reserve. Increase starting charge, reduce the reserve, or use a different profile/stops.`;
      return result;
    }
    if (!charger) {
      result.arrivalPercent = round(charge);
      result.finalLegMiles = legMiles;
      break;
    }
    const followingMile =
      chargers[index + 1]?.mile ?? ASSUMPTIONS.distanceMiles;
    const needed = ((followingMile - nextMile) / vehicle.range) * 100 + reserve;
    if (needed > 100 + 1e-8) {
      result.reason = `The leg after ${charger.city} exceeds this profile's range at the requested reserve.`;
      return result;
    }
    const target = Math.min(100, needed + buffer);
    const departure = Math.max(charge, target);
    const batteryAdded = ((departure - charge) / 100) * vehicle.battery;
    if (batteryAdded < 0.01) {
      result.reason = `${charger.city} adds no energy to this plan. Choose a route without that unnecessary stop.`;
      return result;
    }
    const purchased = batteryAdded / ASSUMPTIONS.chargingEfficiency;
    const averagePower =
      Math.min(vehicle.maxPowerKw, charger.powerKw) *
      ASSUMPTIONS.averagePowerFactor;
    result.stops.push({
      charger,
      legMiles,
      arrivalPercent: round(charge),
      departurePercent: round(departure),
      batteryAddedKwh: round(batteryAdded),
      purchasedKwh: round(purchased),
      chargingMinutes: Math.ceil((purchased / averagePower) * 60),
      cost: round(purchased * charger.price),
    });
    charge = departure;
    mile = nextMile;
  }
  result.feasible = true;
  result.chargeMinutes = result.stops.reduce(
    (sum, stop) => sum + stop.chargingMinutes,
    0,
  );
  result.totalMinutes =
    Math.round((result.distance / ASSUMPTIONS.speedMph) * 60) +
    result.chargeMinutes +
    result.stops.length * ASSUMPTIONS.overheadMinutesPerStop;
  result.cost = round(result.stops.reduce((sum, stop) => sum + stop.cost, 0));
  return result;
}
function objective(plan: Plan, state: TripState) {
  const noAmenities = plan.stops.filter(
    (stop) =>
      !stop.charger.amenities.includes('coffee') ||
      !stop.charger.amenities.includes('restrooms'),
  ).length;
  const preferencePenalty = state.preferAmenities ? noAmenities * 12 : 0;
  if (plan.style === 'fastest') return plan.totalMinutes! + preferencePenalty;
  if (plan.style === 'balanced')
    return plan.totalMinutes! + plan.cost! * 1.5 + preferencePenalty;
  return (
    plan.totalMinutes! +
    plan.cost! * 0.5 +
    preferencePenalty +
    Math.max(plan.finalLegMiles, ...plan.stops.map((stop) => stop.legMiles)) *
      0.3
  );
}
export function compareRoutes(input: TripState): Plan[] {
  const state = validateState(input);
  return STYLES.map((style) => {
    let best: Plan | undefined;
    for (let mask = 0; mask < 2 ** CHARGERS.length; mask++) {
      const ids = CHARGERS.filter(
        (_, index) => (mask & (1 << index)) !== 0,
      ).map((charger) => charger.id);
      const plan = simulate({ ...state, customStopIds: null }, ids, style);
      if (
        plan.feasible &&
        (!best || objective(plan, state) < objective(best, state))
      )
        best = plan;
    }
    return (
      best ?? {
        ...simulate({ ...state, customStopIds: null }, [CHARGERS[0].id], style),
        stops: [],
      }
    );
  });
}
export function currentPlan(state: TripState): Plan {
  return state.customStopIds !== null
    ? simulate(state, state.customStopIds)
    : compareRoutes(state).find((plan) => plan.style === state.routeStyle)!;
}
export function replaceStop(
  state: TripState,
  index: unknown,
  chargerId: unknown,
): TripState {
  const plan = currentPlan(state);
  if (!plan.feasible)
    throw new Error('Build a feasible plan before replacing a stop.');
  if (
    typeof index !== 'number' ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= plan.stops.length
  )
    throw new Error('Choose a valid integer stop index from the current plan.');
  if (typeof chargerId !== 'string')
    throw new Error('Choose a known charger ID.');
  const ids = plan.stops.map((stop) => stop.charger.id);
  ids[index] = chargerId;
  validateStopIds(ids);
  const next = validateState({ ...state, customStopIds: ids });
  const replacement = currentPlan(next);
  if (!replacement.feasible) throw new Error(replacement.reason!);
  return next;
}
export function findChargers(input: unknown): Charger[] {
  const value = record(input, ['minimumPowerKw', 'amenity']);
  const power =
    value.minimumPowerKw === undefined
      ? 50
      : numberIn(value.minimumPowerKw, 'Minimum power', 50, 400);
  if (
    value.amenity !== undefined &&
    !AMENITIES.includes(value.amenity as (typeof AMENITIES)[number])
  )
    throw new Error('Choose a supported amenity.');
  return CHARGERS.filter(
    (charger) =>
      charger.powerKw >= power &&
      (value.amenity === undefined ||
        charger.amenities.includes(value.amenity as string)),
  );
}
