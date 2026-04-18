# Dev Sandbox HTTP Mode (Claude Code Prompt)

## Context

Working in the `gloomhaven-command` repo. Baseline: **T0d complete** — T0 arc closed. Run `git pull` and confirm.

## The Problem

Every recent batch (T0b / T0c / T0d) has ended with Claude Code unable to perform browser-based smoke verification because the sandboxed preview Chromium won't accept the self-signed / local-Certbot cert the dev server presents. The preview gets stuck on `chrome-error://chromewebdata/` and verification is blocked.

This doesn't affect playtest devices (they work fine over HTTPS via the Let's Encrypt cert + LAN DNS setup documented in `docs/HTTPS_LAN_SETUP.md`). It **does** cost verification coverage on every future batch. Net: the same issue will bite every remaining Phase T2+ batch unless fixed.

## Solution

Add a dev-only `GC_DEV_HTTP=1` environment variable that skips the cert discovery and forces plain HTTP on localhost. Preserves the existing HTTPS behavior as the default (unchanged for every playtest and production flow). Fresh-opens a single well-defined escape hatch for sandbox verification and nothing else.

**Three hard non-goals:**
1. Do NOT change default server behavior. HTTPS-when-certs-found stays the default. This is an opt-in override.
2. Do NOT add runtime protocol switching, TLS offload, reverse proxy, or a parallel HTTP listener. Simple env var with a simple branch.
3. Do NOT modify the SW registration or /sw-version.json logic. Those work fine over either protocol because they use relative fetches.

## Root Cause Analysis (confirm before coding)

In `server/src/index.ts`, around line 309-314:
```ts
const certs = findCerts();
const useHttps = !!certs;

const httpServer = certs
  ? createHttpsServer({ cert: readFileSync(certs.cert), key: readFileSync(certs.key) }, app)
  : createServer(app);
```

The server is always HTTPS-when-certs-exist. In Kyle's environment certs always exist (Certbot-managed in `C:\Certbot\live`). Sandboxed Chromium can't verify any cert it doesn't have a root CA for — including publicly-trusted certs over a LAN origin name, because the sandbox is isolated from the host's CA store. Hence the stuck interstitial.

The fix: give the server one override to force HTTP regardless of cert presence.

## Scope

**In scope:**

- `GC_DEV_HTTP=1` environment variable recognized in `server/src/index.ts`. When set, skip `findCerts()` entirely and create an HTTP server. Log a prominent warning on startup so it's obvious the server is in dev mode.
- A **loud safety guard** that prevents `GC_DEV_HTTP=1` from binding to anything except localhost / 127.0.0.1. Binding to `0.0.0.0` over HTTP would expose an unencrypted game server to the LAN, which is never what we want. If someone sets `GC_DEV_HTTP=1` while `HOST` / `PORT_HOST` / the server's bind address is not loopback, refuse to start with a clear error.
- A small helper for Claude Code to start the dev server in this mode, documented in `CLAUDE.md` and a new tiny `docs/DEV_PREVIEW.md`.
- `package.json` script `dev:sandbox` that sets the env var and binds to `127.0.0.1` — Claude Code uses this exclusively for preview verification. `npm run dev` stays unchanged (HTTPS as today).
- Update `CLAUDE.md` under the "Prompt-Driven Workflow" or a new "Verification" section with a verbatim block Claude Code can copy: *"Run `npm run dev:sandbox` for preview-chromium verification. Do NOT run `npm run dev` when the preview browser is the target."*
- Update `docs/BUGFIX_LOG.md` with an entry describing the root cause and the fix (not a bug per se, but the log is where we record environmental issues with fixes).
- Log a single-line warning on startup in HTTP mode: `"[dev] GC_DEV_HTTP — HTTP on 127.0.0.1:PORT. Do NOT use for LAN / playtest."`

**Out of scope:**

- Changes to the `findCerts` function itself.
- Any modification to production cert handling.
- Any change to SW registration, `/sw-version.json`, `/unregister`, or the self-healing SW code.
- Any change to the LAN DNS / router / cert setup.
- Any new test infrastructure.

## Files to Change

```
server/src/index.ts              — env var check, bind guard, HTTP branch
package.json                     — new dev:sandbox script
CLAUDE.md                        — verification section update
docs/DEV_PREVIEW.md              — new short doc (~30 lines)
docs/BUGFIX_LOG.md               — log entry
docs/HTTPS_LAN_SETUP.md          — add a note that this doesn't affect LAN setup
```

Total expected diff: under 100 lines of code. Simple and surgical.

## Step 1 — Server changes

### 1a. Env var + loopback guard

