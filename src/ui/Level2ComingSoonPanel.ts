import Phaser from 'phaser';
import { ASSET_KEYS } from '../config/assets';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig';
import { trackEvent } from '../analytics/analytics';
import { submitWaitlistSignup } from '../net/waitlistClient';
import { FloatingAnimButton } from './FloatingAnimButton';
import { createTextLink, ensureLilitaFont, lilitaDisplayStyle, outlinedTextStyle, UI_CHROME } from './uiChrome';
import {
  getWaitlistEmailValue,
  getWaitlistHoneypotValue,
  hideWaitlistEmailOverlay,
  removeWaitlistEmailOverlay,
  setWaitlistEmailDisabled,
  setWaitlistEmailValue,
  showWaitlistEmailOverlay,
} from './waitlistEmailOverlay';
import {
  hidePrivacyLinkOverlay,
  removePrivacyLinkOverlay,
  showPrivacyLinkOverlay,
} from './privacyLinkOverlay';

const SOURCE = 'level_2_coming_soon';
const CONSENT_VERSION = 'v1';

const PANEL_WIDTH = 326;
// Tall enough to clear the retry button's tap target below it — see the
// comment above the button in renderForm() for why that needs this much room.
const FORM_PANEL_HEIGHT = 540;
const SUCCESS_PANEL_HEIGHT = 236;
const EMAIL_FIELD = { width: 254, height: 44 };
const PRIVACY_LINK_FIELD = { width: 140, height: 22 };

export type Level2ComingSoonPanelOptions = {
  depth: number;
  runId: string;
  onReplay: () => void;
  onClose?: () => void;
};

type PanelState = 'idle' | 'submitting' | 'success' | 'error';

function normalizeEmail(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.length < 5 || trimmed.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}

