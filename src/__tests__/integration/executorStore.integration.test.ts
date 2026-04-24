/**
 * Integration Tests — Executor ↔ Store Message Dispatch
 *
 * Tests the real message dispatch pipeline: executeInSandbox sets up
 * a window message listener → dispatches events → store is mutated.
 *
 * Why these matter:
 *   - Unit tests for executor mock the store entirely, so they can't
 *     catch issues where the executor writes to the wrong store field
 *     or passes the wrong shape to addLog.
 *   - The timeout-based cleanup (10s kill, 3s async grace period)
 *     involves real timer interactions that are easy to break.
 *   - Message ordering and state consistency under rapid-fire messages
 *     is the kind of bug that only shows up in integration tests.
 *
 * NOTE: The executor module imports useSandboxStore directly. We use
 * the SAME store reference (singleton) to verify mutations. No mocking.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useSandboxStore } from '../../store/sandboxStore';
import { executeInSandbox, destroySandbox } from '../../services/executor';

function resetStore() {
  useSandboxStore.setState(useSandboxStore.getInitialState());
}

function state() {
  return useSandboxStore.getState();
}

describe('Executor ↔ Store full integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetStore();
    destroySandbox(); // clean up any prior iframe
  });

  afterEach(() => {
    destroySandbox();
    vi.useRealTimers();
  });

  it('execution sets store status to "running"', () => {
    executeInSandbox('void 0');
    expect(state().executionStatus).toBe('running');
  });

  it('log messages flow through to the real store', () => {
    executeInSandbox('void 0');

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { source: 'codex-sandbox', type: 'log', message: 'hello from sandbox' },
      })
    );

    const logs = state().logs;
    expect(logs).toHaveLength(1);
    expect(logs[0].type).toBe('log');
    expect(logs[0].message).toBe('hello from sandbox');
    expect(logs[0].id).toMatch(/^log-/);
    expect(logs[0].timestamp).toBeGreaterThan(0);
  });

  it('multiple log types correctly populate the store', () => {
    executeInSandbox('void 0');

    const messages = [
      { type: 'log', message: 'log msg' },
      { type: 'warn', message: 'warn msg' },
      { type: 'error', message: 'error msg' },
      { type: 'info', message: 'info msg' },
      { type: 'system', message: 'system msg' },
    ] as const;

    messages.forEach((m) => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { source: 'codex-sandbox', ...m },
        })
      );
    });

    const logs = state().logs;
    expect(logs).toHaveLength(5);
    expect(logs.map((l) => l.type)).toEqual(['log', 'warn', 'error', 'info', 'system']);
    expect(logs.map((l) => l.message)).toEqual(messages.map((m) => m.message));
  });

  it('"done" message transitions status to "success"', () => {
    executeInSandbox('void 0');

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { source: 'codex-sandbox', type: 'done' },
      })
    );

    expect(state().executionStatus).toBe('success');
  });

  it('"clear" message empties the log array in the store', () => {
    // Pre-populate logs
    state().addLog({ type: 'log', message: 'existing log' });
    expect(state().logs).toHaveLength(1);

    executeInSandbox('void 0');

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { source: 'codex-sandbox', type: 'clear' },
      })
    );

    expect(state().logs).toHaveLength(0);
  });

  it('timeout sets status to "error" and adds timeout log to store', () => {
    executeInSandbox('while(true){}');

    vi.advanceTimersByTime(10000);

    expect(state().executionStatus).toBe('error');

    const errorLogs = state().logs.filter((l) => l.type === 'error');
    expect(errorLogs).toHaveLength(1);
    expect(errorLogs[0].message).toContain('timeout');
  });

  it('rapid-fire messages maintain insertion order in store', () => {
    executeInSandbox('void 0');

    for (let i = 0; i < 50; i++) {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { source: 'codex-sandbox', type: 'log', message: `msg-${i}` },
        })
      );
    }

    const logs = state().logs;
    expect(logs).toHaveLength(50);
    for (let i = 0; i < 50; i++) {
      expect(logs[i].message).toBe(`msg-${i}`);
    }
  });

  it('re-execution cleans up previous state and starts fresh', () => {
    // First execution
    executeInSandbox('first run');
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { source: 'codex-sandbox', type: 'log', message: 'from-first' },
      })
    );
    expect(state().logs).toHaveLength(1);

    // Second execution (should destroy first iframe)
    executeInSandbox('second run');
    expect(document.querySelectorAll('iframe')).toHaveLength(1);
    expect(state().executionStatus).toBe('running');
  });

  it('messages from destroyed sandbox are ignored', () => {
    executeInSandbox('void 0');
    destroySandbox();

    // This message should be silently dropped since the handler was removed
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { source: 'codex-sandbox', type: 'log', message: 'ghost message' },
      })
    );

    // Handler was removed — no new logs
    expect(state().logs).toHaveLength(0);
  });

  it('done message cancels the 10s timeout to prevent false error', () => {
    executeInSandbox('void 0');

    // Send "done" at 5s
    vi.advanceTimersByTime(5000);
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { source: 'codex-sandbox', type: 'done' },
      })
    );

    expect(state().executionStatus).toBe('success');

    // Advance past the 10s mark
    vi.advanceTimersByTime(5000);

    // Status should NOT be 'error' — the timeout was cancelled
    expect(state().executionStatus).toBe('success');
    expect(state().logs.filter((l) => l.message.includes('timeout'))).toHaveLength(0);
  });

  it('unknown message types fall back to "log" type in the store', () => {
    executeInSandbox('void 0');

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { source: 'codex-sandbox', type: 'debug', message: 'debug msg' },
      })
    );

    const logs = state().logs;
    expect(logs).toHaveLength(1);
    expect(logs[0].type).toBe('log'); // fallback
    expect(logs[0].message).toBe('debug msg');
  });
});
