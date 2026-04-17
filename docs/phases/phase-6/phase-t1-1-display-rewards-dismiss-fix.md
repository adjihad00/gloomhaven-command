# Phase T1.1 — Fix Display Rewards Dismissal (Claude Code Prompt)

## Context

T1 landed. `state.finishData` is built at `prepareScenarioEnd`, applied at
`completeScenario`, and cleared at `completeTownPhase`. All three clients
show their rewards overlay while `finishData` exists.

Kyle has observed that the **display rewards tableau remains on screen for
the entire town phase**. This is a scope bug in the T1 prompt, not an
intentional design choice. The display should hand off to the town-phase
display surfaces (outpost map, building ops, etc.) shortly after rewards
are claimed — not cling to the tableau until `completeTownPhase`.

Phone and controller behavior stay as-is: phones dismiss locally on
Continue; controller's `ScenarioSummaryOverlay` closes when the GM taps
Cancel/Confirm. The bug is display-only.

## Goal

Display rewards tableau dismisses when:

- All connected phones have sent `dismissRewards` (tracked in
  `finishData.characters[i].dismissed`), AND
- `state.finish === 'success' | 'failure'` (i.e. controller already
  confirmed and `completeScenario` ran — we're past the pending window).

If either condition isn't met, tableau stays. This gives the table a
shared moment to review rewards, then moves on naturally as players close
their phone overlays.

Do NOT clear `state.finishData` at this point — phone overlays that are
still open continue to read from it. The phone's dismissal is local
state; `finishData` persists until `completeTownPhase` as T1 specified.

## Implementation

Only `app/display/overlays/DisplayRewardsOverlay.tsx` (or wherever T1
mounted the display rewards overlay) changes.

Add a local computed boolean:

```ts
const allPhonesDismissed = useMemo(() => {
  if (!finishData) return false;
  // Only count characters whose phone connected at some point during
  // this scenario — absent / never-registered characters shouldn't
  // block dismissal.
  const playing = finishData.characters.filter(c => /* heuristic: */ true);
  return playing.length > 0 && playing.every(c => c.dismissed);
}, [finishData]);

const shouldShow = Boolean(finishData) && !(isFinal && allPhonesDismissed);
```

Where `isFinal = state.finish === 'success' || state.finish === 'failure'`.

Do NOT add a timeout or auto-dismiss — player-driven dismissal is clearer.

**Character filter heuristic:** if there is no reliable "did this
character's phone connect" signal (check the `sessionManager` and
connection bookkeeping), treat every non-absent character in
`finishData.characters` as "playing." Absent characters on the roster
shouldn't stall dismissal. If all phones aren't required to dismiss
(e.g. one player left mid-scenario), we accept that the GM can still
close things down via `completeTownPhase` later.

## Verification

- [ ] Finish a scenario with 2 phones connected. GM confirms. Both phones
      tap Continue → display rewards tableau fades/dismisses within the
      next state diff.
- [ ] Finish a scenario with 2 phones connected. GM confirms. Only phone
      A taps Continue. Display tableau stays up (waiting on phone B).
- [ ] Finish a scenario. GM confirms. Both phones tap Continue. Display
      transitions to whatever the display's town-phase placeholder
      currently shows (an empty TownView — to be fleshed out in T4).
- [ ] T1 regression: `finishData` still persists for later phone/overlay
      reads — confirm by having a phone reconnect after dismissing and
      see the "Rewards have been claimed" state still available until
      `completeTownPhase`.

## Commit Message

```
fix(t1.1): display rewards tableau auto-dismisses when all phones dismiss

Display was clinging to the rewards tableau for the entire town phase
because the dismissal condition was tied to finishData lifetime
(cleared only at completeTownPhase). Now the display closes the
tableau when all connected characters' dismissed flag is set AND
state.finish is final. finishData itself still persists until town
phase ends so phones reconnecting mid-town can still read the claimed
state.

Display-only change. Phone and controller dismissal flows unchanged.
```
