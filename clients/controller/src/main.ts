// Controller client entry point
import { Connection, StateStore, CommandSender } from '@gloomhaven-command/client-lib';
import type { ConnectionStatus } from '@gloomhaven-command/client-lib';
import type { GameState } from '@gloomhaven-command/shared';

// ── Module state ──

let connection: Connection | null = null;
let store: StateStore | null = null;
let commands: CommandSender | null = null;
let gameCode: string = '';
let gameScreenActive: boolean = false;

// Exported accessors for tab modules (Phase 2C+)
export function getStore(): StateStore { return store!; }
export function getCommands(): CommandSender { return commands!; }
export function getConnection(): Connection { return connection!; }
export function getGameCode(): string { return gameCode; }

// ── DOM references ──

let setupScreen: HTMLDivElement;
let gameScreen: HTMLDivElement;
let connectForm: HTMLDivElement;
let gameCodeInput: HTMLInputElement;
let connectBtn: HTMLButtonElement;
let connectionStatusEl: HTMLDivElement;
let statusDot: HTMLSpanElement;
let statusText: HTMLSpanElement;
let gameSetup: HTMLDivElement;
let connectedGameCode: HTMLSpanElement;
let newGameBtn: HTMLButtonElement;
let importBtn: HTMLButtonElement;
let resumeBtn: HTMLButtonElement;
let importPanel: HTMLDivElement;
let importTextarea: HTMLTextAreaElement;
let importFileInput: HTMLInputElement;
let importSubmitBtn: HTMLButtonElement;
let importStatus: HTMLDivElement;
let disconnectBtn: HTMLButtonElement;
let headerRound: HTMLSpanElement;
let headerPhase: HTMLSpanElement;
let headerStatus: HTMLSpanElement;
let headerMenuBtn: HTMLButtonElement;
let fabContainer: HTMLDivElement;
let menuOverlay: HTMLDivElement;
let menuUndoBtn: HTMLButtonElement;
let menuExportBtn: HTMLButtonElement;
let menuDisconnectBtn: HTMLButtonElement;
let menuCloseBtn: HTMLButtonElement;

// ── Initialization ──

