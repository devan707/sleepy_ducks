export type AnalyticsPropertyValue = string | number | boolean | null | undefined;
export type AnalyticsProperties = Record<string, AnalyticsPropertyValue>;

/** A provider sends one already-built event. It must never throw. */
export interface AnalyticsProvider {
  track(event: string, properties: AnalyticsProperties, distinctId: string): void;
}
