import { h } from 'preact';
import { TabPlaceholder } from './TabPlaceholder';

export function HistoryTabPlaceholder() {
  return (
    <TabPlaceholder
      title="History"
      batch="T0d"
      blurb="Auto-generated timeline of scenarios, level-ups, and major events."
    />
  );
}
