import type Phaser from 'phaser';
import { gameRectToScreen } from './gameScreenCoords';
import { getPlayerName, setPlayerName } from '../storage/playerName';

/** Matches the name bubble in SettingsDrawer (game-space, relative to panel X). */
export const PLAYER_NAME_FIELD = {
  x: 32,
  y: 100,
  width: 254,
  height: 30,
} as const;

let sharedInput: HTMLInputElement | null = null;

function getOrCreateInput(): HTMLInputElement {
  if (sharedInput) return sharedInput;

  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 18;
  input.placeholder = 'Enter your name';
  input.autocomplete = 'name';
  input.inputMode = 'text';
  input.className = 'sd-player-name-input';

  const save = () => setPlayerName(input.value);
  input.addEventListener('input', save);
  input.addEventListener('change', save);
  input.addEventListener('blur', save);
  input.addEventListener('keydown', (e) => e.stopPropagation());

  document.body.appendChild(input);
  sharedInput = input;
  return input;
}

export function syncPlayerNameOverlayValue(): void {
  const input = sharedInput;
  if (input) input.value = getPlayerName();
}

export function showPlayerNameOverlay(
  game: Phaser.Game,
  panelX: number,
  panelY = 0,
  panelScale = 1,
): void {
  const input = getOrCreateInput();
  syncPlayerNameOverlayValue();

  const { x, y, width, height } = PLAYER_NAME_FIELD;
  const rect = gameRectToScreen(
    game,
    panelX + x * panelScale,
    panelY + y * panelScale,
    width * panelScale,
    height * panelScale,
  );

  input.style.display = 'block';
  input.style.position = 'fixed';
  input.style.left = `${rect.left}px`;
  input.style.top = `${rect.top}px`;
  input.style.width = `${rect.width}px`;
  input.style.height = `${rect.height}px`;
  input.style.zIndex = '10000';
  input.style.pointerEvents = 'auto';
}

export function hidePlayerNameOverlay(): void {
  const input = sharedInput;
  if (!input) return;
  setPlayerName(input.value);
  input.blur();
  input.style.display = 'none';
  input.style.pointerEvents = 'none';
}

export function focusPlayerNameOverlay(): void {
  sharedInput?.focus({ preventScroll: true });
}

export function removePlayerNameOverlay(): void {
  hidePlayerNameOverlay();
  sharedInput?.remove();
  sharedInput = null;
}
