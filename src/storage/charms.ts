import { CHARM_SLOT_COUNT, CHARMS, type CharmId } from '../config/charmConfig';

const CHARMS_KEY = 'sleeping-ducks-charms';

/** Legacy shape (single collect per charm). */
interface LegacyCharmsState {
  collected?: CharmId[];
  slots?: (CharmId | null)[];
}

export interface CharmsState {
  /** Total times each charm was collected across all runs. */
  counts: Record<CharmId, number>;
  slots: (CharmId | null)[];
}

export function createEmptyCharmsState(): CharmsState {
  return {
    counts: { moonflower: 0, dreamweed: 0 },
    slots: Array.from({ length: CHARM_SLOT_COUNT }, () => null),
  };
}

function isValidCharmId(value: unknown): value is CharmId {
  return value === 'moonflower' || value === 'dreamweed';
}

function migrateLegacy(raw: LegacyCharmsState): CharmsState {
  const state = createEmptyCharmsState();
  if (Array.isArray(raw.collected)) {
    for (const id of raw.collected) {
      if (isValidCharmId(id)) {
        state.counts[id] = Math.max(state.counts[id], 1);
        state.slots[CHARMS[id].slotIndex] = id;
      }
    }
  }
  if (Array.isArray(raw.slots) && raw.slots.length === CHARM_SLOT_COUNT) {
    state.slots = raw.slots.map((s) => (isValidCharmId(s) ? s : null));
    for (const id of state.slots) {
      if (id && state.counts[id] === 0) {
        state.counts[id] = 1;
      }
    }
  } else {
    if (state.counts.moonflower > 0) {
      state.slots[CHARMS.moonflower.slotIndex] = 'moonflower';
    }
  }
  return state;
}

function isValidState(raw: unknown): raw is CharmsState {
  if (!raw || typeof raw !== 'object') return false;
  const o = raw as CharmsState;
  if (!o.counts || typeof o.counts !== 'object') return false;
  if (!Array.isArray(o.slots) || o.slots.length !== CHARM_SLOT_COUNT) return false;
  for (const id of Object.keys(CHARMS) as CharmId[]) {
    const count = o.counts[id];
    if (count !== undefined && (typeof count !== 'number' || count < 0)) return false;
  }
  if (!o.slots.every((s) => s === null || isValidCharmId(s))) return false;
  return true;
}

function normalizeState(parsed: CharmsState): CharmsState {
  return {
    counts: {
      moonflower: parsed.counts.moonflower ?? 0,
      dreamweed: parsed.counts.dreamweed ?? 0,
    },
    slots: [...parsed.slots],
  };
}

export function loadCharms(): CharmsState {
  if (typeof localStorage === 'undefined') return createEmptyCharmsState();
  try {
    const raw = localStorage.getItem(CHARMS_KEY);
    if (!raw) return createEmptyCharmsState();
    const parsed = JSON.parse(raw) as unknown;
    if (isValidState(parsed)) {
      return normalizeState(parsed);
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
  const state = loadCharms();
  return Object.values(state.counts).reduce((sum, n) => sum + (n > 0 ? 1 : 0), 0);
}

/** Add one collection for a charm keepsake. */
export function recordCharmCollect(id: CharmId, slotIndex = CHARMS[id].slotIndex): CharmsState {
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
