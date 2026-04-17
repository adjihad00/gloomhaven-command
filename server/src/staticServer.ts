import express, { Express } from 'express';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';

/**
 * SW version used by both the /sw-version.json endpoint and the SW file
 * injection. Read per-request so `npm run dev` works regardless of whether
 * the server or the build.mjs --watch process started first: once the
 * build-time file exists, every subsequent request sees the real version
 * and client + server converge.
 *
 * A boot-time fallback string is computed once and only used when no file
 * and no env var are present — this prevents the fallback from drifting
 * between calls within a single server run.
 */
const BOOT_FALLBACK_VERSION = `srv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function resolveSwVersion(rootDir: string): string {
  if (process.env.GC_SW_VERSION) return process.env.GC_SW_VERSION;

  // Prefer the build-time version file (written by app/build.mjs).
  // This keeps client bundle + SW + server all aligned.
  for (const role of ['controller', 'phone', 'display']) {
    const path = join(rootDir, 'app', role, 'dist', 'build-version.txt');
    if (existsSync(path)) {
      try {
        const v = readFileSync(path, 'utf-8').trim();
        if (v) return v;
      } catch { /* ignore */ }
    }
  }

  // No file yet (server raced ahead of build.mjs --watch in dev) — use the
  // boot-time fallback so all requests within this server run are consistent.
  return BOOT_FALLBACK_VERSION;
}

export function configureStaticRoutes(app: Express, rootDir: string): void {
  // CORS — allow all origins for LAN use
  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
  });

  // JSON body parser for import endpoint
  app.use(express.json({ limit: '10mb' }));

  // ── Escape-hatch routes (must be registered before static middleware) ─────
  // These paths MUST never be intercepted by any service worker.

  console.log(`[server] SW_VERSION(initial)=${resolveSwVersion(rootDir)}`);

  const noStore = (res: express.Response): void => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  };

  // Version kill switch — clients poll this to detect stale installs.
  // Resolved per-request so `npm run dev` converges once build.mjs --watch
  // has written dist/build-version.txt (see resolveSwVersion for details).
  app.get('/sw-version.json', (_req, res) => {
    noStore(res);
    res.json({ version: resolveSwVersion(rootDir) });
  });

  // Self-contained reset page: unregisters SWs, deletes caches, clears storage
  app.get('/unregister', (_req, res) => {
    noStore(res);
    res.sendFile(join(rootDir, 'app', 'unregister.html'));
  });

  // Service workers — must be served BEFORE static middleware with correct scope header
  // Inject SW_VERSION at request time so the SW's CACHE_NAME and activate-time
  // version check line up with the server's current version.
  const serveSw = (role: 'controller' | 'phone' | 'display', scope: string) =>
    (_req: express.Request, res: express.Response): void => {
      // Prefer generated SW from dist/ (production) over source SW (dev)
      const distSw = join(rootDir, 'app', role, 'dist', 'sw.js');
      const srcSw = join(rootDir, 'app', role, 'sw.js');
      const swPath = existsSync(distSw) ? distSw : srcSw;
      if (!existsSync(swPath)) {
        res.status(404).end();
        return;
      }
      let body: string;
      try {
        body = readFileSync(swPath, 'utf-8');
      } catch (err) {
        console.error('[server] Failed to read SW file:', swPath, err);
        res.status(500).end();
        return;
      }
      const prefix = `self.GC_SW_VERSION_INJECTED=${JSON.stringify(resolveSwVersion(rootDir))};\n`;
      noStore(res);
      res.setHeader('Service-Worker-Allowed', scope);
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.send(prefix + body);
    };

  app.get('/app/controller/sw.js', serveSw('controller', '/controller'));
  app.get('/app/phone/sw.js', serveSw('phone', '/phone'));
  app.get('/app/display/sw.js', serveSw('display', '/display'));
  // Legacy direct-to-dist path retained for any installed clients pointing there
  app.get('/app/display/dist/sw.js', serveSw('display', '/display'));

  // New Preact app — static files from app/
  app.use('/app', express.static(join(rootDir, 'app'), { maxAge: '1h', setHeaders: setCacheHeaders }));

  // Preact app routes — prefer generated HTML from dist/ (production) over source (dev)
  app.get('/controller', (_req, res) => {
    const distHtml = join(rootDir, 'app/controller/dist/index.html');
    res.sendFile(existsSync(distHtml) ? distHtml : join(rootDir, 'app/controller/index.html'));
  });
  app.get('/phone', (_req, res) => {
    const distHtml = join(rootDir, 'app/phone/dist/index.html');
    res.sendFile(existsSync(distHtml) ? distHtml : join(rootDir, 'app/phone/index.html'));
  });
  app.get('/display', (_req, res) => {
    const distHtml = join(rootDir, 'app/display/dist/index.html');
    res.sendFile(existsSync(distHtml) ? distHtml : join(rootDir, 'app/display/index.html'));
  });

  // Game assets — long cache
  app.use('/assets', express.static(join(rootDir, 'assets'), { maxAge: '1d' }));

  // Fallback: serve .staging/worldhaven/images at /assets/worldhaven/images
  // (Worldhaven assets may not be copied to assets/ yet)
  const stagingWorldhaven = join(rootDir, '.staging/worldhaven/images');
  if (existsSync(stagingWorldhaven)) {
    app.use('/assets/worldhaven/images', express.static(stagingWorldhaven, { maxAge: '1d' }));
  }

  // Root CA download for mobile device trust (mkcert)
  app.get('/ca.pem', (_req, res) => {
    const caPath = join(rootDir, 'certs', 'rootCA.pem');
    if (existsSync(caPath)) {
      res.setHeader('Content-Type', 'application/x-pem-file');
      res.setHeader('Content-Disposition', 'attachment; filename="mkcert-rootCA.pem"');
      res.sendFile(caPath);
    } else {
      res.status(404).send('No CA certificate found');
    }
  });

  // Default landing page
  app.get('/', (_req, res) => {
    res.redirect('/controller');
  });
}

function setCacheHeaders(res: express.Response, path: string): void {
  if (path.endsWith('.html')) {
    res.setHeader('Cache-Control', 'no-cache');
  } else if (/main-[a-z0-9]+\.js$/i.test(path)) {
    // Content-hashed bundles are immutable — cache forever
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (path.endsWith('.css')) {
    // CSS is not content-hashed — always revalidate
    res.setHeader('Cache-Control', 'no-cache');
  }
}
