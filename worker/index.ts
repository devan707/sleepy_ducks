/**
 * Cloudflare Worker for the Level 2 waitlist. Deployed alongside the static
 * game build (see wrangler.toml `[assets]`): Cloudflare serves any request
 * that matches a file in dist/ directly, and only falls through to this
 * script for everything else — in practice just POST /api/waitlist.
 *
 * Storage is a single Workers KV namespace, one key per normalized email.
 * That makes duplicate signups naturally idempotent (see handleWaitlist).
 */

export interface Env {
  WAITLIST_KV: KVNamespace;
}

interface WaitlistRecord {
  email: string;
  submittedAt: string;
  source: string;
  consentVersion: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_SOURCE = 'level_2_coming_soon';
const DEFAULT_CONSENT_VERSION = 'v1';
const MAX_FIELD_LEN = 64;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.length < 5 || trimmed.length > 254) return null;
  if (!EMAIL_RE.test(trimmed)) return null;
  return trimmed;
}

function sanitizeField(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string' || !raw.trim()) return fallback;
  return raw.trim().slice(0, MAX_FIELD_LEN);
}

async function handleWaitlist(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ ok: false, reason: 'method_not_allowed' }, 405);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, reason: 'invalid_body' }, 400);
  }

  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};

  // Honeypot: a real player never sees or fills this field. Reject quietly —
  // no signup is stored, and the client only ever learns a generic reason.
  if (typeof record.honeypot === 'string' && record.honeypot.trim().length > 0) {
    return json({ ok: false, reason: 'rejected' }, 400);
  }

  const email = normalizeEmail(record.email);
  if (!email) {
    return json({ ok: false, reason: 'invalid_email' }, 400);
  }

  const key = `waitlist:${email}`;

  try {
    const existing = await env.WAITLIST_KV.get(key);
    if (!existing) {
      const entry: WaitlistRecord = {
        email,
        submittedAt: new Date().toISOString(),
        source: sanitizeField(record.source, DEFAULT_SOURCE),
        consentVersion: sanitizeField(record.consentVersion, DEFAULT_CONSENT_VERSION),
      };
      await env.WAITLIST_KV.put(key, JSON.stringify(entry));
    }
    // Already-registered emails still report success (idempotent) — no
    // duplicate record is created, and we never reveal an email is known.
    return json({ ok: true });
  } catch (err) {
    console.error('waitlist store failed', err);
    return json({ ok: false, reason: 'server_error' }, 500);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/waitlist') {
      return handleWaitlist(request, env);
    }
    return json({ ok: false, reason: 'not_found' }, 404);
  },
};
