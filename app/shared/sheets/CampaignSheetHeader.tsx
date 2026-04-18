import { h } from 'preact';
import { useContext } from 'preact/hooks';
import type { Party } from '@gloomhaven-command/shared';
import { getProsperityLevel } from '@gloomhaven-command/shared';
import { CampaignSheetContext } from './CampaignSheetContext';

interface CampaignSheetHeaderProps {
  party: Party;
}

const EDITION_TITLES: Record<string, string> = {
  gh: 'Gloomhaven',
  fh: 'Frosthaven',
  jotl: 'Jaws of the Lion',
  cs: 'Crimson Scales',
  fc: 'Forgotten Circles',
  toa: 'Trail of Ashes',
};

/**
 * Phase T0c: Campaign Sheet header.
 *
 * - Close button (hidden in autoCycle — display has no interactions).
 * - Title: edition full name. Party name subtitle when present.
 * - Chips: prosperity level · weeks (FH) · scenarios completed.
 *
 * Campaign title is derived — NOT editable here. Party name editing lives
 * in Party Sheet's Standing tab. This keeps the sheets' roles distinct.
 */
export function CampaignSheetHeader({ party }: CampaignSheetHeaderProps) {
  const { onClose, autoCycle, edition } = useContext(CampaignSheetContext);
  const prosperityLevel = getProsperityLevel(party.prosperity ?? 0, edition);
  const scenariosCompleted = party.scenarios?.length ?? 0;
  const weeks = party.weeks ?? 0;
  const isFh = edition === 'fh';
  const editionTitle = EDITION_TITLES[edition] ?? edition.toUpperCase();
  const hasPartyName = !!party.name?.trim();

  return (
    <header class="campaign-sheet__header">
      {!autoCycle && (
        <button
          type="button"
          class="campaign-sheet__close"
          aria-label="Close campaign sheet"
          onClick={onClose}
        >
          ←
        </button>
      )}

      <div class="campaign-sheet__title-block">
        <h1 id="campaign-sheet-title" class="campaign-sheet__title">
          {editionTitle}
        </h1>
        {hasPartyName && (
          <div class="campaign-sheet__party-name">{party.name}</div>
        )}
        <div class="campaign-sheet__subtitle">
          <span class="campaign-sheet__pill" aria-label={`Prosperity level ${prosperityLevel}`}>
            <span class="campaign-sheet__pill-label">Prosperity</span>
            <span class="campaign-sheet__pill-value">{prosperityLevel}</span>
          </span>
          {isFh && (
            <span class="campaign-sheet__pill" aria-label={`${weeks} weeks elapsed`}>
              <span class="campaign-sheet__pill-label">Week</span>
              <span class="campaign-sheet__pill-value">{weeks}</span>
            </span>
          )}
          <span
            class="campaign-sheet__pill"
            aria-label={`${scenariosCompleted} scenario${scenariosCompleted === 1 ? '' : 's'} completed`}
          >
            <span class="campaign-sheet__pill-label">Scenarios</span>
            <span class="campaign-sheet__pill-value">{scenariosCompleted}</span>
          </span>
        </div>
      </div>
    </header>
  );
}
