import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { BatteryCharging, Bot, Download, Info, Route, Zap } from 'lucide-react';
import {
  AMENITIES,
  ASSUMPTIONS,
  CHARGERS,
  DEFAULT_STATE,
  LABELS,
  VEHICLES,
  compareRoutes,
  currentPlan,
  findChargers,
  replaceStop,
  validateState,
  type Style,
  type TripState,
} from './planner';
import { registerTools, toolsFor } from './webmcp';
import { restoreTrip, serializeTrip, STORAGE_KEY } from './storage';
const time = (n: number | null) =>
  n === null ? 'Unavailable' : `${Math.floor(n / 60)}h ${n % 60}m`;
const money = (n: number | null) =>
  n === null ? 'Unavailable' : `$${n.toFixed(2)}`;
function initialTrip() {
  try {
    return {
      state: restoreTrip(localStorage.getItem(STORAGE_KEY)),
      warning: '',
    };
  } catch {
    return {
      state: { ...DEFAULT_STATE },
      warning:
        'Saved settings could not be loaded. Defaults are shown; apply a plan to replace them.',
    };
  }
}
export default function App() {
  const [initial] = useState(initialTrip);
  const [state, setState] = useState(initial.state);
  const stateRef = useRef(state);
  const toDraft = (s: TripState) => ({
    ...s,
    startingChargePercent: String(s.startingChargePercent),
    minimumArrivalPercent: String(s.minimumArrivalPercent),
  });
  const [draft, setDraft] = useState(toDraft(state));
  const [message, setMessage] = useState(
    'Your sample trip is ready to explore.',
  );
  const [warning, setWarning] = useState(initial.warning);
  const [error, setError] = useState('');
  const [toolStatus, setToolStatus] = useState('Connecting agent tools…');
  const [view, setView] = useState<'plan' | 'stations' | 'methods'>('plan');
  const [agentOpen, setAgentOpen] = useState(false);
  const [stationIds, setStationIds] = useState(CHARGERS.map((s) => s.id));
  const [power, setPower] = useState('50');
  const [amenity, setAmenity] = useState('');
  const [stationFilter, setStationFilter] = useState('All six sample stations');
  const [selectedId, setSelectedId] = useState('kettleman-city');
  const comparison = useMemo(() => compareRoutes(state), [state]);
  const plan = useMemo(
    () =>
      state.customStopIds
        ? currentPlan(state)
        : comparison.find((p) => p.style === state.routeStyle)!,
    [state, comparison],
  );
  const vehicle = VEHICLES.find((v) => v.id === state.vehicleId)!;
  const selected = CHARGERS.find((s) => s.id === selectedId)!;
  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(state));
  function apply(next: TripState, text: string, preserveDraft = false) {
    stateRef.current = next;
    setState(next);
    setDraft((previous) =>
      preserveDraft
        ? {
            ...previous,
            routeStyle: next.routeStyle,
            customStopIds: next.customStopIds,
          }
        : toDraft(next),
    );
    setError('');
    setMessage(text);
    try {
      localStorage.setItem(STORAGE_KEY, serializeTrip(next));
      setWarning('');
    } catch {
      setWarning(
        'Browser storage is unavailable. Export this plan to keep a copy.',
      );
    }
  }
  const applyRef = useRef(apply);
  useEffect(() => {
    applyRef.current = apply;
  });
  useEffect(() => {
    const tools = toolsFor({
      get: () => stateRef.current,
      apply: (next, text) => {
        applyRef.current(next, text);
        setView('plan');
      },
      showChargers: (ids) => {
        setStationIds(ids);
        setStationFilter(
          'Agent filter results; submit the controls to start a new search',
        );
        setView('stations');
      },
      showComparison: () => {
        setView('plan');
        setMessage('Three route styles recalculated using the applied inputs.');
      },
    });
    let lifecycle: AbortController;
    const start = () => {
      lifecycle?.abort();
      const current = new AbortController();
      lifecycle = current;
      setToolStatus('Connecting agent tools…');
      void registerTools(document, tools, current.signal)
        .then((count) => {
          if (!current.signal.aborted)
            setToolStatus(
              count === 7
                ? '7 agent tools ready'
                : 'Manual mode · WebMCP unavailable',
            );
        })
        .catch(() => {
          if (!current.signal.aborted) {
            current.abort();
            setToolStatus('Agent tools unavailable · reload to retry');
          }
        });
    };
    const stop = () => lifecycle?.abort();
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) start();
    };
    start();
    window.addEventListener('pagehide', stop);
    window.addEventListener('pageshow', restore);
    return () => {
      stop();
      window.removeEventListener('pagehide', stop);
      window.removeEventListener('pageshow', restore);
    };
  }, []);
  function build(event: FormEvent) {
    event.preventDefault();
    try {
      const next = validateState({
        ...draft,
        startingChargePercent: Number(draft.startingChargePercent),
        minimumArrivalPercent: Number(draft.minimumArrivalPercent),
        routeStyle: state.routeStyle,
        customStopIds: null,
      });
      apply(next, 'Trip recalculated from your inputs.');
      setView('plan');
    } catch (reason) {
      setError((reason as Error).message);
    }
  }
  function selectRoute(style: Style) {
    apply(
      { ...stateRef.current, routeStyle: style, customStopIds: null },
      'Route style changed using your applied inputs.',
      true,
    );
  }
  function replace(index: number, id: string) {
    try {
      apply(
        replaceStop(stateRef.current, index, id),
        'Stop replaced. Energy, time, and cost recalculated.',
      );
    } catch (reason) {
      setError((reason as Error).message);
    }
  }
  function exportPlan() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ ...ASSUMPTIONS, state, plan }, null, 2)], {
        type: 'application/json',
      }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'volt-simulation.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('Simulation exported with its assumptions and limitations.');
  }
  return (
    <main>
      <header className="app-header">
        <a href="/" className="brand" aria-label="Volt home">
          <span className="brand-icon">
            <Route size={22} />
          </span>
          <span>
            <strong>Volt</strong>
            <small>EV trip simulator</small>
          </span>
        </a>
        <nav aria-label="Main navigation">
          {(['plan', 'stations', 'methods'] as const).map((tab) => (
            <button
              key={tab}
              aria-pressed={view === tab}
              onClick={() => setView(tab)}
            >
              {tab === 'plan'
                ? 'Trip plan'
                : tab === 'stations'
                  ? 'Stations'
                  : 'How it works'}
            </button>
          ))}
        </nav>
        <button
          className="action secondary"
          onClick={() => setAgentOpen(!agentOpen)}
          aria-expanded={agentOpen}
        >
          <Bot size={16} /> Agent guide
        </button>
      </header>
      <div className="sample-banner">
        <Info size={17} />
        <span>
          <strong>Simulation only.</strong> Fictional stations and assumed
          vehicle data on one sample corridor. No live availability or
          navigation.
        </span>
      </div>
      <output className="tool-status" data-testid="tool-status">
        {toolStatus}
      </output>
      {agentOpen && (
        <section className="agent-guide">
          <h2>Use Volt with your browser agent</h2>
          <p>
            Seven page-side WebMCP tools share the applied plan and
            calculations. Try: “Use the compact profile, start at 85%, keep a
            25% reserve, and compare route options.” A compatible host is
            required for tools; manual controls work without it.
          </p>
          <button
            className="action secondary"
            onClick={() => setAgentOpen(false)}
          >
            Close guide
          </button>
        </section>
      )}
      <div className="workspace">
        <aside className="planner-sidebar">
          <span className="eyebrow">Understand the tradeoffs</span>
          <h1>What does your next charge change?</h1>
          <p className="muted">
            Explore range, stop time, and cost with a transparent energy model.
          </p>
          <form onSubmit={(event) => build(event)}>
            <label>
              Starting point
              <input
                aria-label="Starting point"
                maxLength={120}
                value={draft.origin}
                onChange={(e) => setDraft({ ...draft, origin: e.target.value })}
              />
            </label>
            <label>
              Destination
              <input
                aria-label="Destination"
                maxLength={120}
                value={draft.destination}
                onChange={(e) =>
                  setDraft({ ...draft, destination: e.target.value })
                }
              />
            </label>
            <p className="hint">Supported: Los Angeles → San Francisco only.</p>
            <label>
              Vehicle profile
              <select
                aria-label="Vehicle profile"
                value={draft.vehicleId}
                onChange={(e) =>
                  setDraft({ ...draft, vehicleId: e.target.value })
                }
              >
                {VEHICLES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-grid">
              <label>
                Start charge (%)
                <input
                  aria-label="Starting battery percentage"
                  type="number"
                  min="10"
                  max="100"
                  step="0.1"
                  required
                  value={draft.startingChargePercent}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      startingChargePercent: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                Reserve (%)
                <input
                  aria-label="Minimum arrival battery percentage"
                  type="number"
                  min="5"
                  max="50"
                  step="0.1"
                  required
                  value={draft.minimumArrivalPercent}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      minimumArrivalPercent: e.target.value,
                    })
                  }
                />
              </label>
            </div>
            <label className="check-label">
              <input
                type="checkbox"
                checked={draft.preferAmenities}
                onChange={(e) =>
                  setDraft({ ...draft, preferAmenities: e.target.checked })
                }
              />{' '}
              Prefer coffee + restrooms
            </label>
            <p className="hint">
              Reserve applies at every stop and at arrival.
            </p>
            <button className="action primary" type="submit">
              <BatteryCharging size={18} /> Build my route
            </button>
          </form>
          {dirty && (
            <p className="notice">
              Inputs changed. Build the route to apply them; results show the
              applied inputs. Route styles use those applied inputs too.
            </p>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {warning && (
            <p role="alert" className="notice">
              {warning}
            </p>
          )}
          <p className="activity" aria-live="polite">
            {message}
          </p>
          <div className="sidebar-actions">
            <button className="action secondary" onClick={exportPlan}>
              <Download size={15} /> Export JSON
            </button>
            <button
              className="text-button"
              onClick={() =>
                apply({ ...DEFAULT_STATE }, 'Default sample settings restored.')
              }
            >
              Reset settings
            </button>
          </div>
          <p className="hint">
            Applied settings save in this browser. Export includes calculations
            and assumptions. Nothing is booked or sent to a charging provider.
          </p>
        </aside>
        <div className="main-panel">
          {view === 'plan' && (
            <>
              <div className="section-heading">
                <div>
                  <span className="eyebrow">
                    One corridor · three objectives
                  </span>
                  <h2>Choose your tradeoff</h2>
                </div>
                <span className="pill">
                  {vehicle.battery} kWh · {vehicle.range} mi assumed range
                </span>
              </div>
              <div className="route-options">
                {comparison.map((option) => (
                  <button
                    key={option.style}
                    data-testid={`route-${option.style}`}
                    aria-pressed={
                      state.routeStyle === option.style && !state.customStopIds
                    }
                    onClick={() => selectRoute(option.style)}
                    className={
                      state.routeStyle === option.style && !state.customStopIds
                        ? 'selected'
                        : ''
                    }
                  >
                    <strong>{LABELS[option.style]}</strong>
                    <span>
                      {option.feasible
                        ? `${time(option.totalMinutes)} · ${money(option.cost)}`
                        : 'Not feasible'}
                    </span>
                    <small>
                      {option.style === 'fastest'
                        ? 'Lowest modeled time'
                        : option.style === 'balanced'
                          ? 'Time + charging cost'
                          : 'Extra charge + shorter legs'}
                    </small>
                  </button>
                ))}
              </div>
              <p className="hint">
                Amenity preference affects every objective. Styles may choose
                the same stations.
              </p>
              {!plan.feasible ? (
                <section
                  className="infeasible"
                  role="alert"
                  data-testid="infeasible"
                >
                  <h2>No feasible plan for these inputs</h2>
                  <p>{plan.reason}</p>
                  <p>
                    This stop sequence needs at least{' '}
                    {plan.requiredStartPercent}% starting charge. No ETA,
                    charging cost, or arrival charge is claimed.
                  </p>
                </section>
              ) : (
                <>
                  <section
                    className="route-map"
                    aria-label="Schematic sample corridor"
                  >
                    <div className="map-caption">
                      SCHEMATIC · NOT A NAVIGATION MAP
                    </div>
                    <svg viewBox="0 0 680 360" aria-hidden="true">
                      <path
                        d="M50 305 L630 65"
                        stroke="#b5cdbc"
                        strokeWidth="34"
                        fill="none"
                      />
                      <path
                        d="M50 305 L630 65"
                        stroke="#236347"
                        strokeWidth="5"
                        strokeDasharray="9 6"
                        fill="none"
                      />
                      <text x="30" y="340">
                        Los Angeles
                      </text>
                      <text x="510" y="38">
                        San Francisco
                      </text>
                    </svg>
                    {CHARGERS.map((s) => {
                      const index = plan.stops.findIndex(
                        (stop) => stop.charger.id === s.id,
                      );
                      return (
                        <button
                          key={s.id}
                          className={`map-station ${index >= 0 ? 'active' : ''} ${selectedId === s.id ? 'focused' : ''}`}
                          style={{
                            left: `${((50 + (s.mile / 387) * 580) / 680) * 100}%`,
                            top: `${((305 - (s.mile / 387) * 240) / 360) * 100}%`,
                          }}
                          aria-label={`Inspect ${s.city} sample station`}
                          onClick={() => setSelectedId(s.id)}
                        >
                          {index >= 0 ? index + 1 : <Zap size={13} />}
                        </button>
                      );
                    })}
                    <div className="map-key">
                      Filled markers: selected stops · outlined: other samples
                    </div>
                  </section>
                  <section className="plan-summary" data-testid="plan-summary">
                    <div>
                      <span className="eyebrow">
                        {plan.custom ? 'Custom stops' : LABELS[plan.style]} ·
                        calculated simulation
                      </span>
                      <h2>
                        {plan.stops.length} charging stop
                        {plan.stops.length === 1 ? '' : 's'}
                      </h2>
                    </div>
                    <dl>
                      <div>
                        <dt>Total time</dt>
                        <dd>{time(plan.totalMinutes)}</dd>
                      </div>
                      <div>
                        <dt>Distance</dt>
                        <dd>{plan.distance} mi</dd>
                      </div>
                      <div>
                        <dt>Stop electricity</dt>
                        <dd>{money(plan.cost)}</dd>
                      </div>
                      <div>
                        <dt>Arrival charge</dt>
                        <dd>{plan.arrivalPercent}%</dd>
                      </div>
                    </dl>
                  </section>
                  <section className="selected-station">
                    <h3>
                      {selected.city} · {selected.site}
                    </h3>
                    <p>
                      {selected.powerKw} kW rated · ${selected.price.toFixed(2)}
                      /kWh sample price · mile {selected.mile}
                    </p>
                    <p className="hint">
                      {selected.amenities.join(' · ')}. Availability and
                      connector compatibility are not verified.
                    </p>
                  </section>
                  <div className="section-heading">
                    <h2>Your charging itinerary</h2>
                    <span className="muted">Arrival → departure</span>
                  </div>
                  <div className="itinerary">
                    {plan.stops.map((stop, index) => (
                      <article
                        className="stop-card"
                        data-testid="stop-card"
                        key={stop.charger.id}
                      >
                        <div className="stop-title">
                          <span className="stop-number">{index + 1}</span>
                          <div>
                            <h3>{stop.charger.city}</h3>
                            <p className="hint">
                              {stop.legMiles} mi from previous point · sample
                              station
                            </p>
                          </div>
                          <strong>
                            {stop.arrivalPercent}% → {stop.departurePercent}%
                          </strong>
                        </div>
                        <div className="stop-metrics">
                          <span>
                            {stop.chargingMinutes} min charging + 5 min overhead
                          </span>
                          <span>{stop.purchasedKwh} kWh purchased</span>
                          <span>{money(stop.cost)}</span>
                        </div>
                        <label>
                          Replace stop {index + 1}
                          <select
                            aria-label={`Replace stop ${index + 1}`}
                            value={stop.charger.id}
                            onChange={(e) => replace(index, e.target.value)}
                          >
                            {CHARGERS.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.city} · {s.powerKw} kW
                              </option>
                            ))}
                          </select>
                        </label>
                      </article>
                    ))}
                  </div>
                  <p className="arrival-line">
                    Final leg: {plan.finalLegMiles} mi. Modeled arrival{' '}
                    {plan.arrivalPercent}% against a{' '}
                    {state.minimumArrivalPercent}% reserve.
                  </p>
                </>
              )}
            </>
          )}
          {view === 'stations' && (
            <section>
              <span className="eyebrow">Fictional infrastructure</span>
              <h2>Explore sample stations</h2>
              <p className="muted">
                Six examples on the fixed corridor, not verified charging
                locations.
              </p>
              <form
                className="station-filters"
                onSubmit={(event) => {
                  event.preventDefault();
                  try {
                    const found = findChargers({
                      minimumPowerKw: Number(power),
                      ...(amenity ? { amenity } : {}),
                    });
                    setStationIds(found.map((s) => s.id));
                    setStationFilter(
                      `${power}+ kW${amenity ? ` · ${amenity}` : ''}`,
                    );
                    setError('');
                  } catch (reason) {
                    setError((reason as Error).message);
                  }
                }}
              >
                <label>
                  Minimum power (kW)
                  <input
                    type="number"
                    min="50"
                    max="400"
                    required
                    value={power}
                    onChange={(e) => setPower(e.target.value)}
                  />
                </label>
                <label>
                  Amenity
                  <select
                    aria-label="Amenity"
                    value={amenity}
                    onChange={(e) => setAmenity(e.target.value)}
                  >
                    <option value="">Any amenity</option>
                    {AMENITIES.map((name) => (
                      <option key={name}>{name}</option>
                    ))}
                  </select>
                </label>
                <button className="action primary">Filter stations</button>
              </form>
              <p data-testid="station-result-count">
                {stationIds.length} stations · {stationFilter}
              </p>
              <div className="station-grid">
                {CHARGERS.filter((s) => stationIds.includes(s.id)).map((s) => (
                  <article
                    className="stop-card"
                    data-testid="station-card"
                    key={s.id}
                  >
                    <h3>{s.city}</h3>
                    <p>
                      {s.powerKw} kW · ${s.price.toFixed(2)}/kWh
                    </p>
                    <p className="hint">
                      Mile {s.mile} · {s.amenities.join(', ')}
                    </p>
                  </article>
                ))}
              </div>
              {!stationIds.length && (
                <p className="notice">
                  No sample stations match these filters.
                </p>
              )}
            </section>
          )}
          {view === 'methods' && (
            <section className="methods">
              <span className="eyebrow">Model version: volt-energy-v1</span>
              <h2>Every result has an assumption behind it.</h2>
              <p>
                A what-if model for a 387-mile corridor, with generic vehicle
                profiles and fictional stations. No directions, real-time
                availability, connector verification, traffic, elevation,
                weather, degradation, or reliable driving ETA.
              </p>
              <h3>Energy and time</h3>
              <ul>
                <li>
                  Energy used = miles ÷ full-charge range × battery capacity.
                </li>
                <li>
                  Every leg must arrive at or above the reserve. Impossible legs
                  make the plan infeasible.
                </li>
                <li>
                  Departure covers the next leg and reserve, plus 0 percentage
                  points for Fastest, 3 for Balanced, or 10 for Comfort, capped
                  at 100%.
                </li>
                <li>
                  Purchased energy = battery energy added ÷ 90% efficiency.
                </li>
                <li>
                  Average charging power = 60% of the lower vehicle/station peak
                  power. Charging time rounds up to whole minutes.
                </li>
                <li>
                  Total time = driving at 60 mph + charging + five minutes per
                  stop.
                </li>
                <li>
                  Cost = purchased energy × sample price, rounded to cents per
                  stop. Initial battery energy, taxes, parking, and other fees
                  are excluded.
                </li>
              </ul>
              <h3>Choosing stops</h3>
              <p>
                All 64 forward-order subsets of six stations are evaluated.
                Fastest minimizes modeled minutes. Balanced adds 1.5 minutes of
                objective weight per dollar. Comfort adds 0.5 per dollar and 0.3
                per mile of the longest leg. Amenity preference adds 12 scoring
                minutes for each stop missing coffee or restrooms; this penalty
                is not travel time. Custom replacements reject backward,
                duplicate, unnecessary, or unreachable stops.
              </p>
              <h3>Storage and privacy</h3>
              <p>
                Applied settings save in this browser. Reset restores defaults.
                JSON export includes inputs, results, and limitations; import is
                not implemented. Other tabs are not synchronized. No accounts,
                provider credentials, tracking scripts, bookings, or payments
                are part of Volt.
              </p>
              <h3>WebMCP</h3>
              <p>
                Four tools inspect or compare; three update locally saved
                settings and the visible plan. Invalid requests leave state
                unchanged. A compatible host must support document.modelContext.
                This is a page-side integration, not a remote MCP server.
              </p>
            </section>
          )}
        </div>
      </div>
      <footer>
        <span>Volt · EV energy and charging simulator</span>
        <a href="https://github.com/agammann/volt-webmcp">
          Source & usage guide
        </a>
        <span>No live provider connection · Not for navigation</span>
      </footer>
    </main>
  );
}
