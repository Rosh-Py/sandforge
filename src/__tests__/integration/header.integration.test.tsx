/**
 * Integration Tests — Header + EditorToolbar ↔ SandboxStore
 *
 * Tests that the Header and EditorToolbar components accurately reflect
 * execution status, bundler readiness, and run button behavior.
 *
 * Why these matter:
 *   - The Header status indicator is the ONLY way users know what state
 *     the system is in. If "Running..." shows when it's idle, or the run
 *     button is enabled before the WASM bundler is ready, users get confused
 *     or trigger crashes.
 *   - EditorToolbar's `disabled` logic has 2 independent conditions
 *     (isBundlerReady + isRunning). Missing either one = a bug.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Header, EditorToolbar } from "../../components/Header";
import { useSandboxStore } from "../../store/sandboxStore";
import type { ExecutionStatus } from "../../store/sandboxStore";

function resetStore() {
  useSandboxStore.setState(useSandboxStore.getInitialState());
}

function state() {
  return useSandboxStore.getState();
}

describe("Header ↔ Store integration", () => {
  beforeEach(resetStore);

  it('shows "Initializing WASM..." when bundler is not ready', () => {
    render(<Header />);
    expect(screen.getByText("Initializing WASM...")).toBeInTheDocument();
  });

  it('shows "Ready" once bundler is ready and status is idle', () => {
    state().setBundlerReady(true);

    render(<Header />);
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  it.each<[ExecutionStatus, string]>([
    ["bundling", "Bundling..."],
    ["running", "Executing..."],
    ["error", "Error"],
    ["success", "Done"],
    ["idle", "Ready"],
  ])('shows "%s" text for execution status "%s"', (status, expectedText) => {
    state().setBundlerReady(true);
    state().setExecutionStatus(status);

    render(<Header />);
    expect(screen.getByText(expectedText)).toBeInTheDocument();
  });

  it("uses running dot class during bundling/running states", () => {
    state().setBundlerReady(true);
    state().setExecutionStatus("bundling");

    render(<Header />);

    const dot = document.querySelector(".header__status-dot");
    expect(dot).toHaveClass("header__status-dot--running");
  });

  it("uses error dot class during error state", () => {
    state().setBundlerReady(true);
    state().setExecutionStatus("error");

    render(<Header />);

    const dot = document.querySelector(".header__status-dot");
    expect(dot).toHaveClass("header__status-dot--error");
  });

  it("uses running dot class when bundler is not ready (initializing)", () => {
    render(<Header />);

    const dot = document.querySelector(".header__status-dot");
    expect(dot).toHaveClass("header__status-dot--running");
  });

  it("uses no special dot class in idle/success states", () => {
    state().setBundlerReady(true);
    state().setExecutionStatus("idle");

    render(<Header />);

    const dot = document.querySelector(".header__status-dot");
    expect(dot).not.toHaveClass("header__status-dot--running");
    expect(dot).not.toHaveClass("header__status-dot--error");
  });
});

describe("EditorToolbar ↔ Store integration", () => {
  beforeEach(resetStore);

  const mockOnRun = vi.fn();

  afterEach(() => {
    mockOnRun.mockClear();
  });

  it("shows the active file name as a tab", () => {
    state().setActiveFile("index.ts");

    render(<EditorToolbar onRun={mockOnRun} />);
    expect(screen.getByText("index.ts")).toBeInTheDocument();
  });

  it("updates tab label when active file changes in store", () => {
    state().setActiveFile("utils.ts");

    render(<EditorToolbar onRun={mockOnRun} />);
    expect(screen.getByText("utils.ts")).toBeInTheDocument();
  });

  // ── Run button disabled states ─────────────────────────────────────

  it("disables run button when bundler is not ready", () => {
    // isBundlerReady is false by default
    render(<EditorToolbar onRun={mockOnRun} />);

    const runBtn = screen.getByText("Run").closest("button")!;
    expect(runBtn).toBeDisabled();
  });

  it("enables run button when bundler is ready and not running", () => {
    state().setBundlerReady(true);
    state().setExecutionStatus("idle");

    render(<EditorToolbar onRun={mockOnRun} />);

    const runBtn = screen.getByText("Run").closest("button")!;
    expect(runBtn).not.toBeDisabled();
  });

  it("disables run button while bundling", () => {
    state().setBundlerReady(true);
    state().setExecutionStatus("bundling");

    render(<EditorToolbar onRun={mockOnRun} />);

    const runBtn = screen.getByText("Running...").closest("button")!;
    expect(runBtn).toBeDisabled();
  });

  it("disables run button while running", () => {
    state().setBundlerReady(true);
    state().setExecutionStatus("running");

    render(<EditorToolbar onRun={mockOnRun} />);

    const runBtn = screen.getByText("Running...").closest("button")!;
    expect(runBtn).toBeDisabled();
  });

  it("re-enables run button after execution completes (success)", () => {
    state().setBundlerReady(true);
    state().setExecutionStatus("success");

    render(<EditorToolbar onRun={mockOnRun} />);

    const runBtn = screen.getByText("Run").closest("button")!;
    expect(runBtn).not.toBeDisabled();
  });

  it("re-enables run button after execution fails (error)", () => {
    state().setBundlerReady(true);
    state().setExecutionStatus("error");

    render(<EditorToolbar onRun={mockOnRun} />);

    const runBtn = screen.getByText("Run").closest("button")!;
    expect(runBtn).not.toBeDisabled();
  });

  // ── Run button click ──────────────────────────────────────────────

  it("calls onRun when clicked and button is enabled", () => {
    state().setBundlerReady(true);
    state().setExecutionStatus("idle");

    render(<EditorToolbar onRun={mockOnRun} />);

    fireEvent.click(screen.getByText("Run").closest("button")!);
    expect(mockOnRun).toHaveBeenCalledTimes(1);
  });

  it("does not call onRun when button is disabled", () => {
    // bundler not ready
    render(<EditorToolbar onRun={mockOnRun} />);

    fireEvent.click(screen.getByText("Run").closest("button")!);
    expect(mockOnRun).not.toHaveBeenCalled();
  });

  // ── Button text changes ───────────────────────────────────────────

  it('shows "Run" text in idle/success/error states', () => {
    state().setBundlerReady(true);
    state().setExecutionStatus("idle");

    render(<EditorToolbar onRun={mockOnRun} />);
    expect(screen.getByText("Run")).toBeInTheDocument();
  });

  it('shows "Running..." text during bundling/running', () => {
    state().setBundlerReady(true);
    state().setExecutionStatus("bundling");

    render(<EditorToolbar onRun={mockOnRun} />);
    expect(screen.getByText("Running...")).toBeInTheDocument();
  });

  // ── Running class applied ─────────────────────────────────────────

  it("applies running CSS class when executing", () => {
    state().setBundlerReady(true);
    state().setExecutionStatus("running");

    render(<EditorToolbar onRun={mockOnRun} />);

    const runBtn = screen.getByText("Running...").closest("button")!;
    expect(runBtn).toHaveClass("editor-toolbar__run-btn--running");
  });

  it("does not apply running CSS class when idle", () => {
    state().setBundlerReady(true);
    state().setExecutionStatus("idle");

    render(<EditorToolbar onRun={mockOnRun} />);

    const runBtn = screen.getByText("Run").closest("button")!;
    expect(runBtn).not.toHaveClass("editor-toolbar__run-btn--running");
  });
});