In `server/src/index.ts`, before the existing `findCerts()` call (around line 309), add:

```ts
// ── Dev sandbox HTTP mode ──────────────────────────────────────────────
// GC_DEV_HTTP=1 forces plain HTTP on loopback, skipping cert discovery.
// Purpose: unblock sandboxed preview browsers (headless Chromium in Claude
// Code environments) that can't verify local-CA certs. Guarded so it only
// binds to 127.0.0.1 — refuses to start if paired with a public bind.
//
// See docs/DEV_PREVIEW.md. Not for LAN, not for playtest, not for prod.
const devHttpMode = process.env.GC_DEV_HTTP === '1';

// Resolve bind host. Default unchanged (listen on all interfaces = 0.0.0.0
// which Node does implicitly when no host is passed to listen()).
const bindHost = process.env.GC_BIND_HOST; // undefined = Node default (all interfaces)

if (devHttpMode && bindHost && bindHost !== '127.0.0.1' && bindHost !== 'localhost') {
  console.error(
    '[fatal] GC_DEV_HTTP=1 requires GC_BIND_HOST=127.0.0.1 or unset (falls through to loopback).\n' +
    '        Refusing to start plain HTTP on a non-loopback interface.\n' +
    '        If you want HTTPS on LAN, unset GC_DEV_HTTP. If you want dev HTTP,\n' +
    '        unset GC_BIND_HOST or set it to 127.0.0.1.',
  );
  process.exit(1);
}

// When GC_DEV_HTTP is active, we also force bindHost to loopback regardless
// of env. This is a belt-and-suspenders check — the fatal above already blocks
// non-loopback, but if someone unsets GC_BIND_HOST entirely while GC_DEV_HTTP
// is set, default behavior would bind to all interfaces, exposing HTTP to LAN.
const effectiveBindHost = devHttpMode ? '127.0.0.1' : bindHost;
```

Then modify the cert discovery + server creation:

```ts
const certs = devHttpMode ? null : findCerts();
const useHttps = !!certs;

const httpServer = certs
  ? createHttpsServer({ cert: readFileSync(certs.cert), key: readFileSync(certs.key) }, app)
  : createServer(app);
```

Update the `listen` call to use `effectiveBindHost`:

```ts
// Change from:
httpServer.listen(PORT, () => { ... });
// To:
httpServer.listen(PORT, effectiveBindHost, () => { ... });
```

Note: `listen(port, undefined, cb)` is equivalent to `listen(port, cb)` — Node treats undefined host as "all interfaces." So passing `effectiveBindHost` (which is `undefined` in the normal path) doesn't change existing behavior.

### 1b. Startup log

Inside the listen callback, after the existing console.log lines, add:

```ts
if (devHttpMode) {
  console.warn('');
  console.warn('  ⚠  GC_DEV_HTTP — plain HTTP on 127.0.0.1 only.');
  console.warn('     Do NOT use for LAN or playtest. Set this only for sandboxed preview browsers.');
  console.warn('');
}
```

Place the warning **before** the `if (certs)` cert-path log so an operator sees the dev-mode warning front and center.

Also: if `useHttps` is false **without** `devHttpMode`, the existing code already logs plain HTTP. Don't regress that — this adds a signal only when the dev override is active.

### 1c. Verify no other protocol assumptions

Grep for other `https` / `useHttps` / `certs` uses in `server/src/` that might assume the wrong thing when overridden:

```bash
grep -rn "useHttps\|certs\|https://" server/src/
```

The cert path is logged and forwarded to WsHub. Confirm WsHub doesn't re-derive protocol from cert presence — it should just wrap the given `httpServer`, which handles the protocol implicitly.

## Step 2 — package.json

Add a new script:

```json
{
  "scripts": {
    "dev": "... existing ...",
    "dev:sandbox": "cross-env GC_DEV_HTTP=1 GC_BIND_HOST=127.0.0.1 npm run dev"
  }
}
```

Check if `cross-env` is already a dev dependency. If not, use a fallback that works on both Windows and POSIX. Since Kyle's dev env is Windows PowerShell:

**If `cross-env` isn't present**, either add it (preferred — one-line dev dep) or use PowerShell-compatible syntax. Preferred:

```bash
npm install --save-dev cross-env
```

Then the script above works. If for any reason cross-env feels wrong, fall back to:

```json
"dev:sandbox": "set GC_DEV_HTTP=1 && set GC_BIND_HOST=127.0.0.1 && npm run dev"
```

…which works on Windows cmd but NOT on PowerShell or bash. `cross-env` is the right call. Unless a grep of `package.json` shows a team convention against it, install it.

## Step 3 — Documentation

