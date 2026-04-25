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
    state().actions.setBundlerReady(true);

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
    state().actions.setBundlerReady(true);
    state().actions.setExecutionStatus(status);

    render(<Header />);
    expect(screen.getByText(expectedText)).toBeInTheDocument();
  });

  it("uses running dot class during bundling/running states", () => {
    state().actions.setBundlerReady(true);
    state().actions.setExecutionStatus("bundling");

    render(<Header />);

    const dot = screen.getByTestId("status-dot");
    expect(dot).toHaveAttribute("data-execution-status", "bundling");
  });

  it("uses error dot class during error state", () => {
    state().actions.setBundlerReady(true);
    state().actions.setExecutionStatus("error");

    render(<Header />);

    const dot = screen.getByTestId("status-dot");
    expect(dot).toHaveAttribute("data-execution-status", "error");
  });

  it("uses running dot class when bundler is not ready (initializing)", () => {
    render(<Header />);

    const dot = screen.getByTestId("status-dot");
    expect(dot).toHaveAttribute("data-execution-status", "initializing");
  });

  it("uses no special dot class in idle/success states", () => {
    state().actions.setBundlerReady(true);
    state().actions.setExecutionStatus("idle");

    render(<Header />);

    const dot = screen.getByTestId("status-dot");
    expect(dot).toHaveAttribute("data-execution-status", "idle");
    expect(dot).not.toHaveAttribute("data-execution-status", "bundling");
    expect(dot).not.toHaveAttribute("data-execution-status", "error");
  });
});

describe("EditorToolbar ↔ Store integration", () => {
  beforeEach(resetStore);

  const mockOnRun = vi.fn();

  afterEach(() => {
    mockOnRun.mockClear();
  });

  it("shows the active file name as a tab", () => {
    state().actions.setActiveFile("index.ts");

    render(<EditorToolbar onRun={mockOnRun} />);
    expect(screen.getByText("index.ts")).toBeInTheDocument();
  });

  it("updates tab label when active file changes in store", () => {
    state().actions.setActiveFile("utils.ts");

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
    state().actions.setBundlerReady(true);
    state().actions.setExecutionStatus("idle");

    render(<EditorToolbar onRun={mockOnRun} />);

    const runBtn = screen.getByText("Run").closest("button")!;
    expect(runBtn).not.toBeDisabled();
  });

  it("disables run button while bundling", () => {
    state().actions.setBundlerReady(true);
    state().actions.setExecutionStatus("bundling");

    render(<EditorToolbar onRun={mockOnRun} />);

    const runBtn = screen.getByText("Running...").closest("button")!;
    expect(runBtn).toBeDisabled();
  });

  it("disables run button while running", () => {
    state().actions.setBundlerReady(true);
    state().actions.setExecutionStatus("running");

    render(<EditorToolbar onRun={mockOnRun} />);

    const runBtn = screen.getByText("Running...").closest("button")!;
    expect(runBtn).toBeDisabled();
  });

  it("re-enables run button after execution completes (success)", () => {
    state().actions.setBundlerReady(true);
    state().actions.setExecutionStatus("success");

    render(<EditorToolbar onRun={mockOnRun} />);

    const runBtn = screen.getByText("Run").closest("button")!;
    expect(runBtn).not.toBeDisabled();
  });

  it("re-enables run button after execution fails (error)", () => {
    state().actions.setBundlerReady(true);
    state().actions.setExecutionStatus("error");

    render(<EditorToolbar onRun={mockOnRun} />);

    const runBtn = screen.getByText("Run").closest("button")!;
    expect(runBtn).not.toBeDisabled();
  });

  // ── Run button click ──────────────────────────────────────────────

  it("calls onRun when clicked and button is enabled", () => {
    state().actions.setBundlerReady(true);
    state().actions.setExecutionStatus("idle");

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
    state().actions.setBundlerReady(true);
    state().actions.setExecutionStatus("idle");

    render(<EditorToolbar onRun={mockOnRun} />);
    expect(screen.getByText("Run")).toBeInTheDocument();
  });

  it('shows "Running..." text during bundling/running', () => {
    state().actions.setBundlerReady(true);
    state().actions.setExecutionStatus("bundling");

    render(<EditorToolbar onRun={mockOnRun} />);
    expect(screen.getByText("Running...")).toBeInTheDocument();
  });

  // ── Running class applied ─────────────────────────────────────────

  it("applies running CSS class when executing", () => {
    state().actions.setBundlerReady(true);
    state().actions.setExecutionStatus("running");

    render(<EditorToolbar onRun={mockOnRun} />);

    const runBtn = screen.getByTestId("run-button");
    expect(runBtn).toHaveAttribute("data-is-running", "true");
  });

  it("does not apply running CSS class when idle", () => {
    state().actions.setBundlerReady(true);
    state().actions.setExecutionStatus("idle");

    render(<EditorToolbar onRun={mockOnRun} />);

    const runBtn = screen.getByTestId("run-button");
    expect(runBtn).toHaveAttribute("data-is-running", "false");
  });
});
