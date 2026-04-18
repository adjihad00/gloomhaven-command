# Dev Preview — Sandbox HTTP Mode

**Use this only for sandboxed preview browsers (Claude Code, headless
Chromium). Never for LAN or playtest.**

## Problem

Sandboxed preview browsers can't verify the local Certbot or mkcert
certs the dev server presents over HTTPS. The preview hangs on the
`chrome-error://chromewebdata/` cert interstitial and no UI ever loads.

## Fix

```
npm run dev:sandbox
```

Sets `GC_DEV_HTTP=1` and `GC_BIND_HOST=127.0.0.1`, then delegates to
`npm run dev`. The server skips cert discovery, creates a plain HTTP
listener, and binds only to the loopback interface. It refuses to start
in this mode on any non-loopback bind — plain HTTP cannot accidentally
land on a LAN interface via this path.

## When to use it

| Scenario | Command |
|----------|---------|
| Claude Code preview verification | `npm run dev:sandbox` |
| Playtest over LAN / iPads / phones | `npm run dev` (unchanged) |
| Production deployment | `npm run dev` / `npm start` (unchanged) |

## Verification URLs in sandbox mode

- `http://127.0.0.1:3000/controller`
- `http://127.0.0.1:3000/phone`
- `http://127.0.0.1:3000/display`

WebSocket endpoint is `ws://127.0.0.1:3000/` (path `/`, same as the
HTTPS production path).

No cert warnings. No interstitial. Behavior is identical to HTTPS
otherwise.

## What's different from normal dev

- Protocol is HTTP, not HTTPS.
- Server ONLY binds to `127.0.0.1` (not all interfaces). LAN devices
  can't reach it.
- Startup log shows a prominent `⚠ GC_DEV_HTTP` warning.
- The `LAN:` line in the startup banner is suppressed (there is no LAN
  surface in this mode).
- SW registration still works — fetches are relative and
  protocol-agnostic.
- `/sw-version.json`, `/unregister`, and all `/api/*` routes behave
  identically.

## Troubleshooting

If `npm run dev:sandbox` refuses to start with a "Refusing to start
plain HTTP on a non-loopback interface" error, you likely have
`GC_BIND_HOST` set in your shell to something other than `127.0.0.1`.
Unset it and re-run:

```powershell
# PowerShell
Remove-Item Env:GC_BIND_HOST
```
```bash
# bash / Git Bash
unset GC_BIND_HOST
```

The sandbox script sets `GC_BIND_HOST=127.0.0.1` explicitly, so this
shouldn't trigger in normal usage — but a pre-existing shell env var
can leak through inherited environments in some shells.

If port 3000 is already in use, kill the other dev server first.
`dev:sandbox` and `dev` can't share a port.
