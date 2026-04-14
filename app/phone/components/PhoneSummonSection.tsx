// TODO: Summons deferred — develop jointly with controller summon mechanism
import { h } from 'preact';
import type { Summon, ConditionName } from '@gloomhaven-command/shared';

interface PhoneSummonSectionProps {
  summons: Summon[];
  characterName: string;
  characterEdition: string;
  onChangeHealth: (summonUuid: string, delta: number) => void;
  onRemoveSummon: (summonUuid: string) => void;
  onToggleCondition: (summonUuid: string, condition: ConditionName) => void;
}

export function PhoneSummonSection(_props: PhoneSummonSectionProps) {
  return null;
}