document.addEventListener('DOMContentLoaded', () => {
  // Grab DOM elements
  setupScreen = document.getElementById('setupScreen') as HTMLDivElement;
  gameScreen = document.getElementById('gameScreen') as HTMLDivElement;
  connectForm = document.getElementById('connectForm') as HTMLDivElement;
  gameCodeInput = document.getElementById('gameCodeInput') as HTMLInputElement;
  connectBtn = document.getElementById('connectBtn') as HTMLButtonElement;
  connectionStatusEl = document.getElementById('connectionStatus') as HTMLDivElement;
  statusDot = document.getElementById('statusDot') as HTMLSpanElement;
  statusText = document.getElementById('statusText') as HTMLSpanElement;
  gameSetup = document.getElementById('gameSetup') as HTMLDivElement;
  connectedGameCode = document.getElementById('connectedGameCode') as HTMLSpanElement;
  newGameBtn = document.getElementById('newGameBtn') as HTMLButtonElement;
  importBtn = document.getElementById('importBtn') as HTMLButtonElement;
  resumeBtn = document.getElementById('resumeBtn') as HTMLButtonElement;
  importPanel = document.getElementById('importPanel') as HTMLDivElement;
  importTextarea = document.getElementById('importTextarea') as HTMLTextAreaElement;
  importFileInput = document.getElementById('importFileInput') as HTMLInputElement;
  importSubmitBtn = document.getElementById('importSubmitBtn') as HTMLButtonElement;
  importStatus = document.getElementById('importStatus') as HTMLDivElement;
  disconnectBtn = document.getElementById('disconnectBtn') as HTMLButtonElement;
  headerRound = document.getElementById('headerRound') as HTMLSpanElement;
  headerPhase = document.getElementById('headerPhase') as HTMLSpanElement;
  headerStatus = document.getElementById('headerStatus') as HTMLSpanElement;
  headerMenuBtn = document.getElementById('headerMenuBtn') as HTMLButtonElement;
  fabContainer = document.getElementById('fabContainer') as HTMLDivElement;
  menuOverlay = document.getElementById('menuOverlay') as HTMLDivElement;
  menuUndoBtn = document.getElementById('menuUndoBtn') as HTMLButtonElement;
  menuExportBtn = document.getElementById('menuExportBtn') as HTMLButtonElement;
  menuDisconnectBtn = document.getElementById('menuDisconnectBtn') as HTMLButtonElement;
  menuCloseBtn = document.getElementById('menuCloseBtn') as HTMLButtonElement;

  // Pre-fill saved game code
  const savedCode = localStorage.getItem('gc_gameCode');
  if (savedCode) {
    gameCodeInput.value = savedCode;
  }

  // Wire event listeners
  connectBtn.addEventListener('click', handleConnect);
  gameCodeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleConnect();
  });
  newGameBtn.addEventListener('click', () => enterGameScreen());
  importBtn.addEventListener('click', () => importPanel.classList.toggle('hidden'));
  importSubmitBtn.addEventListener('click', handleImport);
  importFileInput.addEventListener('change', handleFileSelect);
  resumeBtn.addEventListener('click', () => enterGameScreen());
  disconnectBtn.addEventListener('click', handleDisconnect);

  // Menu
  headerMenuBtn.addEventListener('click', () => menuOverlay.classList.remove('hidden'));
  menuCloseBtn.addEventListener('click', () => menuOverlay.classList.add('hidden'));
  menuUndoBtn.addEventListener('click', () => {
    commands?.undoAction();
    menuOverlay.classList.add('hidden');
  });
  menuExportBtn.addEventListener('click', () => {
    window.open(`/api/export/${gameCode}`);
    menuOverlay.classList.add('hidden');
  });
  menuDisconnectBtn.addEventListener('click', () => {
    connection?.disconnect();
    menuOverlay.classList.add('hidden');
    exitGameScreen();
  });

  // Close menu on backdrop click
  menuOverlay.addEventListener('click', (e) => {
    if (e.target === menuOverlay) menuOverlay.classList.add('hidden');
  });
});

// ── Connect ──

function handleConnect(): void {
  const code = gameCodeInput.value.trim();
  if (!code) return;

  gameCode = code;
  localStorage.setItem('gc_gameCode', gameCode);

  // Show status, disable button
  connectionStatusEl.classList.remove('hidden');
  connectBtn.disabled = true;
  statusText.textContent = 'Connecting...';
  statusDot.className = 'status-dot';

  // Create infrastructure
  store = new StateStore();
  connection = new Connection({
    gameCode,
    onStateUpdate: handleStateUpdate,
    onConnectionChange: handleConnectionChange,
    onError: showError,
  });
  commands = new CommandSender(connection);

  // Register as controller
  const origOnChange = handleConnectionChange;
  connection = new Connection({
    gameCode,
    onStateUpdate: handleStateUpdate,
    onConnectionChange: (status: ConnectionStatus) => {
      origOnChange(status);
      if (status === 'connected') {
        connection!.register('controller');
      }
    },
    onError: showError,
  });
  commands = new CommandSender(connection);

  connection.connect();
}

// ── State update ──

function handleStateUpdate(state: GameState): void {
  store!.setState(state);

  if (gameScreenActive) {
    updateHeader(state);
  }

  // Show Resume button if game has existing state
  if (!gameScreenActive && (state.characters.length > 0 || state.round > 0)) {
    resumeBtn.classList.remove('hidden');
  }
}

// ── Connection status ──

