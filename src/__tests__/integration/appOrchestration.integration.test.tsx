/**
 * Integration Tests — App Orchestration (handleRun flow)
 *
 * This is the highest-value integration test in the suite. It tests
 * the full pipeline: user clicks Run → clearLogs → setBundling →
 * bundle(files) → on error: log + set error status / on success:
 * executeInSandbox.
 *
 * Why this matters:
 *   - The handleRun callback coordinates 4 modules (store, bundler,
 *     executor, UI). A regression in any step silently breaks the
 *     entire execution pipeline.
 *   - Error/success branching logic is NOT covered by any unit test
 *     because it lives inside App.tsx's useCallback, not in an exported function.
 *   - Keyboard shortcut (Ctrl+Enter) bypasses the button entirely and
 *     calls handleRun directly — must be tested separately.
 *
 * Best practices applied:
 *   - Uses getByRole('button', { name }) instead of .getByText().closest()
 *   - No className selectors or DOM traversal
 *   - Splash screen delay extracted to named constant
 *   - No non-null assertions on query results
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useSandboxStore } from '../../store/sandboxStore';
import { APP_NAME_UPPER } from '../../constants';

// ── Mocks ──────────────────────────────────────────────────────────────

const mockBundle = vi.fn();
const mockInitBundler = vi.fn();
const mockExecuteInSandbox = vi.fn();

vi.mock('../../services/bundler', () => ({
  initBundler: (...args: unknown[]) => mockInitBundler(...args),
  bundle: (...args: unknown[]) => mockBundle(...args),
}));

vi.mock('../../services/executor', () => ({
  executeInSandbox: (...args: unknown[]) => mockExecuteInSandbox(...args),
}));

// Import App after mocks are set up
import App from '../../App';

/** Matches the setTimeout delay used in App.tsx for the splash screen */
const SPLASH_SCREEN_DELAY_MS = 800;

function resetStore() {
  useSandboxStore.setState(useSandboxStore.getInitialState());
}

function state() {
  return useSandboxStore.getState();
}

