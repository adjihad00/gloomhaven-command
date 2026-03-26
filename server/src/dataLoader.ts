// Server-side filesystem DataLoader implementation
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import type { DataLoader } from '@gloomhaven-command/shared';

export class FileSystemDataLoader implements DataLoader {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = resolve(basePath);
  }

  async loadJson<T>(path: string): Promise<T> {
    const fullPath = join(this.basePath, path);
    const content = readFileSync(fullPath, 'utf8');
    return JSON.parse(content) as T;
  }

  async listFiles(dirPath: string): Promise<string[]> {
    const fullPath = join(this.basePath, dirPath);
    if (!existsSync(fullPath)) return [];
    return readdirSync(fullPath, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.json'))
      .map((e) => e.name);
  }

  async exists(path: string): Promise<boolean> {
    return existsSync(join(this.basePath, path));
  }
}
