// Shared client-side service worker registration + watchdog.
//
// Ordering is deliberate:
//   1) Fetch /sw-version.json FIRST, before registering. If the server version
//      disagrees with the bundle's baked-in GC_BUILD_VERSION, the client is
//      running stale code — nuke caches + unregister SWs and hard-reload.
//   2) Only then register the SW. This avoids the classic
//      "stale SW resurrects stale bundle" loop.
//   3) Subscribe to `sw-self-destructed` postMessage so a server-triggered
//      version bump takes effect within a single page load on every tab.
//   4) Poll reg.update() every 5 minutes so long-lived tabs pick up new
//      versions without user interaction.
//
// esbuild replaces `process.env.GC_BUILD_VERSION` via `define` at build time.
declare const process: { env: { GC_BUILD_VERSION: string } };

const CLIENT_VERSION: string =
  (typeof process !== 'undefined' && process.env && process.env.GC_BUILD_VERSION) || '';

export interface SwRegistrationOptions {
  /** Absolute path to the SW file, e.g. '/app/phone/sw.js' */
  swPath: string;
  /** Scope, e.g. '/phone'. Matches the server's Service-Worker-Allowed header. */
  scope?: string;
}

async function resetAllCaches(): Promise<void> {
  try {
    if ('caches' in self) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch { /* ignore */ }
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch { /* ignore */ }
}

export async function registerServiceWorker(opts: SwRegistrationOptions): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  // Step 1: version check BEFORE registering.
  try {
    const res = await fetch('/sw-version.json', { cache: 'no-store' });
    if (res.ok) {
      const body = await res.json();
      const serverVersion: string | undefined = body && body.version;
      if (serverVersion && CLIENT_VERSION && serverVersion !== CLIENT_VERSION) {
        console.warn('[sw-registration] Client version mismatch — resetting',
          { client: CLIENT_VERSION, server: serverVersion });
        await resetAllCaches();
        // Reload will bring down the new HTML referencing the new bundle.
        location.reload();
        return;
      }
    }
  } catch (err) {
    console.warn('[sw-registration] Version check failed (offline?)', err);
  }

  // Step 2: register.
  let reg: ServiceWorkerRegistration;
  try {
    reg = await navigator.serviceWorker.register(opts.swPath, {
      scope: opts.scope,
      updateViaCache: 'none',
    });
  } catch (err) {
    console.warn('[sw-registration] Registration failed', err);
    return;
  }

  // Step 3: listen for SW-initiated self-destruct.
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event && event.data && event.data.type === 'sw-self-destructed') {
      console.warn('[sw-registration] SW self-destructed; reloading');
      location.reload();
    }
  });

  // Step 4: periodic update check while the tab is foregrounded.
  setInterval(() => { reg.update().catch(() => {}); }, 5 * 60 * 1000);
}
