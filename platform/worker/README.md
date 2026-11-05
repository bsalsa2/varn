# varn-ask: the private VARN assistant API

A **new** Cloudflare Worker (`varn-ask`). It does not replace `varn-api`. It answers questions about the command center's own data and proposes view-only terminal commands. The human clicks Run; the assistant never acts on its own.

- Model: `@cf/google/gemma-4-26b-a4b-it` on **Workers AI, Workers Free plan**. No other AI service, no API keys, no card.
- Counters: a SQLite-backed **Durable Object** (available on the Free plan; KV is not used because its free tier allows only 1,000 writes a day).
- Login: password checked on the server (PBKDF2-SHA256, random salt, constant-time compare). Session token = HMAC-signed, expires after 8 hours, kept only in browser memory.
- Nothing about a question is logged or stored (`observability` is off in `wrangler.toml`).

| Route | What it does |
|---|---|
| `GET /health` | `{ ok: true, service: "varn-ask" }`. No secrets, no CORS. |
| `POST /v1/login` | `{ password }` → `{ token, expires_in }`. 5 wrong tries per IP in 15 min blocks that IP for 15 min. |
| `POST /v1/ask` | `{ question, live }` with `Authorization: Bearer <token>`. Answer, command, or raw results. |

## Limits (all fail closed)

| Limit | Value | Where to change |
|---|---|---|
| Question length | 300 characters | `src/ask.js` |
| Requests | 10 per minute per IP | `src/limits.js` |
| Questions per day | 60 | `DAILY_QUESTION_CAP` in `wrangler.toml` |
| Neurons per day | 8,000 (of the 10,000 free) | `NEURON_BUDGET` in `wrangler.toml` |
| Tool steps per question | 4 | `src/ask.js` |
| Allowed browser origins | `ALLOWED_ORIGINS` (no wildcard) | `wrangler.toml` |

Each question reserves a worst-case Neuron estimate first and is refused if that would pass the day's budget. Days reset at 00:00 UTC, like Workers AI. If Workers AI reports that the free allowance is gone, or the counters cannot be reached, the user sees "Limit reached for today" or "Limits are unavailable" and no model call is made. **Nothing here can charge you**: it never uses a paid model and never asks for a payment method. If Cloudflare ever asks for a card or the Paid plan, stop.

## Deploy with Wrangler (about 10 minutes)

Run these from `platform/worker`. Someone with the Cloudflare account must run `wrangler login`.

```bash
cd platform/worker
npx wrangler login
npx wrangler deploy
```

`deploy` creates the Worker and its Durable Object. Until the two secrets exist the Worker answers `503 not_configured`, so it is safe to deploy first.

Make the password hash and session secret **on your own computer** (the password is typed, not echoed, at least 10 characters, and is never written anywhere):

```bash
node tools/make_password_hash.mjs --put
```

It asks for a password (at least 10 characters, typed twice, not shown) and saves `ASK_PASSWORD_HASH` and `ASK_SESSION_SECRET` straight to Cloudflare. Nothing is printed, copied or pasted. (Without `--put` it prints the two values for you to store with `npx wrangler secret put <NAME>`; that is where copy-and-paste mistakes happen.)

Check it:

```bash
curl https://varn-ask.<your-subdomain>.workers.dev/health
```

To change the password later, run the tool again and `secret put` both values (a new `ASK_SESSION_SECRET` signs everyone out immediately).

## Deploy from the dashboard instead

Pasting code into the dashboard editor does not work well for this Worker (it has several files, a Durable Object and a Workers AI binding), so use Workers Builds, which is free (3,000 build minutes a month):

1. Cloudflare dashboard → **Workers & Pages** → **Create application** → import the `bsalsa2/varn` GitHub repository.
2. Worker name: `varn-ask` (it must match `name` in `wrangler.toml`). **Root directory:** `platform/worker`. Build command: leave empty. Deploy command: `npx wrangler deploy`. Production branch: the branch you deploy from.
3. After the first deploy: Worker → **Settings** → **Variables and Secrets** → **Add** → type **Secret**, once for `ASK_PASSWORD_HASH` and once for `ASK_SESSION_SECRET` (values from `node tools/make_password_hash.mjs`) → **Deploy**.
4. The AI and Durable Object bindings come from `wrangler.toml`; nothing to add by hand.

## Use it (private builds only)

The assistant is **not part of the public site**. A normal `npm run build` contains none of it, and `npm run build` fails if any of it, the Worker URL or a secret name ends up in `dist/`.

```bash
cd platform
# platform/.env.private.local  (git-ignored)
#   VITE_ASK_URL=https://varn-ask.<your-subdomain>.workers.dev
npm run dev:private          # http://localhost:5173, with the Ask button and Ctrl+J
npm run build:private        # writes dist-private/ (never deploy this to the public site)
```

`ALLOWED_ORIGINS` in `wrangler.toml` lists the private site (`https://varn-ask-app-9x4m.pages.dev`) and `http://localhost:5173`. The public site is deliberately **not** listed.

### Host the private build on its own Pages site (no terminal needed to use it)

1. Cloudflare dashboard → **Workers & Pages** → **Create application** → **Pages** → **Import an existing Git repository** → pick `bsalsa2/varn`.
2. Project name `varn-ask-app-9x4m` (any unused name works, but then update `ALLOWED_ORIGINS` to match). Production branch: the branch you deploy from.
3. Build settings: framework preset **None**; build command `npm run build:private`; build output directory `dist-private`; root directory (under Advanced) `platform`.
4. Environment variables: `VITE_ASK_URL` = your Worker's address, and `NODE_VERSION` = `22`.
5. Save and Deploy. In the Worker (Workers & Pages → varn-ask → Settings → Variables and Secrets) make sure `ALLOWED_ORIGINS` includes the new `https://<project>.pages.dev`.

This site is **separate from the public site and not linked from it**. Cloudflare Access (to make the page itself private) asks for payment details at sign-up, so it is not used; the Worker's password login, lockout and daily caps still apply.

## Tests

`npm test` in `platform/` runs the Worker tests (`worker/test/`) with a fake model: login, lockout, expiry, tampered tokens, the command allowlist, number and citation checks, prompt-injection cases, limits, and that the public build contains none of the assistant.

## Not verified here

- Live calls to Workers AI. The model was faked in tests; the response parser accepts both shapes Cloudflare documents, but run a few real questions after deploying.
- PBKDF2 uses 100,000 iterations, the most the Workers runtime accepts as far as I know; the docs I could search did not state the limit. Use a long passphrase.
- Free-plan limits come from Cloudflare's pricing pages as of this build; check the Workers AI dashboard for real Neuron use.


