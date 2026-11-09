import { get, set } from 'idb-keyval';
import { ImportedGame } from './GameImportService';

const SAVED_GAMES_KEY = 'chess_saved_games';
const USER_SETTINGS_KEY = 'chess_user_settings';

export interface UserSettings {
  theme: 'dark' | 'light';
  soundEnabled: boolean;
  autoAnalyze: boolean;
  engineDepth: number;
  engineThreads: number;
  engineHashMb: number;
  boardOrientation: 'white' | 'black';
}

const DEFAULT_SETTINGS: UserSettings = {
  theme: 'dark',
  soundEnabled: true,
  autoAnalyze: true,
  engineDepth: 14,
  engineThreads: 1,
  engineHashMb: 32,
  boardOrientation: 'white',
};

export class StorageService {
  public static async getSavedGames(): Promise<ImportedGame[]> {
    try {
      const games = await get<ImportedGame[]>(SAVED_GAMES_KEY);
      return games || [];
    } catch {
      return [];
    }
  }

  public static async saveGame(game: ImportedGame): Promise<void> {
    try {
      const existing = await this.getSavedGames();
      existing.unshift(game);
      // Keep last 50 games
      await set(SAVED_GAMES_KEY, existing.slice(0, 50));
    } catch (e) {
      console.warn('StorageService: Failed to save game', e);
    }
  }

  public static getUserSettings(): UserSettings {
    try {
      const saved = localStorage.getItem(USER_SETTINGS_KEY);
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_SETTINGS;
  }

  public static saveUserSettings(settings: Partial<UserSettings>): void {
    try {
      const current = this.getUserSettings();
      const updated = { ...current, ...settings };
      localStorage.setItem(USER_SETTINGS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('StorageService: Failed to save settings', e);
    }
  }
}

