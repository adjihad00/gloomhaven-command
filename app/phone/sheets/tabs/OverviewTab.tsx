import { h } from 'preact';
import type {
  Character,
  ConditionName,
  ElementModel,
  ElementType,
  ElementState,
  LootDeck,
} from '@gloomhaven-command/shared';
import { useGameState } from '../../../hooks/useGameState';
import { OverviewXPBar } from './OverviewXPBar';
import { OverviewStatMedallions } from './OverviewStatMedallions';
import { OverviewActiveScenario } from './OverviewActiveScenario';
import { OverviewHandPreview } from './OverviewHandPreview';

interface OverviewTabProps {
  character: Character;
  edition: string;
  elements?: ElementModel[];
  lootDeck?: LootDeck | null;
  isActive: boolean;
  onChangeHealth?: (delta: number) => void;
  onSetXP?: (value: number) => void;
  onToggleCondition?: (name: ConditionName) => void;
  onToggleLongRest?: () => void;
  onToggleAbsent?: () => void;
  onToggleExhausted?: () => void;
  onMoveElement?: (element: ElementType, newState: ElementState) => void;
}

/**
 * Phase T0a: Overview tab — the reference-quality tab.
 *
 * Composition:
 *   - XP bar (career XP vs next threshold, with wax-seal level-up cue)
 *   - 4-up stat medallions (Gold / HP / Scenarios / Perks)
 *   - Active Scenario section (only when mode === 'scenario')
 *   - Hand preview placeholder (interactivity arrives in T2b)
 *
 * Gating on `state.mode` is derived during render; Active Scenario and
 * Current Activity are mutually exclusive in practice.
 */
export function OverviewTab(props: OverviewTabProps) {
  const {
    character, edition, elements, lootDeck, isActive,
    onChangeHealth, onSetXP, onToggleCondition,
    onToggleLongRest, onToggleAbsent, onToggleExhausted,
    onMoveElement,
  } = props;
  const { state } = useGameState();
  const mode = state?.mode ?? 'scenario';

  return (
    <div class="overview-tab">
      <OverviewXPBar character={character} />
      <OverviewStatMedallions character={character} />

      {mode === 'scenario' && (
        <OverviewActiveScenario
          character={character}
          edition={edition}
          elements={elements}
          lootDeck={lootDeck}
          isActive={isActive}
          onChangeHealth={onChangeHealth}
          onSetXP={onSetXP}
          onToggleCondition={onToggleCondition}
          onToggleLongRest={onToggleLongRest}
          onToggleAbsent={onToggleAbsent}
          onToggleExhausted={onToggleExhausted}
          onMoveElement={onMoveElement}
        />
      )}

      {/* Current Activity — T8 hookup (town downtime). Stubbed for T0a. */}

      <OverviewHandPreview />
    </div>
  );
}
