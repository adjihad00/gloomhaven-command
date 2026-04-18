#!/usr/bin/env node
// Dev sandbox launcher: starts the dev server in HTTP-on-loopback mode for
// sandboxed preview browsers (Claude Code, headless Chromium) that can't
// verify local-CA / Certbot certs. Delegates to `npm run dev` after setting
// GC_DEV_HTTP=1 + GC_BIND_HOST=127.0.0.1. Cross-platform — no cross-env dep.
//
// See docs/DEV_PREVIEW.md. NEVER use for LAN or playtest.

import { spawn } from 'node:child_process';

const env = {
  ...process.env,
  GC_DEV_HTTP: '1',
  GC_BIND_HOST: '127.0.0.1',
};

// Use `npm.cmd` on Windows; `npm` elsewhere. The shell: true fallback would
// also work but passing the explicit binary name is more robust to PATH quirks.
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const child = spawn(npmCmd, ['run', 'dev'], {
  env,
  stdio: 'inherit',
  shell: false,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

// Forward termination signals so Ctrl-C propagates to the child.
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    if (!child.killed) child.kill(sig);
  });
}