describe('App — handleRun orchestration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    resetStore();

    // Default: bundler initializes successfully
    mockInitBundler.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Helper: render App and wait for it to get past the loading screen
  async function renderAndWaitForReady() {
    render(<App />);

    // initBundler resolves → setBundlerReady(true) → setTimeout splash delay
    await act(async () => {
      await mockInitBundler();
    });

    // Advance past the splash screen delay
    await act(async () => {
      vi.advanceTimersByTime(SPLASH_SCREEN_DELAY_MS);
    });
  }

  // ── Loading / initialization ────────────────────────────────────

  it('shows loading screen while bundler initializes', () => {
    mockInitBundler.mockReturnValue(new Promise(() => {})); // never resolves
    render(<App />);

    expect(screen.getByText(APP_NAME_UPPER)).toBeInTheDocument();
    expect(screen.getByText('Initializing WASM Engine...')).toBeInTheDocument();
  });

  it('transitions from loading screen to main UI after init', async () => {
    await renderAndWaitForReady();

    // Loading screen should be gone
    expect(screen.queryByText('Initializing WASM Engine...')).not.toBeInTheDocument();
    // Main UI should be visible — check for a known landmark
    expect(screen.getByText('Explorer')).toBeInTheDocument();
  });

  it('sets isBundlerReady to true after successful init', async () => {
    await renderAndWaitForReady();
    expect(state().isBundlerReady).toBe(true);
  });

  it('shows main UI and logs error if init fails', async () => {
    // Use real timers for this test — waitFor needs real setTimeout
    vi.useRealTimers();
    mockInitBundler.mockRejectedValue(new Error('WASM load failed'));

    render(<App />);

    // Wait for the rejection to propagate and the loading screen to disappear
    await waitFor(() => {
      expect(screen.queryByText('Initializing WASM Engine...')).not.toBeInTheDocument();
    }, { timeout: 3000 });

    // Should have logged the error
    const errorLogs = state().logs.filter((l) => l.type === 'error');
    expect(errorLogs.length).toBeGreaterThan(0);
    expect(errorLogs[0].message).toContain('WASM load failed');

    // Restore fake timers for other tests
    vi.useFakeTimers();
  });

  // ── handleRun success path ──────────────────────────────────────

  it('clears logs, sets bundling, then calls bundle with current files', async () => {
    mockBundle.mockResolvedValue({ code: 'bundled_code', error: null });

    await renderAndWaitForReady();

    // Add a pre-existing log
    state().addLog({ type: 'log', message: 'old log' });

    // Use getByRole to find the Run button — accessible and resilient
    const runBtn = screen.getByRole('button', { name: /^run$/i });

    await act(async () => {
      fireEvent.click(runBtn);
    });

    // Logs should have been cleared and re-populated
    const logMessages = state().logs.map((l) => l.message);
    expect(logMessages).not.toContain('old log');

    // bundle should have been called with current files
    expect(mockBundle).toHaveBeenCalledWith(state().files);
  });

  it('calls executeInSandbox with bundled code on success', async () => {
    mockBundle.mockResolvedValue({ code: 'const x = 1;', error: null });

    await renderAndWaitForReady();

    const runBtn = screen.getByRole('button', { name: /^run$/i });

    await act(async () => {
      fireEvent.click(runBtn);
    });

    expect(mockExecuteInSandbox).toHaveBeenCalledWith('const x = 1;');
  });

  it('logs system messages during the run flow', async () => {
    mockBundle.mockResolvedValue({ code: 'code', error: null });

    await renderAndWaitForReady();

    const runBtn = screen.getByRole('button', { name: /^run$/i });

    await act(async () => {
      fireEvent.click(runBtn);
    });

    const systemLogs = state().logs.filter((l) => l.type === 'system');
    expect(systemLogs.some((l) => l.message.includes('Bundling'))).toBe(true);
    expect(systemLogs.some((l) => l.message.includes('Bundle complete'))).toBe(true);
  });

  // ── handleRun error path ────────────────────────────────────────

  it('logs bundle error and sets error status (does NOT call executeInSandbox)', async () => {
    mockBundle.mockResolvedValue({
      code: '',
      error: 'Syntax error: unexpected token',
    });

    await renderAndWaitForReady();

    const runBtn = screen.getByRole('button', { name: /^run$/i });

    await act(async () => {
      fireEvent.click(runBtn);
    });

    // Should NOT have called executor
    expect(mockExecuteInSandbox).not.toHaveBeenCalled();

    // Should have logged the error
    const errorLogs = state().logs.filter((l) => l.type === 'error');
    expect(errorLogs.some((l) => l.message.includes('Syntax error'))).toBe(true);

    // Status should be 'error'
    expect(state().executionStatus).toBe('error');
  });

  // ── Keyboard shortcut ───────────────────────────────────────────

  it('Ctrl+Enter triggers handleRun', async () => {
    mockBundle.mockResolvedValue({ code: 'kb-code', error: null });

    await renderAndWaitForReady();

    await act(async () => {
      fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });
    });

    expect(mockBundle).toHaveBeenCalled();
    expect(mockExecuteInSandbox).toHaveBeenCalledWith('kb-code');
  });

  it('Cmd+Enter (macOS) triggers handleRun', async () => {
    mockBundle.mockResolvedValue({ code: 'meta-code', error: null });

    await renderAndWaitForReady();

    await act(async () => {
      fireEvent.keyDown(window, { key: 'Enter', metaKey: true });
    });

    expect(mockBundle).toHaveBeenCalled();
    expect(mockExecuteInSandbox).toHaveBeenCalledWith('meta-code');
  });

  it('does NOT trigger handleRun with just Enter (no modifier)', async () => {
    await renderAndWaitForReady();

    await act(async () => {
      fireEvent.keyDown(window, { key: 'Enter' });
    });

    expect(mockBundle).not.toHaveBeenCalled();
  });

  it('does NOT trigger handleRun via shortcut before bundler is ready', async () => {
    mockInitBundler.mockReturnValue(new Promise(() => {})); // never resolves
    render(<App />);

    // The loading screen is still showing, but let's also test the shortcut
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });
    });

    expect(mockBundle).not.toHaveBeenCalled();
  });

  // ── Edge case: run uses latest files ──────────────────────────────

  it('bundles the LATEST file contents, not stale closure values', async () => {
    mockBundle.mockResolvedValue({ code: 'code', error: null });

    await renderAndWaitForReady();

    // Modify a file after render — wrap in act to trigger re-render
    // so the component's useCallback picks up the new `files` from the store
    await act(async () => {
      state().updateFileContent('index.ts', 'const updated = true;');
    });

    const runBtn = screen.getByRole('button', { name: /^run$/i });

    await act(async () => {
      fireEvent.click(runBtn);
    });

    // bundle should have been called with the updated content
    const calledWith = mockBundle.mock.calls[0][0];
    expect(calledWith['index.ts']).toBe('const updated = true;');
  });
});
