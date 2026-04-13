import { h } from 'preact';
import { useState } from 'preact/hooks';
import type { Character } from '@gloomhaven-command/shared';
import { useDataApi } from '../../hooks/useDataApi';
import { OverlayBackdrop } from './OverlayBackdrop';
import { formatName } from '../../shared/formatName';
import { characterThumbnail } from '../../shared/assets';

interface CharacterSheetOverlayProps {
  character: Character;
  edition: string;
  onClose: () => void;
}

type SheetTab = 'stats' | 'perks' | 'items' | 'quest';

export function CharacterSheetOverlay({ character, edition, onClose }: CharacterSheetOverlayProps) {
  const [activeTab, setActiveTab] = useState<SheetTab>('stats');
  const ed = character.edition || edition;
  const { data: classData } = useDataApi<any>(`${ed}/character/${character.name}`, true);

  const tabs: SheetTab[] = ['stats', 'perks', 'items', 'quest'];

  return (
    <OverlayBackdrop onClose={onClose} position="right">
      <div class="sheet">
        <div class="sheet__header">
          <img class="sheet__portrait" src={characterThumbnail(ed, character.name)} alt={character.name} />
          <div class="sheet__title">
            <span class="sheet__class">{formatName(character.name)}</span>
            {character.title && <span class="sheet__name">"{character.title}"</span>}
            <span class="sheet__level">Level {character.level}</span>
          </div>
        </div>

        <div class="sheet__tabs">
          {tabs.map(tab => (
            <button
              key={tab}
              class={`sheet__tab ${activeTab === tab ? 'sheet__tab--active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div class="sheet__content">
          {activeTab === 'stats' && <StatsTab character={character} classData={classData} />}
          {activeTab === 'perks' && <PerksTab character={character} classData={classData} />}
          {activeTab === 'items' && <ItemsTab character={character} />}
          {activeTab === 'quest' && <QuestTab character={character} />}
        </div>
      </div>
    </OverlayBackdrop>
  );
}

const XP_THRESHOLDS = [0, 45, 95, 150, 210, 275, 345, 420, 500];

function StatsTab({ character, classData }: { character: Character; classData: any }) {
  const currentXP = character.experience || 0;
  const nextThreshold = XP_THRESHOLDS.find(t => t > currentXP) || 500;

  return (
    <div class="sheet__stats">
      <div class="sheet__stat-row">
        <span class="sheet__stat-label">Class</span>
        <span class="sheet__stat-value">{formatName(character.name)}</span>
      </div>
      <div class="sheet__stat-row">
        <span class="sheet__stat-label">Level</span>
        <span class="sheet__stat-value">{character.level}</span>
      </div>
      <div class="sheet__stat-row">
        <span class="sheet__stat-label">XP</span>
        <span class="sheet__stat-value">{currentXP} / {nextThreshold}</span>
      </div>
      <div class="sheet__stat-row">
        <span class="sheet__stat-label">HP at level</span>
        <span class="sheet__stat-value">{character.maxHealth}</span>
      </div>
      {classData?.handSize && (
        <div class="sheet__stat-row">
          <span class="sheet__stat-label">Hand Size</span>
          <span class="sheet__stat-value">{classData.handSize} cards</span>
        </div>
      )}
      <div class="sheet__stat-row">
        <span class="sheet__stat-label">Gold</span>
        <span class="sheet__stat-value">{character.loot || 0}</span>
      </div>
      <div class="sheet__thresholds">
        <span class="sheet__stat-label">XP Thresholds</span>
        <div class="sheet__threshold-row">
          {XP_THRESHOLDS.map((t, i) => (
            <span key={i} class={`sheet__threshold ${currentXP >= t ? 'sheet__threshold--reached' : ''}`}>
              Lv{i + 1}: {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function PerksTab({ character, classData }: { character: Character; classData: any }) {
  const perks = classData?.perks || [];

  if (perks.length === 0) {
    return <div class="sheet__empty">Perk data not available for this class.</div>;
  }

  return (
    <div class="sheet__perks">
      {perks.map((perk: any, i: number) => {
        const checked = character.progress?.perks?.[i] > 0;
        return (
          <div key={i} class="sheet__perk-row">
            <span class="sheet__perk-check">{checked ? '\u2611' : '\u2610'}</span>
            <span class="sheet__perk-desc">{formatPerkDescription(perk)}</span>
          </div>
        );
      })}
    </div>
  );
}

function formatPerkDescription(perk: any): string {
  const type = perk.type || 'unknown';
  const cards = perk.cards || [];

  const describeCard = (c: any) => {
    const mod = c.attackModifier?.type || 'card';
    const rolling = c.attackModifier?.rolling ? ' rolling' : '';
    return `${c.count}x${rolling} ${mod}`;
  };

  if (type === 'remove' && cards.length > 0) {
    return `Remove ${cards.map(describeCard).join(', ')}`;
  }
  if (type === 'replace' && cards.length >= 2) {
    return `Replace ${describeCard(cards[0])} with ${describeCard(cards[1])}`;
  }
  if (type === 'add' && cards.length > 0) {
    return `Add ${cards.map(describeCard).join(', ')}`;
  }
  return `${type}: ${JSON.stringify(cards).substring(0, 80)}`;
}

function ItemsTab({ character }: { character: Character }) {
  const items = character.progress?.items || [];
  if (items.length === 0) {
    return <div class="sheet__empty">No items equipped. Item management available in Town mode.</div>;
  }
  return (
    <div class="sheet__items">
      {items.map((item: any, i: number) => (
        <div key={i} class="sheet__item-row">
          <span>{item.name || item.id || `Item ${i + 1}`}</span>
          <span class="sheet__item-edition">{item.edition || ''}</span>
        </div>
      ))}
    </div>
  );
}

function QuestTab({ character }: { character: Character }) {
  const quest = character.progress?.personalQuest;
  if (!quest) {
    return <div class="sheet__empty">No personal quest data. Import from GHS save or assign in Town mode.</div>;
  }
  return (
    <div class="sheet__quest">
      <p>Personal Quest: {quest}</p>
    </div>
  );
}
