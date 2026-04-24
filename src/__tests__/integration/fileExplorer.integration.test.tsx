/**
 * Integration Tests — FileExplorer ↔ SandboxStore
 *
 * These tests render the real FileExplorer component against the real Zustand store.
 * They verify that user interactions (clicks, keyboard events) correctly mutate
 * global state and that the UI reflects state changes accurately.
 *
 * Why these matter:
 *   - FileExplorer is the primary file management surface. Bugs here silently
 *     corrupt the VFS (e.g., orphan activeFile pointers, phantom files).
 *   - The component has subtle conditional rendering (delete buttons hidden
 *     when only 1 file remains) that breaks silently with store schema changes.
 *
 * Best practices applied:
 *   - All queries use accessible roles (role="option", aria-selected, aria-label)
 *     instead of className selectors
 *   - Uses userEvent over fireEvent for realistic interaction simulation
 *   - Uses accessible roles and aria-labels instead of DOM traversal (.closest, .querySelector)
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileExplorer } from "../../components/FileExplorer";
import { useSandboxStore } from "../../store/sandboxStore";

function resetStore() {
  useSandboxStore.setState(useSandboxStore.getInitialState());
}

function state() {
  return useSandboxStore.getState();
}

describe("FileExplorer ↔ Store integration", () => {
  beforeEach(resetStore);

  // ── Rendering reflects store state ────────────────────────────────

  it("renders all files from the store", () => {
    render(<FileExplorer />);

    expect(screen.getByText("index.ts")).toBeInTheDocument();
    expect(screen.getByText("utils.ts")).toBeInTheDocument();
  });

  it("marks the active file with aria-selected", () => {
    render(<FileExplorer />);

    const indexOption = screen.getByRole("option", { name: /index\.ts/i });
    expect(indexOption).toHaveAttribute("aria-selected", "true");

    const utilsOption = screen.getByRole("option", { name: /utils\.ts/i });
    expect(utilsOption).toHaveAttribute("aria-selected", "false");
  });

  // ── File selection ────────────────────────────────────────────────

  it("clicking a file updates the store activeFile", async () => {
    const user = userEvent.setup();
    render(<FileExplorer />);

    await user.click(screen.getByText("utils.ts"));

    expect(state().activeFile).toBe("utils.ts");
  });

  it("re-renders with updated aria-selected after click", async () => {
    const user = userEvent.setup();
    render(<FileExplorer />);

    await user.click(screen.getByText("utils.ts"));

    const utilsOption = screen.getByRole("option", { name: /utils\.ts/i });
    expect(utilsOption).toHaveAttribute("aria-selected", "true");

    const indexOption = screen.getByRole("option", { name: /index\.ts/i });
    expect(indexOption).toHaveAttribute("aria-selected", "false");
  });

  // ── File creation flow ────────────────────────────────────────────

  it('shows input field when "New File" button is clicked', async () => {
    const user = userEvent.setup();
    render(<FileExplorer />);

    await user.click(screen.getByTitle("New File"));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("filename.ts")).toBeInTheDocument();
    });
  });

  it("creates a file and activates it on Enter", async () => {
    const user = userEvent.setup();
    render(<FileExplorer />);

    await user.click(screen.getByTitle("New File"));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("filename.ts")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("filename.ts");
    await user.type(input, "helpers.ts");
    await user.keyboard("{Enter}");

    // Store should reflect the new file
    expect(state().files["helpers.ts"]).toBeDefined();
    expect(state().activeFile).toBe("helpers.ts");
    expect(state().isCreatingFile).toBe(false);
  });

  it("appends .ts extension when user omits it", async () => {
    const user = userEvent.setup();
    render(<FileExplorer />);

    await user.click(screen.getByTitle("New File"));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("filename.ts")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("filename.ts");
    await user.type(input, "mymodule");
    await user.keyboard("{Enter}");

    expect(state().files["mymodule.ts"]).toBeDefined();
    expect(state().files["mymodule"]).toBeUndefined();
  });

  it("preserves user-provided extension (e.g. .json)", async () => {
    const user = userEvent.setup();
    render(<FileExplorer />);

    await user.click(screen.getByTitle("New File"));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("filename.ts")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("filename.ts");
    await user.type(input, "data.json");
    await user.keyboard("{Enter}");

    expect(state().files["data.json"]).toBeDefined();
  });

  it("cancels file creation on Escape", async () => {
    const user = userEvent.setup();
    render(<FileExplorer />);

    await user.click(screen.getByTitle("New File"));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("filename.ts")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("filename.ts");
    await user.type(input, "wont-create");
    await user.keyboard("{Escape}");

    expect(state().files["wont-create"]).toBeUndefined();
    expect(state().files["wont-create.ts"]).toBeUndefined();
    expect(state().isCreatingFile).toBe(false);
  });

  it("dismisses empty-name creation on blur without creating file", async () => {
    const user = userEvent.setup();
    render(<FileExplorer />);

    await user.click(screen.getByTitle("New File"));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("filename.ts")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("filename.ts");
    // Tab away to trigger blur
    await user.tab();

    // No phantom file should be created
    const fileCount = Object.keys(state().files).length;
    expect(fileCount).toBe(2); // still just index.ts and utils.ts
  });

  // ── File deletion ─────────────────────────────────────────────────

  it("deletes a file when trash icon is clicked", async () => {
    const user = userEvent.setup();
    render(<FileExplorer />);

    // Use aria-label to find the specific delete button
    const deleteUtilsBtn = screen.getByRole("button", {
      name: "Delete utils.ts",
    });
    await user.click(deleteUtilsBtn);

    expect(state().files["utils.ts"]).toBeUndefined();
  });

  it("hides delete buttons when only one file remains", () => {
    // Delete one file via store to leave only one
    state().deleteFile("utils.ts");

    render(<FileExplorer />);

    expect(
      screen.queryByRole("button", { name: /^Delete /i }),
    ).not.toBeInTheDocument();
  });

  it("updates activeFile when the active file is deleted", async () => {
    const user = userEvent.setup();
    render(<FileExplorer />);

    // Active is index.ts, delete it
    const deleteIndexBtn = screen.getByRole("button", {
      name: "Delete index.ts",
    });
    await user.click(deleteIndexBtn);

    expect(state().activeFile).not.toBe("index.ts");
    expect(Object.keys(state().files)).toContain(state().activeFile);
  });

  // ── Delete click does not bubble to file selection ─────────────

  it("delete click does not change activeFile to the deleted file", async () => {
    const user = userEvent.setup();
    // Set active to index.ts
    expect(state().activeFile).toBe("index.ts");

    render(<FileExplorer />);

    // Click delete on utils.ts — should NOT activate utils.ts first
    const deleteUtilsBtn = screen.getByRole("button", {
      name: "Delete utils.ts",
    });
    await user.click(deleteUtilsBtn);

    // activeFile should still be index.ts (not utils.ts, which was deleted)
    expect(state().activeFile).toBe("index.ts");
  });
});
