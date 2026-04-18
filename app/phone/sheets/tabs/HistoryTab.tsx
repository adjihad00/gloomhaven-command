import { h } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import type {
  Character,
  HistoryEntry,
  HistoryEntryScenarioCompleted,
  HistoryEntryScenarioFailed,
} from '@gloomhaven-command/shared';
import { useCommands } from '../../../hooks/useCommands';
import { XPIcon, GoldIcon } from '../../../components/Icons';

interface HistoryTabProps {
  character: Character;
}

/**
 * Phase T0d: History tab — reverse-chronological timeline of scenario events.
 *
 * On first render, fires `backfillCharacterHistory` (idempotent engine-side)
 * to seed entries from `state.party.scenarios`. Live entries are appended by
 * `handleCompleteScenario`. Read-only for everyone; GMs don't edit history.
 */
export function HistoryTab({ character }: HistoryTabProps) {
  const commands = useCommands();
  const backfillFired = useRef(false);

  useEffect(() => {
    if (backfillFired.current) return;
    if (character.progress?.historyBackfilled) return;
    backfillFired.current = true;
    commands.backfillCharacterHistory(character.name, character.edition);
  }, [character.name, character.edition, character.progress?.historyBackfilled]);

  const entries: HistoryEntry[] = character.progress?.history ?? [];
  const reversed = [...entries].reverse();

  return (
    <section class="history-tab" role="region" aria-labelledby="history-tab-heading">
      <header class="history-tab__header">
        <h3 id="history-tab-heading" class="history-tab__heading">History</h3>
        <p class="history-tab__subheading">
          {reversed.length > 0
            ? `${reversed.length} entr${reversed.length === 1 ? 'y' : 'ies'} in this hero's story.`
            : "Your hero's story begins. Entries will appear here as you play."}
        </p>
      </header>

      {reversed.length === 0 ? (
        <EmptyState />
      ) : (
        <ol class="history-tab__timeline" role="list">
          {reversed.map((entry) => (
            <li
              key={entry.id}
              class={`history-tab__entry history-tab__entry--${entry.kind}${entry.backfilled ? ' history-tab__entry--backfilled' : ''}`}
            >
              <HistoryEntryRow entry={entry} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function HistoryEntryRow({ entry }: { entry: HistoryEntry }) {
  switch (entry.kind) {
    case 'scenarioCompleted':
      return <ScenarioCompletedRow entry={entry} />;
    case 'scenarioFailed':
      return <ScenarioFailedRow entry={entry} />;
    default: {
      // Exhaustiveness guard — new history variants land with future batches.
      const _exhaustive: never = entry;
      void _exhaustive;
      return <UnknownEntryRow entry={entry as HistoryEntry} />;
    }
  }
}

function ScenarioCompletedRow({ entry }: { entry: HistoryEntryScenarioCompleted }) {
  return (
    <article class="history-entry history-entry--completed">
      <div class="history-entry__marker" aria-hidden="true">
        <div class="history-entry__marker-dot history-entry__marker-dot--victory" />
      </div>
      <div class="history-entry__body">
        <header class="history-entry__title">
          Scenario <span class="history-entry__scenario-num">#{entry.scenarioIndex}</span>
          <span class="history-entry__outcome history-entry__outcome--victory">Completed</span>
          {entry.backfilled && (
            <span class="history-entry__backfilled-chip" title="Reconstructed from older save data">
              Reconstructed
            </span>
          )}
        </header>
        {!entry.backfilled && <RewardRow entry={entry} />}
        <footer class="history-entry__meta">
          <span class="history-entry__edition">{entry.edition.toUpperCase()}</span>
          {entry.scenarioLevel > 0 && (
            <span class="history-entry__level">Level {entry.scenarioLevel}</span>
          )}
          {entry.group && <span class="history-entry__group">{entry.group}</span>}
        </footer>
      </div>
    </article>
  );
}

function ScenarioFailedRow({ entry }: { entry: HistoryEntryScenarioFailed }) {
  return (
    <article class="history-entry history-entry--failed">
      <div class="history-entry__marker" aria-hidden="true">
        <div class="history-entry__marker-dot history-entry__marker-dot--defeat" />
      </div>
      <div class="history-entry__body">
        <header class="history-entry__title">
          Scenario <span class="history-entry__scenario-num">#{entry.scenarioIndex}</span>
          <span class="history-entry__outcome history-entry__outcome--defeat">Failed</span>
        </header>
        {!entry.backfilled && <RewardRow entry={entry} />}
        <footer class="history-entry__meta">
          <span class="history-entry__edition">{entry.edition.toUpperCase()}</span>
          {entry.scenarioLevel > 0 && (
            <span class="history-entry__level">Level {entry.scenarioLevel}</span>
          )}
          {entry.group && <span class="history-entry__group">{entry.group}</span>}
        </footer>
      </div>
    </article>
  );
}

function RewardRow({
  entry,
}: {
  entry: HistoryEntryScenarioCompleted | HistoryEntryScenarioFailed;
}) {
  const xp = entry.xpGained;
  const gold = entry.goldGained;
  const battleGoalChecks =
    entry.kind === 'scenarioCompleted' ? entry.battleGoalChecks : undefined;

  const hasAny =
    (xp !== undefined && xp !== 0) ||
    (gold !== undefined && gold !== 0) ||
    (battleGoalChecks !== undefined && battleGoalChecks > 0);
  if (!hasAny) return null;

  return (
    <dl class="history-entry__rewards">
      {xp !== undefined && xp !== 0 && (
        <div class="history-entry__reward">
          <XPIcon size={14} />
          <dt class="sr-only">XP gained</dt>
          <dd>+{xp}</dd>
        </div>
      )}
      {gold !== undefined && gold !== 0 && (
        <div class="history-entry__reward">
          <GoldIcon size={14} />
          <dt class="sr-only">Gold gained</dt>
          <dd>+{gold}</dd>
        </div>
      )}
      {battleGoalChecks !== undefined && battleGoalChecks > 0 && (
        <div class="history-entry__reward">
          <span class="history-entry__reward-icon" aria-hidden="true">◆</span>
          <dt class="sr-only">Battle goal checks</dt>
          <dd>+{battleGoalChecks}</dd>
        </div>
      )}
    </dl>
  );
}

function UnknownEntryRow({ entry }: { entry: HistoryEntry }) {
  return (
    <article class="history-entry history-entry--unknown">
      <div class="history-entry__body">
        <header class="history-entry__title">
          <span class="history-entry__scenario-num">Entry #{entry.id}</span>
        </header>
        <p class="history-entry__unknown-text">
          (This entry requires a newer app version to display properly.)
        </p>
      </div>
    </article>
  );
}

function EmptyState() {
  return (
    <div class="history-tab__empty">
      <p class="history-tab__empty-text">
        No entries yet. Your first scenario will be recorded here.
      </p>
    </div>
  );
}
