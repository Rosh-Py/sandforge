/**
 * Unit Tests — Sandbox Store (Zustand)
 *
 * Tests core state management semantics:
 *   • File CRUD with activeFile tracking invariants
 *   • Log ordering, ID uniqueness, and metadata
 *   • Execution status lifecycle
 */
import { describe, it, expect, beforeEach } from "vitest";
import { useSandboxStore } from "../../store/sandboxStore";
import type { ExecutionStatus } from "../../store/sandboxStore";

// ─── Helpers ────────────────────────────────────────────────────────────

function resetStore() {
  useSandboxStore.setState(useSandboxStore.getInitialState());
}

function state() {
  return useSandboxStore.getState();
}

// ─── Suite ──────────────────────────────────────────────────────────────

describe("sandboxStore", () => {
  beforeEach(resetStore);

  // ── Initial state ───────────────────────────────────────────────────
  describe("initial state", () => {
    it("bootstraps with exactly 2 default files and index.ts active", () => {
      const { files, activeFile } = state();
      expect(Object.keys(files).sort()).toEqual(["index.ts", "utils.ts"]);
      expect(activeFile).toBe("index.ts");
    });

    it("starts with empty logs, idle status, and bundler not ready", () => {
      const { logs, executionStatus, isBundlerReady, isCreatingFile } = state();
      expect(logs).toHaveLength(0);
      expect(executionStatus).toBe("idle");
      expect(isBundlerReady).toBe(false);
      expect(isCreatingFile).toBe(false);
    });
  });

  // ── File operations ─────────────────────────────────────────────────
  describe("createFile", () => {
    it("creates a new file, activates it, and resets isCreatingFile", () => {
      state().setIsCreatingFile(true);
      state().createFile("hello.ts", 'console.log("hi")');
      const { files, activeFile, isCreatingFile } = state();
      expect(files["hello.ts"]).toBe('console.log("hi")');
      expect(activeFile).toBe("hello.ts");
      expect(isCreatingFile).toBe(false);
    });

    it("defaults content to empty string when omitted", () => {
      state().createFile("empty.ts");
      expect(state().files["empty.ts"]).toBe("");
    });

    it("is a no-op for duplicate file names (preserves existing content)", () => {
      const originalContent = state().files["index.ts"];
      state().createFile("index.ts", "SHOULD_NOT_OVERWRITE");
      expect(state().files["index.ts"]).toBe(originalContent);
    });
  });

  describe("deleteFile", () => {
    it("removes the file from the store", () => {
      state().deleteFile("utils.ts");
      expect(state().files["utils.ts"]).toBeUndefined();
    });

    it("falls back activeFile to the first remaining file when deleting active", () => {
      // active is index.ts
      state().deleteFile("index.ts");
      const { activeFile, files } = state();
      expect(activeFile).not.toBe("index.ts");
      expect(Object.keys(files)).toContain(activeFile);
    });

    it("preserves activeFile when deleting a non-active file", () => {
      state().deleteFile("utils.ts");
      expect(state().activeFile).toBe("index.ts");
    });

    it("sets activeFile to empty string when all files are deleted", () => {
      state().deleteFile("index.ts");
      state().deleteFile("utils.ts");
      expect(Object.keys(state().files)).toHaveLength(0);
      expect(state().activeFile).toBe("");
    });
  });

  describe("updateFileContent", () => {
    it("updates existing file content without affecting other files", () => {
      const utilsBefore = state().files["utils.ts"];
      state().updateFileContent("index.ts", "const x = 42;");
      expect(state().files["index.ts"]).toBe("const x = 42;");
      expect(state().files["utils.ts"]).toBe(utilsBefore);
    });

    it("upserts — creates a new file entry if name does not exist", () => {
      state().updateFileContent("phantom.ts", "code");
      expect(state().files["phantom.ts"]).toBe("code");
    });
  });

  describe("renameFile", () => {
    it("renames a file: old key gone, new key has same content", () => {
      const original = state().files["utils.ts"];
      state().renameFile("utils.ts", "helpers.ts");
      expect(state().files["helpers.ts"]).toBe(original);
      expect(state().files["utils.ts"]).toBeUndefined();
    });

    it("updates activeFile when the active file is renamed", () => {
      state().setActiveFile("utils.ts");
      state().renameFile("utils.ts", "helpers.ts");
      expect(state().activeFile).toBe("helpers.ts");
    });

    it("leaves activeFile unchanged when renaming a non-active file", () => {
      state().renameFile("utils.ts", "helpers.ts");
      expect(state().activeFile).toBe("index.ts");
    });

    it("is a no-op when the target name already exists (prevents collision)", () => {
      const indexContent = state().files["index.ts"];
      const utilsContent = state().files["utils.ts"];
      state().renameFile("utils.ts", "index.ts");
      // Both files should remain unmodified
      expect(state().files["utils.ts"]).toBe(utilsContent);
      expect(state().files["index.ts"]).toBe(indexContent);
    });
  });

  // ── Terminal / Logs ─────────────────────────────────────────────────
  describe("logs", () => {
    it("addLog appends entries with auto-generated id and timestamp", () => {
      state().addLog({ type: "log", message: "hello" });
      const [log] = state().logs;
      expect(log.type).toBe("log");
      expect(log.message).toBe("hello");
      expect(log.id).toMatch(/^log-/);
      expect(log.timestamp).toBeGreaterThan(0);
    });

    it("preserves insertion order across multiple logs", () => {
      state().addLog({ type: "log", message: "first" });
      state().addLog({ type: "warn", message: "second" });
      state().addLog({ type: "error", message: "third" });
      const messages = state().logs.map((l) => l.message);
      expect(messages).toEqual(["first", "second", "third"]);
    });

    it("generates unique IDs even for consecutive identical logs", () => {
      state().addLog({ type: "log", message: "same" });
      state().addLog({ type: "log", message: "same" });
      const [a, b] = state().logs;
      expect(a.id).not.toBe(b.id);
    });

    it("clearLogs resets to empty array (idempotent)", () => {
      state().addLog({ type: "log", message: "one" });
      state().addLog({ type: "error", message: "two" });
      state().clearLogs();
      expect(state().logs).toHaveLength(0);
      // Calling again is safe
      state().clearLogs();
      expect(state().logs).toHaveLength(0);
    });
  });

  // ── Execution status ────────────────────────────────────────────────
  describe("execution status lifecycle", () => {
    it("transitions through a full lifecycle: idle → bundling → running → success → idle", () => {
      const lifecycle: ExecutionStatus[] = [
        "bundling",
        "running",
        "success",
        "idle",
      ];
      lifecycle.forEach((s) => {
        state().setExecutionStatus(s);
        expect(state().executionStatus).toBe(s);
      });
    });

    it("supports error recovery: idle → bundling → error → idle", () => {
      state().setExecutionStatus("bundling");
      state().setExecutionStatus("error");
      expect(state().executionStatus).toBe("error");
      state().setExecutionStatus("idle");
      expect(state().executionStatus).toBe("idle");
    });
  });

  // ── Cross-cutting state interactions ────────────────────────────────
  describe("state interactions", () => {
    it("file operations do not affect logs or execution status", () => {
      state().addLog({ type: "log", message: "before" });
      state().setExecutionStatus("running");

      state().createFile("new.ts", "code");
      state().deleteFile("utils.ts");

      expect(state().logs).toHaveLength(1);
      expect(state().logs[0].message).toBe("before");
      expect(state().executionStatus).toBe("running");
    });

    it("log operations do not affect files", () => {
      const filesBefore = { ...state().files };
      state().addLog({ type: "log", message: "msg" });
      state().clearLogs();
      expect(state().files).toEqual(filesBefore);
    });
  });
});
