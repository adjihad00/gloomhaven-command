# Batch 14: Service Worker Cache Busting + Phone Permission Enforcement

Two targeted fixes before the next round of phone development.

---

## Fix 1: Hash-Based Service Worker Cache Busting

### Problem
The phone service worker uses a manually-bumped `CACHE_VERSION` string. Every JS change requires remembering to bump it, or Android serves stale cached JavaScript. This already caused a bug during Phase 3 — commands silently failed because the browser was running old code.

### Solution
Make esbuild generate content-hashed filenames for all client bundles. The service worker precache list is then auto-generated at build time, so any code change produces new hashes → new cache keys → automatic invalidation.

### Implementation

**Step 1: Audit current state**
- Read the current esbuild config (likely in `package.json` scripts or a build script)
- Read the current service worker files (`app/phone/sw.js`, and check if controller/display have their own)
- Read `server/src/staticServer.ts` to see how static files are served
- Identify all three client entry points and their output paths

**Step 2: Add content hashing to esbuild**
- Enable `entryNames: '[name]-[hash]'` (or equivalent) for all client builds
- Generate a manifest/mapping of original names → hashed filenames
- Write the manifest to a known location (e.g., `dist/manifest.json` or inline into the SW)

**Step 3: Generate SW precache list at build time**
- After esbuild runs, read the hashed output filenames
- Generate/template the service worker with the actual filenames baked in as the precache list
- The SW cache name should include a hash of all precached URLs (so it auto-invalidates when any file changes)
- Remove the manual `CACHE_VERSION` constant entirely

**Step 4: Update staticServer.ts**
- The HTML files need to reference the hashed JS/CSS filenames
- Either: (a) generate the HTML from a template at build time, or (b) serve HTML through a middleware that rewrites `<script src="phone.js">` to `<script src="phone-abc123.js">`
- Option (a) is simpler — have the build script write the HTML with correct paths
- Hashed assets should be served with `Cache-Control: public, max-age=31536000, immutable`
- HTML files should be served with `Cache-Control: no-cache` (so the browser always checks for new HTML → which references new hashes)

**Step 5: SW update flow**
- The service worker should use `skipWaiting()` + `clients.claim()` so updates activate immediately
- On `install`, precache all hashed assets from the baked-in list
- On `activate`, delete any old caches that don't match the current cache name
- Navigation requests (HTML) should be network-first (so fresh HTML with new script tags is always fetched)
- Asset requests (JS/CSS/images) should be cache-first (hashed filenames guarantee uniqueness)

**Verification:**
- [ ] `npm run build` produces hashed filenames (e.g., `phone-a1b2c3.js`)
- [ ] HTML files reference the hashed filenames
- [ ] Service worker precache list contains hashed filenames
- [ ] Changing any source file → rebuild → different hash → SW auto-updates
- [ ] No manual version bumping anywhere in the codebase
- [ ] `npm run dev` still works (dev mode can skip hashing if simpler)

---

## Fix 2: Server-Side Phone Permission Enforcement

### Problem
Phone clients register with a `characterName` via the `register` message, but the server doesn't enforce that phone clients can only send commands targeting their registered character. Any phone can currently send commands for any character.

### Implementation

**Step 1: Audit current state**
- Read `server/src/wsHub.ts` — find where `register` messages are handled and where commands are processed
- Check if there's already any role/character tracking per connection
- Read `packages/shared/src/types/protocol.ts` for the register message shape
- Read `packages/shared/src/types/commands.ts` to understand command target shapes

**Step 2: Track registration per connection**
- When a phone client sends `{ type: "register", role: "phone", characterName: "brute" }`, store the `role` and `characterName` on that connection's session object
- Controller and display roles have no character restriction

**Step 3: Add command validation**
- In the command handler (where `type: "command"` messages are processed), before `applyCommand`:
  - If the connection's role is `"phone"` and `characterName` is set:
    - Extract the target from the command payload
    - If the command targets a specific character (via `payload.target`, `payload.characterName`, etc.), verify it matches the registered `characterName`
    - If it doesn't match, send an error response: `{ type: "error", message: "Phone can only control registered character" }`
    - If the command has no character target (e.g., global commands like `advancePhase`), **block it** — phones should not be able to advance phases, reveal rooms, etc.
  - If the connection's role is NOT `"phone"` (or no role registered), allow all commands

**Step 4: Define allowed phone commands**
These commands are valid for phone clients (all must target their registered character):
```
setInitiative          — payload.characterName must match
toggleLongRest         — payload.characterName must match
changeHealth           — payload.target.name must match
toggleCondition        — payload.target.name must match
setExperience          — payload.characterName must match
setLoot                — payload.characterName must match
toggleExhausted        — payload.characterName must match
toggleAbsent           — payload.characterName must match
addSummon              — payload.characterName must match
removeSummon           — payload.characterName must match
toggleTurn             — payload.figure.name must match (for ending own turn)
```

These commands should be BLOCKED for phone clients:
```
advancePhase, revealRoom, setScenario, addCharacter, removeCharacter,
setLevel, setLevelAdjustment, setRound, addMonsterGroup, removeMonsterGroup,
addEntity, removeEntity, drawMonsterAbility, shuffleMonsterAbilities,
drawModifierCard, shuffleModifierDeck, addModifierCard, removeModifierCard,
drawLootCard, assignLoot, moveElement, undoAction, importGhsState,
updateCampaign, completeScenario, setMonsterLevel, changeMaxHealth
```

**Step 5: Error handling**
- Send a clear error message back to the phone client
- Do NOT disconnect the client — just reject the command
- Log the rejected command server-side for debugging

**Verification:**
- [ ] Phone client with registered character can send `changeHealth` for their character
- [ ] Phone client CANNOT send `changeHealth` for a different character (gets error)
- [ ] Phone client CANNOT send `advancePhase` (gets error)
- [ ] Controller client (no role or role="controller") can send any command
- [ ] Existing phone functionality still works after adding enforcement

---

## Docs to Update

After both fixes, update:
- `docs/BUGFIX_LOG.md` — append entries for both fixes
- `docs/DESIGN_DECISIONS.md` — append entry for hash-based cache busting strategy and phone permission model
- `docs/PROJECT_CONTEXT.md` — update if build process or command handling changed
- `docs/COMMAND_PROTOCOL.md` — add section on phone role permission enforcement

**Commit message:** `fix: hash-based SW cache busting + phone command permission enforcement`
