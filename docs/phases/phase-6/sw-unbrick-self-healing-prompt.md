# Service Worker Unbrick + Self-Healing Fix (Claude Code Prompt)

## The Problem

Current service workers at `app/phone/sw.js` and `app/controller/sw.js` use
**cache-first** for every non-/api/ non-/assets/ GET. A device that cached
the old-cert-origin app shell will never hit the network to discover a new
version — the SW intercepts every navigation and serves the stale HTML.
There is no kill switch and no way for the SW to notice it's wrong.

Kyle currently has iPads/iPhones/Androids in this state after a cert swap.
"Delete Website Data → wait → reboot" sometimes works, sometimes doesn't
(Safari holds SW state per-app-group and per-home-screen-PWA separately,
and the cache-first logic resurrects the SW on each load). This is not
sustainable for friends who visit the house to play.

## The Fix — Two Parts

### Part 1: Unbrick currently-stuck devices

Serve a static `/unregister` page (plain HTML, no build step, inline
JavaScript) that tears down all service workers and caches for the
origin, then reloads the main page. Any stuck device navigates to
`https://[server]/unregister` once and self-heals.

### Part 2: Self-healing service workers

Rewrite both SWs to make it **structurally impossible** for a device to
get permanently stuck again:

1. **Network-first for navigations and the SW file itself** — stale HTML
   is never served when the network is reachable.
2. **Version kill switch** — a `/sw-version.json` served by Express.
   The SW checks it on `activate` and on every navigation response; on
   mismatch it unregisters itself and nukes its caches.
3. **Client-side version check** — the app's main.js, on boot, fetches
   `/sw-version.json` and compares against a build-baked constant.
   Mismatch → force-unregister + reload.

Worst case after this ships: one page load may still serve stale, but
the next load always recovers.

---

## Files to Change

```
app/phone/sw.js                      — rewrite
app/controller/sw.js                 — rewrite
app/build.mjs                        — inject SW_VERSION constant at build
server/src/staticServer.ts (or index.ts) — add /unregister route + /sw-version.json
app/phone/unregister.html            — new (or colocated at app/unregister.html)
app/shared/swRegistration.ts         — new, shared client-side register+watchdog
app/phone/main.tsx                   — call swRegistration
app/controller/main.tsx              — call swRegistration
app/display/main.tsx                 — call swRegistration (display doesn't have an SW currently — check first; if it does, include it in the SW version check)
```

Check whether the display client has an SW before making changes there:

```bash
ls app/display/sw.js 2>/dev/null || echo "no display SW"
```

If no display SW exists, skip SW changes for it but still add the client
watchdog so the display auto-recovers from any future SW addition.

---

## Step 1 — The unregister page

