import { h } from 'preact';
import { useContext } from 'preact/hooks';
import type { Party } from '@gloomhaven-command/shared';
import { CampaignSheetContext } from '../CampaignSheetContext';
import { WaxSealHeader } from '../WaxSealHeader';

interface SettingsTabProps {
  party: Party;
  gameCode?: string;
}

const GEAR_ICON = (
  <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
    <circle cx="10" cy="10" r="3" fill="none" stroke="currentColor" stroke-width="1.3" />
    <path
      d="M10 2.5 L10 5 M10 15 L10 17.5 M2.5 10 L5 10 M15 10 L17.5 10
         M4.6 4.6 L6.4 6.4 M13.6 13.6 L15.4 15.4
         M15.4 4.6 L13.6 6.4 M6.4 13.6 L4.6 15.4"
      stroke="currentColor"
      stroke-width="1.3"
      stroke-linecap="round"
    />
  </svg>
);

const EDITION_FULL_NAMES: Record<string, string> = {
  gh: 'Gloomhaven',
  fh: 'Frosthaven',
  jotl: 'Jaws of the Lion',
  cs: 'Crimson Scales',
  fc: 'Forgotten Circles',
  toa: 'Trail of Ashes',
};

/**
 * Phase T0c: Settings tab.
 *
 * Read-mostly. Edition · campaign mode · game code. Export affordance
 * matches MenuOverlay's `/api/export/{gameCode}` pattern. Import stub
 * disabled with a "coming soon" caption.
 */
export function SettingsTab({ party, gameCode }: SettingsTabProps) {
  const { edition, readOnly } = useContext(CampaignSheetContext);
  const editionName = EDITION_FULL_NAMES[edition] ?? edition.toUpperCase();
  const campaignMode = party.campaignMode ? 'Campaign' : 'One-off Scenario';

  const scenariosTotal =
    (party.scenarios?.length ?? 0)
    + (party.casualScenarios?.length ?? 0)
    + (party.conclusions?.length ?? 0);

  const canExport = !readOnly && !!gameCode;
  const handleExport = () => {
    if (!gameCode) return;
    window.open(`/api/export/${gameCode}`, '_blank');
  };

  return (
    <div class="settings-tab">
      <WaxSealHeader title="Settings" icon={GEAR_ICON} />

      <section class="settings-tab__section">
        <h3 class="settings-tab__section-title">Campaign Identity</h3>
        <dl class="settings-tab__info-grid">
          <div class="settings-tab__info-row">
            <dt class="settings-tab__info-label">Edition</dt>
            <dd class="settings-tab__info-value">
              <span class="settings-tab__chip">{editionName}</span>
            </dd>
          </div>
          <div class="settings-tab__info-row">
            <dt class="settings-tab__info-label">Mode</dt>
            <dd class="settings-tab__info-value">
              <span class="settings-tab__chip">{campaignMode}</span>
            </dd>
          </div>
          {gameCode && (
            <div class="settings-tab__info-row">
              <dt class="settings-tab__info-label">Game Code</dt>
              <dd class="settings-tab__info-value">
                <span class="settings-tab__chip settings-tab__chip--mono">{gameCode}</span>
              </dd>
            </div>
          )}
        </dl>
      </section>

      <section class="settings-tab__section">
        <h3 class="settings-tab__section-title">Save &amp; Restore</h3>
        {canExport && (
          <button
            type="button"
            class="settings-tab__action"
            onClick={handleExport}
          >
            Export Campaign
          </button>
        )}
        <button
          type="button"
          class="settings-tab__action settings-tab__action--disabled"
          disabled
          aria-disabled="true"
          title="Coming in a future update."
        >
          Import from GHS Save
        </button>
        <p class="settings-tab__hint">GHS import is coming in a future update.</p>
      </section>

      <section class="settings-tab__section">
        <h3 class="settings-tab__section-title">Campaign Info</h3>
        <dl class="settings-tab__info-grid">
          <div class="settings-tab__info-row">
            <dt class="settings-tab__info-label">Scenarios Played</dt>
            <dd class="settings-tab__info-value">{scenariosTotal}</dd>
          </div>
          {edition === 'fh' && (
            <div class="settings-tab__info-row">
              <dt class="settings-tab__info-label">Weeks Elapsed</dt>
              <dd class="settings-tab__info-value">{party.weeks ?? 0}</dd>
            </div>
          )}
          <div class="settings-tab__info-row">
            <dt class="settings-tab__info-label">Total Donations</dt>
            <dd class="settings-tab__info-value">{party.donations ?? 0} g</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
