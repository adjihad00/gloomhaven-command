import { h } from 'preact';
import { useContext, useEffect, useRef, useState } from 'preact/hooks';
import type { Party } from '@gloomhaven-command/shared';
import { useCommands } from '../../../hooks/useCommands';
import { CampaignSheetContext } from '../CampaignSheetContext';
import { WaxSealHeader } from '../WaxSealHeader';

interface DonationsTabProps {
  party: Party;
}

const COIN_ICON = (
  <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
    <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1.4" />
    <path d="M10 5 V15" stroke="currentColor" stroke-width="1.1" />
    <path d="M7.5 7.5 H11.5 C12.5 7.5 13 8 13 8.75 C13 9.5 12.5 10 11.5 10 H8" stroke="currentColor" stroke-width="1.1" fill="none" stroke-linecap="round" />
    <path d="M8 10 H12 C13 10 13.5 10.5 13.5 11.25 C13.5 12 13 12.5 12 12.5 H7.5" stroke="currentColor" stroke-width="1.1" fill="none" stroke-linecap="round" />
  </svg>
);

const PIP_INCREMENT = 10;
const DEFAULT_PIP_COUNT = 10;

/**
 * Phase T0c: Donations tab.
 *
 * Running total + milestone pips (every 10g). Cross-milestone flash cue
 * when the count lands exactly on a pip. GM-only "+10g" action.
 *
 * Donation history is not tracked in state (the number is a running
 * total only), so no "Most recent donation" display.
 */
export function DonationsTab({ party }: DonationsTabProps) {
  const { readOnly } = useContext(CampaignSheetContext);
  const commands = useCommands();
  const donations = party.donations ?? 0;

  // Pip count grows to always show at least one empty pip past the filled ones.
  const pipCount = Math.max(
    DEFAULT_PIP_COUNT,
    Math.ceil((donations + PIP_INCREMENT) / PIP_INCREMENT),
  );
  const filledPips = Math.floor(donations / PIP_INCREMENT);
  const nextMilestone = (filledPips + 1) * PIP_INCREMENT;
  const toNextMilestone = nextMilestone - donations;

  // Milestone-cross flash cue.
  const lastFilledRef = useRef(filledPips);
  const [flashPip, setFlashPip] = useState<number | null>(null);
  useEffect(() => {
    if (lastFilledRef.current === filledPips) return;
    const rose = filledPips > lastFilledRef.current;
    const newFilled = filledPips;
    lastFilledRef.current = filledPips;
    if (!rose) return;
    setFlashPip(newFilled);
    const t = window.setTimeout(() => setFlashPip(null), 700);
    return () => window.clearTimeout(t);
  }, [filledPips]);

  const handleDonate = () => {
    commands.updateCampaign('donations', donations + PIP_INCREMENT);
  };

  return (
    <div class="donations-tab">
      <WaxSealHeader title="Donations" icon={COIN_ICON} />

      <div class="donations-tab__total">
        <span class="donations-tab__total-value">{donations}</span>
        <span class="donations-tab__total-unit">gold</span>
        <p class="donations-tab__total-caption">donated to the sanctuary</p>
      </div>

      <div class="donations-tab__pips" role="group" aria-label="Donation milestones">
        {Array.from({ length: pipCount }, (_, i) => {
          const pipLevel = i + 1;
          const pipGold = pipLevel * PIP_INCREMENT;
          const filled = i < filledPips;
          const flashing = flashPip === pipLevel;
          return (
            <div
              key={pipLevel}
              class={`donations-tab__pip${filled ? ' donations-tab__pip--filled' : ''}${flashing ? ' donations-tab__pip--flash' : ''}`}
              aria-label={`${pipGold} gold milestone${filled ? ' — reached' : ''}`}
            >
              <span class="donations-tab__pip-gold">{pipGold}</span>
            </div>
          );
        })}
      </div>

      <p class="donations-tab__next" aria-live="polite">
        Next milestone: {nextMilestone} gold ({toNextMilestone} to go)
      </p>

      {!readOnly && (
        <div class="donations-tab__actions">
          <button
            type="button"
            class="donations-tab__donate"
            aria-label={`Donate 10 gold (current total: ${donations})`}
            onClick={handleDonate}
          >
            +10g Donate
          </button>
        </div>
      )}
    </div>
  );
}
