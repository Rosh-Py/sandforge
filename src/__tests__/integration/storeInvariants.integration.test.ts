/**
 * Integration Tests — Store State Invariants & Edge Cases
 *
 * These tests verify invariants that must NEVER be violated, regardless of
 * the sequence of operations. They go beyond CRUD tests by testing
 * adversarial sequences — the kind of bugs that surface after a user has
 * been using the app for 30 minutes.
 *
 * Why these matter:
 *   - State corruption is silent. If activeFile points to a deleted file,
 *     the editor shows nothing but no error is thrown.
 *   - Zustand's immutable update pattern can introduce subtle reference bugs
 *     when operations are chained rapidly.
 *   - These are the invariants a staff engineer would audit in code review.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { useSandboxStore } from "../../store/sandboxStore";

function resetStore() {
  useSandboxStore.setState(useSandboxStore.getInitialState());
}

function state() {
  return useSandboxStore.getState();
}

describe("Store — State invariant enforcement", () => {
  beforeEach(resetStore);

  // ── INVARIANT: activeFile always points to an existing file or '' ──

  describe("activeFile pointer validity", () => {
    it("activeFile always refers to an existing file after any deletion sequence", () => {
      // Create several files
      state().actions.createFile("a.ts", "a");
      state().actions.createFile("b.ts", "b");
      state().actions.createFile("c.ts", "c");

      // Delete them in various orders
      state().actions.deleteFile("c.ts");
      const { activeFile: af1, files: f1 } = state();
      expect(af1 === "" || f1[af1] !== undefined).toBe(true);

      state().actions.deleteFile("a.ts");
      const { activeFile: af2, files: f2 } = state();
      expect(af2 === "" || f2[af2] !== undefined).toBe(true);

      state().actions.deleteFile("b.ts");
      const { activeFile: af3, files: f3 } = state();
      expect(af3 === "" || f3[af3] !== undefined).toBe(true);

      // Delete the original files too
      state().actions.deleteFile("index.ts");
      state().actions.deleteFile("utils.ts");
      const { activeFile: af4, files: f4 } = state();
      expect(af4 === "" || f4[af4] !== undefined).toBe(true);
      expect(Object.keys(f4)).toHaveLength(0);
      expect(af4).toBe("");
    });

    it("activeFile updates to the renamed file, not a stale name", () => {
      state().actions.setActiveFile("index.ts");
      state().actions.renameFile("index.ts", "main.ts");

      expect(state().activeFile).toBe("main.ts");
      expect(state().files["index.ts"]).toBeUndefined();
      expect(state().files["main.ts"]).toBeDefined();
    });

    it("activeFile is not corrupted by renaming a non-active file", () => {
      state().actions.setActiveFile("index.ts");
      state().actions.renameFile("utils.ts", "helpers.ts");

      expect(state().activeFile).toBe("index.ts");
    });
  });

  // ── INVARIANT: files object has no undefined values ───────────────

  describe("file content integrity", () => {
    it("createFile with no content sets empty string, never undefined", () => {
      state().actions.createFile("new.ts");
      expect(state().files["new.ts"]).toBe("");
      expect(state().files["new.ts"]).not.toBeUndefined();
    });

    it("renameFile preserves content exactly", () => {
      const originalContent = state().files["utils.ts"];
      state().actions.renameFile("utils.ts", "renamed.ts");

      expect(state().files["renamed.ts"]).toBe(originalContent);
      // Verify it's a value copy, not that the old key still works
      expect(state().files["utils.ts"]).toBeUndefined();
    });

    it("updateFileContent with empty string does not delete the file", () => {
      state().actions.updateFileContent("index.ts", "");
      expect("index.ts" in state().files).toBe(true);
      expect(state().files["index.ts"]).toBe("");
    });
  });

  // ── INVARIANT: no duplicate file names ─────────────────────────────

  describe("duplicate prevention", () => {
    it("createFile with existing name is a no-op", () => {
      const originalContent = state().files["index.ts"];
      const fileCount = Object.keys(state().files).length;

      state().actions.createFile("index.ts", "overwrite attempt");

      expect(state().files["index.ts"]).toBe(originalContent);
      expect(Object.keys(state().files)).toHaveLength(fileCount);
    });

    it("renameFile to existing name is a no-op", () => {
      const indexContent = state().files["index.ts"];
      const utilsContent = state().files["utils.ts"];

      state().actions.renameFile("utils.ts", "index.ts");

      expect(state().files["index.ts"]).toBe(indexContent);
      expect(state().files["utils.ts"]).toBe(utilsContent);
    });
  });

  // ── INVARIANT: log IDs are always unique ──────────────────────────

  describe("log ID uniqueness", () => {
    it("generates unique IDs across 1000 rapid-fire additions", () => {
      for (let i = 0; i < 1000; i++) {
        state().actions.addLog({ type: "log", message: `msg-${i}` });
      }

      const ids = state().logs.map((l) => l.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(1000);
    });

    it("IDs remain unique after clear and re-add", () => {
      state().actions.addLog({ type: "log", message: "before clear" });
      const idBeforeClear = state().logs[0].id;

      state().actions.clearLogs();
      state().actions.addLog({ type: "log", message: "after clear" });
      const idAfterClear = state().logs[0].id;

      expect(idBeforeClear).not.toBe(idAfterClear);
    });
  });

  // ── Adversarial sequences ─────────────────────────────────────────

  describe("adversarial operation sequences", () => {
    it("create → rename → delete → create same name works correctly", () => {
      state().actions.createFile("temp.ts", "original");
      state().actions.renameFile("temp.ts", "renamed.ts");

      expect(state().files["temp.ts"]).toBeUndefined();
      expect(state().files["renamed.ts"]).toBe("original");

      state().actions.deleteFile("renamed.ts");
      expect(state().files["renamed.ts"]).toBeUndefined();

      // Re-create with the original name
      state().actions.createFile("temp.ts", "reborn");
      expect(state().files["temp.ts"]).toBe("reborn");
    });

    it("rapid create-delete cycle does not leak file entries", () => {
      const initialCount = Object.keys(state().files).length;

      for (let i = 0; i < 50; i++) {
        state().actions.createFile(`temp-${i}.ts`, `content-${i}`);
        state().actions.deleteFile(`temp-${i}.ts`);
      }

      expect(Object.keys(state().files)).toHaveLength(initialCount);
    });

    it("editing a file that was just created in the same tick works", () => {
      state().actions.createFile("just-created.ts", "initial");
      state().actions.updateFileContent("just-created.ts", "updated");
      expect(state().files["just-created.ts"]).toBe("updated");
    });

    it("deleting the last file then creating a new one recovers correctly", () => {
      state().actions.deleteFile("index.ts");
      state().actions.deleteFile("utils.ts");

      expect(Object.keys(state().files)).toHaveLength(0);
      expect(state().activeFile).toBe("");

      state().actions.createFile("recovery.ts", "recovered");
      expect(state().activeFile).toBe("recovery.ts");
      expect(state().files["recovery.ts"]).toBe("recovered");
    });

    it("interleaving file ops and status changes does not cause cross-contamination", () => {
      state().actions.setExecutionStatus("running");
      state().actions.addLog({ type: "log", message: "during run" });

      state().actions.createFile("new-during-run.ts", "code");
      state().actions.deleteFile("utils.ts");
      state().actions.updateFileContent("index.ts", "modified");

      // File ops should succeed
      expect(state().files["new-during-run.ts"]).toBe("code");
      expect(state().files["utils.ts"]).toBeUndefined();
      expect(state().files["index.ts"]).toBe("modified");

      // Execution state should be unaffected
      expect(state().executionStatus).toBe("running");
      expect(state().logs).toHaveLength(1);
      expect(state().logs[0].message).toBe("during run");
    });
  });
});