function errorMessageFor(reason: string): string {
  switch (reason) {
    case 'invalid_email':
      return 'Please enter a valid email address.';
    case 'network_error':
      return "Couldn't reach the server — check your connection and try again.";
    case 'rate_limited':
      return 'Too many attempts. Please try again in a bit.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

/**
 * Polished "Level 2 coming soon" modal shown after Next Level is tapped.
 * Owns the optional email waitlist signup: idle -> submitting -> success|error.
 * Built from Phaser graphics/text to match the game's existing look, with a
 * real HTML <input> overlaid for the email field (see waitlistEmailOverlay).
 */
export class Level2ComingSoonPanel {
  private readonly scene: Phaser.Scene;
  private readonly opts: Level2ComingSoonPanelOptions;
  private root: Phaser.GameObjects.Container | null = null;
  private contentNodes: Phaser.GameObjects.GameObject[] = [];
  private replayButton: FloatingAnimButton | null = null;
  private state: PanelState = 'idle';
  private errorMessage = '';
  private openFlag = false;
  private submitToken = 0;
  private emailFieldRect: { x: number; y: number; w: number; h: number } | null = null;
  private privacyLinkRect: { x: number; y: number; w: number; h: number } | null = null;
  private resizeHandler: (() => void) | null = null;

  constructor(scene: Phaser.Scene, opts: Level2ComingSoonPanelOptions) {
    this.scene = scene;
    this.opts = opts;
  }

  isOpen(): boolean {
    return this.openFlag;
  }

  open(): void {
    if (this.openFlag) return;
    this.openFlag = true;
    this.state = 'idle';
    this.errorMessage = '';
    setWaitlistEmailValue('');

    const scrim = this.scene.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x040c14, 0.66)
      .setInteractive();
    scrim.on('pointerdown', (p: Phaser.Input.Pointer) => p.event?.stopPropagation());

    this.root = this.scene.add.container(0, 0, [scrim]);
    this.root.setDepth(this.opts.depth).setScrollFactor(0);

    this.render();

    trackEvent(
      'waitlist_prompt_viewed',
      { run_id: this.opts.runId },
      { dedupeKey: this.opts.runId },
    );

    this.resizeHandler = () => {
      this.repositionEmailOverlay();
      this.repositionPrivacyLink();
    };
    this.scene.scale.on('resize', this.resizeHandler);
  }

  close(): void {
    if (!this.openFlag) return;
    this.openFlag = false;
    this.submitToken += 1; // invalidate any in-flight submit
    hideWaitlistEmailOverlay();
    hidePrivacyLinkOverlay();
    if (this.resizeHandler) {
      this.scene.scale.off('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
    this.contentNodes = [];
    this.replayButton = null;
    this.root?.destroy();
    this.root = null;
  }

  /** Fully releases the shared HTML input elements — call on final teardown only. */
  destroy(): void {
    this.close();
    removeWaitlistEmailOverlay();
    removePrivacyLinkOverlay();
  }

  private clearContent(): void {
    for (const node of this.contentNodes) node.destroy();
    this.contentNodes = [];
    this.replayButton = null;
    this.emailFieldRect = null;
    this.privacyLinkRect = null;
  }

  private render(): void {
    if (!this.root) return;
    this.clearContent();

    if (this.state === 'success') {
      this.renderSuccess();
      hideWaitlistEmailOverlay();
      hidePrivacyLinkOverlay();
    } else {
      this.renderForm();
      this.repositionEmailOverlay();
      this.repositionPrivacyLink();
      setWaitlistEmailDisabled(this.state === 'submitting');
    }
  }

  private repositionEmailOverlay(): void {
    if (!this.openFlag || !this.emailFieldRect) {
      hideWaitlistEmailOverlay();
      return;
    }
    const r = this.emailFieldRect;
    showWaitlistEmailOverlay(this.scene.game, r.x, r.y, r.w, r.h);
  }

  private repositionPrivacyLink(): void {
    if (!this.openFlag || !this.privacyLinkRect) {
      hidePrivacyLinkOverlay();
      return;
    }
    const r = this.privacyLinkRect;
    showPrivacyLinkOverlay(this.scene.game, r.x, r.y, r.w, r.h);
  }

  private addContent(...nodes: Phaser.GameObjects.GameObject[]): void {
    this.contentNodes.push(...nodes);
    this.root?.add(nodes);
  }

  private renderForm(): void {
    const cx = GAME_WIDTH / 2;
    const panelTop = (GAME_HEIGHT - FORM_PANEL_HEIGHT) / 2;
    const contentWidth = PANEL_WIDTH - 48;
    const isSubmitting = this.state === 'submitting';
    const hasError = this.state === 'error';

    const panelBg = this.scene.add.graphics();
    panelBg.fillStyle(0x0c202c, 0.96);
    panelBg.fillRoundedRect(cx - PANEL_WIDTH / 2, panelTop, PANEL_WIDTH, FORM_PANEL_HEIGHT, 20);
    panelBg.lineStyle(2, 0xffe566, 0.5);
    panelBg.strokeRoundedRect(cx - PANEL_WIDTH / 2, panelTop, PANEL_WIDTH, FORM_PANEL_HEIGHT, 20);
    this.addContent(panelBg);

    this.addContent(this.buildCloseButton(cx + PANEL_WIDTH / 2 - 30, panelTop + 30));

    const title = this.scene.add
      .text(cx, panelTop + 28, 'Level 2 is coming soon!', lilitaDisplayStyle({
        fontSize: '20px',
        wordWrap: { width: contentWidth, useAdvancedWrap: true },
        align: 'center',
      }))
      .setOrigin(0.5, 0);
    void ensureLilitaFont(title, 20);
    this.addContent(title);

    const subtitle = this.scene.add
      .text(cx, panelTop + 68, "Want to know when it's ready?", {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '15px',
        color: '#e8f4fc',
        align: 'center',
        wordWrap: { width: contentWidth, useAdvancedWrap: true },
      })
      .setOrigin(0.5, 0);
    this.addContent(subtitle);

    const fieldY = panelTop + 104;
    const fieldX = cx - EMAIL_FIELD.width / 2;
    const fieldBg = this.scene.add.graphics();
    fieldBg.fillStyle(0x081420, 0.9);
    fieldBg.fillRoundedRect(fieldX, fieldY, EMAIL_FIELD.width, EMAIL_FIELD.height, 10);
    fieldBg.lineStyle(1.5, hasError ? 0xff8a8a : 0xffffff, hasError ? 0.85 : 0.24);
    fieldBg.strokeRoundedRect(fieldX, fieldY, EMAIL_FIELD.width, EMAIL_FIELD.height, 10);
    this.addContent(fieldBg);
    this.emailFieldRect = { x: fieldX, y: fieldY, w: EMAIL_FIELD.width, h: EMAIL_FIELD.height };

    if (hasError && this.errorMessage) {
      const err = this.scene.add
        .text(cx, fieldY + EMAIL_FIELD.height + 8, this.errorMessage, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '12.5px',
          color: '#ff9d9d',
          align: 'center',
          wordWrap: { width: contentWidth, useAdvancedWrap: true },
        })
        .setOrigin(0.5, 0);
      this.addContent(err);
    }

    const notifyY = panelTop + 208;
    this.addContent(
      this.buildPillButton(
        cx,
        notifyY,
        isSubmitting ? 'Sending…' : 'Notify me',
        !isSubmitting,
        () => void this.handleSubmit(),
      ),
    );

    const disclaimer = this.scene.add
      .text(cx, panelTop + 242, "We'll only use your email for Sleepy Ducks updates. Unsubscribe anytime.", {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        color: '#9fc0d6',
        align: 'center',
        wordWrap: { width: contentWidth, useAdvancedWrap: true },
      })
      .setOrigin(0.5, 0);
    this.addContent(disclaimer);

    this.addContent(
      createTextLink(this.scene, cx, panelTop + 286, 'Not now', () => this.handleClose(), 1, {
        fontSize: '14px',
        strokeThickness: 2,
        color: '#cfe6f4',
      }),
    );

    this.privacyLinkRect = {
      x: cx - PRIVACY_LINK_FIELD.width / 2,
      y: panelTop + 312 - PRIVACY_LINK_FIELD.height / 2,
      w: PRIVACY_LINK_FIELD.width,
      h: PRIVACY_LINK_FIELD.height,
    };

    // FloatingAnimButton's tap target is sized to the source texture (a
    // square canvas padded around the visible pill, ~168x168 for this
    // displayWidth), not the visible pill shape — so its hit box reaches
    // roughly 90px above and below this button's center. "Not now" and the
    // Privacy Policy link above must clear that, hence the tall panel and
    // the gap here (a real bug found in testing: without this gap, taps on
    // "Not now" were silently swallowed by this button instead).
    this.replayButton = new FloatingAnimButton(
      this.scene,
      cx,
      panelTop + 434,
      ASSET_KEYS.uiRetry,
      null,
      {
        depth: 1,
        displayWidth: 150,
        autoFloat: false,
        interactive: true,
        onClick: () => this.handleReplay(),
      },
    );
    this.addContent(this.replayButton.root);
  }

  private renderSuccess(): void {
    const cx = GAME_WIDTH / 2;
    const panelTop = (GAME_HEIGHT - SUCCESS_PANEL_HEIGHT) / 2;
    const contentWidth = PANEL_WIDTH - 48;

    const panelBg = this.scene.add.graphics();
    panelBg.fillStyle(0x0c202c, 0.96);
    panelBg.fillRoundedRect(cx - PANEL_WIDTH / 2, panelTop, PANEL_WIDTH, SUCCESS_PANEL_HEIGHT, 20);
    panelBg.lineStyle(2, 0xffe566, 0.5);
    panelBg.strokeRoundedRect(cx - PANEL_WIDTH / 2, panelTop, PANEL_WIDTH, SUCCESS_PANEL_HEIGHT, 20);
    this.addContent(panelBg);

    this.addContent(this.buildCloseButton(cx + PANEL_WIDTH / 2 - 30, panelTop + 30));

    const title = this.scene.add
      .text(cx, panelTop + 34, "You're on the list!", lilitaDisplayStyle({
        fontSize: '21px',
        wordWrap: { width: contentWidth, useAdvancedWrap: true },
        align: 'center',
      }))
      .setOrigin(0.5, 0);
    void ensureLilitaFont(title, 21);
    this.addContent(title);

    const subtitle = this.scene.add
      .text(cx, panelTop + 76, "We'll let you know when Level 2 is ready.", {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '15px',
        color: '#e8f4fc',
        align: 'center',
        wordWrap: { width: contentWidth, useAdvancedWrap: true },
      })
      .setOrigin(0.5, 0);
    this.addContent(subtitle);

    this.replayButton = new FloatingAnimButton(
      this.scene,
      cx,
      panelTop + 172,
      ASSET_KEYS.uiRetry,
      null,
      {
        depth: 1,
        displayWidth: 168,
        autoFloat: false,
        interactive: true,
        onClick: () => this.handleReplay(),
      },
    );
    this.addContent(this.replayButton.root);
  }

  private buildCloseButton(x: number, y: number): Phaser.GameObjects.Container {
    const hitSize = 40;
    const text = this.scene.add
      .text(0, 0, '✕', outlinedTextStyle({
        fontSize: '18px',
        strokeThickness: 3,
        color: UI_CHROME.textSoft,
      }))
      .setOrigin(0.5);
    const hit = this.scene.add
      .rectangle(0, 0, hitSize, hitSize, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event?.stopPropagation();
      this.handleClose();
    });
    return this.scene.add.container(x, y, [hit, text]);
  }

  private buildPillButton(
    x: number,
    y: number,
    label: string,
    enabled: boolean,
    onClick: () => void,
  ): Phaser.GameObjects.Container {
    const w = 184;
    const h = 46;
    const g = this.scene.add.graphics();
    g.fillStyle(0xffe566, enabled ? 1 : 0.55);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 13);

    const text = this.scene.add
      .text(0, 0, label, {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#1a0e08',
      })
      .setOrigin(0.5);

    const children: Phaser.GameObjects.GameObject[] = [g, text];

    if (enabled) {
      const hit = this.scene.add
        .rectangle(0, 0, w, h, 0xffffff, 0)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
        p.event?.stopPropagation();
        onClick();
      });
      children.push(hit);
    }

    return this.scene.add.container(x, y, children);
  }

  private handleClose(): void {
    this.close();
    this.opts.onClose?.();
  }

  private handleReplay(): void {
    trackEvent(
      'replay_clicked',
      { level: 1, source: SOURCE, run_id: this.opts.runId },
      { dedupeKey: this.opts.runId },
    );
    this.close();
    this.opts.onReplay();
  }

  private async handleSubmit(): Promise<void> {
    if (this.state === 'submitting' || this.state === 'success') return;

    const honeypot = getWaitlistHoneypotValue();
    const rawEmail = getWaitlistEmailValue();

    trackEvent('waitlist_signup_submitted', { run_id: this.opts.runId });

    if (honeypot.trim().length > 0) {
      trackEvent('waitlist_signup_failed', { run_id: this.opts.runId, reason: 'honeypot' });
      this.state = 'error';
      this.errorMessage = errorMessageFor('honeypot');
      this.render();
      return;
    }

    const email = normalizeEmail(rawEmail);
    if (!email) {
      trackEvent('waitlist_signup_failed', { run_id: this.opts.runId, reason: 'invalid_email' });
      this.state = 'error';
      this.errorMessage = errorMessageFor('invalid_email');
      this.render();
      return;
    }

    this.state = 'submitting';
    this.render();

    const token = ++this.submitToken;
    const result = await submitWaitlistSignup({
      email,
      honeypot,
      source: SOURCE,
      consentVersion: CONSENT_VERSION,
    });

    // Panel was closed (or reopened/resubmitted) while the request was in flight.
    if (token !== this.submitToken) return;

    if (result.ok) {
      this.state = 'success';
      trackEvent('waitlist_signup_succeeded', { run_id: this.opts.runId });
    } else {
      this.state = 'error';
      this.errorMessage = errorMessageFor(result.reason);
      trackEvent('waitlist_signup_failed', { run_id: this.opts.runId, reason: result.reason });
    }
    this.render();
  }
}
