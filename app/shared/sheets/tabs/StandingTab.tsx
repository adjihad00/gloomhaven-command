import { h } from 'preact';
import { useContext, useState, useCallback } from 'preact/hooks';
import type { Party } from '@gloomhaven-command/shared';
import { getReputationPriceModifier } from '@gloomhaven-command/shared';
import { useCommands } from '../../../hooks/useCommands';
import { useCommitOnPause } from '../../hooks/useCommitOnPause';
import { PartySheetContext } from '../PartySheetContext';

interface StandingTabProps {
  party: Party;
}

const REPUTATION_MIN = -20;
const REPUTATION_MAX = 20;

/**
 * Phase T0b: Standing tab.
 *
 * Editable: party name, reputation (slider → updateCampaign on release),
 * party notes, party achievements (add/remove via structured commands).
 *
 * All text fields use `useCommitOnPause` (blur/Enter/1000 ms).
 */
export function StandingTab({ party }: StandingTabProps) {
  const { readOnly } = useContext(PartySheetContext);
  const commands = useCommands();

  // ── Party Name ────────────────────────────────────────────────────────
  const nameField = useCommitOnPause({
    value: party.name ?? '',
    onCommit: (v) => commands.updateCampaign('name', v),
    commitOnEnter: true,
  });

  // ── Reputation slider ─────────────────────────────────────────────────
  // Local-optimistic drag value; commits on release.
  const [repDragValue, setRepDragValue] = useState<number | null>(null);
  const liveRep = repDragValue ?? party.reputation ?? 0;
  const priceModifier = getReputationPriceModifier(liveRep);

  const handleRepInput = (e: Event) => {
    const next = Number((e.target as HTMLInputElement).value);
    setRepDragValue(next);
  };
  const handleRepCommit = () => {
    if (repDragValue === null) return;
    const clamped = Math.max(REPUTATION_MIN, Math.min(REPUTATION_MAX, repDragValue));
    commands.updateCampaign('reputation', clamped);
    setRepDragValue(null);
  };

  // ── Party Notes (textarea) ────────────────────────────────────────────
  const notesField = useCommitOnPause({
    value: party.notes ?? '',
    onCommit: (v) => commands.updateCampaign('notes', v),
    commitOnEnter: false,
  });

  // ── Achievements ──────────────────────────────────────────────────────
  const [achDraft, setAchDraft] = useState('');
  const handleAddAchievement = useCallback(() => {
    const val = achDraft.trim();
    if (!val) return;
    commands.addPartyAchievement(val);
    setAchDraft('');
  }, [achDraft, commands]);

  const achievements = party.achievementsList ?? [];

  return (
    <div class="standing-tab">
      {/* Party Name ─────────────────────────────────────────────────── */}
      <section class="standing-tab__section">
        <label class="standing-tab__label" for="standing-tab-name">
          Party Name
        </label>
        <div class="standing-tab__parchment-field">
          <input
            id="standing-tab-name"
            class="standing-tab__input"
            type="text"
            value={nameField.localValue}
            readOnly={readOnly}
            placeholder="Unnamed Party"
            onInput={nameField.onInput}
            onFocus={nameField.onFocus}
            onBlur={nameField.onBlur}
            onKeyDown={nameField.onKeyDown}
          />
        </div>
      </section>

      {/* Reputation ─────────────────────────────────────────────────── */}
      <section class="standing-tab__section">
        <div class="standing-tab__rep-head">
          <label class="standing-tab__label" for="standing-tab-reputation">
            Reputation
          </label>
          <div class="standing-tab__rep-value">
            {liveRep > 0 ? `+${liveRep}` : liveRep}
          </div>
        </div>
        <input
          id="standing-tab-reputation"
          class="standing-tab__rep-slider"
          type="range"
          min={REPUTATION_MIN}
          max={REPUTATION_MAX}
          step={1}
          value={liveRep}
          disabled={readOnly}
          aria-valuemin={REPUTATION_MIN}
          aria-valuemax={REPUTATION_MAX}
          aria-valuenow={liveRep}
          aria-valuetext={`${liveRep > 0 ? '+' : ''}${liveRep}, ${formatPriceModifierLabel(priceModifier)}`}
          onInput={handleRepInput}
          onChange={handleRepCommit}
          onMouseUp={handleRepCommit}
          onTouchEnd={handleRepCommit}
        />
        <div class="standing-tab__rep-ticks" aria-hidden="true">
          <span class="standing-tab__rep-tick" data-value="-20">−20</span>
          <span class="standing-tab__rep-tick" data-value="-10">−10</span>
          <span class="standing-tab__rep-tick" data-value="0">0</span>
          <span class="standing-tab__rep-tick" data-value="10">+10</span>
          <span class="standing-tab__rep-tick" data-value="20">+20</span>
        </div>
        <div class="standing-tab__rep-modifier">
          <span class="standing-tab__rep-modifier-label">Shop Price Modifier</span>
          <span class="standing-tab__rep-modifier-chip">
            {formatPriceModifierChip(priceModifier)}
          </span>
        </div>
      </section>

      {/* Party Notes ────────────────────────────────────────────────── */}
      <section class="standing-tab__section">
        <label class="standing-tab__label" for="standing-tab-notes">
          Party Notes
        </label>
        <div class="standing-tab__parchment-field standing-tab__parchment-field--tall">
          <textarea
            id="standing-tab-notes"
            class="standing-tab__textarea"
            value={notesField.localValue}
            readOnly={readOnly}
            rows={6}
            placeholder="Chronicle your party's story, alliances, and enemies…"
            onInput={notesField.onInput}
            onFocus={notesField.onFocus}
            onBlur={notesField.onBlur}
          />
        </div>
      </section>

      {/* Achievements ───────────────────────────────────────────────── */}
      <section class="standing-tab__section">
        <div class="standing-tab__ach-head">
          <span class="standing-tab__label">Party Achievements</span>
          <span class="standing-tab__ach-count">
            {achievements.length} earned
          </span>
        </div>
        {achievements.length > 0 ? (
          <ul class="standing-tab__ach-list">
            {achievements.map((a) => (
              <li key={a} class="standing-tab__ach-row">
                <span class="standing-tab__ach-text">{a}</span>
                {!readOnly && (
                  <button
                    type="button"
                    class="standing-tab__ach-remove"
                    aria-label={`Remove achievement: ${a}`}
                    onClick={() => commands.removePartyAchievement(a)}
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p class="standing-tab__ach-empty">
            No achievements yet. They'll appear here as your party makes its mark.
          </p>
        )}

        {!readOnly && (
          <div class="standing-tab__ach-add">
            <div class="standing-tab__parchment-field">
              <input
                class="standing-tab__input"
                type="text"
                value={achDraft}
                placeholder="Add an achievement…"
                onInput={(e) => setAchDraft((e.target as HTMLInputElement).value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAddAchievement();
                  }
                }}
              />
            </div>
            <button
              type="button"
              class="standing-tab__ach-add-btn"
              disabled={!achDraft.trim()}
              onClick={handleAddAchievement}
            >
              Add
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function formatPriceModifierChip(mod: number): string {
  if (mod === 0) return '±0 g';
  const sign = mod > 0 ? '+' : '−';
  return `${sign}${Math.abs(mod)}g per item`;
}

function formatPriceModifierLabel(mod: number): string {
  if (mod === 0) return 'no price adjustment';
  if (mod < 0) return `discount ${Math.abs(mod)} gold per item`;
  return `surcharge ${mod} gold per item`;
}
