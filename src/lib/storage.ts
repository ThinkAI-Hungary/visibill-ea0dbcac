/**
 * safeStorage — Safe wrapper for localStorage access.
 * Prevents application crashes in incognito mode or when third-party storage is disabled by Chrome policies.
 */
export const safeStorage = {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn(`safeStorage.getItem failed for key "${key}":`, e);
      return null;
    }
  },

  setItem(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      console.warn(`safeStorage.setItem failed for key "${key}":`, e);
      return false;
    }
  },

  removeItem(key: string): boolean {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.warn(`safeStorage.removeItem failed for key "${key}":`, e);
      return false;
    }
  },

  key(index: number): string | null {
    try {
      return localStorage.key(index);
    } catch (e) {
      console.warn(`safeStorage.key failed for index ${index}:`, e);
      return null;
    }
  },

  get length(): number {
    try {
      return localStorage.length;
    } catch (e) {
      console.warn('safeStorage.length access failed:', e);
      return 0;
    }
  }
};
