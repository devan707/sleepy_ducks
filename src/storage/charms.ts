import { CHARM_SLOT_COUNT, type CharmId } from '../config/charmConfig';

const CHARMS_KEY = 'sleeping-ducks-charms';

export interface CharmsState {
  collected: CharmId[];
  slots: (CharmId | null)[];
}

export function createEmptyCharmsState(): CharmsState {
  return {
    collected: [],
    slots: Array.from({ length: CHARM_SLOT_COUNT }, () => null),
  };
}

function isValidCharmId(value: unknown): value is CharmId {
  return value === 'moonflower';
}

function isValidState(raw: unknown): raw is CharmsState {
  if (!raw || typeof raw !== 'object') return false;
  const o = raw as CharmsState;
  if (!Array.isArray(o.collected) || !Array.isArray(o.slots)) return false;
  if (o.slots.length !== CHARM_SLOT_COUNT) return false;
  if (!o.collected.every(isValidCharmId)) return false;
  if (!o.slots.every((s) => s === null || isValidCharmId(s))) return false;
  return true;
}

export function loadCharms(): CharmsState {
  if (typeof localStorage === 'undefined') return createEmptyCharmsState();
  try {
    const raw = localStorage.getItem(CHARMS_KEY);
    if (!raw) return createEmptyCharmsState();
    const parsed = JSON.parse(raw) as unknown;
    if (!isValidState(parsed)) return createEmptyCharmsState();
    return parsed;
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

export function isCharmCollected(id: CharmId): boolean {
  return loadCharms().collected.includes(id);
}

export function getCollectedCharmCount(): number {
  return loadCharms().collected.length;
}

export function collectCharm(id: CharmId, slotIndex: number): CharmsState {
  const state = loadCharms();
  if (!state.collected.includes(id)) {
    state.collected.push(id);
  }
  if (slotIndex >= 0 && slotIndex < CHARM_SLOT_COUNT) {
    state.slots[slotIndex] = id;
  }
  saveCharms(state);
  return state;
}
