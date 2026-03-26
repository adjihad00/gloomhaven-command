import { useContext } from 'preact/hooks';
import { AppContext } from '../shared/context';

export function useCommands() {
  const { commands } = useContext(AppContext);
  if (!commands) throw new Error('useCommands used outside of connected AppContext');
  return commands;
}
