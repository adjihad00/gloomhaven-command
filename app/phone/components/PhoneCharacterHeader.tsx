import { h } from 'preact';
import { characterThumbnail } from '../../shared/assets';
import { formatName } from '../../shared/formatName';

interface PhoneCharacterHeaderProps {
  name: string;
  edition: string;
  level: number;
  characterColor?: string;
  health: number;
  maxHealth: number;
  onTap?: () => void;
}

export function PhoneCharacterHeader({
  name, edition, level, characterColor, health, maxHealth, onTap,
}: PhoneCharacterHeaderProps) {
  const accentColor = characterColor || 'var(--accent-copper)';
  const ratio = maxHealth > 0 ? health / maxHealth : 0;
  const hpColor = ratio > 0.5 ? 'var(--health-green)' : ratio > 0.25 ? 'var(--accent-gold)' : 'var(--negative-red)';

  return (
    <button
      class="phone-header"
      onClick={onTap}
      aria-label={`${formatName(name)} details`}
      style={{ '--char-accent': accentColor } as any}
    >
      <div class="phone-header__accent-bar" />

      {/* HP bar as background fill */}
      <div class="phone-header__hp-bg">
        <div
          class="phone-header__hp-fill"
          style={{ width: `${ratio * 100}%`, backgroundColor: hpColor }}
        />
      </div>

      <div class="phone-header__content">
        <img
          src={characterThumbnail(edition, name)}
          alt=""
          class="phone-header__thumb"
          loading="lazy"
        />
        <div class="phone-header__info">
          <span class="phone-header__name">{formatName(name)}</span>
          <span class="phone-header__level">Level {level}</span>
        </div>
        <span class="phone-header__hp-text">
          {health}/{maxHealth}
        </span>
      </div>
    </button>
  );
}
