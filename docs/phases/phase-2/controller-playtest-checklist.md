# Controller Playtest Evaluation — Issue Tracker

Test on iPad (Safari + Chrome) and desktop (Claude in Chrome).
Capture every issue. Fix nothing yet — batch corrections after.

## Categories

### LAYOUT — spacing, sizing, overflow, alignment
Issues where elements are mispositioned, overlapping, clipped, or poorly sized for iPad.

### INTERACTION — tap targets, gestures, input behavior
Issues where buttons are too small, inputs behave unexpectedly, or touch interactions feel wrong.

### WORKFLOW — missing steps, wrong order, confusing flow
Issues where the gameplay flow doesn't match how you actually run Gloomhaven at the table.

### MISSING — features or info that should be visible but aren't
Things that need to be on screen that aren't rendered or aren't accessible.

### VISUAL — colors, contrast, readability, aesthetic
Issues where text is hard to read, colors are wrong, or the dark theme doesn't work.

### BUG — broken functionality
Things that produce errors, don't respond, or behave incorrectly.

---

## Test Scenarios

### 1. Connection Flow
- [ ] Connect from iPad Safari
- [ ] Connect from iPad Chrome
- [ ] Connect from desktop Chrome
- [ ] New Game flow
- [ ] Import GHS Save flow (paste JSON from GHS backup)
- [ ] Resume flow (reconnect to existing game)
- [ ] Disconnect and reconnect (session token recovery)

### 2. Scenario Setup (Scenario Tab)
- [ ] Set scenario number + edition
- [ ] Add 3-4 characters
- [ ] Set scenario level
- [ ] Toggle character absent/exhausted
- [ ] Remove a character
- [ ] Reveal a room

### 3. Round Flow (Active Play Tab)
- [ ] Set initiatives for all characters
- [ ] Start round (FAB button)
- [ ] Advance through all turns (Next Turn FAB)
- [ ] End round (Next Round FAB)
- [ ] Repeat for 2-3 rounds

### 4. Character Management (Active Play)
- [ ] Health +/- on characters
- [ ] Health +/- on summons
- [ ] Toggle conditions on characters
- [ ] Toggle conditions on monsters
- [ ] Kill a monster standee
- [ ] Element board cycling

### 5. Monster Setup (Monsters Tab)
- [ ] Add a monster group
- [ ] Add normal + elite standees
- [ ] Remove a standee
- [ ] Remove a monster group
- [ ] Draw monster ability
- [ ] Monster modifier deck draw/shuffle

### 6. Loot & Decks (Loot Tab)
- [ ] Character AMD draw/shuffle
- [ ] Bless/curse add/remove
- [ ] Loot deck (if FH edition)

### 7. Campaign Tab
- [ ] Character XP +/- buttons
- [ ] Character Gold +/- buttons
- [ ] Party info display
- [ ] Game info accuracy

### 8. Cross-Device Sync
- [ ] Open controller on iPad AND desktop simultaneously
- [ ] Make changes on one, verify they appear on the other
- [ ] Disconnect one device, make changes on the other, reconnect — verify sync

---

## Issue Log

Format: `[CATEGORY] Description — where it happens`

*(Fill in during testing)*

