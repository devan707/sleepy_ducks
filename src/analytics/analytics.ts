import { isDevMode } from '../dev/isDevMode';
import { getAnalyticsId } from '../storage/analyticsId';
import type { AnalyticsProperties, AnalyticsProvider } from './AnalyticsProvider';
import { PostHogProvider } from './PostHogProvider';

/** Explicit event catalog — see docs in the task description for the property contract. */
export type AnalyticsEventName =
  | 'level_started'
  | 'level_completed'
  | 'level_failed'
  | 'next_level_clicked'
  | 'replay_clicked'
  | 'waitlist_prompt_viewed'
  | 'waitlist_signup_submitted'
  | 'waitlist_signup_succeeded'
  | 'waitlist_signup_failed';

function isDebugEnabled(): boolean {
  if (isDevMode()) return true;
  try {
    return new URLSearchParams(location.search).get('analyticsDebug') === '1';
  } catch {
    return false;
  }
}

const DEBUG = isDebugEnabled();

let providerInitialized = false;
let provider: AnalyticsProvider | null = null;
const firedOnce = new Set<string>();

function createProvider(): AnalyticsProvider | null {
  const apiKey = import.meta.env.VITE_POSTHOG_KEY;
  if (!apiKey) {
    if (DEBUG) {
      console.info('[analytics] VITE_POSTHOG_KEY not set — events will only log to console');
    }
    return null;
  }
  const host = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';
  return new PostHogProvider({ apiKey, host });
}

function getProvider(): AnalyticsProvider | null {
  if (!providerInitialized) {
    providerInitialized = true;
    try {
      provider = createProvider();
    } catch (err) {
      if (DEBUG) console.warn('[analytics] provider init failed', err);
      provider = null;
    }
  }
  return provider;
}

export interface TrackOptions {
  /**
   * When set, the event fires at most once per key for the lifetime of the
   * page (guards double taps and Phaser scene re-creation). Callers pass a
   * value that's stable for the action/state transition being measured —
   * typically the run_id.
   */
  dedupeKey?: string;
}

/**
 * Fire an analytics event. Never throws and never awaits network I/O, so a
 * slow or unreachable analytics endpoint cannot delay or break gameplay.
 */
export function trackEvent(
  event: AnalyticsEventName,
  properties: AnalyticsProperties = {},
  options: TrackOptions = {},
): void {
  try {
    if (options.dedupeKey) {
      const fullKey = `${event}:${options.dedupeKey}`;
      if (firedOnce.has(fullKey)) {
        if (DEBUG) console.debug(`[analytics] skipped duplicate "${event}"`, options.dedupeKey);
        return;
      }
      firedOnce.add(fullKey);
    }

    if (DEBUG) {
      console.info(`[analytics] ${event}`, properties);
    }

    const p = getProvider();
    if (!p) return;
    p.track(event, properties, getAnalyticsId());
  } catch (err) {
    if (DEBUG) console.warn('[analytics] track failed (ignored)', err);
    /* Analytics failures must never break or delay gameplay. */
  }
}

/** Unique id for one Level 1 attempt — ties start/completion/failure/click events together. */
export function generateRunId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `run-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
