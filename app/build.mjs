import * as esbuild from 'esbuild';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync, readdirSync, unlinkSync, mkdirSync, existsSync } from 'fs';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes('--watch');

const sharedConfig = {
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2022'],
  sourcemap: true,
  minify: !watch,
  jsx: 'automatic',
  jsxImportSource: 'preact',
  loader: { '.ts': 'ts', '.tsx': 'tsx' },
  alias: {
    'react': 'preact/compat',
    'react-dom': 'preact/compat',
    '@gloomhaven-command/shared': resolve(__dirname, '../packages/shared/src/index.ts'),
  },
  logLevel: 'info',
};

const entryPoints = [
  { name: 'controller', entry: 'controller/main.tsx' },
  { name: 'phone',      entry: 'phone/main.tsx' },
  { name: 'display',    entry: 'display/main.tsx' },
];

// CSS files included in service worker precache per role (roles with SWs only)
const SW_CSS = {
  controller: [
    '/app/shared/styles/theme.css',
    '/app/shared/styles/typography.css',
    '/app/shared/styles/components.css',
    '/app/shared/styles/connection.css',
    '/app/controller/styles/controller.css',
  ],
  phone: [
    '/app/shared/styles/theme.css',
    '/app/shared/styles/typography.css',
    '/app/shared/styles/components.css',
    '/app/shared/styles/connection.css',
    '/app/phone/styles/phone.css',
  ],
  display: [
    '/app/shared/styles/theme.css',
    '/app/shared/styles/typography.css',
    '/app/shared/styles/components.css',
    '/app/shared/styles/connection.css',
    '/app/display/styles/display.css',
  ],
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function hashFileContents(filePaths) {
  const h = createHash('sha256');
  for (const fp of filePaths) h.update(readFileSync(fp));
  return h.digest('hex').slice(0, 10);
}

function cleanDist(distDir) {
  if (!existsSync(distDir)) return;
  for (const f of readdirSync(distDir)) {
    if (/^main.*\.(js|js\.map)$/.test(f) || f === 'index.html' || f === 'sw.js') {
      unlinkSync(resolve(distDir, f));
    }
  }
}

function generateHtml(role, hashedJsFilename) {
  const src = readFileSync(resolve(__dirname, role, 'index.html'), 'utf-8');
  return src.replace(
    `src="/app/${role}/dist/main.js"`,
    `src="/app/${role}/dist/${hashedJsFilename}"`,
  );
}

function generateSw(role, hashedJsFilename, cacheName) {
  const cssUrls = SW_CSS[role];
  if (!cssUrls) return null;

  const urls = [
    `'/${role}'`,
    ...cssUrls.map(u => `'${u}'`),
    `'/app/${role}/dist/${hashedJsFilename}'`,
  ];

  return `const CACHE_NAME = '${cacheName}';
const APP_SHELL = [
  ${urls.join(',\n  ')},
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache WebSocket, API calls, or asset data
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/assets/')) {
    return;
  }

  // Navigation requests: network-first (fresh HTML references new hashes)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for app shell assets (hashed filenames guarantee uniqueness)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        if (event.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
`;
}

// ── Build ────────────────────────────────────────────────────────────────────

async function build() {
  for (const ep of entryPoints) {
    const distDir = resolve(__dirname, ep.name, 'dist');
    mkdirSync(distDir, { recursive: true });

    if (watch) {
      // Dev mode: plain filenames, source HTML/SW used as-is
      const ctx = await esbuild.context({
        ...sharedConfig,
        entryPoints: [resolve(__dirname, ep.entry)],
        outfile: resolve(distDir, 'main.js'),
      });
      await ctx.watch();
      console.log(`Watching ${ep.name}...`);
    } else {
      // Production: content-hashed filenames + generated HTML/SW
      cleanDist(distDir);

      const result = await esbuild.build({
        ...sharedConfig,
        entryPoints: [resolve(__dirname, ep.entry)],
        outdir: distDir,
        entryNames: '[name]-[hash]',
        metafile: true,
      });

      // Extract hashed filename from metafile
      const jsOutput = Object.keys(result.metafile.outputs)
        .find(o => o.endsWith('.js') && !o.endsWith('.js.map'));
      const hashedFilename = basename(jsOutput);
      console.log(`Built ${ep.name} → ${hashedFilename}`);

      // Generate dist/index.html with hashed script reference
      writeFileSync(resolve(distDir, 'index.html'), generateHtml(ep.name, hashedFilename));
      console.log(`  Generated ${ep.name}/dist/index.html`);

      // Generate dist/sw.js with baked-in precache list (if role has a SW)
      if (SW_CSS[ep.name]) {
        const cssFiles = SW_CSS[ep.name].map(u => resolve(__dirname, u.replace(/^\/app\//, '')));
        const contentHash = hashFileContents([...cssFiles, resolve(distDir, hashedFilename)]);
        const cacheName = `gc-${ep.name}-${contentHash}`;

        writeFileSync(resolve(distDir, 'sw.js'), generateSw(ep.name, hashedFilename, cacheName));
        console.log(`  Generated ${ep.name}/dist/sw.js (cache: ${cacheName})`);
      }
    }
  }
}

build().catch(err => { console.error(err); process.exit(1); });
