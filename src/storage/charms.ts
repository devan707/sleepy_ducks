import { CHARM_SLOT_COUNT, type CharmId } from '../config/charmConfig';

const CHARMS_KEY = 'sleeping-ducks-charms';

/** Legacy shape (single collect per charm). */
interface LegacyCharmsState {
  collected?: CharmId[];
  slots?: (CharmId | null)[];
}

export interface CharmsState {
  /** Total times each charm was collected across all runs. */
  counts: Record<CharmId, number>;
  /** First slot shows moonflower when count > 0. */
  slots: (CharmId | null)[];
}

export function createEmptyCharmsState(): CharmsState {
  return {
    counts: { moonflower: 0 },
    slots: Array.from({ length: CHARM_SLOT_COUNT }, () => null),
  };
}

function isValidCharmId(value: unknown): value is CharmId {
  return value === 'moonflower';
}

function migrateLegacy(raw: LegacyCharmsState): CharmsState {
  const state = createEmptyCharmsState();
  if (Array.isArray(raw.collected) && raw.collected.includes('moonflower')) {
    state.counts.moonflower = 1;
  }
  if (Array.isArray(raw.slots) && raw.slots.length === CHARM_SLOT_COUNT) {
    state.slots = raw.slots.map((s) => (s === 'moonflower' ? 'moonflower' : null));
  } else if (state.counts.moonflower > 0) {
    state.slots[0] = 'moonflower';
  }
  return state;
}

function isValidState(raw: unknown): raw is CharmsState {
  if (!raw || typeof raw !== 'object') return false;
  const o = raw as CharmsState;
  if (!o.counts || typeof o.counts !== 'object') return false;
  if (!Array.isArray(o.slots) || o.slots.length !== CHARM_SLOT_COUNT) return false;
  const count = o.counts.moonflower;
  if (count !== undefined && (typeof count !== 'number' || count < 0)) return false;
  if (!o.slots.every((s) => s === null || isValidCharmId(s))) return false;
  return true;
}

export function loadCharms(): CharmsState {
  if (typeof localStorage === 'undefined') return createEmptyCharmsState();
  try {
    const raw = localStorage.getItem(CHARMS_KEY);
    if (!raw) return createEmptyCharmsState();
    const parsed = JSON.parse(raw) as unknown;
    if (isValidState(parsed)) {
      return {
        counts: { moonflower: parsed.counts.moonflower ?? 0 },
        slots: [...parsed.slots],
      };
    }
    if (parsed && typeof parsed === 'object' && 'collected' in (parsed as object)) {
      return migrateLegacy(parsed as LegacyCharmsState);
    }
    return createEmptyCharmsState();
  } catch {
    return createEmptyCharmsState();
  }
}

export function saveCharms(state: CharmsState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CHARMS_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota */
  }
}

export function getCharmCount(id: CharmId): number {
  return loadCharms().counts[id] ?? 0;
}

/** @deprecated Use getCharmCount(id) > 0 */
export function isCharmCollected(id: CharmId): boolean {
  return getCharmCount(id) > 0;
}

export function getCollectedCharmCount(): number {
  return getCharmCount('moonflower');
}

/** Add one collection (one per run when the player taps the night flower). */
export function recordCharmCollect(id: CharmId, slotIndex = 0): CharmsState {
  const state = loadCharms();
  state.counts[id] = (state.counts[id] ?? 0) + 1;
  if (slotIndex >= 0 && slotIndex < CHARM_SLOT_COUNT && state.counts[id] > 0) {
    state.slots[slotIndex] = id;
  }
  saveCharms(state);
  return state;
}

/** @deprecated Use recordCharmCollect */
export function collectCharm(id: CharmId, slotIndex: number): CharmsState {
  return recordCharmCollect(id, slotIndex);
}
