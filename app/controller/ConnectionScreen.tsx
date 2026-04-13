import { useState, useRef } from 'preact/hooks';
import type { ConnectionStatus } from '../../clients/shared/lib/connection';

interface Props {
  gameCode: string;
  status: ConnectionStatus;
  error: string | null;
  onConnect: (gameCode: string) => void;
  onDisconnect: () => void;
  hasExistingGame: boolean;
}

export function ConnectionScreen({ gameCode: initialCode, status, error, onConnect, onDisconnect, hasExistingGame }: Props) {
  const [code, setCode] = useState(initialCode);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState<{ message: string; success: boolean } | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const connected = status === 'connected';
  const connecting = status === 'connecting' || status === 'reconnecting';

  const handleConnect = () => {
    const trimmed = code.trim();
    if (trimmed) onConnect(trimmed);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') handleConnect();
  };

  const handleFileSelect = () => {
    const file = fileInputRef.current?.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setImportText(reader.result as string);
      reader.readAsText(file);
    }
  };

  const handleImport = async () => {
    const jsonText = importText.trim();
    if (!jsonText) {
      setImportStatus({ message: 'Please paste or upload a GHS JSON file.', success: false });
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      setImportStatus({ message: 'Invalid JSON. Please check the format.', success: false });
      return;
    }

    try {
      setImporting(true);
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameCode: code, ghsState: parsed }),
      });

      if (!res.ok) {
        const err = await res.text();
        setImportStatus({ message: `Import failed: ${err}`, success: false });
        return;
      }

      setImportStatus({ message: 'Import successful!', success: true });
    } catch (err) {
      setImportStatus({ message: `Network error: ${err}`, success: false });
    } finally {
      setImporting(false);
    }
  };

  const handleDisconnect = () => {
    setShowImport(false);
    setImportStatus(null);
    onDisconnect();
  };

  return (
    <div class="setup-screen">
      <div class="setup-content">
        <h1 class="heading-xl setup-title">Gloomhaven<br />Command</h1>
        <p class="setup-subtitle">Controller</p>

        {/* Connect form — shown when not connected */}
        {!connected && (
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

            <details class="advanced-connection">
              <summary>Advanced</summary>
              <div class="form-group">
                <label class="form-label">Server URL (leave blank for auto-detect)</label>
                <input
                  class="form-input"
                  type="text"
                  placeholder={`ws://${location.host}`}
                  value={localStorage.getItem('gc_serverHost') || ''}
                  onInput={(e) => {
                    const val = (e.target as HTMLInputElement).value.trim();
                    if (val) {
                      localStorage.setItem('gc_serverHost', val);
                    } else {
                      localStorage.removeItem('gc_serverHost');
                    }
                  }}
                />
              </div>
            </details>
          </div>
        )}

        {/* Connection status */}
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

        {/* Error */}
        {error && (
          <div class="import-status error">{error}</div>
        )}

        {/* Post-connect options */}
        {connected && (
          <div class="setup-options">
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.9rem' }}>
              Game: {code}
            </p>

            <button class="setup-option-btn btn-primary" onClick={() => { /* enters scenario view via state update */ }}>
              <span class="option-icon">+</span>
              <span>
                <span class="option-label">New Game</span>
                <span class="option-desc">Start a fresh scenario</span>
              </span>
            </button>

            <button class="setup-option-btn" onClick={() => setShowImport(!showImport)}>
              <span class="option-icon">&darr;</span>
              <span>
                <span class="option-label">Import GHS Save</span>
                <span class="option-desc">Load from Gloomhaven Secretariat</span>
              </span>
            </button>

            {hasExistingGame && (
              <button class="setup-option-btn" onClick={() => { /* resume — state already loaded */ }}>
                <span class="option-icon">&rarr;</span>
                <span>
                  <span class="option-label">Resume</span>
                  <span class="option-desc">Continue existing game</span>
                </span>
              </button>
            )}
          </div>
        )}

        {/* Import panel */}
        {showImport && connected && (
          <div class="import-panel">
            <p class="import-instructions">
              Export your game from GHS (Settings &rarr; Data Management &rarr; Export),
              then paste the JSON below or upload the file.
            </p>
            <textarea
              class="form-input import-textarea"
              placeholder="Paste GHS JSON here..."
              value={importText}
              onInput={(e) => setImportText((e.target as HTMLTextAreaElement).value)}
            />
            <div class="import-actions">
              <label class="btn import-file-btn">
                Upload File
                <input
                  type="file"
                  accept=".json"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
              </label>
              <button
                class="btn btn-primary"
                onClick={handleImport}
                disabled={importing}
              >
                {importing ? 'Importing...' : 'Import'}
              </button>
            </div>
            {importStatus && (
              <div class={`import-status ${importStatus.success ? 'success' : 'error'}`}>
                {importStatus.message}
              </div>
            )}
          </div>
        )}

        {/* Disconnect */}
        {connected && (
          <button class="btn-text" onClick={handleDisconnect}>
            Disconnect
          </button>
        )}
      </div>
    </div>
  );
}
