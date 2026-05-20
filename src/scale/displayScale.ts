import type Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig';

const DRAWER_REFERENCE_W = 318;

/** Compact settings panel height (matches SettingsDrawer content layout). */
export const DRAWER_PANEL_H = 680;

export type DrawerLayout = {
  panelWidth: number;
  panelHeight: number;
  panelY: number;
  panelXOpen: number;
  panelXClosed: number;
  panelScale: number;
  safeRect: null;
};

/** Settings drawer placement — full game frame is always visible (FIT letterboxing). */
export function getDrawerLayout(_game: Phaser.Game): DrawerLayout {
  return {
    panelWidth: DRAWER_REFERENCE_W,
    panelHeight: DRAWER_PANEL_H,
    panelY: (GAME_HEIGHT - DRAWER_PANEL_H) / 2,
    panelXOpen: GAME_WIDTH - DRAWER_REFERENCE_W,
    panelXClosed: GAME_WIDTH + 4,
    panelScale: 1,
    safeRect: null,
  };
}
