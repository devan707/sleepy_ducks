/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public PostHog project API key (client-safe). Analytics is disabled without it. */
  readonly VITE_POSTHOG_KEY?: string;
  /** PostHog ingestion host. Defaults to https://us.i.posthog.com. */
  readonly VITE_POSTHOG_HOST?: string;
  /** Override for the waitlist signup endpoint. Defaults to the same-origin "/api/waitlist". */
  readonly VITE_WAITLIST_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
