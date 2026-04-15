import { h } from 'preact';
import type { Character } from '@gloomhaven-command/shared';
import { characterThumbnail, conditionIcon } from '../../shared/assets';
import { formatName } from '../../shared/formatName';

interface DisplayCharacterSummaryProps {
  characters: Character[];
}

function hpColor(ratio: number): string {
  if (ratio > 0.5) return 'high';
  if (ratio > 0.25) return 'mid';
  return 'low';
}

export function DisplayCharacterSummary({ characters }: DisplayCharacterSummaryProps) {
  // Show all characters except absent
  const visible = characters.filter(c => !c.absent);
  if (visible.length === 0) return null;

  return (
    <div class="display-summary">
      <div class="display-summary__title">Party</div>
      {visible.map(char => {
        const hpRatio = char.maxHealth > 0 ? char.health / char.maxHealth : 0;
        const activeConditions = char.entityConditions.filter(c => c.state !== 'removed' && !c.expired);

        return (
          <div key={char.name} class={`display-summary__row ${char.exhausted ? 'display-summary__row--exhausted' : ''}`}>
            <img src={characterThumbnail(char.edition, char.name)} alt={char.name}
              class="display-summary__portrait" />
            <span class="display-summary__name">{formatName(char.name)}</span>
            <div class="display-summary__hp-bar">
              <div class={`display-summary__hp-fill figure-card__hp-fill--${hpColor(hpRatio)}`}
                style={{ width: `${hpRatio * 100}%` }} />
            </div>
            <span class="display-summary__hp-text">
              {char.exhausted ? 'X' : `${char.health}/${char.maxHealth}`}
            </span>
            <span class="display-summary__xp">{char.experience} XP</span>
            {activeConditions.length > 0 && (
              <div class="display-summary__conditions">
                {activeConditions.map(c => (
                  <img key={c.name} src={conditionIcon(c.name)} alt={c.name}
                    width={18} height={18} class="display-summary__condition-icon" />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
