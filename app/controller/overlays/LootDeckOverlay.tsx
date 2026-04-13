import { h } from 'preact';
import type { LootDeck, Character } from '@gloomhaven-command/shared';
import { useCommands } from '../../hooks/useCommands';
import { OverlayBackdrop } from './OverlayBackdrop';
import { LootDeckPanel } from '../../components/LootDeckPanel';

interface LootDeckOverlayProps {
  lootDeck: LootDeck;
  characters: Character[];
  edition: string;
  onClose: () => void;
}

export function LootDeckOverlay({ lootDeck, characters, edition, onClose }: LootDeckOverlayProps) {
  const commands = useCommands();

  return (
    <OverlayBackdrop onClose={onClose} position="right">
      <LootDeckPanel
        lootDeck={lootDeck}
        characters={characters}
        edition={edition}
        onDraw={() => commands.drawLootCard()}
        onAssign={(cardIndex, charName, charEdition) => commands.assignLoot(cardIndex, charName, charEdition)}
      />
    </OverlayBackdrop>
  );
}
