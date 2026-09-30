import { DEFAULT_STATE, validateState, type TripState } from './planner';
export const STORAGE_KEY = 'volt-trip-v1';
export function restoreTrip(value: string | null): TripState {
  if (!value) return { ...DEFAULT_STATE };
  if (value.length > 10000) throw new Error('Saved trip is too large.');
  const saved = JSON.parse(value);
  if (saved.version !== 1) throw new Error('Unsupported saved trip version.');
  return validateState(saved.state);
}
export function serializeTrip(state: TripState) {
  return JSON.stringify({ version: 1, state: validateState(state) });
}
