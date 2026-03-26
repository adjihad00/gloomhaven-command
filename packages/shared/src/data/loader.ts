// Abstract data loader interface — server and client each provide their own implementation

export interface DataLoader {
  /** Load a single JSON file by path relative to data root (e.g., "gh/character/brute.json") */
  loadJson<T>(path: string): Promise<T>;

  /** List files in a directory relative to data root (e.g., "gh/character/") */
  listFiles(dirPath: string): Promise<string[]>;

  /** Check if a file exists */
  exists(path: string): Promise<boolean>;
}
