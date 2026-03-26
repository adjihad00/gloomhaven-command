import { useState } from 'preact/hooks';
import type { ConnectionStatus } from '../../clients/shared/lib/connection';

interface Props {
  gameCode: string;
  status: ConnectionStatus;
  error: string | null;
  onConnect: (gameCode: string) => void;
  onDisconnect: () => void;
}

export function ConnectionScreen({ gameCode: initialCode, status, error, onConnect, onDisconnect }: Props) {
  const [code, setCode] = useState(initialCode);

  const connected = status === 'connected';
  const connecting = status === 'connecting' || status === 'reconnecting';

  const handleConnect = () => {
    const trimmed = code.trim();
    if (trimmed) onConnect(trimmed);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') handleConnect();
  };

  return (
    <div class="setup-screen">
      <div class="setup-content">
        <h1 class="heading-xl setup-title">Gloomhaven<br />Command</h1>
        <p class="setup-subtitle">Player</p>

        <div class="setup-section">
          <div class="form-group">
            <label class="form-label">Game Code</label>
            <input
              class="form-input"
              type="text"
              placeholder="Enter game code..."
              value={code}
              onInput={(e) => setCode((e.target as HTMLInputElement).value)}
              onKeyDown={handleKeyDown}
              disabled={connecting}
            />
          </div>
          <button
            class="btn btn-primary"
            onClick={handleConnect}
            disabled={connecting || !code.trim()}
          >
            {connecting ? 'Connecting...' : 'Connect'}
          </button>
        </div>

        {(connecting || connected) && (
          <div class={`connection-status ${connected ? 'connected' : ''}`}>
            <span class={`status-dot ${connected ? 'connected' : ''}`}></span>
            <span>
              {status === 'connecting' && 'Connecting...'}
              {status === 'reconnecting' && 'Reconnecting...'}
              {status === 'connected' && 'Connected'}
            </span>
          </div>
        )}

        {error && (
          <div class="import-status error">{error}</div>
        )}

        {connected && (
          <button class="btn-text" onClick={onDisconnect}>
            Disconnect
          </button>
        )}
      </div>
    </div>
  );
}
