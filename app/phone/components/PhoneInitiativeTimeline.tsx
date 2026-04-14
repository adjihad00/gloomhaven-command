import { h } from 'preact';
import { useState, useEffect, useRef, useMemo } from 'preact/hooks';
import { useGameState } from '../../hooks/useGameState';
import { characterThumbnail, monsterThumbnail } from '../../shared/assets';
import { formatName } from '../../shared/formatName';
import { getInitiativeOrder } from '@gloomhaven-command/shared';
import type { GameState } from '@gloomhaven-command/shared';

interface PhoneInitiativeTimelineProps {
  selectedCharacter: string;
  characterColor?: string;
}

export function PhoneInitiativeTimeline({ selectedCharacter, characterColor }: PhoneInitiativeTimelineProps) {
  const { state, phase } = useGameState();
  const [visible, setVisible] = useState(false);
  const prevPhase = useRef(phase);
  const prevActive = useRef(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const isPlayPhase = phase === 'next';

  const orderedFigures = useMemo(() => {
    if (!state) return [];
    return getInitiativeOrder(state as GameState)
      .filter(f => !f.absent && f.initiative > 0);
  }, [state]);

  const activeIndex = orderedFigures.findIndex(f => f.active);
  const playerFigure = orderedFigures.find(
    f => f.type === 'character' && f.name === selectedCharacter
  );
  const isPlayerActive = playerFigure?.active ?? false;
  const activeFigure = orderedFigures.find(f => f.active);
  const activeName = activeFigure ? formatName(activeFigure.name) : '';

  useEffect(() => {
    if (isPlayPhase && prevPhase.current === 'draw') {
      setVisible(true);
    }
    prevPhase.current = phase;
  }, [phase, isPlayPhase]);

  useEffect(() => {
    if (isPlayerActive && !prevActive.current) {
      setVisible(false);
    }
    if (!isPlayerActive && prevActive.current && isPlayPhase) {
      setVisible(true);
    }
    prevActive.current = isPlayerActive;
  }, [isPlayerActive, isPlayPhase]);

  // Smoothly scroll active figure to center
  useEffect(() => {
    if (visible && trackRef.current && activeIndex >= 0) {
      const track = trackRef.current;
      const items = track.children;
      if (items[activeIndex]) {
        const item = items[activeIndex] as HTMLElement;
        const scrollLeft = item.offsetLeft - (track.clientWidth / 2) + (item.offsetWidth / 2);
        track.scrollTo({ left: scrollLeft, behavior: 'smooth' });
      }
    }
  }, [visible, activeIndex]);

  if (!visible || !isPlayPhase || orderedFigures.length === 0) return null;

  return (
    <div class="phone-timeline" role="dialog" aria-modal="true" aria-label="Initiative timeline">
      <div class="phone-timeline__overlay" />

      {/* Top banner: active figure name */}
      <div class="phone-timeline__banner">
        {activeName && (
          <span class="phone-timeline__active-name">{activeName}'s Turn</span>
        )}
      </div>

      {/* Carousel with gold line through initiative numbers */}
      <div class="phone-timeline__carousel">
        <div class="phone-timeline__track" ref={trackRef}>
          {orderedFigures.map((fig) => {
            const isPlayer = fig.type === 'character' && fig.name === selectedCharacter;
            const isDone = fig.off;
            const isActive = fig.active;
            const thumbnail = fig.type === 'character'
              ? characterThumbnail(fig.edition, fig.name)
              : monsterThumbnail(fig.edition, fig.name);

            return (
              <div
                key={`${fig.edition}-${fig.name}`}
                class={`phone-timeline__figure ${isActive ? 'phone-timeline__figure--active' : ''} ${isDone ? 'phone-timeline__figure--done' : ''} ${isPlayer ? 'phone-timeline__figure--player' : ''}`}
                style={isPlayer && characterColor ? { '--timeline-player-color': characterColor } as any : undefined}
              >
                <div class="phone-timeline__portrait">
                  <img src={thumbnail} alt={fig.name} class="phone-timeline__img" loading="lazy" />
                </div>
                {/* Initiative number — gold bar runs behind these */}
                <div class="phone-timeline__init-wrap">
                  <span class="phone-timeline__init">{fig.initiative}</span>
                </div>
              </div>
            );
          })}
        </div>
        {/* Gold bar at initiative number level — interrupted by numbers */}
        <div class="phone-timeline__gold-bar" aria-hidden="true" />
      </div>

      {/* Dismiss button */}
      <button
        class="phone-timeline__dismiss"
        onClick={() => setVisible(false)}
        aria-label="Return to character view"
      >
        Return to Character View
      </button>
    </div>
  );
}