### 3a. `docs/DEV_PREVIEW.md` (new file, ~30 lines)

```markdown
# Dev Preview — Sandbox HTTP Mode

**Use this only for sandboxed preview browsers (Claude Code, headless
Chromium). Never for LAN or playtest.**

## Problem

Sandboxed preview browsers can't verify the local Certbot or mkcert
certs the dev server presents over HTTPS. The preview hangs on the
`chrome-error://chromewebdata/` cert interstitial.

## Fix

`npm run dev:sandbox`

This sets `GC_DEV_HTTP=1` and binds the server to `127.0.0.1` on HTTP
only. The server refuses to start in this mode on any non-loopback
interface — it's physically impossible to accidentally expose plain
HTTP to the LAN via this path.

## When to use it

| Scenario | Command |
|----------|---------|
| Claude Code preview verification | `npm run dev:sandbox` |
| Playtest over LAN / iPads / phones | `npm run dev` (unchanged) |
| Production deployment | `npm run dev` (unchanged) |

## Verification URLs in dev sandbox mode

- http://127.0.0.1:3000/controller
- http://127.0.0.1:3000/phone
- http://127.0.0.1:3000/display

No cert warnings. No interstitial. Works identically to HTTPS in behavior.

## What's different from normal dev

- Protocol is HTTP, not HTTPS.
- Server ONLY binds to 127.0.0.1 (not 0.0.0.0). LAN devices can't reach it.
- Startup log shows a prominent `⚠ GC_DEV_HTTP` warning.
- SW registration still works (fetches are relative and protocol-agnostic).

## Troubleshooting

If `npm run dev:sandbox` refuses to start with a "Refusing to start plain
HTTP on a non-loopback interface" error, you likely have `GC_BIND_HOST`
set in your shell to something other than `127.0.0.1`. Unset it:

```bash
# PowerShell
Remove-Item Env:GC_BIND_HOST
# bash
unset GC_BIND_HOST
```

The sandbox script sets `GC_BIND_HOST=127.0.0.1` explicitly, so this
shouldn't trigger in normal usage — but a pre-existing shell env var can
leak through.
```

### 3b. Update `CLAUDE.md`

In the existing `## Prompt-Driven Workflow` section, append a new top-level section:

```markdown
## Browser Preview Verification

When running browser-based smoke verification in a sandboxed preview
Chromium (typical for Claude Code environments), **use `npm run dev:sandbox`
instead of `npm run dev`**. This forces HTTP on 127.0.0.1 so the sandboxed
browser can reach the server without getting stuck on cert interstitials.

Quick reference:

| When | Command |
|------|---------|
| Preview-browser verification (sandbox) | `npm run dev:sandbox` |
| LAN playtest / production dev | `npm run dev` |

Never run `dev:sandbox` on a shared network or production host — it
binds HTTP to loopback only and will refuse to start on any other
interface.

See `docs/DEV_PREVIEW.md` for details.
```

### 3c. Update `docs/HTTPS_LAN_SETUP.md`

Append a small note at the end:

```markdown
## Dev Sandbox HTTP Mode

For Claude Code preview-browser verification, see `docs/DEV_PREVIEW.md`.
That mode is HTTP-only, loopback-only, and independent of this LAN HTTPS
setup. LAN playtest setup described above is unaffected and remains the
only supported path for real devices.
```

### 3d. Update `docs/BUGFIX_LOG.md`

Append:

```markdown
## [date] — Dev Sandbox HTTP Mode

**Symptom:** Every recent batch's (T0b/c/d) browser verification was
skipped because sandboxed preview Chromium (Claude Code env) can't
verify local-CA certs served by the dev HTTPS server. Previews hung
at `chrome-error://chromewebdata/`.

**Root cause:** Server defaults to HTTPS whenever certs are present;
certs are always present on dev host (Certbot-managed). Sandboxed
browsers lack the host CA store and reject the cert. No opt-out existed.

**Fix:** New `GC_DEV_HTTP=1` env var skips cert discovery and forces
plain HTTP. Hard-bound to loopback (127.0.0.1) with a startup fatal if
paired with a non-loopback bind host. New `npm run dev:sandbox` script
is the Claude-Code-verification command. Default `npm run dev` and all
playtest / production flows unchanged.

