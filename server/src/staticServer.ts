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

  // Client apps — HTML with no-cache, JS/CSS with 1-hour cache
  const clientOptions = { maxAge: '1h', setHeaders: setHtmlNoCache };

  app.use('/display', express.static(join(rootDir, 'clients/display'), clientOptions));
  app.use('/controller', express.static(join(rootDir, 'clients/controller'), clientOptions));
  app.use('/phone', express.static(join(rootDir, 'clients/phone'), clientOptions));

  // Shared styles
  app.use('/shared/styles', express.static(join(rootDir, 'clients/shared/styles'), { maxAge: '1h' }));

  // Game assets — long cache
  app.use('/assets', express.static(join(rootDir, 'assets'), { maxAge: '1d' }));

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
