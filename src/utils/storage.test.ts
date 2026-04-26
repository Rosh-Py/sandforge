import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  initStorage,
  getStorageItem,
  setStorageItem,
  getLayout,
  saveLayout,
  STORAGE_KEYS,
} from "./storage";

describe("Storage Utilities", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("STORAGE_KEYS", () => {
    it("should export correct storage keys with current prefix and version", () => {
      expect(STORAGE_KEYS.LAYOUT_SIDEBAR).toBe("sandforge:v1:layout:sidebar");
      expect(STORAGE_KEYS.LAYOUT_EDITOR_VERTICAL).toBe(
        "sandforge:v1:layout:editor:vertical",
      );
      expect(STORAGE_KEYS.LAYOUT_EDITOR_HORIZONTAL).toBe(
        "sandforge:v1:layout:editor:horizontal",
      );
      expect(STORAGE_KEYS.ORIENTATION).toBe("sandforge:v1:orientation");
    });
  });

  describe("initStorage", () => {
    it("should preserve current version sandforge keys", () => {
      localStorage.setItem("sandforge:v1:some_key", "value");
      initStorage();
      expect(localStorage.getItem("sandforge:v1:some_key")).toBe("value");
    });

    it("should remove older version sandforge keys", () => {
      localStorage.setItem("sandforge:v0:old_key", "value");
      localStorage.setItem("sandforge:legacy", "value");

      initStorage();

      expect(localStorage.getItem("sandforge:v0:old_key")).toBeNull();
      expect(localStorage.getItem("sandforge:legacy")).toBeNull();
    });

    it("should preserve non-sandforge keys", () => {
      localStorage.setItem("other_app:key", "value");
      initStorage();
      expect(localStorage.getItem("other_app:key")).toBe("value");
    });

    it("should catch and log errors if localStorage throws during init", () => {
      vi.spyOn(localStorage, "key").mockImplementation(() => {
        throw new Error("Simulated storage error");
      });
      // Need at least 1 item to enter the loop
      localStorage.setItem("some_key", "value");

      expect(() => initStorage()).not.toThrow();
      expect(console.warn).toHaveBeenCalledWith(
        "Failed to clean up old storage keys",
        expect.any(Error),
      );
    });
  });

  describe("getStorageItem", () => {
    it("should return parsed value for valid JSON", () => {
      localStorage.setItem("test_key", JSON.stringify({ a: 1 }));
      const result = getStorageItem<{ a: number }>("test_key");
      expect(result).toEqual({ a: 1 });
    });

    it("should return default value if key does not exist", () => {
      const result = getStorageItem("missing_key", "default");
      expect(result).toBe("default");
    });

    it("should return default value, remove key, and warn if JSON is invalid", () => {
      localStorage.setItem("corrupt_key", "{ invalid: json");
      const result = getStorageItem("corrupt_key", "default");

      expect(result).toBe("default");
      expect(localStorage.getItem("corrupt_key")).toBeNull();
      expect(console.warn).toHaveBeenCalledWith(
        'Error parsing storage key "corrupt_key"',
        expect.any(Error),
      );
    });

    it("should handle error during localStorage.removeItem when parsing fails", () => {
      localStorage.setItem("corrupt_key", "{ invalid: json");
      vi.spyOn(localStorage, "removeItem").mockImplementationOnce(() => {
        throw new Error("Failed to remove");
      });

      const result = getStorageItem("corrupt_key", "default");

      expect(result).toBe("default");
      expect(console.warn).toHaveBeenCalled();
    });
  });

  describe("setStorageItem", () => {
    it("should save stringified value to localStorage", () => {
      setStorageItem("test_key", { a: 1 });
      expect(localStorage.getItem("test_key")).toBe('{"a":1}');
    });

    it("should catch and log errors if localStorage.setItem throws", () => {
      vi.spyOn(localStorage, "setItem").mockImplementationOnce(() => {
        throw new Error("Quota exceeded");
      });

      setStorageItem("test_key", { a: 1 });

      expect(console.warn).toHaveBeenCalledWith(
        'Error setting storage key "test_key"',
        expect.any(Error),
      );
    });
  });

  describe("getLayout", () => {
    it("should return parsed layout object", () => {
      localStorage.setItem(
        "layout_key",
        JSON.stringify({ pane1: 50, pane2: 50 }),
      );
      const result = getLayout("layout_key");
      expect(result).toEqual({ pane1: 50, pane2: 50 });
    });

    it("should return undefined and clean up if key is missing or invalid", () => {
      const result = getLayout("missing_layout");
      expect(result).toBeUndefined();
    });

    it("should handle error during cleanup if invalid layout", () => {
      vi.spyOn(localStorage, "removeItem").mockImplementationOnce(() => {
        throw new Error("Cleanup failed");
      });

      const result = getLayout("missing_layout");
      expect(result).toBeUndefined();
    });
  });

  describe("saveLayout", () => {
    it("should save layout via setStorageItem", () => {
      saveLayout("layout_key", { pane1: 30, pane2: 70 });
      expect(localStorage.getItem("layout_key")).toBe(
        '{"pane1":30,"pane2":70}',
      );
    });
  });
});
