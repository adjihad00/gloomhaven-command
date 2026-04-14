import express, { Express } from 'express';
import { join } from 'path';
import { existsSync } from 'fs';

export function configureStaticRoutes(app: Express, rootDir: string): void {
  // CORS — allow all origins for LAN use
  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
  });

  // JSON body parser for import endpoint
  app.use(express.json({ limit: '10mb' }));

  // Service workers — must be served BEFORE static middleware with correct scope header
  // Prefer generated SW from dist/ (production) over source SW (dev)
  app.get('/app/controller/sw.js', (_req, res) => {
    res.setHeader('Service-Worker-Allowed', '/controller');
    res.setHeader('Cache-Control', 'no-cache');
    const distSw = join(rootDir, 'app/controller/dist/sw.js');
    res.sendFile(existsSync(distSw) ? distSw : join(rootDir, 'app/controller/sw.js'));
  });
  app.get('/app/phone/sw.js', (_req, res) => {
    res.setHeader('Service-Worker-Allowed', '/phone');
    res.setHeader('Cache-Control', 'no-cache');
    const distSw = join(rootDir, 'app/phone/dist/sw.js');
    res.sendFile(existsSync(distSw) ? distSw : join(rootDir, 'app/phone/sw.js'));
  });

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
  }
}
