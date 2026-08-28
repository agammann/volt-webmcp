'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  BatteryCharging,
  Bot,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Coffee,
  Gauge,
  Info,
  MapPin,
  Navigation,
  Route,
  ShieldCheck,
  Sparkles,
  Utensils,
  X,
  Zap,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';

type ToolInput = Record<string, unknown>;

type SiteTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: Record<string, boolean>;
  execute: (input: ToolInput) => unknown | Promise<unknown>;
};

type ModelContext = {
  registerTool: (tool: SiteTool) => void | Promise<void>;
  unregisterTool?: (name: string) => void | Promise<void>;
};

declare global {
  interface Document {
    modelContext?: ModelContext;
  }
}

type Charger = {
  id: string;
  city: string;
  site: string;
  powerKw: number;
  stalls: number;
  available: number;
  price: number;
  amenities: string[];
  charge: number;
  minutes: number;
  position: { left: number; top: number };
};

type RouteOption = {
  id: 'fastest' | 'balanced' | 'comfort';
  label: string;
  eyebrow: string;
  description: string;
  time: string;
  minutes: number;
  distance: number;
  arrival: number;
  cost: number;
  stopIds: string[];
};

const VEHICLES = [
  { id: 'model-y', name: 'Tesla Model Y LR', range: 310, battery: 75 },
  { id: 'ioniq-5', name: 'Hyundai Ioniq 5', range: 303, battery: 77 },
  { id: 'mach-e', name: 'Ford Mustang Mach-E', range: 312, battery: 91 },
  { id: 'rivian-r1s', name: 'Rivian R1S', range: 352, battery: 135 },
];

const CHARGERS: Charger[] = [
  {
    id: 'santa-clarita',
    city: 'Santa Clarita',
    site: 'Newhall Ranch',
    powerKw: 250,
    stalls: 20,
    available: 14,
    price: 0.42,
    amenities: ['coffee', 'restrooms', 'food'],
    charge: 61,
    minutes: 12,
    position: { left: 31, top: 72 },
  },
  {
    id: 'tejon-ranch',
    city: 'Tejon Ranch',
    site: 'Outlets at Tejon',
    powerKw: 350,
    stalls: 16,
    available: 9,
    price: 0.48,
    amenities: ['coffee', 'restrooms', 'shopping'],
    charge: 58,
    minutes: 10,
    position: { left: 39, top: 62 },
  },
  {
    id: 'kettleman-city',
    city: 'Kettleman City',
    site: 'I-5 Charging Garden',
    powerKw: 250,
    stalls: 40,
    available: 27,
    price: 0.39,
    amenities: ['coffee', 'restrooms', 'food', 'lounge'],
    charge: 54,
    minutes: 24,
    position: { left: 52, top: 47 },
  },
  {
    id: 'harris-ranch',
    city: 'Coalinga',
    site: 'Harris Ranch',
    powerKw: 350,
    stalls: 24,
    available: 18,
    price: 0.46,
    amenities: ['restrooms', 'food', 'hotel'],
    charge: 68,
    minutes: 28,
    position: { left: 57, top: 42 },
  },
  {
    id: 'gilroy',
    city: 'Gilroy',
    site: 'Leavesley Road',
    powerKw: 150,
    stalls: 18,
    available: 8,
    price: 0.36,
    amenities: ['coffee', 'restrooms', 'food'],
    charge: 42,
    minutes: 16,
    position: { left: 71, top: 25 },
  },
  {
    id: 'san-jose',
    city: 'San Jose',
    site: 'Market Street Garage',
    powerKw: 350,
    stalls: 12,
    available: 5,
    price: 0.52,
    amenities: ['coffee', 'restrooms', 'shopping'],
    charge: 47,
    minutes: 11,
    position: { left: 78, top: 17 },
  },
];

