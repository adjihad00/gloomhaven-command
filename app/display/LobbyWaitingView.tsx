import { h } from 'preact';

export function LobbyWaitingView() {
  return (
    <div class="display-lobby">
      <h1 class="display-lobby__title">Gloomhaven Command</h1>
      <p class="display-lobby__status">Setting up scenario...</p>
      <p class="display-lobby__hint">The game will begin shortly.</p>
    </div>
  );
}
