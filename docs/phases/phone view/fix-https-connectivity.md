# CRITICAL: Diagnose & Fix HTTPS + Connectivity Regression

## Symptom

After Batch 16 (lobby mode + edition changes), the app is broken for all non-localhost access:

| Access Method | Result |
|---|---|
| `https://localhost:3000` (dev PC) | ✅ Works |
| `https://game.gh-command.com:3000` (Chrome PC) | ❌ Page won't load at all |
| `https://game.gh-command.com:3000` (phone browser) | ⚠️ Page loads but WebSocket connection fails |
| `https://192.168.50.96:3000` (LAN direct) | ❌ Other devices can't navigate here |

**This worked before Batch 16.** The HTTPS infrastructure (Let's Encrypt certs, Cloudflare DNS, router local DNS override) was set up in an earlier batch and was functional.

The change that likely triggered this: removing GH as the default edition. But the connectivity issue could be caused by any of the Batch 16 changes.

## DO NOT GUESS. DIAGNOSE SYSTEMATICALLY.

Follow this exact diagnostic sequence. Do NOT skip steps or assume causes. Report findings at each step before moving to the next.

---

### Step 1: Check if the server starts and binds correctly

```bash
# Check server startup logs
npm run dev 2>&1 | head -50

# Check what port/address the server is listening on
# Look for Express .listen() call — is it binding to 0.0.0.0 or 127.0.0.1?
```

Read `server/src/index.ts` (or wherever the server entry point is). Find the `.listen()` call. Verify:
- Is it binding to `0.0.0.0` (all interfaces) or `127.0.0.1` (localhost only)?
- Has the listen call changed in Batch 16?
- Is the HTTPS server creation still intact?

**If binding to 127.0.0.1 or localhost:** That's the bug. Change to `0.0.0.0`.

### Step 2: Check HTTPS cert loading

Read the HTTPS cert auto-discovery code (added in a previous batch). Verify:
- Cert paths still resolve correctly
- No new code path that skips HTTPS and falls back to HTTP-only
- The server is actually creating an `https.createServer()`, not just `http.createServer()`

```bash
# Check if certs exist where expected
ls -la "C:\Certbot\live\" 2>/dev/null || echo "No Let's Encrypt certs"
ls -la certs/ 2>/dev/null || echo "No local certs dir"
```

**Check server console output** for cert-related messages (the previous HTTPS setup logged which cert source it found).

### Step 3: Check static file serving

Read `server/src/staticServer.ts`. Check if any Batch 16 changes broke the static file routing:

- Are the phone/controller/display HTML files still being served correctly?
- Did adding lobby mode change any route handlers?
- Is the root `/` route still serving the controller HTML?
- Are the `/phone` and `/display` routes still working?
- Did any new middleware get inserted BEFORE the static file handler that might be intercepting requests?

```bash
# Test static file serving locally
curl -k https://localhost:3000/ -I
curl -k https://localhost:3000/phone -I
curl -k https://localhost:3000/phone/index.html -I
```

### Step 4: Check for JavaScript errors that break the app

The page loading on phone but failing to connect suggests the HTML loads but the JS fails or the WebSocket URL is wrong.

```bash
# Check the built JS files exist and aren't empty
ls -la dist/controller/
ls -la dist/phone/
ls -la dist/display/

# Check if the HTML references the correct hashed JS filenames
cat dist/controller/index.html | grep script
cat dist/phone/index.html | grep script
```

**Check the built JS for obvious errors:**
- Does the connection code construct the WebSocket URL correctly?
- Did removing the default edition cause a null reference on startup that breaks before WebSocket connects?
- Is there a `window.location` based WebSocket URL construction that might break with the domain name?

### Step 5: Check WebSocket upgrade path

Read the WebSocket setup in `server/src/wsHub.ts` or wherever the `ws` server is created. Verify:
- The WebSocket server is attached to the HTTPS server (not a separate HTTP server)
- The upgrade handler hasn't been modified
- No new middleware is consuming the upgrade request before ws gets it

```bash
# Test WebSocket handshake
# (run from a device that can't connect)
curl -k -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" https://192.168.50.96:3000/ -v
```

### Step 6: Check service worker interference

The service worker from previous batches might be caching old responses or intercepting requests incorrectly.

```bash
# Check if SW files exist and what they cache
cat dist/controller/sw.js | head -20
cat dist/phone/sw.js | head -20

# Check if the SW precache list references correct hashed filenames
grep -o 'phone-[a-f0-9]*\.js' dist/phone/sw.js
grep -o 'phone-[a-f0-9]*\.js' dist/phone/index.html
```

**If the SW precache list doesn't match the actual hashed filenames,** the SW will serve 404s for the JS bundle.

Also check: did the build run after the Batch 16 changes? The hash-based cache busting from Batch 14 requires a production build to generate new hashes. If only `npm run dev` was used, the dist/ files might be stale.

### Step 7: Check for CORS or CSP headers

Did Batch 16 add any new headers (Content-Security-Policy, CORS, etc.) that might block connections from the domain?

```bash
# Check response headers from the domain
curl -k https://localhost:3000/ -I 2>&1 | grep -i -E "content-security|access-control|strict-transport"
```

### Step 8: Check the build output

```bash
# Run a fresh production build
npm run build 2>&1

# Check for build errors
echo $?

# Verify output files
find dist/ -name "*.js" -o -name "*.html" | sort
```

If the build has errors or produces incomplete output, that would explain why the app breaks.

### Step 9: Network-level check

If all the above checks out, verify the network path:

```bash
# From the dev PC, can you reach the server on the LAN IP?
curl -k https://192.168.50.96:3000/ -I

# Is the firewall blocking port 3000?
netstat -an | findstr 3000

# Is the server actually listening on all interfaces?
netstat -an | findstr LISTENING | findstr 3000
```

Expected: `0.0.0.0:3000` in LISTENING state. If it shows `127.0.0.1:3000`, that's the problem.

---

## After Diagnosis: Fix

Once you've identified the root cause(s), fix them. Common fixes for this symptom pattern:

| Cause | Fix |
|---|---|
| Server binding to 127.0.0.1 | Change `.listen(port)` to `.listen(port, '0.0.0.0')` |
| HTTPS server not created | Restore cert auto-discovery, ensure `https.createServer()` |
| JS error on startup (null edition) | Add null checks / default handling for missing edition |
| Stale build artifacts | Run `npm run build`, verify hashes match |
| SW serving stale files | Bump SW cache or ensure build generates new hashes |
| WebSocket URL construction | Ensure `wss://` prefix when on HTTPS, use `location.host` not hardcoded |
| New middleware intercepting requests | Check middleware order in Express setup |

**After fixing, verify ALL four access methods from the table at the top work:**
1. `https://localhost:3000` — dev PC
2. `https://game.gh-command.com:3000` — Chrome PC
3. `https://game.gh-command.com:3000` — phone browser
4. `https://192.168.50.96:3000` — LAN direct from another device

---

## Docs to Update

- `docs/BUGFIX_LOG.md` — append entry with symptom, root cause, and fix
- `docs/DESIGN_DECISIONS.md` — if the fix involves an architectural change

**Commit message:** `fix: restore HTTPS + LAN connectivity after lobby refactor`
