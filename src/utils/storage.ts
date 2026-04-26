class InMemoryStorage implements Storage {
  private data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  key(index: number): string | null {
    const keys = Array.from(this.data.keys());
    return keys[index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value.toString());
  }
}

let storage: Storage;

try {
  // Test if localStorage is accessible and working
  const testKey = "__sandforge_test__";
  window.localStorage.setItem(testKey, "test");
  window.localStorage.removeItem(testKey);
  storage = window.localStorage;
} catch {
  console.warn(
    "localStorage is not available, falling back to in-memory storage.",
  );
  storage = new InMemoryStorage();
}

const PREFIX = "sandforge:";
const VERSION = "v1:";

export const STORAGE_KEYS = {
  LAYOUT_SIDEBAR: `${PREFIX}${VERSION}layout:sidebar`,
  LAYOUT_EDITOR_VERTICAL: `${PREFIX}${VERSION}layout:editor:vertical`,
  LAYOUT_EDITOR_HORIZONTAL: `${PREFIX}${VERSION}layout:editor:horizontal`,
  ORIENTATION: `${PREFIX}${VERSION}orientation`,
} as const;

// List of older keys to clean up to avoid junking up the user's local storage
const DEPRECATED_KEYS: string[] = [];

export function initStorage() {
  try {
    DEPRECATED_KEYS.forEach((key) => storage.removeItem(key));

    // Remove any sandforge keys that don't match the current version prefix
    // Collect keys first to avoid mutation issues while iterating
    const keysToRemove: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (
        key &&
        key.startsWith(PREFIX) &&
        !key.startsWith(`${PREFIX}${VERSION}`)
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => storage.removeItem(key));
  } catch (e) {
    console.warn("Failed to clean up old storage keys", e);
  }
}

export function getStorageItem<T>(
  key: string,
  defaultValue?: T,
): T | undefined {
  try {
    const raw = storage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw) as T;
  } catch (e) {
    console.warn(`Error parsing storage key "${key}"`, e);
    // If it's corrupted, remove it
    try {
      storage.removeItem(key);
    } catch {
      // ignore
    }
    return defaultValue;
  }
}

export function setStorageItem<T>(key: string, value: T): void {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`Error setting storage key "${key}"`, e);
  }
}

export function getLayout(key: string): Record<string, number> | undefined {
  const parsed = getStorageItem<Record<string, number>>(key);
  if (parsed) {
    return parsed;
  }
  // Clean up invalid or outdated layout data
  try {
    storage.removeItem(key);
  } catch {
    // ignore
  }
  return undefined;
}

export function saveLayout(key: string, layout: Record<string, number>): void {
  setStorageItem(key, layout);
}