function handleConnectionChange(status: ConnectionStatus): void {
  // Update setup screen status
  statusDot.className = 'status-dot';
  switch (status) {
    case 'connected':
      statusDot.classList.add('connected');
      statusText.textContent = 'Connected';
      // Transition from connect form to setup options
      if (!gameScreenActive) {
        connectForm.classList.add('hidden');
        gameSetup.classList.remove('hidden');
        connectedGameCode.textContent = `Game: ${gameCode}`;
      }
      break;
    case 'connecting':
      statusText.textContent = 'Connecting...';
      break;
    case 'reconnecting':
      statusText.textContent = 'Reconnecting...';
      break;
    case 'disconnected':
      statusDot.classList.add('disconnected');
      statusText.textContent = 'Disconnected';
      connectBtn.disabled = false;
      break;
  }

  // Update header status dot when in game
  if (gameScreenActive) {
    headerStatus.className = 'status-dot';
    if (status === 'connected') {
      headerStatus.classList.add('connected');
    } else if (status === 'disconnected') {
      headerStatus.classList.add('disconnected');
    }
  }
}

// ── Error display ──

function showError(message: string): void {
  console.error('[Controller]', message);
  // Show in import status if import panel is visible
  if (!importPanel.classList.contains('hidden')) {
    importStatus.textContent = message;
    importStatus.className = 'import-status error';
    importStatus.classList.remove('hidden');
  }
}

// ── Import handlers ──

function handleFileSelect(): void {
  const file = importFileInput.files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = () => {
      importTextarea.value = reader.result as string;
    };
    reader.readAsText(file);
  }
}

async function handleImport(): Promise<void> {
  const jsonText = importTextarea.value.trim();
  if (!jsonText) {
    showImportStatus('Please paste or upload a GHS JSON file.', false);
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    showImportStatus('Invalid JSON. Please check the format.', false);
    return;
  }

  try {
    importSubmitBtn.disabled = true;
    const res = await fetch('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameCode, ghsState: parsed }),
    });

    if (!res.ok) {
      const err = await res.text();
      showImportStatus(`Import failed: ${err}`, false);
      return;
    }

    showImportStatus('Import successful!', true);
    setTimeout(() => enterGameScreen(), 1000);
  } catch (err) {
    showImportStatus(`Network error: ${err}`, false);
  } finally {
    importSubmitBtn.disabled = false;
  }
}

function showImportStatus(message: string, success: boolean): void {
  importStatus.textContent = message;
  importStatus.className = `import-status ${success ? 'success' : 'error'}`;
  importStatus.classList.remove('hidden');
}

// ── Screen transitions ──

function enterGameScreen(): void {
  setupScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');
  gameScreenActive = true;

  initTabNavigation();

  // Update header with current state
  const state = store?.getState();
  if (state) {
    updateHeader(state);
  }

  fabContainer.classList.remove('hidden');
}

function exitGameScreen(): void {
  gameScreen.classList.add('hidden');
  setupScreen.classList.remove('hidden');
  gameScreenActive = false;

  // Reset to connect form
  gameSetup.classList.add('hidden');
  connectForm.classList.remove('hidden');
  connectionStatusEl.classList.add('hidden');
  connectBtn.disabled = false;
  importPanel.classList.add('hidden');
  importStatus.classList.add('hidden');
  resumeBtn.classList.add('hidden');
}

function handleDisconnect(): void {
  connection?.disconnect();
  exitGameScreen();
}

// ── Tab navigation ──

function initTabNavigation(): void {
  const tabBtns = document.querySelectorAll<HTMLButtonElement>('.tab-btn');
  const tabPanels = document.querySelectorAll<HTMLDivElement>('.tab-panel');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab!;
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const panelId = 'tab' + tabId.charAt(0).toUpperCase() + tabId.slice(1);
      document.getElementById(panelId)?.classList.add('active');
    });
  });
}

// ── Header update ──

function updateHeader(state: GameState): void {
  headerRound.textContent = state.round > 0 ? `Round ${state.round}` : 'Round \u2014';
  headerPhase.textContent = state.state === 'draw' ? 'Card Selection' : 'Playing';
}
