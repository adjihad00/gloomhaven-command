import express, { Express } from 'express';
import { join } from 'path';

export function configureStaticRoutes(app: Express, rootDir: string): void {
  // CORS — allow all origins for LAN use
  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
  });

  // JSON body parser for import endpoint
  app.use(express.json({ limit: '10mb' }));

  // New Preact app — static files from app/
  app.use('/app', express.static(join(rootDir, 'app'), { maxAge: '1h', setHeaders: setHtmlNoCache }));

  // Preact app routes — serve index.html for each role
  app.get('/controller', (_req, res) => {
    res.sendFile(join(rootDir, 'app/controller/index.html'));
  });
  app.get('/phone', (_req, res) => {
    res.sendFile(join(rootDir, 'app/phone/index.html'));
  });
  app.get('/display', (_req, res) => {
    res.sendFile(join(rootDir, 'app/display/index.html'));
  });

  // Game assets — long cache
  app.use('/assets', express.static(join(rootDir, 'assets'), { maxAge: '1d' }));

  // Service worker — must be served with correct scope header
  app.get('/app/controller/sw.js', (req, res) => {
    res.setHeader('Service-Worker-Allowed', '/controller');
    res.sendFile(join(rootDir, 'app/controller/sw.js'));
  });

  // Default landing page
  app.get('/', (_req, res) => {
    res.redirect('/controller');
  });
}

function setHtmlNoCache(res: express.Response, path: string): void {
  if (path.endsWith('.html')) {
    res.setHeader('Cache-Control', 'no-cache');
  }
}