Create `app/unregister.html`. This is a single self-contained file, no
build step, no dependencies. It must be served from a path the SW does
not intercept (the fetch handler's early-return list). Express route
added in Step 3.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Cache-Control" content="no-store, no-cache, must-revalidate">
<meta http-equiv="Pragma" content="no-cache">
<meta http-equiv="Expires" content="0">
<title>Reset Gloomhaven Command</title>
<style>
  html, body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #1a1612; color: #e8d9b8; min-height: 100vh; }
  main { max-width: 540px; margin: 0 auto; padding: 48px 24px; text-align: center; }
  h1 { font-size: 28px; font-weight: 500; margin: 0 0 16px; color: #d3a663; }
  p { line-height: 1.5; margin: 12px 0; font-size: 16px; }
  .status { margin: 32px 0; padding: 20px; border: 1px solid #3d2f20; border-radius: 8px; background: #20180f; font-family: ui-monospace, SFMono-Regular, monospace; font-size: 14px; text-align: left; white-space: pre-wrap; min-height: 120px; }
  .ok { color: #7fb069; }
  .err { color: #d88373; }
  .busy { color: #d3a663; }
  a.home { display: inline-block; margin-top: 16px; padding: 12px 24px; background: #d3a663; color: #1a1612; text-decoration: none; border-radius: 6px; font-weight: 500; }
  a.home[aria-disabled="true"] { opacity: 0.4; pointer-events: none; }
</style>
</head>
<body>
<main>
<h1>Reset App State</h1>
<p>This will clear cached files and service workers so your device can load the latest version of Gloomhaven Command.</p>
<p>It's safe to run even if things look fine.</p>
<div class="status" id="log" aria-live="polite">Starting…</div>
<a class="home" id="home" href="/" aria-disabled="true">Return to app</a>
</main>
<script>
(function () {
  var log = document.getElementById('log');
  var home = document.getElementById('home');
  var lines = [];
  function write(msg, cls) {
    var span = document.createElement('span');
    span.className = cls || '';
    span.textContent = msg + '\n';
    log.appendChild(span);
  }
  async function run() {
    try {
      write('Step 1: Unregister service workers', 'busy');
      if ('serviceWorker' in navigator) {
        var regs = await navigator.serviceWorker.getRegistrations();
        if (regs.length === 0) {
          write('  No service workers registered.', 'ok');
        } else {
          for (var i = 0; i < regs.length; i++) {
            var scope = regs[i].scope;
            var ok = await regs[i].unregister();
            write('  ' + (ok ? 'Unregistered' : 'Failed to unregister') + ' ' + scope, ok ? 'ok' : 'err');
          }
        }
      } else {
        write('  serviceWorker API not available (OK).', 'ok');
      }

      write('\nStep 2: Delete caches', 'busy');
      if ('caches' in self) {
        var keys = await caches.keys();
        if (keys.length === 0) {
          write('  No caches to delete.', 'ok');
        } else {
          for (var j = 0; j < keys.length; j++) {
            var ok2 = await caches.delete(keys[j]);
            write('  ' + (ok2 ? 'Deleted' : 'Failed to delete') + ' cache: ' + keys[j], ok2 ? 'ok' : 'err');
          }
        }
      } else {
        write('  Caches API not available (OK).', 'ok');
      }

      write('\nStep 3: Clear local & session storage', 'busy');
      try { localStorage.clear(); write('  localStorage cleared.', 'ok'); }
      catch (e) { write('  localStorage unavailable: ' + e.message, 'err'); }
      try { sessionStorage.clear(); write('  sessionStorage cleared.', 'ok'); }
      catch (e) { write('  sessionStorage unavailable: ' + e.message, 'err'); }

      write('\n✓ Reset complete. You can close this tab.', 'ok');
      write('Tap "Return to app" below to reload the app fresh.', 'ok');
      home.setAttribute('aria-disabled', 'false');
      home.focus();
    } catch (err) {
      write('\nERROR: ' + (err && err.message ? err.message : String(err)), 'err');
      write('Please force-quit the browser and delete site data manually.', 'err');
    }
  }
  run();
})();
</script>
</body>
</html>
```

Key design points:

- **No-store cache headers** so intermediate proxies/CDNs never serve a
  stale copy.
- Self-contained: no external CSS/JS, so it renders even if every cache
  is broken.
- Async/await pattern with per-step logging so a partial failure is
  visible to the user.
- Clears caches, service workers, localStorage, sessionStorage — the
  full client side.
- Home link starts disabled, enables on completion.

---

## Step 2 — Version endpoint + unregister route

In `server/src/staticServer.ts` (check path — may be `server/src/index.ts`;
grep for `app.get` and `sendFile`):

```ts
// Unique per server start — every build bumps it, every restart bumps it.
// Clients compare against this; mismatch triggers SW nuke.
const SW_VERSION = process.env.GC_SW_VERSION
  || `${process.env.GC_BUILD_ID || Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

app.get('/sw-version.json', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.set('Pragma', 'no-cache');
  res.json({ version: SW_VERSION });
});

// Serve unregister page with no-cache headers
app.get('/unregister', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.set('Pragma', 'no-cache');
  res.sendFile(path.resolve(__dirname, '../../app/unregister.html'));
});

// Also serve sw.js with no-cache headers so browsers always fetch fresh
app.get(['/phone/sw.js', '/controller/sw.js', '/display/sw.js'], (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.set('Service-Worker-Allowed', '/');
  next();
});
```

The `next()` approach lets the existing static middleware actually serve
the file; the cache-control headers get set first.

Log the SW_VERSION on startup:

```ts
console.log(`[server] SW_VERSION=${SW_VERSION}`);
```

---

## Step 3 — Build-time version injection

In `app/build.mjs`, bake a matching version constant into each client
bundle so the client-side check has something to compare against.

Find the build config object that runs esbuild. Add:

```js
const BUILD_VERSION = process.env.GC_BUILD_ID
  || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// Pass to every esbuild call as a define
define: {
  'process.env.GC_BUILD_VERSION': JSON.stringify(BUILD_VERSION),
},
```

(Check existing `define` entries before merging — don't overwrite.)

Export the version to stdout so the server start script can read it:

```js
console.log(`GC_BUILD_VERSION=${BUILD_VERSION}`);
```

Update your start script (or `npm run dev`) to propagate:

```bash
GC_BUILD_ID=$(date +%s) npm run build && GC_SW_VERSION=$GC_BUILD_ID node dist/server/index.js
```

(Adjust to whatever your current startup looks like. If `package.json`
scripts are the source of truth, edit there.)

Alternative if env-piping is too fragile: **write the version to a file**
during build (`dist/build-version.txt`), and the server reads it on
startup via `fs.readFileSync`. More reliable across dev and prod.

---

## Step 4 — Rewrite the service workers

Both `app/phone/sw.js` and `app/controller/sw.js` get the same treatment.
Here's the phone version; mirror for controller (swap CACHE_NAME and
APP_SHELL paths).

```js
// GC_SW_VERSION is injected by the build; falls back to Date-based string
// if someone runs the SW file directly without the build step (dev edge case).
const SW_VERSION = self.GC_SW_VERSION_INJECTED || 'dev-' + Date.now();
const CACHE_NAME = 'gc-phone-' + SW_VERSION;

const APP_SHELL = [
  '/phone',
  '/app/shared/styles/theme.css',
  '/app/shared/styles/typography.css',
  '/app/shared/styles/components.css',
  '/app/shared/styles/connection.css',
  '/app/phone/styles/phone.css',
  '/app/phone/dist/main.js',
];

// Paths the SW must never intercept
const BYPASS_PATHS = ['/api/', '/assets/', '/sw-version.json', '/unregister', '/sw.js'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
      .catch((err) => {
        console.error('[sw] Install failed, continuing anyway:', err);
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Delete every cache whose name doesn't match the current version
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
    await self.clients.claim();

    // Verify we're still the current version on the server
    try {
      const res = await fetch('/sw-version.json', { cache: 'no-store' });
      if (res.ok) {
        const { version } = await res.json();
        if (version && version !== SW_VERSION) {
          console.warn('[sw] Version mismatch; self-destructing.',
                       { sw: SW_VERSION, server: version });
          await selfDestruct();
        }
      }
    } catch (_) { /* network down; don't self-destruct */ }
  })());
});

async function selfDestruct() {
  const keys = await caches.keys();
  await Promise.all(keys.map((k) => caches.delete(k)));
  const registration = await self.registration;
  await registration.unregister();
  // Notify all clients to reload
  const clients = await self.clients.matchAll();
  for (const client of clients) {
    try { client.postMessage({ type: 'sw-self-destructed' }); } catch (_) {}
  }
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept these paths
  if (BYPASS_PATHS.some((p) => url.pathname.startsWith(p))) {
    return;
  }

  // Navigation requests (HTML documents): network-first, cache fallback
  if (event.request.mode === 'navigate'
      || (event.request.method === 'GET'
          && event.request.headers.get('accept')?.includes('text/html'))) {
    event.respondWith(
      fetch(event.request).then((response) => {
        // Cache a copy for offline fallback
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() =>
        caches.match(event.request).then((cached) => cached || caches.match('/phone'))
      )
    );
    return;
  }

  // Static assets: network-first, cache fallback (was cache-first — that was the bug)
  event.respondWith(
    fetch(event.request).then((response) => {
      if (event.request.method === 'GET' && response.status === 200) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => caches.match(event.request))
  );
});
```

Key differences from the original:

- `CACHE_NAME` includes `SW_VERSION` so a new build automatically uses a
  new cache. No manual `v4→v5` bump.
- `BYPASS_PATHS` includes `/sw-version.json`, `/unregister`, `/sw.js` —
  the critical escape hatches are never intercepted.
- **Network-first for everything** — the original bug is gone. Offline
  use still works via cache fallback.
- `activate` does a version check against the server and self-destructs
  on mismatch. Belt-and-suspenders with the client-side check.
- `selfDestruct()` tells all pages to reload via `postMessage`.

---

## Step 5 — Inject SW_VERSION into sw.js at build time

Since `sw.js` isn't processed by esbuild in the current setup (it's
served as-is from `app/phone/sw.js`), inject the version a different way.

Two options, pick one:

**Option A (simpler): serve sw.js through an Express handler that
substitutes the version string.**

```ts
// server/src/staticServer.ts
app.get(['/phone/sw.js', '/controller/sw.js'], (req, res) => {
  const file = req.path.includes('/phone/') ? 'app/phone/sw.js' : 'app/controller/sw.js';
  const src = fs.readFileSync(path.resolve(__dirname, '../../', file), 'utf-8');
  const injected = `self.GC_SW_VERSION_INJECTED = ${JSON.stringify(SW_VERSION)};\n` + src;
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.set('Content-Type', 'application/javascript');
  res.set('Service-Worker-Allowed', '/');
  res.send(injected);
});
```

**Option B (build-time): add a step to `app/build.mjs` that reads sw.js,
prepends the version line, and writes to `dist/phone/sw.js`.**

Option A is simpler and works the same in dev as in prod. Prefer A
unless there's a static-hosting constraint.

---

## Step 6 — Client-side watchdog

New file `app/shared/swRegistration.ts`:

```ts
// Injected by esbuild `define`
declare const process: { env: { GC_BUILD_VERSION: string } };

const CLIENT_VERSION = process.env.GC_BUILD_VERSION;

export interface SwRegistrationOptions {
  /** Path to the SW file, e.g. '/phone/sw.js' */
  swPath: string;
  /** Scope, typically the app root like '/phone' or '/' */
  scope?: string;
}

export async function registerServiceWorker(opts: SwRegistrationOptions): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  // Step 1: version check BEFORE registering the SW.
  // If the server version doesn't match the bundle's baked-in version,
  // the user is running a stale page. Force a hard reload.
  try {
    const res = await fetch('/sw-version.json', { cache: 'no-store' });
    if (res.ok) {
      const { version } = await res.json();
      if (version && CLIENT_VERSION && version !== CLIENT_VERSION) {
        console.warn('[sw-registration] Client version mismatch; resetting.',
                     { client: CLIENT_VERSION, server: version });
        await resetAllCaches();
        // Full reload — the new HTML will bring down the new JS.
        location.reload();
        return;
      }
    }
  } catch (err) {
    console.warn('[sw-registration] Version check failed (offline?):', err);
  }

  // Step 2: register SW.
  try {
    const reg = await navigator.serviceWorker.register(opts.swPath, {
      scope: opts.scope || '/',
      updateViaCache: 'none', // browser always fetches sw.js fresh
    });

    // Step 3: subscribe to self-destruct messages.
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'sw-self-destructed') {
        console.warn('[sw-registration] SW self-destructed; reloading.');
        location.reload();
      }
    });

    // Step 4: check for updates periodically (every 5 min while tab is foreground).
    setInterval(() => { reg.update().catch(() => {}); }, 5 * 60 * 1000);
  } catch (err) {
    console.error('[sw-registration] Registration failed:', err);
  }
}

async function resetAllCaches(): Promise<void> {
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  } catch (_) { /* ignore */ }
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  } catch (_) { /* ignore */ }
}
```

Then in each client entry point:

```ts
// app/phone/main.tsx (and controller/main.tsx, display/main.tsx)
import { registerServiceWorker } from '../shared/swRegistration';

// After Preact app is mounted, kick off SW registration
registerServiceWorker({ swPath: '/phone/sw.js', scope: '/phone/' });
```

Display client: if it has no sw.js today, still call the version check
part (skip the register) so it self-heals if a future batch adds one.
Easiest: always call `registerServiceWorker`, and if `swPath` points at
a non-existent file, the `register` call just logs an error and moves on.

---

## Step 7 — Docs + PWA manifest

If the phone or controller has a `manifest.webmanifest` (check under
`app/phone/` and `app/controller/`), ensure `start_url` points to the
normal app path (e.g. `/phone`), not to a cached path. An installed PWA
that starts at a stale URL is another vector for getting stuck.

Update `docs/BUGFIX_LOG.md` with a detailed post-mortem — this was a
high-impact bug that affected multiple devices and is worth capturing.

Update `docs/DESIGN_DECISIONS.md` with an entry explaining the
network-first + kill-switch architecture and why cache-first was
inappropriate for this app (we're not offline-first; we're LAN-first,
and a dead SW is far worse than a slow first load).

---

## Verification Checklist

### Unbrick (Part 1)

- [ ] Navigate a currently-stuck iPad to `https://[server]/unregister` in
      regular-mode Safari. Page loads.
- [ ] Page shows: "Unregistered", "Deleted cache", "localStorage cleared".
- [ ] Tap "Return to app" → app loads fresh in regular mode.
- [ ] Repeat on iPhone, Android phone, and any other stuck device.
- [ ] PWA home-screen icon: after visiting /unregister in Safari, delete
      the home-screen icon and re-add. Confirm it opens the current
      version.

### Self-healing (Part 2) — simulated stale state

- [ ] Load phone app. Confirm SW registers (DevTools → Application → SW).
- [ ] Note current `SW_VERSION` in server logs.
- [ ] Restart server with no changes → new SW_VERSION is generated.
- [ ] Reload the phone page. Observe `[sw-registration] Client version
      mismatch; resetting.` in console, full reload, app loads clean.

### Self-healing — real deploy

- [ ] Make a trivial UI change. `npm run build` + restart.
- [ ] Existing phone (connected before the rebuild) gets served the new
      version on next navigation, or auto-reloads within 5 minutes.

### Regressions

- [ ] Offline mode still works for at least one load (cache fallback on
      network-first fetches).
- [ ] WebSocket connection establishment unchanged.
- [ ] /api/* requests never touched by the SW.
- [ ] /assets/* requests never touched by the SW.
- [ ] `npm run build` succeeds.
- [ ] `tsc --noEmit` clean.

### Documentation

- [ ] `docs/BUGFIX_LOG.md` entry describing the stuck-SW bug, the cert
      trigger, the network-first + kill-switch fix, and the /unregister
      page.
- [ ] `docs/DESIGN_DECISIONS.md` entry on SW strategy.
- [ ] `docs/PROJECT_CONTEXT.md` "Commands" section doesn't need changes
      but check "Build Process" — mention GC_BUILD_VERSION.
- [ ] `README` or `docs/HTTPS_LAN_SETUP.md` — add a "If devices can't
      load the app" section pointing at /unregister.

---

## Commit Message

```
fix(sw): self-healing service workers + unbrick endpoint

Rewrites phone and controller SWs from cache-first to network-first,
adds build-bound version stamping, a server /sw-version.json endpoint,
and a client-side watchdog that force-resets stale installations.
New /unregister page tears down any SW + caches + storage in one tap
for currently-stuck devices.

Root cause: cache-first fetch handler + stale cache after cert origin
change meant devices never re-fetched the app shell, creating
permanently-stuck PWAs that couldn't be cleared without deleting all
Safari website data and rebooting.

Changes:
- app/phone/sw.js, app/controller/sw.js: network-first; cache name now
  version-keyed; activate hook compares version with server and
  self-destructs on mismatch; explicit bypass list for /sw-version.json,
  /unregister, /sw.js so escape hatches always work.
- app/unregister.html: self-contained reset page — clears SWs, caches,
  localStorage, sessionStorage. No-cache headers server-side.
- app/shared/swRegistration.ts: shared registration + client-side
  version watchdog. Pre-register version check forces location.reload
  on mismatch. updateViaCache: 'none'.
- server: /sw-version.json and /unregister routes with no-cache headers.
  Serves /phone/sw.js and /controller/sw.js with version injection at
  request time.
- app/build.mjs: GC_BUILD_VERSION injected into client bundles via
  esbuild define.
- Clients: registerServiceWorker called from each main.tsx.

Devices now self-heal within one page load of any server restart or
rebuild. No more "delete website data and pray."

Docs updated in BUGFIX_LOG, DESIGN_DECISIONS, HTTPS_LAN_SETUP.
```

---

## Notes to Claude Code

- Produce a Plan first and wait for confirmation before changing files.
- The order that matters: server routes first (so `/unregister` exists),
  then swRegistration + main.tsx changes (so new clients self-heal),
  then SW rewrites (so new installs use the new model). Unregister page
  can land in parallel with any of the above.
- Test locally with two browser tabs: one on old SW, one on new, and
  confirm the version mismatch triggers reset on the old.
- Keep CACHE_NAME version-keyed forever — no more manual `v4→v5`.
- Watch out for the existing `gc-phone-v4` cache in the wild — the
  activate hook's "delete all non-matching cache names" handles that
  cleanly as long as the new SW actually activates (which the client
  watchdog guarantees).
- Scope pitfall: `navigator.serviceWorker.register('/phone/sw.js', { scope: '/phone/' })`.
  If existing code registers with `scope: '/'`, that's broader than needed
  and may be why the SW intercepts /unregister unless bypassed. Check
  current registration scope before copying it verbatim.
- If Cloudflare is in front of the server (see `Cloudflare-token.txt` in
  project), ensure `/sw-version.json` and `/unregister` bypass its edge
  cache. Set `Cache-Control: no-store` as done above; if Cloudflare
  respects that it's fine, otherwise add a page rule.
