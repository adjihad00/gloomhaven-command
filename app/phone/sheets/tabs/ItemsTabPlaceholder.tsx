import { h } from 'preact';
import { TabPlaceholder } from './TabPlaceholder';

export function ItemsTabPlaceholder() {
  return (
    <TabPlaceholder
      title="Items"
      batch="T2a"
      blurb="Equipped gear by slot, inventory, shop browser, and sell actions."
    />
  );
}
