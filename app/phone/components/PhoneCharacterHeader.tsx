import { h } from 'preact';
import { characterThumbnail } from '../../shared/assets';
import { formatName } from '../../shared/formatName';

interface PhoneCharacterHeaderProps {
  name: string;
  edition: string;
  level: number;
  characterColor?: string;
  onTap?: () => void;
}

export function PhoneCharacterHeader({ name, edition, level, characterColor, onTap }: PhoneCharacterHeaderProps) {
  const accentColor = characterColor || 'var(--accent-copper)';

  return (
    <button
      class="phone-header"
      onClick={onTap}
      aria-label={`${formatName(name)} details`}
      style={{ '--char-accent': accentColor } as any}
    >
      <div class="phone-header__accent-bar" />
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
        <div class="phone-header__chevron" aria-hidden="true">&#x203A;</div>
      </div>
    </button>
  );
}
