import type Phaser from 'phaser';
import { gameRectToScreen } from './gameScreenCoords';

/**
 * Real HTML <a> overlaid on the canvas for the "Privacy Policy" link in the
 * waitlist panel. A Phaser pointerdown handler calling window.open() is
 * unreliable — Phaser dispatches input on its own update tick rather than
 * synchronously inside the native click event, so browsers (especially
 * mobile Safari) can treat the resulting window.open() as an untrusted
 * popup and block it. A genuine <a target="_blank"> avoids that entirely.
 */

let sharedLink: HTMLAnchorElement | null = null;

function getOrCreateLink(): HTMLAnchorElement {
  if (sharedLink) return sharedLink;

  const a = document.createElement('a');
  a.href = '/privacy.html';
  a.target = '_blank';
  a.rel = 'noopener';
  a.textContent = 'Privacy Policy';
  a.className = 'sd-privacy-link';

  document.body.appendChild(a);
  sharedLink = a;
  return a;
}

export function showPrivacyLinkOverlay(
  game: Phaser.Game,
  gx: number,
  gy: number,
  gw: number,
  gh: number,
): void {
  const a = getOrCreateLink();
  const rect = gameRectToScreen(game, gx, gy, gw, gh);
  a.style.display = 'flex';
  a.style.left = `${rect.left}px`;
  a.style.top = `${rect.top}px`;
  a.style.width = `${rect.width}px`;
  a.style.height = `${rect.height}px`;
}

export function hidePrivacyLinkOverlay(): void {
  if (sharedLink) sharedLink.style.display = 'none';
}

export function removePrivacyLinkOverlay(): void {
  hidePrivacyLinkOverlay();
  sharedLink?.remove();
  sharedLink = null;
}
