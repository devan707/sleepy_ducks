import { MOONFLOWER_ATLAS_KEYS } from './moonflowerAssets';

export const CHARM_SLOT_COUNT = 6;

export type CharmId = 'moonflower';

export interface CharmDefinition {
  id: CharmId;
  name: string;
  slotIndex: number;
  iconAtlasKey: string;
  iconFrame: string;
}

export const CHARMS: Record<CharmId, CharmDefinition> = {
  moonflower: {
    id: 'moonflower',
    name: 'Moonflower',
    slotIndex: 0,
    iconAtlasKey: MOONFLOWER_ATLAS_KEYS.sway,
    iconFrame: 'frame_000',
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

/** Centered row when no chest art is shown. */
export const CHARMS_BARE_ROW_LAYOUT = {
  boxWidth: 300,
  boxHeight: 0,
  slots: [
    { x: 0.08, y: 0.5 },
    { x: 0.26, y: 0.5 },
    { x: 0.44, y: 0.5 },
    { x: 0.62, y: 0.5 },
    { x: 0.8, y: 0.5 },
    { x: 0.98, y: 0.5 },
  ],
} as const;

export function getCharmDefinition(id: CharmId): CharmDefinition {
  return CHARMS[id];
}
