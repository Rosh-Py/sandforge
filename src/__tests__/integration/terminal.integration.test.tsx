/**
 * Integration Tests — Terminal ↔ SandboxStore
 *
 * Tests that the Terminal component correctly renders log entries from the
 * store, and that user interactions (clear button) feed back into the store.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";
import { Terminal } from "../../components/Terminal";
import { useSandboxStore } from "../../store/sandboxStore";

function resetStore() {
  useSandboxStore.setState(useSandboxStore.getInitialState());
}

function state() {
  return useSandboxStore.getState();
}

describe("Terminal ↔ Store integration", () => {
  beforeEach(resetStore);

  // ── Empty state ───────────────────────────────────────────────────

  it("shows empty state message when there are no logs", () => {
    render(<Terminal />);
    expect(screen.getByText("Run your code to see output")).toBeInTheDocument();
  });

  it("does not show clear button when there are no logs", () => {
    render(<Terminal />);
    expect(screen.queryByText("Clear")).not.toBeInTheDocument();
  });

  // ── Log rendering ────────────────────────────────────────────────

  it("renders log entries from the store", () => {
    state().actions.addLog({ type: "log", message: "hello world" });
    state().actions.addLog({ type: "error", message: "something broke" });

    render(<Terminal />);

    expect(screen.getByText("hello world")).toBeInTheDocument();
    expect(screen.getByText("something broke")).toBeInTheDocument();
  });

  it("hides empty state message when logs are present", () => {
    state().actions.addLog({ type: "log", message: "output" });

    render(<Terminal />);

    expect(
      screen.queryByText("Run your code to see output"),
    ).not.toBeInTheDocument();
  });

  it("applies correct CSS class for each log type", () => {
    state().actions.addLog({ type: "log", message: "log-msg" });
    state().actions.addLog({ type: "warn", message: "warn-msg" });
    state().actions.addLog({ type: "error", message: "error-msg" });
    state().actions.addLog({ type: "info", message: "info-msg" });
    state().actions.addLog({ type: "system", message: "system-msg" });

    render(<Terminal />);

    const logLine = screen.getByText("log-msg").closest(".terminal__line");
    expect(logLine).toHaveClass("terminal__line--log");

    const warnLine = screen.getByText("warn-msg").closest(".terminal__line");
    expect(warnLine).toHaveClass("terminal__line--warn");

    const errorLine = screen.getByText("error-msg").closest(".terminal__line");
    expect(errorLine).toHaveClass("terminal__line--error");

    const infoLine = screen.getByText("info-msg").closest(".terminal__line");
    expect(infoLine).toHaveClass("terminal__line--info");

    const systemLine = screen
      .getByText("system-msg")
      .closest(".terminal__line");
    expect(systemLine).toHaveClass("terminal__line--system");
  });

  it("renders correct prefix icons for each log type", () => {
    state().actions.addLog({ type: "log", message: "log-prefix" });
    state().actions.addLog({ type: "warn", message: "warn-prefix" });
    state().actions.addLog({ type: "error", message: "error-prefix" });
    state().actions.addLog({ type: "info", message: "info-prefix" });
    state().actions.addLog({ type: "system", message: "system-prefix" });

    render(<Terminal />);

    const prefixes = document.querySelectorAll(".terminal__prefix");
    const prefixTexts = Array.from(prefixes).map((el) => el.textContent);

    expect(prefixTexts).toEqual(["›", "⚠", "✖", "ℹ", "⚡"]);
  });

  it("preserves log ordering (insertion order)", () => {
    state().actions.addLog({ type: "log", message: "first" });
    state().actions.addLog({ type: "log", message: "second" });
    state().actions.addLog({ type: "log", message: "third" });

    render(<Terminal />);

    const messages = document.querySelectorAll(".terminal__message");
    const texts = Array.from(messages).map((el) => el.textContent);
    expect(texts).toEqual(["first", "second", "third"]);
  });

  // ── Clear button ──────────────────────────────────────────────────

  it("shows clear button when logs are present", () => {
    state().actions.addLog({ type: "log", message: "msg" });

    render(<Terminal />);

    expect(screen.getByText("Clear")).toBeInTheDocument();
  });

  it("clicking clear button empties logs in the store and re-renders empty state", () => {
    state().actions.addLog({ type: "log", message: "will be cleared" });

    render(<Terminal />);

    fireEvent.click(screen.getByText("Clear"));

    expect(state().logs).toHaveLength(0);
    expect(screen.getByText("Run your code to see output")).toBeInTheDocument();
  });

  // ── Reactivity: component reflects store mutations ────────────────

  it("dynamically renders new logs added after initial render", async () => {
    render(<Terminal />);

    // Initially empty
    expect(screen.getByText("Run your code to see output")).toBeInTheDocument();

    // Mutate store externally
    act(() => {
      state().actions.addLog({ type: "log", message: "late arrival" });
    });

    // Component should reactively update (Zustand subscription)
    await waitFor(() => {
      expect(screen.getByText("late arrival")).toBeInTheDocument();
    });
  });

  // ── Large number of logs ──────────────────────────────────────────

  it("renders many logs without crashing", () => {
    for (let i = 0; i < 100; i++) {
      state().actions.addLog({ type: "log", message: `log-${i}` });
    }

    render(<Terminal />);

    const messages = document.querySelectorAll(".terminal__message");
    expect(messages).toHaveLength(100);
    expect(screen.getByText("log-0")).toBeInTheDocument();
    expect(screen.getByText("log-99")).toBeInTheDocument();
  });
});
