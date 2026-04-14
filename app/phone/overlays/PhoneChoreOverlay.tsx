import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { useGameState } from '../../hooks/useGameState';
import { useCommands } from '../../hooks/useCommands';
import { formatName } from '../../shared/formatName';
import { monsterThumbnail } from '../../shared/assets';

interface PhoneChoreOverlayProps {
  selectedCharacter: string;
}

export function PhoneChoreOverlay({ selectedCharacter }: PhoneChoreOverlayProps) {
  const { state } = useGameState();
  const commands = useCommands();
  const [visible, setVisible] = useState(false);
  const prevPhase = useRef<string | undefined>(undefined);

  const setupPhase = state?.setupPhase;
  const setupData = state?.setupData;

  useEffect(() => {
    if (setupPhase === 'chores' && prevPhase.current !== 'chores') {
      setVisible(true);
    }
    if (setupPhase !== 'chores' && prevPhase.current === 'chores') {
      setVisible(false);
    }
    if (!setupPhase && prevPhase.current) {
      setVisible(false);
    }
    prevPhase.current = setupPhase ?? undefined;
  }, [setupPhase]);

  if (!visible || !setupData || setupPhase !== 'chores') return null;

  const myChore = setupData.chores.find(c => c.characterName === selectedCharacter);
  const isConfirmed = !!setupData.choreConfirmations[selectedCharacter];
  const edition = setupData.edition;

  // Find my character's edition for the command
  const myChar = state?.characters?.find(c => c.name === selectedCharacter);
  const charEdition = myChar?.edition || edition;

  const choreTitle: Record<string, string> = {
    monsters: 'Collect Monster Standees',
    map: 'Collect Map Tiles',
    overlays: 'Collect Overlay Tiles',
    decks: 'Collect Stat Cards & Ability Decks',
  };

  const handleConfirm = () => {
    commands.confirmChore(selectedCharacter, charEdition);
  };

  return (
    <div class="phone-chore" role="dialog" aria-modal="true">
      <div class="phone-chore__overlay" />
      <div class="phone-chore__content">
        <h2 class="phone-chore__heading">Your Setup Task</h2>

        {myChore ? (
          <>
            <h3 class="phone-chore__title">{choreTitle[myChore.choreType] || 'Setup Task'}</h3>

            <div class="phone-chore__items">
              {myChore.items.map((item, i) => (
                <div key={i} class="phone-chore__item">
                  {myChore.choreType === 'monsters' && item.dataName && (
                    <img
                      src={monsterThumbnail(edition, item.dataName)}
                      alt={item.name}
                      class="phone-chore__item-img"
                      loading="lazy"
                    />
                  )}
                  <div class="phone-chore__item-info">
                    <span class="phone-chore__item-name">{item.name}</span>
                    {item.count && (
                      <span class="phone-chore__item-detail">{item.count} standees</span>
                    )}
                    {item.ref && (
                      <span class="phone-chore__item-detail">Tile: {item.ref}</span>
                    )}
                    {item.description && (
                      <span class="phone-chore__item-detail">{item.description}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {myChore.choreType === 'monsters' && (
              <div class="phone-chore__reminder">
                Also collect:
                <ul>
                  <li>Stat cards for each monster type</li>
                  <li>Ability card decks (shuffle each)</li>
                </ul>
              </div>
            )}

            {myChore.choreType === 'overlays' && (
              <div class="phone-chore__reminder">
                Place overlay tiles for Room 1 only during initial setup.
                Other rooms are revealed when doors are opened.
              </div>
            )}

            <button
              class={`phone-chore__confirm ${isConfirmed ? 'phone-chore__confirm--done' : ''}`}
              onClick={handleConfirm}
              disabled={isConfirmed}
              aria-label={isConfirmed ? 'Task confirmed' : 'Confirm task complete'}
            >
              {isConfirmed ? '\u2713  Task Complete' : 'Task Complete'}
            </button>

            {isConfirmed && (
              <div class="phone-chore__waiting">
                Waiting for other players...
              </div>
            )}
          </>
        ) : (
          <div class="phone-chore__no-task">
            <p>No setup task assigned to you.</p>
            <p>Waiting for other players to finish...</p>
          </div>
        )}
      </div>
    </div>
  );
}
