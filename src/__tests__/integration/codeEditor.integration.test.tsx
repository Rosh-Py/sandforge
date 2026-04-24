/**
 * Integration Tests — CodeEditor ↔ SandboxStore
 *
 * Tests that the CodeEditor component correctly reads from and writes to
 * the Zustand store via the mocked Monaco Editor.
 *
 * Why these matter:
 *   - CodeEditor is the primary input surface. If onChange doesn't write
 *     back to the store, the bundler bundles stale code — a silent,
 *     infuriating bug where "my changes don't take effect."
 *   - The empty-file placeholder state is a real edge case that triggers
 *     when all files are deleted.
 *   - Monaco is heavy and mocked; these tests validate the integration
 *     contract between the mock and our component logic.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CodeEditor } from "../../components/CodeEditor";
import { useSandboxStore } from "../../store/sandboxStore";

function resetStore() {
  useSandboxStore.setState(useSandboxStore.getInitialState());
}

function state() {
  return useSandboxStore.getState();
}

describe("CodeEditor ↔ Store integration", () => {
  beforeEach(resetStore);

  it("renders the mock editor with the active file content", () => {
    render(<CodeEditor />);

    const editor = screen.getByTestId(
      "mock-monaco-editor",
    ) as HTMLTextAreaElement;
    expect(editor.value).toBe(state().files["index.ts"]);
  });

  it("shows placeholder when no active file is set", () => {
    useSandboxStore.setState({ activeFile: "" });

    render(<CodeEditor />);

    expect(
      screen.getByText("Create or select a file to start coding"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("mock-monaco-editor")).not.toBeInTheDocument();
  });

  it("updates store when editor content changes", () => {
    render(<CodeEditor />);

    const editor = screen.getByTestId(
      "mock-monaco-editor",
    ) as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: "const x = 42;" } });

    expect(state().files["index.ts"]).toBe("const x = 42;");
  });

  it("reflects active file switch by showing different content", () => {
    const { unmount } = render(<CodeEditor />);

    // Initially shows index.ts content
    let editor = screen.getByTestId(
      "mock-monaco-editor",
    ) as HTMLTextAreaElement;
    expect(editor.value).toBe(state().files["index.ts"]);

    // Switch to utils.ts
    state().setActiveFile("utils.ts");
    unmount();
    render(<CodeEditor />);

    editor = screen.getByTestId("mock-monaco-editor") as HTMLTextAreaElement;
    expect(editor.value).toBe(state().files["utils.ts"]);
  });

  it("does not clobber other files when editing the active file", () => {
    const utilsContent = state().files["utils.ts"];

    render(<CodeEditor />);

    const editor = screen.getByTestId(
      "mock-monaco-editor",
    ) as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: "new index content" } });

    // utils.ts should remain untouched
    expect(state().files["utils.ts"]).toBe(utilsContent);
    expect(state().files["index.ts"]).toBe("new index content");
  });

  it("handles empty content (newly created file)", () => {
    state().createFile("empty.ts");
    state().setActiveFile("empty.ts");

    render(<CodeEditor />);

    const editor = screen.getByTestId(
      "mock-monaco-editor",
    ) as HTMLTextAreaElement;
    expect(editor.value).toBe("");
  });

  it("renders empty string for active file that does not exist in VFS", () => {
    // Edge case: activeFile points to a deleted file
    useSandboxStore.setState({ activeFile: "ghost.ts" });

    render(<CodeEditor />);

    const editor = screen.getByTestId(
      "mock-monaco-editor",
    ) as HTMLTextAreaElement;
    expect(editor.value).toBe("");
  });
});