**Follow-up:** Future batches include a browser-smoke step executed
under `dev:sandbox`. See `CLAUDE.md § Browser Preview Verification`.
```

## Step 4 — Manual verification (before committing)

Run both modes and verify:

1. **Default mode** — `npm run dev`:
   - HTTPS starts as today.
   - Server binds on 0.0.0.0 (or whatever existing behavior).
   - LAN access from a phone works identically to before.
   - No `GC_DEV_HTTP` warning in logs.

2. **Sandbox mode** — `npm run dev:sandbox`:
   - Server logs `⚠ GC_DEV_HTTP` warning.
   - Server listens on `127.0.0.1:3000` with HTTP.
   - `curl http://127.0.0.1:3000/controller` returns the controller HTML.
   - `curl http://<LAN_IP>:3000/controller` times out or refuses connection (binds loopback only).
   - A browser connected to the dev loopback over HTTP loads all three clients without cert warnings.
   - WebSocket works (`ws://127.0.0.1:3000/ws` or whatever path). Run a quick connect → state flow.

3. **Safety guard verification** — try to misuse it:
   - `GC_DEV_HTTP=1 GC_BIND_HOST=0.0.0.0 npm run dev` → should exit with fatal error.
   - `GC_DEV_HTTP=1 GC_BIND_HOST=192.168.50.96 npm run dev` → should exit with fatal error.

## Verification Checklist

- [ ] `npm run dev` behavior unchanged (HTTPS, LAN-accessible, Let's Encrypt cert picked up).
- [ ] `npm run dev:sandbox` starts HTTP on 127.0.0.1:3000.
- [ ] `npm run dev:sandbox` refuses to start with `GC_BIND_HOST=0.0.0.0`.
- [ ] `npm run dev:sandbox` refuses to start with `GC_BIND_HOST=<LAN_IP>`.
- [ ] Sandboxed preview Chromium loads all three clients (controller/phone/display) over HTTP loopback.
- [ ] WebSocket connections work over HTTP loopback (ws://, not wss://).
- [ ] SW registration works in sandbox mode (no cert-related errors in SW install).
- [ ] Existing `/sw-version.json` and `/unregister` routes work unchanged.
- [ ] `npm run build` clean.
- [ ] `tsc --noEmit` clean.
- [ ] `CLAUDE.md` clearly points at `dev:sandbox` for verification.
- [ ] `docs/DEV_PREVIEW.md` exists and documents the command.
- [ ] `docs/BUGFIX_LOG.md` has the entry.

## Commit Message

```
chore(dev): GC_DEV_HTTP mode for sandboxed preview browsers

Adds an opt-in env var (GC_DEV_HTTP=1) that forces plain HTTP on
127.0.0.1, skipping cert discovery. Purpose: unblock browser-based
smoke verification in sandboxed Claude Code preview environments
where headless Chromium can't verify local-CA certs.

New `npm run dev:sandbox` script sets GC_DEV_HTTP=1 and
GC_BIND_HOST=127.0.0.1 via cross-env. Default `npm run dev` is
unchanged — HTTPS-when-certs-found behavior is preserved.

Safety guard: server refuses to start with GC_DEV_HTTP=1 + any
non-loopback bind host. Plain HTTP cannot accidentally land on a
LAN interface via this path.

Documentation:
- New docs/DEV_PREVIEW.md explaining the workflow.
- CLAUDE.md adds a Browser Preview Verification section pointing at
  dev:sandbox.
- HTTPS_LAN_SETUP.md gets a cross-reference.
- BUGFIX_LOG entry captures the root cause.

Root cause: three recent batches (T0b/c/d) couldn't complete browser
smoke verification due to sandboxed Chromium rejecting the local
Certbot cert (no host CA store in the sandbox).

Baseline: T0d complete.
```

## Notes to Claude Code

1. **Produce a Plan first.** Flag the `cross-env` install decision so Kyle can confirm before a new dev dep lands.

2. **Before editing, verify the current `server/src/index.ts` around line 309-314 matches the prompt's description.** If the cert discovery logic has changed since T0d landed, surface the delta and adapt.

3. **Do NOT touch `findCerts()` itself.** The function is fine. Just skip calling it when `GC_DEV_HTTP=1`.

4. **The loopback bind guard is the most important safety property.** Write it defensively. Test both "set to LAN IP" and "set to 0.0.0.0" scenarios manually before declaring done.

5. **Don't add a reverse proxy, don't add TLS offload, don't add a parallel HTTP listener.** Simple env var branch. Resist scope creep.

6. **When running `npm run dev:sandbox` for verification yourself**, make sure the existing `npm run dev` process isn't already running (port 3000 conflict). Kill it first.

7. **Manual smoke:** start `dev:sandbox`, open phone in preview Chromium, confirm the Player Sheet loads, confirm you can open the character portrait and see the T0d Notes + History tabs, confirm websocket messages flow. That's the verification this whole fix is about.

8. **Do NOT commit until Kyle confirms.** Per `CLAUDE.md` — this is a standing rule, not batch-specific.
