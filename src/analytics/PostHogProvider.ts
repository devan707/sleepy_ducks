import type { AnalyticsProperties, AnalyticsProvider } from './AnalyticsProvider';

export interface PostHogConfig {
  apiKey: string;
  host: string;
}

/**
 * Minimal capture-only PostHog client — posts explicit events to the HTTP
 * capture endpoint directly. Deliberately does not use posthog-js: that
 * pulls in autocapture + session recording, which this experiment must not
 * collect. Uses sendBeacon when available so the event survives a scene/
 * page transition; falls back to a fire-and-forget keepalive fetch.
 */
export class PostHogProvider implements AnalyticsProvider {
  private readonly captureUrl: string;
  private readonly apiKey: string;

  constructor(config: PostHogConfig) {
    this.captureUrl = `${config.host.replace(/\/+$/, '')}/capture/`;
    this.apiKey = config.apiKey;
  }

  track(event: string, properties: AnalyticsProperties, distinctId: string): void {
    const payload = JSON.stringify({
      api_key: this.apiKey,
      event,
      distinct_id: distinctId,
      properties: {
        ...properties,
        $lib: 'sleepy-ducks-web',
      },
    });

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([payload], { type: 'text/plain' });
        if (navigator.sendBeacon(this.captureUrl, blob)) return;
      }
    } catch {
      /* fall through to fetch */
    }

    try {
      void fetch(this.captureUrl, {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: payload,
        keepalive: true,
      }).catch(() => {
        /* analytics must never break gameplay */
      });
    } catch {
      /* analytics must never break gameplay */
    }
  }
}
