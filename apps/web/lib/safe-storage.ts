/**
 * localStorage that never throws: private-mode browsers and storage-blocked
 * contexts fall back to an in-memory map so a session still works for the
 * lifetime of the tab.
 */
const memory = new Map<string, string>();

export const safeStorage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key) ?? memory.get(key) ?? null;
    } catch {
      return memory.get(key) ?? null;
    }
  },
  set(key: string, value: string): void {
    memory.set(key, value);
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // In-memory fallback already holds the value.
    }
  },
  remove(key: string): void {
    memory.delete(key);
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Nothing to clean up beyond the in-memory copy.
    }
  },
};
