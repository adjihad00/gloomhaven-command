import { v4 as uuidv4 } from 'uuid';
import type { ClientRole, DiffMessage } from '@gloomhaven-command/shared';

export interface InternalSession {
  sessionToken: string;
  gameCode: string;
  role?: ClientRole;
  characterName?: string;
  lastRevision: number;
  connectedAt: number;
  lastPong: number;
}

export class SessionManager {
  private sessions: Map<string, InternalSession> = new Map();
  private diffBuffer: Map<string, DiffMessage[]> = new Map();
  private readonly maxDiffBuffer = 100;

  createSession(gameCode: string, role?: ClientRole, characterName?: string): InternalSession {
    const token = uuidv4();
    const session: InternalSession = {
      sessionToken: token,
      gameCode,
      role,
      characterName,
      lastRevision: 0,
      connectedAt: Date.now(),
      lastPong: Date.now(),
    };
    this.sessions.set(token, session);
    return session;
  }

  getSession(token: string): InternalSession | null {
    return this.sessions.get(token) ?? null;
  }

  updateRevision(token: string, revision: number): void {
    const session = this.sessions.get(token);
    if (session) {
      session.lastRevision = revision;
    }
  }

  updatePong(token: string): void {
    const session = this.sessions.get(token);
    if (session) {
      session.lastPong = Date.now();
    }
  }

  removeSession(token: string): void {
    this.sessions.delete(token);
  }

  getStaleTokens(timeoutMs: number): string[] {
    const now = Date.now();
    const stale: string[] = [];
    for (const [token, session] of this.sessions) {
      if (now - session.lastPong > timeoutMs) {
        stale.push(token);
      }
    }
    return stale;
  }

  pushDiff(gameCode: string, diff: DiffMessage): void {
    let buffer = this.diffBuffer.get(gameCode);
    if (!buffer) {
      buffer = [];
      this.diffBuffer.set(gameCode, buffer);
    }
    buffer.push(diff);
    if (buffer.length > this.maxDiffBuffer) {
      buffer.shift();
    }
  }

  getDiffsSince(gameCode: string, revision: number): DiffMessage[] | null {
    const buffer = this.diffBuffer.get(gameCode);
    if (!buffer || buffer.length === 0) return null;

    const oldest = buffer[0].revision;
    if (revision < oldest) return null;

    return buffer.filter((d) => d.revision > revision);
  }

  getSessionCount(): number {
    return this.sessions.size;
  }
}
