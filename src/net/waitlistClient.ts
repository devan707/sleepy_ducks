export type WaitlistSubmitResult = { ok: true } | { ok: false; reason: string };

export interface WaitlistSubmitParams {
  email: string;
  /** Hidden honeypot field value — non-empty means a bot filled it. */
  honeypot: string;
  source: string;
  consentVersion: string;
}

function endpointUrl(): string {
  return import.meta.env.VITE_WAITLIST_API_URL || '/api/waitlist';
}

/**
 * Posts a waitlist signup to the serverless endpoint. Never throws — network
 * failures resolve to a safe reason code so the caller can show a normal
 * error state instead of crashing the panel.
 */
export async function submitWaitlistSignup(
  params: WaitlistSubmitParams,
): Promise<WaitlistSubmitResult> {
  try {
    const res = await fetch(endpointUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(params),
    });

    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }

    const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : null;

    if (res.ok && record?.ok === true) {
      return { ok: true };
    }

    const reason = typeof record?.reason === 'string' ? record.reason : `http_${res.status}`;
    return { ok: false, reason };
  } catch {
    return { ok: false, reason: 'network_error' };
  }
}
