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

// Use `shell: true` so cmd.exe resolves the `npm` shim on Windows (Node 24
// rejects direct spawn of .cmd files with EINVAL). Safe here: the entire
// command is a fixed string literal with no interpolated user input, so
// there is no shell injection surface.
const child = spawn('npm', ['run', 'dev'], {
  env,
  stdio: 'inherit',
  shell: true,
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