const ROUTES: Record<RouteOption['id'], RouteOption> = {
  fastest: {
    id: 'fastest',
    label: 'Fastest',
    eyebrow: 'Save 22 min',
    description: 'Higher-power stops with the shortest charging time.',
    time: '6 hr 56 min',
    minutes: 416,
    distance: 389,
    arrival: 18,
    cost: 41,
    stopIds: ['tejon-ranch', 'kettleman-city', 'san-jose'],
  },
  balanced: {
    id: 'balanced',
    label: 'Balanced',
    eyebrow: 'Recommended',
    description: 'Comfortable arrival buffer with reliable amenities.',
    time: '7 hr 18 min',
    minutes: 438,
    distance: 387,
    arrival: 26,
    cost: 37,
    stopIds: ['santa-clarita', 'kettleman-city', 'gilroy'],
  },
  comfort: {
    id: 'comfort',
    label: 'Comfort',
    eyebrow: 'Largest buffer',
    description: 'More range at every leg and relaxed meal-friendly stops.',
    time: '7 hr 42 min',
    minutes: 462,
    distance: 392,
    arrival: 34,
    cost: 44,
    stopIds: ['santa-clarita', 'tejon-ranch', 'harris-ranch', 'gilroy'],
  },
};

const TOOL_NAMES = [
  'get_trip_context',
  'list_vehicle_profiles',
  'find_chargers',
  'compare_route_options',
  'create_trip_plan',
  'set_trip_preferences',
  'replace_charging_stop',
];

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function getCharger(id: string) {
  return CHARGERS.find((charger) => charger.id === id) ?? CHARGERS[0];
}

