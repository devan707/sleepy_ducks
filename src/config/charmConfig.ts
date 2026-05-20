import { DREAMWEED_STATIC_KEY } from './dreamweedAssets';
import { MOONFLOWER_ATLAS_KEYS } from './moonflowerAssets';

export const CHARM_SLOT_COUNT = 6;

export type CharmId = 'moonflower' | 'dreamweed';

export interface CharmDefinition {
  id: CharmId;
  name: string;
  slotIndex: number;
  iconKey: string;
  iconFrame?: string;
}

export const CHARMS: Record<CharmId, CharmDefinition> = {
  moonflower: {
    id: 'moonflower',
    name: 'Moonflower',
    slotIndex: 0,
    iconKey: MOONFLOWER_ATLAS_KEYS.sway,
    iconFrame: 'frame_000',
  },
  dreamweed: {
    id: 'dreamweed',
    name: 'Dreamweed',
    slotIndex: 1,
    iconKey: DREAMWEED_STATIC_KEY,
  },
};

/** Slot centers as fractions of charm_box.png (tweak when art lands). */
export const CHARM_BOX_SLOT_LAYOUT = {
  boxWidth: 340,
  boxHeight: 88,
  slots: [
    { x: 0.1, y: 0.5 },
    { x: 0.26, y: 0.5 },
    { x: 0.42, y: 0.5 },
    { x: 0.58, y: 0.5 },
    { x: 0.74, y: 0.5 },
    { x: 0.9, y: 0.5 },
  ],
} as const;

/** Centered row in settings drawer — 5 slots, 15px margin to panel edge (318px panel, r=22). */
export const CHARMS_BARE_ROW_LAYOUT = {
  boxWidth: 244,
  boxHeight: 0,
  slots: [
    { x: 0, y: 0.5 },
    { x: 0.25, y: 0.5 },
    { x: 0.5, y: 0.5 },
    { x: 0.75, y: 0.5 },
    { x: 1, y: 0.5 },
  ],
} as const;

export function getCharmDefinition(id: CharmId): CharmDefinition {
  return CHARMS[id];
}

export function getCharmAtSlot(slotIndex: number): CharmDefinition | null {
  for (const def of Object.values(CHARMS)) {
    if (def.slotIndex === slotIndex) return def;
  }
  return null;
}

/** @deprecated Use iconKey */
export function getCharmIconAtlasKey(id: CharmId): string {
  return CHARMS[id].iconKey;
}
