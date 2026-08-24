# Deploy — Cloudflare Pages

## Cloudflare dashboard settings (match your Build screen)

Your project uses **Git → build → `wrangler deploy`**. Set each field like this:

| Setting | Value | Notes |
|---------|--------|--------|
| **Git repository** | `devan707/sleeping_ducks` | Repo name can differ from project name |
| **Build command** | `npm ci && npm run build` | Builds `dist/` |
| **Deploy command** | `npx wrangler deploy` | Keep this — [`wrangler.toml`](../wrangler.toml) points it at `./dist` |
| **Version command** | *(leave blank or delete)* | Not needed for a static game |
| **Root directory** | `/` | Leave as root |
| **Production branch** | `main` | |
| **Build watch paths** | *(empty)* | Build on every push |
| **Variables and secrets** | `NODE_VERSION` = `20` | **Add this** — required for Vite 6 |

[`wrangler.toml`](../wrangler.toml) must include:

```toml
[assets]
directory = "./dist"
```

Without that block, `wrangler deploy` looks for a Worker script and the deploy step fails even when the build succeeds.

### What you can ignore for now

- **Deploy Hooks** — optional manual triggers
- **Build cache** — leave enabled
- **API token** — Cloudflare manages this when you connected Git

### Level 2 waitlist — required KV binding

The waitlist signup form (`worker/index.ts`) needs a Workers KV namespace.
One-time setup:

```bash
npx wrangler login
npx wrangler kv namespace create WAITLIST_KV
```

Copy the `id` it prints into [`wrangler.toml`](../wrangler.toml)'s
`[[kv_namespaces]]` block (replacing `REPLACE_WITH_KV_NAMESPACE_ID`), commit,
and push. Without this, `/api/waitlist` returns a server error but the game
itself still works — signups just won't be stored.

Export collected emails any time with `npm run waitlist:export` (requires
`wrangler login`; writes CSV to stdout).

### Analytics — optional PostHog env vars

Set these as Cloudflare **Build** environment variables (they're inlined at
build time, so a Preview/Production split needs the same vars in both):

| Variable | Value | Notes |
|---|---|---|
| `VITE_POSTHOG_KEY` | your PostHog project API key | Public/client-safe key, not a secret. Leave unset to ship with analytics disabled. |
| `VITE_POSTHOG_HOST` | `https://us.i.posthog.com` | Or your region/self-hosted host. Optional — defaults to US cloud. |

See [`.env.example`](../.env.example) for local dev.

---

## Cloudflare Git build (recommended for this project)

Use **Workers & Pages → sleepy-ducks → Settings → Builds & deployments** with these exact values:

| Setting | Value |
|---------|--------|
| **Framework preset** | Vite (or None) |
| **Build command** | `npm ci && npm run build` |
| **Build output directory** | `dist` |
| **Root directory** | *(leave blank)* |

### Required environment variable

Under **Settings → Environment variables** (Production + Preview):

| Variable | Value |
|----------|--------|
| `NODE_VERSION` | `20` |

The repo also pins Node via [`.nvmrc`](../.nvmrc) and [`wrangler.toml`](../wrangler.toml).

### Retry after pushing

1. Commit and push all source **including** [`public/assets/`](../public/assets/) (~170MB of game art must be in Git).
2. Commit the updated [`wrangler.toml`](../wrangler.toml) with the `[assets]` block.
3. Cloudflare → **Deployments** → **Retry deployment** on the failed build.

---

## Common build failures

### Build succeeds, deploy fails (`wrangler deploy` / no entry point)

Add the `[assets]` block to `wrangler.toml` (see above). Clear **Version command** if set.

### `Output directory "public" not found` (or similar)

Build succeeded but Cloudflare is looking in the wrong folder. Set **Build output directory** to `dist`, not `public`.

### `vite: command not found` / `tsc: command not found`

Dev dependencies were skipped. Set `NODE_VERSION=20` and use build command `npm ci && npm run build` (not `npm install --production`).

### `The engine "node" is incompatible`

Add environment variable `NODE_VERSION=20` in Cloudflare dashboard.

### Build succeeds but game has no art on the live site

`public/assets/` was not pushed to GitHub. Verify the folder exists in your repo on github.com.

### `pages only supports files up to 25 MiB`

No single file in this project exceeds that limit. If you see this, check for accidental cache folders in the repo.

---

## Optional: GitHub Actions deploy

If you prefer CI deploy instead of Cloudflare Git builds, disable automatic builds in Cloudflare (or disconnect Git) and use [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) with secrets:

| Secret | Where to find it |
|--------|------------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare → API Tokens → **Edit Cloudflare Workers** template |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard sidebar |

Do **not** run both Cloudflare Git builds and GitHub Actions deploy on every push unless you intend to.

---

## Live URL

**https://sleepy-ducks.pages.dev**

Update `og:url` / `og:image` in [`index.html`](../index.html) if you use a custom domain.

## Smoke test

- [ ] Loading bar completes on mobile
- [ ] First tap unlocks audio
- [ ] Full run → game over → retry
- [ ] iPhone Safari + Android Chrome, portrait

Local preview:

```bash
npm run build
npm run preview
```

To test the waitlist signup end-to-end locally (the Vite dev server on its
own doesn't serve `/api/waitlist`), run the built app through Wrangler
instead:

```bash
npm run worker:dev
```

This uses a local, on-disk KV namespace — no Cloudflare account needed for
this check.
