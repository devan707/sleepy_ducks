import type Phaser from 'phaser';
import { gameRectToScreen } from './gameScreenCoords';

/**
 * Real HTML <input> overlaid on the canvas for the waitlist email field —
 * same technique as playerNameOverlay.ts. A native input gives correct
 * mobile keyboards, autofill, and accessibility without simulating text
 * entry on canvas. A second, permanently off-screen input acts as a
 * honeypot: real players never see or fill it, simple bots that fill every
 * field on a form will.
 */

let sharedEmailInput: HTMLInputElement | null = null;
let sharedHoneypotInput: HTMLInputElement | null = null;

function getOrCreateEmailInput(): HTMLInputElement {
  if (sharedEmailInput) return sharedEmailInput;

  const input = document.createElement('input');
  input.type = 'email';
  input.inputMode = 'email';
  input.autocomplete = 'email';
  input.autocapitalize = 'off';
  input.spellcheck = false;
  input.placeholder = 'Email address';
  input.maxLength = 254;
  input.className = 'sd-waitlist-email-input';
  input.addEventListener('keydown', (e) => e.stopPropagation());

  document.body.appendChild(input);
  sharedEmailInput = input;
  return input;
}

function getOrCreateHoneypotInput(): HTMLInputElement {
  if (sharedHoneypotInput) return sharedHoneypotInput;

  const input = document.createElement('input');
  input.type = 'text';
  input.name = 'company_website';
  input.autocomplete = 'off';
  input.tabIndex = -1;
  input.setAttribute('aria-hidden', 'true');
  input.className = 'sd-waitlist-honeypot';

  document.body.appendChild(input);
  sharedHoneypotInput = input;
  return input;
}

export function showWaitlistEmailOverlay(
  game: Phaser.Game,
  gx: number,
  gy: number,
  gw: number,
  gh: number,
): void {
  const input = getOrCreateEmailInput();
  getOrCreateHoneypotInput();

  const rect = gameRectToScreen(game, gx, gy, gw, gh);
  input.style.display = 'block';
  input.style.left = `${rect.left}px`;
  input.style.top = `${rect.top}px`;
  input.style.width = `${rect.width}px`;
  input.style.height = `${rect.height}px`;
}

export function hideWaitlistEmailOverlay(): void {
  if (!sharedEmailInput) return;
  sharedEmailInput.blur();
  sharedEmailInput.style.display = 'none';
}

export function focusWaitlistEmailOverlay(): void {
  sharedEmailInput?.focus({ preventScroll: true });
}

export function getWaitlistEmailValue(): string {
  return sharedEmailInput?.value ?? '';
}

export function setWaitlistEmailValue(value: string): void {
  if (sharedEmailInput) sharedEmailInput.value = value;
}

export function setWaitlistEmailDisabled(disabled: boolean): void {
  if (sharedEmailInput) sharedEmailInput.disabled = disabled;
}

/** Non-empty only when a bot filled the hidden field. */
export function getWaitlistHoneypotValue(): string {
  return sharedHoneypotInput?.value ?? '';
}

export function removeWaitlistEmailOverlay(): void {
  hideWaitlistEmailOverlay();
  sharedEmailInput?.remove();
  sharedEmailInput = null;
  sharedHoneypotInput?.remove();
  sharedHoneypotInput = null;
}
