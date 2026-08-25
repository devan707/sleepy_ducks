import type Phaser from 'phaser';
import { gameRectToScreen } from './gameScreenCoords';

/** Panel-local hit area — sits just under Settings "How to Play". */
export const LEGAL_LINKS_FIELD = {
  x: 24,
  y: 624,
  width: 270,
  height: 16,
} as const;

let root: HTMLDivElement | null = null;

function legalHref(file: string): string {
  try {
    return new URL(file, document.baseURI).href;
  } catch {
    return file;
  }
}

function getOrCreateRoot(): HTMLDivElement {
  if (root) return root;

  const wrap = document.createElement('div');
  wrap.className = 'sd-legal-links';

  const privacy = document.createElement('a');
  privacy.href = legalHref('privacy.html');
  privacy.target = '_blank';
  privacy.rel = 'noopener';
  privacy.textContent = 'Privacy';

  const sep = document.createElement('span');
  sep.textContent = '·';
  sep.setAttribute('aria-hidden', 'true');

  const terms = document.createElement('a');
  terms.href = legalHref('terms.html');
  terms.target = '_blank';
  terms.rel = 'noopener';
  terms.textContent = 'Terms';

  wrap.append(privacy, sep, terms);
  document.body.appendChild(wrap);
  root = wrap;
  return wrap;
}

export function showLegalLinksOverlay(
  game: Phaser.Game,
  panelX: number,
  panelY: number,
  panelScale: number,
): void {
  const el = getOrCreateRoot();
  const { x, y, width, height } = LEGAL_LINKS_FIELD;
  const rect = gameRectToScreen(
    game,
    panelX + x * panelScale,
    panelY + y * panelScale,
    width * panelScale,
    height * panelScale,
  );
  el.style.display = 'flex';
  el.style.left = `${rect.left}px`;
  el.style.top = `${rect.top}px`;
  el.style.width = `${rect.width}px`;
  el.style.height = `${rect.height}px`;
}

export function hideLegalLinksOverlay(): void {
  if (!root) return;
  root.style.display = 'none';
}

export function removeLegalLinksOverlay(): void {
  hideLegalLinksOverlay();
  root?.remove();
  root = null;
}
