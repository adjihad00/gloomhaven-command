# Fix `dev:sandbox` Windows `spawn EINVAL` (Claude Code Prompt)

## Context

Just-landed commit added `scripts/dev-sandbox.mjs` which spawns `npm run dev` after setting `GC_DEV_HTTP=1` + `GC_BIND_HOST=127.0.0.1`. On Kyle's Windows + Node 24 dev environment, `npm run dev:sandbox` throws:

```
Error: spawn EINVAL
    at ChildProcess.spawn (node:internal/child_process:421:11)
```

Root cause: Node.js on Windows hardened `child_process.spawn` (roughly Node 18+ with stricter enforcement in Node 20/22/24) to reject `.cmd` / `.bat` shim files unless `shell: true` is passed or the full cmd.exe invocation is constructed manually. The current wrapper uses `shell: false` with `npm.cmd`, which works in some Windows configurations but fails on Kyle's Node 24.

## The Fix

Change `shell: false` → `shell: true` in `scripts/dev-sandbox.mjs`. That's it. Plus a very small comment update explaining why.

Why `shell: true` is safe here:
- All arguments are hard-coded string literals in the script itself.
- No user input, no env var interpolation into args, no file paths that could contain metacharacters.
- There is literally no shell injection surface.

## Scope

**In scope:**
- `scripts/dev-sandbox.mjs`: change `shell: false` to `shell: true`, update the inline comment, remove the `npm.cmd` branching (with `shell: true`, plain `npm` resolves correctly on both platforms).

**Out of scope:**
- Any other changes. This is a one-liner.

## Step 1 — Edit

In `scripts/dev-sandbox.mjs`, replace the spawn block:

**Before:**
```js
// Use `npm.cmd` on Windows; `npm` elsewhere. The shell: true fallback would
// also work but passing the explicit binary name is more robust to PATH quirks.
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const child = spawn(npmCmd, ['run', 'dev'], {
  env,
  stdio: 'inherit',
  shell: false,
});
```

**After:**
```js
// Use `shell: true` so cmd.exe resolves the `npm` shim on Windows (Node 24
// rejects direct spawn of .cmd files with EINVAL). Safe here: the entire
// command is a fixed string literal with no interpolated user input, so
// there is no shell injection surface.
const child = spawn('npm', ['run', 'dev'], {
  env,
  stdio: 'inherit',
  shell: true,
});
```

## Step 2 — Verify

- `npm run dev:sandbox` starts cleanly on Kyle's Windows + Node 24 host.
- Console shows the existing `⚠ GC_DEV_HTTP` warning.
- Server binds to `http://127.0.0.1:3000` (or whatever PORT).
- `curl http://127.0.0.1:3000/api/health` returns OK.
- Ctrl-C cleanly shuts down the child process (signal forwarding still works because `child.kill(sig)` continues to behave regardless of shell mode).
- Regression check on Linux/macOS: not strictly needed since this change only affects how npm is resolved, but if convenient, confirm the wrapper still works there too (e.g. in the Claude Code sandbox where this prompt might run). `shell: true` is cross-platform safe.

## Step 3 — Docs

No doc changes. The behavior is identical from the user's perspective — same command, same warnings, same loopback binding.

## Step 4 — No commit until verified

Kyle runs `npm run dev:sandbox` in PowerShell after the change. If it starts cleanly and he can hit http://127.0.0.1:{PORT}/phone from a browser, commit.

## Commit Message

```
fix(dev:sandbox): use shell:true on spawn to handle npm.cmd on Windows Node 24

Node 24's hardened child_process.spawn rejects direct invocation of .cmd
shim files with EINVAL, even when the explicit .cmd name is passed.
Switching to shell: true lets cmd.exe resolve the npm shim correctly on
Windows while remaining a no-op on POSIX.

Safe because the entire spawn argument set is a fixed string literal —
no interpolated user input, no shell injection surface.

Regressed: scripts/dev-sandbox.mjs (1 line change + comment update).
```

## Notes to Claude Code

1. **Just fix it and verify** — this is a one-line change, no Plan needed, no scope debate.
2. **Do not add cross-env** or other dev deps. The `shell: true` flip is the right minimal fix.
3. **Do not remove the signal forwarding** (`SIGINT` / `SIGTERM` handlers) — that part was correct and is needed for clean Ctrl-C.
4. **Do not commit until Kyle confirms** the sandbox launches and serves HTTP on 127.0.0.1.
