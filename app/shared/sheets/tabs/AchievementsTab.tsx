import { h } from 'preact';
import { useCallback, useContext, useState } from 'preact/hooks';
import type { Party } from '@gloomhaven-command/shared';
import { useCommands } from '../../../hooks/useCommands';
import { CampaignSheetContext } from '../CampaignSheetContext';
import { WaxSealHeader } from '../WaxSealHeader';

interface AchievementsTabProps {
  party: Party;
}

const SHIELD_ICON = (
  <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
    <path
      d="M10 3 L16 5 V10 C16 13.5 13.5 16 10 17.5 C6.5 16 4 13.5 4 10 V5 Z"
      fill="none"
      stroke="currentColor"
      stroke-width="1.4"
      stroke-linejoin="round"
    />
    <path
      d="M7.5 10 L9.5 12 L12.5 8.5"
      fill="none"
      stroke="currentColor"
      stroke-width="1.3"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
);

/**
 * Phase T0c: Achievements tab.
 *
 * Global achievements. Mirrors Standing tab's party-achievements UI but
 * targets `state.party.globalAchievementsList` via structured commands.
 * Transient input — submit-on-Enter / click (no useCommitOnPause needed).
 */
export function AchievementsTab({ party }: AchievementsTabProps) {
  const { readOnly } = useContext(CampaignSheetContext);
  const commands = useCommands();

  const [draft, setDraft] = useState('');
  const handleAdd = useCallback(() => {
    const val = draft.trim();
    if (!val) return;
    commands.addGlobalAchievement(val);
    setDraft('');
  }, [draft, commands]);

  const achievements = party.globalAchievementsList ?? [];

  return (
    <div class="achievements-tab">
      <WaxSealHeader title="Achievements" icon={SHIELD_ICON} />

      <div class="achievements-tab__meta">
        <span class="achievements-tab__count">
          {achievements.length} earned
        </span>
      </div>

      {achievements.length > 0 ? (
        <ul class="achievements-tab__list">
          {achievements.map((a) => (
            <li key={a} class="achievements-tab__row">
              <span class="achievements-tab__text">{a}</span>
              {!readOnly && (
                <button
                  type="button"
                  class="achievements-tab__remove"
                  aria-label={`Remove achievement: ${a}`}
                  onClick={() => commands.removeGlobalAchievement(a)}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p class="achievements-tab__empty">
          No global achievements yet. These track party-wide story milestones.
        </p>
      )}

      {!readOnly && (
        <div class="achievements-tab__add">
          <div class="achievements-tab__parchment-field">
            <input
              class="achievements-tab__input"
              type="text"
              value={draft}
              placeholder="Add a global achievement…"
              onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAdd();
                }
              }}
            />
          </div>
          <button
            type="button"
            class="achievements-tab__add-btn"
            disabled={!draft.trim()}
            onClick={handleAdd}
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}
