/** True only in Vite development (`npm run dev`), false in production builds. */
export function isDevMode(): boolean {
  return import.meta.env.DEV;
}
