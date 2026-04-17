import { h } from 'preact';
import { useContext, useState } from 'preact/hooks';
import type { Character } from '@gloomhaven-command/shared';
import { PartySheetContext } from '../PartySheetContext';
import { getCharacterTheme, withAlpha } from '../../characterThemes';
import { characterThumbnail, characterIcon } from '../../assets';
import { formatName } from '../../formatName';

interface RosterTabProps {
  characters: Character[];
  retirements: Character[];
  edition: string;
}

/**
 * Phase T0b: Roster tab — portrait grid of active characters + collapsible
 * retirement archive. Read-only for T0b (no click handlers); tapping an
 * active character card to open the Player Sheet is deferred because
 * controller GMs already reach PlayerSheet from character cards on the
 * scenario grid.
 */
export function RosterTab({ characters, retirements, edition: _edition }: RosterTabProps) {
  const { autoCycle } = useContext(PartySheetContext);
  const [retireesExpanded, setRetireesExpanded] = useState(false);
  const active = characters.filter((c) => !c.absent);
  const absent = characters.filter((c) => c.absent);

  if (active.length === 0 && absent.length === 0 && retirements.length === 0) {
    return (
      <div class="roster-tab roster-tab--empty" data-autocycle={autoCycle ? 'true' : 'false'}>
        <div class="roster-tab__empty-silhouette" aria-hidden="true">
          <svg viewBox="0 0 120 160" preserveAspectRatio="xMidYMid meet">
            <path
              d="M60 18c-12 0-22 10-22 22 0 8 4 14 9 18-16 6-28 22-28 42v52h82v-52c0-20-12-36-28-42 5-4 9-10 9-18 0-12-10-22-22-22z"
              fill="var(--parchment-ink-dim)"
              opacity="0.35"
            />
          </svg>
        </div>
        <p class="roster-tab__empty-text">No heroes yet.</p>
        <p class="roster-tab__empty-hint">
          Return to the Lobby to add characters.
        </p>
      </div>
    );
  }

  return (
    <div class="roster-tab">
      {active.length > 0 && (
        <section class="roster-tab__section">
          <h2 class="roster-tab__section-title">Active Characters</h2>
          <div class="roster-tab__grid">
            {active.map((c) => (
              <RosterCard key={`${c.edition}-${c.name}`} character={c} />
            ))}
          </div>
        </section>
      )}

      {absent.length > 0 && (
        <section class="roster-tab__section">
          <h2 class="roster-tab__section-title">Absent</h2>
          <div class="roster-tab__grid roster-tab__grid--dim">
            {absent.map((c) => (
              <RosterCard key={`${c.edition}-${c.name}`} character={c} absent />
            ))}
          </div>
        </section>
      )}

      {retirements.length > 0 && (
        <section class="roster-tab__section roster-tab__section--retirees">
          <button
            type="button"
            class="roster-tab__retirees-toggle"
            aria-expanded={retireesExpanded}
            aria-controls="roster-tab-retirees-list"
            onClick={() => setRetireesExpanded((e) => !e)}
            disabled={autoCycle}
          >
            <span class="roster-tab__section-title">
              Retired Archive ({retirements.length})
            </span>
            <span class="roster-tab__retirees-caret" aria-hidden="true">
              {retireesExpanded ? '▾' : '▸'}
            </span>
          </button>
          {(retireesExpanded || autoCycle) && (
            <ul id="roster-tab-retirees-list" class="roster-tab__retirees-list">
              {retirements.map((c, i) => (
                <li
                  key={`${c.edition}-${c.name}-${i}`}
                  class="roster-tab__retiree-row"
                >
                  <img
                    class="roster-tab__retiree-icon"
                    src={characterIcon(c.edition, c.name)}
                    alt=""
                    aria-hidden="true"
                  />
                  <span class="roster-tab__retiree-name">
                    {c.title?.trim() || formatName(c.name)}
                  </span>
                  <span class="roster-tab__retiree-class">
                    {formatName(c.name)}
                  </span>
                  <span class="roster-tab__retiree-edition">
                    {c.edition.toUpperCase()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function RosterCard({ character, absent }: { character: Character; absent?: boolean }) {
  const theme = getCharacterTheme(character.name);
  const style = {
    '--card-accent': theme.accent,
    '--card-accent-dim': withAlpha(theme.accent, 0.35),
    '--card-accent-glow': withAlpha(theme.accent, 0.5),
  } as h.JSX.CSSProperties;
  const displayName = character.title?.trim() || formatName(character.name);

  return (
    <div
      class={`roster-tab__card${absent ? ' roster-tab__card--absent' : ''}`}
      data-class={character.name}
      style={style}
    >
      <div class="roster-tab__portrait-frame">
        <img
          class="roster-tab__portrait"
          src={characterThumbnail(character.edition, character.name)}
          alt=""
        />
      </div>
      <div class="roster-tab__card-body">
        <div class="roster-tab__card-name">{displayName}</div>
        <div class="roster-tab__card-class">{formatName(character.name)}</div>
        <div class="roster-tab__card-meta">
          <span class="roster-tab__card-level">Lv {character.level}</span>
          <span class="roster-tab__card-divider" aria-hidden="true">·</span>
          <span class="roster-tab__card-hp">
            {character.health}/{character.maxHealth} HP
          </span>
        </div>
      </div>
    </div>
  );
}
