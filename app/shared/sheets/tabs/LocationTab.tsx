import { h } from 'preact';
import { useContext } from 'preact/hooks';
import type { Party } from '@gloomhaven-command/shared';
import { useCommands } from '../../../hooks/useCommands';
import { useCommitOnPause } from '../../hooks/useCommitOnPause';
import { PartySheetContext } from '../PartySheetContext';

interface LocationTabProps {
  party: Party;
}

/**
 * Phase T0b: Location tab.
 *
 * T0b scope: current-location text editing + travel-history timeline of
 * completed scenarios. World-map scenario picker drops in at T5 as an
 * enhancement; a small-caps placeholder band notes the upcoming feature.
 */
export function LocationTab({ party }: LocationTabProps) {
  const { readOnly } = useContext(PartySheetContext);
  const commands = useCommands();

  const locationField = useCommitOnPause({
    value: party.location ?? '',
    onCommit: (v) => commands.updateCampaign('location', v),
    commitOnEnter: true,
  });

  // Reverse chronological order; scenarios stored oldest-first in GHS saves.
  const recent = [...(party.scenarios ?? [])].reverse();

  return (
    <div class="location-tab">
      <section class="location-tab__section">
        <label class="location-tab__label" for="location-tab-location">
          Current Location
        </label>
        <div class="location-tab__parchment-field">
          <input
            id="location-tab-location"
            class="location-tab__input"
            type="text"
            value={locationField.localValue}
            readOnly={readOnly}
            placeholder="Where is the party encamped?"
            onInput={locationField.onInput}
            onFocus={locationField.onFocus}
            onBlur={locationField.onBlur}
            onKeyDown={locationField.onKeyDown}
          />
        </div>
        <p class="location-tab__map-note">
          World map scenario picker arrives in T5.
        </p>
      </section>

      <section class="location-tab__section">
        <h2 class="location-tab__section-title">Travel History</h2>
        {recent.length === 0 ? (
          <p class="location-tab__history-empty">
            No completed scenarios yet. Every journey begins with a first step.
          </p>
        ) : (
          <ol class="location-tab__history">
            {recent.map((s, i) => (
              <li
                key={`${s.edition}-${s.index}-${i}`}
                class="location-tab__history-row"
              >
                <span class="location-tab__history-marker" aria-hidden="true" />
                <span class="location-tab__history-index">
                  #{s.index}
                </span>
                <span class="location-tab__history-edition">
                  {s.edition.toUpperCase()}
                </span>
                <span class="location-tab__history-check" aria-hidden="true">
                  ✓
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