export default function Home() {
  const [origin, setOrigin] = useState('Los Angeles, CA');
  const [destination, setDestination] = useState('San Francisco, CA');
  const [vehicleId, setVehicleId] = useState('model-y');
  const [startCharge, setStartCharge] = useState(78);
  const [minimumArrival, setMinimumArrival] = useState(20);
  const [preferAmenities, setPreferAmenities] = useState(true);
  const [routeId, setRouteId] = useState<RouteOption['id']>('balanced');
  const [selectedStopIds, setSelectedStopIds] = useState(
    ROUTES.balanced.stopIds,
  );
  const [selectedChargerId, setSelectedChargerId] = useState('kettleman-city');
  const [agentPanelOpen, setAgentPanelOpen] = useState(false);
  const [webMcpReady, setWebMcpReady] = useState(false);
  const [isPlanning, setIsPlanning] = useState(false);
  const [activity, setActivity] = useState({
    title: 'Trip ready to explore',
    detail: 'The map and 7 agent tools share the same live plan.',
  });

  const stateRef = useRef({
    origin,
    destination,
    vehicleId,
    startCharge,
    minimumArrival,
    preferAmenities,
    routeId,
    selectedStopIds,
  });

  stateRef.current = {
    origin,
    destination,
    vehicleId,
    startCharge,
    minimumArrival,
    preferAmenities,
    routeId,
    selectedStopIds,
  };

  const currentRoute = ROUTES[routeId];
  const currentVehicle =
    VEHICLES.find((vehicle) => vehicle.id === vehicleId) ?? VEHICLES[0];
  const selectedCharger = getCharger(selectedChargerId);
  const activeChargers = selectedStopIds.map(getCharger);

  useEffect(() => {
    const context = document.modelContext;
    if (typeof context?.registerTool !== 'function') return;

    let cancelled = false;
    const note = (title: string, detail: string) => {
      setActivity({ title, detail });
    };

    const tools: SiteTool[] = [
      {
        name: 'get_trip_context',
        description:
          'Read the traveler’s current EV trip inputs, preferences, selected route, and charging stops shown on the page.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        execute: () => {
          const state = stateRef.current;
          const vehicle =
            VEHICLES.find((item) => item.id === state.vehicleId) ?? VEHICLES[0];
          return {
            origin: state.origin,
            destination: state.destination,
            vehicle,
            startingChargePercent: state.startCharge,
            minimumArrivalPercent: state.minimumArrival,
            prefersAmenities: state.preferAmenities,
            selectedRoute: ROUTES[state.routeId],
            chargingStops: state.selectedStopIds.map(getCharger),
          };
        },
      },
      {
        name: 'list_vehicle_profiles',
        description:
          'List the EV profiles available for route and battery planning, including their estimated range and battery capacity.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        execute: () => ({ vehicles: VEHICLES }),
      },
      {
        name: 'find_chargers',
        description:
          'Find compatible demo charging stations along the Los Angeles to San Francisco corridor, filtered by power or amenity.',
        inputSchema: {
          type: 'object',
          properties: {
            minimumPowerKw: {
              type: 'number',
              description: 'Minimum charging power in kilowatts.',
              minimum: 50,
              maximum: 400,
            },
            amenity: {
              type: 'string',
              description: 'Optional amenity such as coffee, food, restrooms, shopping, lounge, or hotel.',
            },
          },
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        execute: (input) => {
          const minimumPower = asNumber(input.minimumPowerKw, 50);
          const amenity = asString(input.amenity).toLowerCase();
          const chargers = CHARGERS.filter(
            (charger) =>
              charger.powerKw >= minimumPower &&
              (!amenity || charger.amenities.includes(amenity)),
          );
          note(
            'Agent searched the corridor',
            `${chargers.length} chargers match ${minimumPower}+ kW${amenity ? ` with ${amenity}` : ''}.`,
          );
          return { count: chargers.length, chargers };
        },
      },
      {
        name: 'compare_route_options',
        description:
          'Compare the fastest, balanced, and comfort-focused EV route plans with time, distance, cost, arrival charge, and stops.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        execute: () => {
          note(
            'Agent compared 3 routes',
            'Fastest saves 22 minutes; balanced keeps a stronger arrival buffer.',
          );
          return {
            routes: Object.values(ROUTES).map((route) => ({
              ...route,
              stops: route.stopIds.map(getCharger),
            })),
          };
        },
      },
      {
        name: 'create_trip_plan',
        description:
          'Create and display a charger-aware trip plan using a selected route style and optional trip inputs. This updates the visible map.',
        inputSchema: {
          type: 'object',
          properties: {
            origin: { type: 'string', description: 'Trip starting point.' },
            destination: { type: 'string', description: 'Trip destination.' },
            routeStyle: {
              type: 'string',
              enum: ['fastest', 'balanced', 'comfort'],
              description: 'Optimization style for the plan.',
            },
            startingChargePercent: {
              type: 'number',
              minimum: 10,
              maximum: 100,
            },
          },
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, destructiveHint: false },
        execute: (input) => {
          const style = asString(input.routeStyle, 'balanced') as RouteOption['id'];
          const safeStyle = ROUTES[style] ? style : 'balanced';
          const nextOrigin = asString(input.origin, stateRef.current.origin);
          const nextDestination = asString(
            input.destination,
            stateRef.current.destination,
          );
          const nextCharge = Math.min(
            100,
            Math.max(10, asNumber(input.startingChargePercent, stateRef.current.startCharge)),
          );
          setOrigin(nextOrigin);
          setDestination(nextDestination);
          setStartCharge(nextCharge);
          setRouteId(safeStyle);
          setSelectedStopIds(ROUTES[safeStyle].stopIds);
          note(
            'Agent built a new trip plan',
            `${ROUTES[safeStyle].label} route selected with ${ROUTES[safeStyle].stopIds.length} charging stops.`,
          );
          return {
            applied: true,
            route: ROUTES[safeStyle],
            stops: ROUTES[safeStyle].stopIds.map(getCharger),
            origin: nextOrigin,
            destination: nextDestination,
            startingChargePercent: nextCharge,
          };
        },
      },
      {
        name: 'set_trip_preferences',
        description:
          'Update the EV profile, minimum arrival charge, or amenity preference shown in the planner.',
        inputSchema: {
          type: 'object',
          properties: {
            vehicleId: {
              type: 'string',
              enum: VEHICLES.map((vehicle) => vehicle.id),
            },
            minimumArrivalPercent: {
              type: 'number',
              minimum: 5,
              maximum: 50,
            },
            preferAmenities: { type: 'boolean' },
          },
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
        execute: (input) => {
          const nextVehicle = asString(input.vehicleId, stateRef.current.vehicleId);
          const safeVehicle = VEHICLES.some((vehicle) => vehicle.id === nextVehicle)
            ? nextVehicle
            : stateRef.current.vehicleId;
          const nextMinimum = Math.min(
            50,
            Math.max(
              5,
              asNumber(input.minimumArrivalPercent, stateRef.current.minimumArrival),
            ),
          );
          const nextAmenities =
            typeof input.preferAmenities === 'boolean'
              ? input.preferAmenities
              : stateRef.current.preferAmenities;
          setVehicleId(safeVehicle);
          setMinimumArrival(nextMinimum);
          setPreferAmenities(nextAmenities);
          note(
            'Agent updated trip preferences',
            `Arrival goal is ${nextMinimum}%${nextAmenities ? ' with amenity-friendly stops' : ''}.`,
          );
          return {
            applied: true,
            vehicleId: safeVehicle,
            minimumArrivalPercent: nextMinimum,
            preferAmenities: nextAmenities,
          };
        },
      },
      {
        name: 'replace_charging_stop',
        description:
          'Replace one charging stop in the visible itinerary with another compatible corridor charger.',
        inputSchema: {
          type: 'object',
          required: ['stopIndex', 'chargerId'],
          properties: {
            stopIndex: {
              type: 'number',
              description: 'Zero-based index of the stop to replace.',
              minimum: 0,
              maximum: 3,
            },
            chargerId: {
              type: 'string',
              enum: CHARGERS.map((charger) => charger.id),
            },
          },
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, destructiveHint: false },
        execute: (input) => {
          const stopIndex = Math.floor(asNumber(input.stopIndex, -1));
          const chargerId = asString(input.chargerId);
          const charger = CHARGERS.find((item) => item.id === chargerId);
          const currentStops = stateRef.current.selectedStopIds;
          if (!charger || stopIndex < 0 || stopIndex >= currentStops.length) {
            return {
              applied: false,
              error: 'Choose a valid stop index and charger ID.',
              currentStops: currentStops.map(getCharger),
            };
          }
          const nextStops = [...currentStops];
          const replaced = getCharger(nextStops[stopIndex]);
          nextStops[stopIndex] = chargerId;
          setSelectedStopIds(nextStops);
          setSelectedChargerId(chargerId);
          note(
            'Agent changed a charging stop',
            `${replaced.city} was replaced with ${charger.city}.`,
          );
          return {
            applied: true,
            replaced: replaced.city,
            replacement: charger,
            stops: nextStops.map(getCharger),
          };
        },
      },
    ];

    void (async () => {
      try {
        for (const tool of tools) {
          await context.registerTool(tool);
        }
        if (!cancelled) setWebMcpReady(true);
      } catch {
        if (!cancelled) {
          setWebMcpReady(false);
          setActivity({
            title: 'Planner is ready',
            detail: 'Site tools will appear in a compatible WebMCP browser.',
          });
        }
      }
    })();

    return () => {
      cancelled = true;
      if (typeof context.unregisterTool === 'function') {
        for (const name of TOOL_NAMES) void context.unregisterTool(name);
      }
    };
  }, []);

  function selectRoute(nextRouteId: RouteOption['id'], source = 'You') {
    setRouteId(nextRouteId);
    setSelectedStopIds(ROUTES[nextRouteId].stopIds);
    setSelectedChargerId(ROUTES[nextRouteId].stopIds[1] ?? ROUTES[nextRouteId].stopIds[0]);
    setActivity({
      title: `${source} selected the ${ROUTES[nextRouteId].label.toLowerCase()} route`,
      detail: `${ROUTES[nextRouteId].stopIds.length} stops · ${ROUTES[nextRouteId].time} · $${ROUTES[nextRouteId].cost} estimated charging.`,
    });
  }

  function planRoute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPlanning(true);
    setActivity({
      title: 'Optimizing the route',
      detail: `Checking range and ${preferAmenities ? 'amenity-friendly' : 'fast'} charging stops for ${currentVehicle.name}.`,
    });
    window.setTimeout(() => {
      setIsPlanning(false);
      setSelectedStopIds(currentRoute.stopIds);
      setActivity({
        title: 'Route optimized',
        detail: `${currentRoute.label} plan arrives with ${currentRoute.arrival}% and ${currentRoute.stopIds.length} charging stops.`,
      });
    }, 650);
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border/80 bg-background/90 px-5 backdrop-blur-xl lg:px-8">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_8px_24px_rgba(28,91,67,.18)]">
            <Route className="size-[18px]" strokeWidth={2.4} />
          </div>
          <div>
            <p className="text-[15px] font-semibold tracking-[-0.02em]">ChargeRoute</p>
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              EV trip intelligence
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className={`hidden h-7 gap-1.5 px-2.5 sm:inline-flex ${
              webMcpReady
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}
          >
            {webMcpReady ? <Check className="size-3" /> : <Sparkles className="size-3" />}
            {webMcpReady ? '7 site tools live' : 'WebMCP built in'}
          </Badge>
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-xl px-3.5"
            onClick={() => setAgentPanelOpen((open) => !open)}
            aria-expanded={agentPanelOpen}
          >
            <Bot className="size-4" /> Ask your agent
          </Button>
        </div>
      </header>

      <section className="grid min-h-[calc(100vh-64px)] grid-cols-1 lg:grid-cols-[370px_minmax(0,1fr)]">
        <aside className="border-b border-border bg-card px-5 py-6 lg:border-r lg:border-b-0 lg:px-6">
          <Badge className="mb-4 h-6 bg-primary/10 px-2.5 text-primary">
            Plan with confidence
          </Badge>
          <h1 className="max-w-[310px] text-3xl font-semibold leading-[1.08] tracking-[-0.045em]">
            Your next charge, already figured out.
          </h1>
          <p className="mt-3 max-w-[310px] text-sm leading-6 text-muted-foreground">
            Build a road trip around range, charging speed, and the stops you actually want to make.
          </p>

          <form className="mt-7 space-y-4" onSubmit={planRoute}>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Starting point</span>
              <span className="relative block">
                <Navigation className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-primary" />
                <Input
                  className="h-11 rounded-xl bg-background pl-9 text-sm"
                  value={origin}
                  onChange={(event) => setOrigin(event.target.value)}
                  aria-label="Starting point"
                />
              </span>
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Destination</span>
              <span className="relative block">
                <MapPin className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#e56f44]" />
                <Input
                  className="h-11 rounded-xl bg-background pl-9 text-sm"
                  value={destination}
                  onChange={(event) => setDestination(event.target.value)}
                  aria-label="Destination"
                />
              </span>
            </label>

            <div className="grid grid-cols-[1fr_104px] gap-3">
              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground">Vehicle</span>
                <NativeSelect
                  className="w-full"
                  value={vehicleId}
                  onChange={(event) => setVehicleId(event.target.value)}
                  aria-label="Vehicle profile"
                >
                  {VEHICLES.map((vehicle) => (
                    <NativeSelectOption key={vehicle.id} value={vehicle.id}>
                      {vehicle.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground">Start charge</span>
                <span className="relative block">
                  <BatteryCharging className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-primary" />
                  <Input
                    className="h-8 pl-8 text-sm"
                    type="number"
                    min={10}
                    max={100}
                    value={startCharge}
                    onChange={(event) => setStartCharge(Number(event.target.value))}
                    aria-label="Starting battery percentage"
                  />
                </span>
              </label>
            </div>

            <div className="grid grid-cols-[1fr_104px] gap-3">
              <button
                type="button"
                onClick={() => setPreferAmenities((value) => !value)}
                className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left text-xs transition ${
                  preferAmenities
                    ? 'border-primary/30 bg-primary/[0.06] text-foreground'
                    : 'border-dashed border-border bg-background text-muted-foreground'
                }`}
                aria-pressed={preferAmenities}
              >
                <Coffee className="size-4 shrink-0 text-primary" />
                <span>
                  <span className="block font-semibold">Amenities</span>
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">
                    Coffee + restrooms
                  </span>
                </span>
                {preferAmenities && <Check className="ml-auto size-3.5 text-primary" />}
              </button>
              <label className="space-y-1.5 rounded-xl border border-border bg-background px-3 py-2">
                <span className="block text-[10px] font-semibold text-muted-foreground">Arrive above</span>
                <span className="flex items-center gap-1">
                  <input
                    className="w-10 bg-transparent text-sm font-semibold outline-none"
                    type="number"
                    min={5}
                    max={50}
                    value={minimumArrival}
                    onChange={(event) => setMinimumArrival(Number(event.target.value))}
                    aria-label="Minimum arrival battery percentage"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </span>
              </label>
            </div>

            <Button
              className="h-11 w-full rounded-xl bg-primary text-sm shadow-[0_10px_28px_rgba(28,91,67,.22)] hover:bg-primary/90"
              disabled={isPlanning}
            >
              {isPlanning ? 'Optimizing…' : 'Build my route'}
              {!isPlanning && <ArrowRight className="ml-1 size-4" />}
            </Button>
          </form>

          <div className="mt-6 rounded-2xl border border-border bg-background p-4">
            <div className="flex items-start gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#f4ebc7] text-[#735a12]">
                <Bot className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold">{activity.title}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{activity.detail}</p>
              </div>
            </div>
          </div>

          <p className="mt-4 flex items-start gap-2 text-[10px] leading-4 text-muted-foreground">
            <Info className="mt-0.5 size-3 shrink-0" />
            Demo corridor uses realistic sample station data. Always verify live availability before driving.
          </p>
        </aside>

        <div className="relative min-h-[760px] overflow-hidden bg-[#dfe9df] lg:min-h-0">
          <div className="absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_center,rgba(31,64,52,.13)_1px,transparent_1px)] [background-size:22px_22px]" />
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 900 760"
            fill="none"
            aria-label={`Planned electric vehicle route from ${origin} to ${destination}`}
          >
            <path
              d="M60 715C194 648 135 550 272 510C382 478 314 380 460 337C588 300 530 194 706 111C764 84 804 57 850 20"
              stroke="#cbd9cd"
              strokeWidth="80"
              strokeLinecap="round"
            />
            <path
              d="M22 460C184 424 171 316 304 277C435 239 431 145 556 110C687 74 710 18 735 -14"
              stroke="#edf2ed"
              strokeWidth="26"
              strokeLinecap="round"
            />
            <path
              d="M159 782C247 678 196 603 306 542C426 476 353 391 482 337C585 294 543 220 662 154C744 108 795 69 850 20"
              stroke="#2b6d52"
              strokeWidth="7"
              strokeLinecap="round"
              className={isPlanning ? 'route-planning' : ''}
            />
            <path
              d="M159 782C247 678 196 603 306 542C426 476 353 391 482 337C585 294 543 220 662 154C744 108 795 69 850 20"
              stroke="#f8fff9"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="12 13"
            />
            <g opacity=".55" fill="#799081" fontFamily="sans-serif" fontSize="13" fontWeight="600">
              <text x="64" y="630">Santa Barbara</text>
              <text x="302" y="448">Bakersfield</text>
              <text x="590" y="265">Fresno</text>
              <text x="716" y="185">San Jose</text>
            </g>
          </svg>

          <div className="absolute top-4 left-4 z-10 grid max-w-[calc(100%-32px)] grid-cols-3 gap-1.5 rounded-2xl border border-white/80 bg-white/90 p-1.5 shadow-[0_12px_40px_rgba(24,56,43,.13)] backdrop-blur-xl sm:top-6 sm:left-6">
            {Object.values(ROUTES).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => selectRoute(option.id)}
                className={`rounded-xl px-3 py-2.5 text-left transition sm:min-w-28 ${
                  routeId === option.id
                    ? 'bg-[#163f30] text-white shadow-sm'
                    : 'text-foreground hover:bg-emerald-50'
                }`}
                aria-pressed={routeId === option.id}
              >
                <span className={`block text-[9px] font-semibold uppercase tracking-[0.12em] ${routeId === option.id ? 'text-emerald-200' : 'text-muted-foreground'}`}>
                  {option.eyebrow}
                </span>
                <span className="mt-0.5 block text-xs font-semibold">{option.label}</span>
              </button>
            ))}
          </div>

          <div className="absolute top-[78%] left-[15%] flex max-w-[150px] items-center gap-2 rounded-full bg-[#163f30] py-1.5 pr-3 pl-1.5 text-xs font-semibold text-white shadow-lg">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white text-[#163f30]">
              <Navigation className="size-3.5" fill="currentColor" />
            </span>
            <span className="truncate">{origin.split(',')[0]}</span>
          </div>
          <div className="absolute top-[5%] right-[4%] flex max-w-[160px] items-center gap-2 rounded-full bg-[#e56f44] py-1.5 pr-3 pl-1.5 text-xs font-semibold text-white shadow-lg sm:right-[9%]">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/95 text-[#e56f44]">
              <MapPin className="size-3.5" fill="currentColor" />
            </span>
            <span className="truncate">{destination.split(',')[0]}</span>
          </div>

          {activeChargers.map((charger, index) => (
            <button
              type="button"
              key={`${charger.id}-${index}`}
              onClick={() => setSelectedChargerId(charger.id)}
              className={`absolute z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-xl border p-2 pr-3 text-left shadow-[0_10px_30px_rgba(26,60,44,.16)] backdrop-blur transition hover:-translate-y-[55%] sm:flex ${
                selectedChargerId === charger.id
                  ? 'border-primary bg-white ring-2 ring-primary/20'
                  : 'border-white/70 bg-white/92'
              }`}
              style={{ top: `${charger.position.top}%`, left: `${charger.position.left}%` }}
              aria-label={`View ${charger.city} charger details`}
            >
              <span className="grid size-8 place-items-center rounded-lg bg-[#e8f5ec] text-primary">
                <Zap className="size-4" fill="currentColor" />
              </span>
              <span className="hidden sm:block">
                <span className="block text-[11px] font-semibold">{charger.city}</span>
                <span className="block whitespace-nowrap text-[10px] text-muted-foreground">
                  {charger.minutes} min · {charger.powerKw} kW · {charger.charge}%
                </span>
              </span>
            </button>
          ))}

          <div className="absolute top-24 right-4 z-20 hidden w-64 rounded-2xl border border-white/80 bg-white/94 p-4 shadow-[0_16px_48px_rgba(24,56,43,.16)] backdrop-blur-xl xl:block">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">Selected stop</p>
                <h2 className="mt-1 text-sm font-semibold">{selectedCharger.city}</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">{selectedCharger.site}</p>
              </div>
              <span className="grid size-8 place-items-center rounded-lg bg-emerald-50 text-primary">
                <Zap className="size-4" fill="currentColor" />
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 border-y border-border py-3">
              <div>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Power</p>
                <p className="mt-1 text-xs font-semibold">{selectedCharger.powerKw} kW</p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Open</p>
                <p className="mt-1 text-xs font-semibold">{selectedCharger.available}/{selectedCharger.stalls}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Rate</p>
                <p className="mt-1 text-xs font-semibold">${selectedCharger.price}/kWh</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {selectedCharger.amenities.map((amenity) => (
                <Badge key={amenity} variant="secondary" className="h-5 text-[9px] capitalize">
                  {amenity === 'coffee' && <Coffee className="size-2.5" />}
                  {amenity === 'food' && <Utensils className="size-2.5" />}
                  {amenity}
                </Badge>
              ))}
            </div>
          </div>

          <div className="absolute right-4 bottom-4 left-4 z-20 rounded-2xl border border-white/80 bg-white/94 p-4 shadow-[0_18px_60px_rgba(24,56,43,.16)] backdrop-blur-xl sm:right-6 sm:bottom-6 sm:left-6 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-[220px] items-center gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#163f30] text-white">
                  <Route className="size-5" />
                </span>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{currentRoute.label} route</p>
                  <p className="mt-0.5 text-sm font-semibold">
                    {selectedStopIds.length} charging stops · {currentRoute.time}
                  </p>
                </div>
              </div>
              <div className="grid flex-1 grid-cols-2 gap-4 sm:flex sm:flex-none sm:items-center sm:gap-7 sm:text-right">
                <div>
                  <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">Distance</p>
                  <p className="mt-0.5 text-sm font-semibold">{currentRoute.distance} mi</p>
                </div>
                <div>
                  <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">Charge cost</p>
                  <p className="mt-0.5 text-sm font-semibold">${currentRoute.cost}</p>
                </div>
                <div>
                  <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">Arrival</p>
                  <p className="mt-0.5 text-sm font-semibold text-primary">{Math.max(currentRoute.arrival, minimumArrival)}%</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="hidden h-9 rounded-xl sm:flex"
                  onClick={() => setAgentPanelOpen(true)}
                >
                  Improve with agent
                </Button>
              </div>
            </div>
          </div>

          {agentPanelOpen && (
            <section className="absolute top-3 right-3 bottom-3 z-30 flex w-[min(360px,calc(100%-24px))] flex-col rounded-3xl border border-white/80 bg-[#102d24]/97 p-5 text-white shadow-[0_26px_80px_rgba(10,31,24,.38)] backdrop-blur-xl sm:top-5 sm:right-5 sm:bottom-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-[#d8f1df] text-[#163f30]">
                  <Bot className="size-5" />
                </span>
                <button
                  type="button"
                  onClick={() => setAgentPanelOpen(false)}
                  className="grid size-8 place-items-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white"
                  aria-label="Close agent panel"
                >
                  <X className="size-4" />
                </button>
              </div>
              <Badge className="mt-5 w-fit bg-emerald-200/10 text-emerald-200">
                <Sparkles className="size-3" /> {TOOL_NAMES.length} WebMCP tools
              </Badge>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em]">Plan together, not around each other.</h2>
              <p className="mt-2 text-sm leading-6 text-white/65">
                Ask Codex to inspect the same live route, compare tradeoffs, and update the map while you stay in control.
              </p>

              <div className="mt-6 space-y-2">
                {[
                  'Keep me above 25% at every stop.',
                  'Find a faster charger with coffee.',
                  'Compare the three route options.',
                  'Replace my second stop with Harris Ranch.',
                ].map((prompt) => (
                  <button
                    type="button"
                    key={prompt}
                    onClick={() => {
                      setActivity({
                        title: 'Example prompt selected',
                        detail: `Ask your agent: “${prompt}”`,
                      });
                      setAgentPanelOpen(false);
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.055] px-3.5 py-3 text-left text-xs text-white/85 transition hover:border-emerald-200/30 hover:bg-white/10"
                  >
                    <span>“{prompt}”</span>
                    <ChevronRight className="size-3.5 shrink-0 text-emerald-200" />
                  </button>
                ))}
              </div>

              <div className="mt-auto grid grid-cols-2 gap-2 pt-6">
                <div className="rounded-xl border border-white/10 bg-white/[0.045] p-3">
                  <ShieldCheck className="size-4 text-emerald-200" />
                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-white/50">Human review</p>
                  <p className="mt-1 text-xs">Every change stays visible on the map.</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.045] p-3">
                  <Gauge className="size-4 text-emerald-200" />
                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-white/50">Shared state</p>
                  <p className="mt-1 text-xs">Tools read your current trip preferences.</p>
                </div>
              </div>
            </section>
          )}

          <div className="sr-only" aria-live="polite">
            {activity.title}. {activity.detail}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-[#102d24] px-5 py-12 text-white lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-[1.1fr_1fr] md:items-center">
          <div>
            <Badge className="bg-emerald-200/10 text-emerald-200">Why ChargeRoute</Badge>
            <h2 className="mt-4 max-w-xl text-3xl font-semibold tracking-[-0.04em]">
              A map for people. Structured actions for agents.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/65">
              Traditional route planners make agents click through brittle interfaces. ChargeRoute exposes the decisions that matter—range, chargers, route tradeoffs, and stops—as explicit WebMCP tools.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: Clock3, value: '3', label: 'route strategies' },
              { icon: Zap, value: '6', label: 'charger sites' },
              { icon: CircleDollarSign, value: '7', label: 'agent tools' },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                <item.icon className="size-4 text-emerald-200" />
                <p className="mt-4 text-2xl font-semibold">{item.value}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wider text-white/50">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
