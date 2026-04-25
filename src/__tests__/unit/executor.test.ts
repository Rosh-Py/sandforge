/**
 * Unit Tests — Executor Service
 *
 * Tests the pure logic extracted from executor.ts:
 *   • isSandboxMessage type guard
 *   • isLogType type guard
 *   • executeInSandbox DOM + message handling integration
 *   • destroySandbox cleanup behavior
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ─── Import guards from the real source module ─────────────────────────
// These were previously re-implemented in the test (bad practice: testing
// a stale copy of logic). Now we test the actual exported functions.

import { isLogType, isSandboxMessage } from "../../services/executor";
import { SANDBOX_SOURCE } from "../../constants";

// ─── Suite: Type Guards ─────────────────────────────────────────────────

describe("executor — type guards", () => {
  describe("isLogType", () => {
    it.each(["log", "warn", "error", "info", "system"])(
      'returns true for valid type "%s"',
      (type) => {
        expect(isLogType(type)).toBe(true);
      },
    );

    it.each(["done", "clear", "debug", "trace", "", "LOG", "Error"])(
      'returns false for invalid type "%s"',
      (type) => {
        expect(isLogType(type)).toBe(false);
      },
    );

    it.each([null, undefined, 42, true, {}, []])(
      "returns false for non-string value: %j",
      (val) => {
        expect(isLogType(val)).toBe(false);
      },
    );
  });

  describe("isSandboxMessage", () => {
    it("returns true for a valid log message", () => {
      expect(
        isSandboxMessage({
          source: SANDBOX_SOURCE,
          type: "log",
          message: "hi",
        }),
      ).toBe(true);
    });

    it("returns true for a valid done message (no message field)", () => {
      expect(isSandboxMessage({ source: SANDBOX_SOURCE, type: "done" })).toBe(
        true,
      );
    });

    it("returns true for a valid clear message", () => {
      expect(isSandboxMessage({ source: SANDBOX_SOURCE, type: "clear" })).toBe(
        true,
      );
    });

    it("returns false when source is missing", () => {
      expect(isSandboxMessage({ type: "log", message: "hi" })).toBe(false);
    });

    it("returns false when source is wrong", () => {
      expect(isSandboxMessage({ source: "other-source", type: "log" })).toBe(
        false,
      );
    });

    it("returns false when type is missing", () => {
      expect(isSandboxMessage({ source: SANDBOX_SOURCE })).toBe(false);
    });

    it("returns false when type is non-string", () => {
      expect(isSandboxMessage({ source: SANDBOX_SOURCE, type: 123 })).toBe(
        false,
      );
    });

    it("returns false for null", () => {
      expect(isSandboxMessage(null)).toBe(false);
    });

    it("returns false for primitives", () => {
      expect(isSandboxMessage("string")).toBe(false);
      expect(isSandboxMessage(42)).toBe(false);
      expect(isSandboxMessage(undefined)).toBe(false);
    });

    it("returns false for arrays", () => {
      expect(isSandboxMessage([1, 2, 3])).toBe(false);
    });
  });
});

// ─── Integration: executeInSandbox + destroySandbox ─────────────────────

// Mocks must be hoisted to top-level scope for vi.mock factory
const mockAddLog = vi.fn();
const mockClearLogs = vi.fn();
const mockSetExecutionStatus = vi.fn();

vi.mock("../../store/sandboxStore", () => ({
  useSandboxStore: {
    getState: () => ({
      actions: {
        addLog: mockAddLog,
        clearLogs: mockClearLogs,
        setExecutionStatus: mockSetExecutionStatus,
      },
    }),
  },
}));

// Import after mock is set up
import { executeInSandbox, destroySandbox } from "../../services/executor";

describe("executor — sandbox lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    // Ensure no leftover iframes
    destroySandbox();
  });

  afterEach(() => {
    destroySandbox();
    vi.useRealTimers();
  });

  it('creates a hidden iframe with sandbox="allow-scripts"', () => {
    executeInSandbox('console.log("test")');

    const iframes = document.querySelectorAll("iframe");
    expect(iframes).toHaveLength(1);

    const iframe = iframes[0];
    expect(iframe.style.display).toBe("none");
    expect(iframe.sandbox.contains("allow-scripts")).toBe(true);
  });

  it('sets execution status to "running"', () => {
    executeInSandbox('console.log("test")');
    expect(mockSetExecutionStatus).toHaveBeenCalledWith("running");
  });

  it("sets iframe src to a blob URL", () => {
    executeInSandbox('console.log("test")');
    const iframe = document.querySelector("iframe");
    expect(iframe?.src).toMatch(/^blob:/);
  });

  it("destroySandbox removes the iframe and cleans up", () => {
    executeInSandbox('console.log("test")');
    expect(document.querySelectorAll("iframe")).toHaveLength(1);

    destroySandbox();
    expect(document.querySelectorAll("iframe")).toHaveLength(0);
  });

  it("destroySandbox revokes the blob URL", () => {
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL");
    executeInSandbox('console.log("test")');
    const iframe = document.querySelector("iframe");
    const blobUrl = iframe?.src;

    destroySandbox();
    expect(revokeSpy).toHaveBeenCalledWith(blobUrl);
    revokeSpy.mockRestore();
  });

  it("destroySandbox is safe to call multiple times", () => {
    executeInSandbox('console.log("test")');
    destroySandbox();
    destroySandbox(); // second call should not throw
    expect(document.querySelectorAll("iframe")).toHaveLength(0);
  });

  it("cleans up previous sandbox when executing again", () => {
    executeInSandbox('console.log("first")');
    expect(document.querySelectorAll("iframe")).toHaveLength(1);

    executeInSandbox('console.log("second")');
    // Should still only have 1 iframe (previous was destroyed)
    expect(document.querySelectorAll("iframe")).toHaveLength(1);
  });

  it('handles "done" message: sets status to success', () => {
    executeInSandbox('console.log("test")');

    const doneEvent = new MessageEvent("message", {
      data: { source: SANDBOX_SOURCE, type: "done" },
    });
    window.dispatchEvent(doneEvent);

    expect(mockSetExecutionStatus).toHaveBeenCalledWith("success");

    // Iframe should still exist (no longer cleaned up after 3s)
    expect(document.querySelectorAll("iframe")).toHaveLength(1);

    vi.advanceTimersByTime(3000);
    expect(document.querySelectorAll("iframe")).toHaveLength(1);
  });

  it('handles "clear" message: calls clearLogs on the store', () => {
    executeInSandbox('console.log("test")');

    const clearEvent = new MessageEvent("message", {
      data: { source: SANDBOX_SOURCE, type: "clear" },
    });
    window.dispatchEvent(clearEvent);

    expect(mockClearLogs).toHaveBeenCalled();
  });

  it("handles log messages: calls addLog with correct type and message", () => {
    executeInSandbox('console.log("test")');

    const logEvent = new MessageEvent("message", {
      data: { source: SANDBOX_SOURCE, type: "warn", message: "be careful" },
    });
    window.dispatchEvent(logEvent);

    expect(mockAddLog).toHaveBeenCalledWith({
      type: "warn",
      message: "be careful",
    });
  });

  it('falls back unknown message types to "log"', () => {
    executeInSandbox('console.log("test")');

    const unknownEvent = new MessageEvent("message", {
      data: { source: SANDBOX_SOURCE, type: "trace", message: "traced" },
    });
    window.dispatchEvent(unknownEvent);

    expect(mockAddLog).toHaveBeenCalledWith({
      type: "log",
      message: "traced",
    });
  });

  it("ignores messages from other sources", () => {
    executeInSandbox('console.log("test")');
    mockAddLog.mockClear(); // reset after executeInSandbox might trigger calls

    const foreignEvent = new MessageEvent("message", {
      data: { source: "some-other-thing", type: "log", message: "ignore me" },
    });
    window.dispatchEvent(foreignEvent);

    expect(mockAddLog).not.toHaveBeenCalled();
  });

  it("triggers boot timeout after 15s if sandbox fails to respond", () => {
    executeInSandbox("invalid code");

    vi.advanceTimersByTime(16000); // 15s threshold + 1s buffer

    expect(mockAddLog).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "error",
        message: expect.stringContaining("initialize"),
      }),
    );
    expect(mockSetExecutionStatus).toHaveBeenCalledWith("error");
    expect(document.querySelectorAll("iframe")).toHaveLength(0);
  });

  it("triggers heartbeat timeout after 5s once initialized", () => {
    executeInSandbox('console.log("test")');

    // Signal initialization
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { source: SANDBOX_SOURCE, type: "system", message: "starting" },
      }),
    );

    // Move past the threshold without any more messages
    vi.advanceTimersByTime(6000); // 5s threshold + 1s buffer

    expect(mockAddLog).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "error",
        message: expect.stringContaining("stalled"),
      }),
    );
    expect(mockSetExecutionStatus).toHaveBeenCalledWith("error");
    expect(document.querySelectorAll("iframe")).toHaveLength(0);
  });

  it("any message from sandbox resets the heartbeat timer", () => {
    executeInSandbox('console.log("test")');

    // Initialize
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { source: SANDBOX_SOURCE, type: "system", message: "starting" },
      }),
    );

    // Advance 4s (just under the 5s threshold)
    vi.advanceTimersByTime(4000);

    // Send a message
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { source: SANDBOX_SOURCE, type: "log", message: "I'm alive" },
      }),
    );

    // Advance another 4s
    vi.advanceTimersByTime(4000);

    // Should NOT have timed out
    expect(mockSetExecutionStatus).not.toHaveBeenCalledWith("error");
    expect(document.querySelectorAll("iframe")).toHaveLength(1);
  });
});
