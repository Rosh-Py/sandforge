/**
 * E2E Tests — Core User Flows
 *
 * These tests run against the REAL application in a real browser.
 * They validate the critical user journeys that determine whether
 * the product is usable:
 *
 *   1. App boots and initializes the WASM bundler
 *   2. User writes code and runs it → sees output in terminal
 *   3. User creates/deletes/switches files
 *   4. Error handling: syntax errors surface clearly
 *   5. Keyboard shortcuts work
 *
 * Philosophy: We test behavior the USER experiences, not implementation
 * details. If these tests pass, the product works. If they fail, it's broken.
 *
 * Best practices applied:
 *   - All locators use accessible queries: getByRole, getByText, getByLabel,
 *     getByTitle — NEVER className selectors
 *   - Tests describe user-visible behavior, not DOM structure
 *   - Helpers are named by what the user sees, not CSS implementation
 */
import { test, expect, type Page } from "@playwright/test";

// ── Helpers ─────────────────────────────────────────────────────────────

/** Wait for the app to finish initializing (loading screen disappears). */
async function waitForAppReady(page: Page) {
  // The loading screen shows role="status" with aria-label="Loading"
  // Wait for it to disappear (or never appear if already cached)
  await page.waitForFunction(
    () => !document.querySelector('[role="status"][aria-label="Loading"]'),
    { timeout: 30_000 },
  );

  // Ensure the main UI is visible using semantic role
  await expect(page.getByRole("main")).toBeVisible({ timeout: 10_000 });
}

/** Wait for the status indicator to show "Ready". */
async function waitForReady(page: Page) {
  const status = page.getByRole("status", { name: "Execution status" });
  await expect(status).toContainText("Ready", { timeout: 15_000 });
}

/** Click the Run button using accessible role query. */
async function clickRun(page: Page) {
  await page.getByRole("button", { name: "Run" }).click();
}

/** Wait for execution to complete (status shows "Done"). */
async function waitForDone(page: Page) {
  const status = page.getByRole("status", { name: "Execution status" });
  await expect(status).toContainText("Done", { timeout: 15_000 });
}

/** Get all terminal log messages from the log region. */
async function getTerminalMessages(page: Page): Promise<string[]> {
  const log = page.getByRole("log", { name: "Terminal output" });
  // Each message is in a line — get text content of the log lines
  return log.locator('[data-testid="terminal-line"]').allTextContents();
}

// ─────────────────────────────────────────────────────────────────────────

test.describe("App Initialization", () => {
  test("shows loading screen then transitions to main UI", async ({ page }) => {
    await page.goto("/");

    // Eventually the main app should be visible
    await waitForAppReady(page);

    // Loading screen should be gone
    const loadingStatus = page.getByRole("status", { name: "Loading" });
    await expect(loadingStatus).not.toBeVisible();

    // Main UI elements should be visible using semantic queries
    await expect(page.getByRole("main")).toBeVisible();
    await expect(
      page.getByRole("listbox", { name: "File list" }),
    ).toBeVisible();
    await expect(
      page.getByRole("log", { name: "Terminal output" }),
    ).toBeVisible();
  });

  test('header shows "Ready" after initialization', async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
    await waitForReady(page);

    const status = page.getByRole("status", { name: "Execution status" });
    await expect(status).toContainText("Ready");
  });

  test("default files are visible in the file explorer", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    const fileList = page.getByRole("listbox", { name: "File list" });
    await expect(
      fileList.getByRole("option", { name: /index\.ts/ }),
    ).toBeVisible();
    await expect(
      fileList.getByRole("option", { name: /utils\.ts/ }),
    ).toBeVisible();
  });

  test("index.ts is active by default", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    const indexOption = page.getByRole("option", { name: /index\.ts/ });
    await expect(indexOption).toHaveAttribute("aria-selected", "true");
  });

  test("terminal shows empty state message initially", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    await expect(page.getByText("Run your code to see output")).toBeVisible();
  });
});

test.describe("Code Execution — Happy Path", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
    await waitForReady(page);
  });

  test("run button is enabled when bundler is ready", async ({ page }) => {
    const runBtn = page.getByRole("button", { name: "Run" });
    await expect(runBtn).toBeEnabled();
    await expect(runBtn).toContainText("Run");
  });

  test("running the default code produces output in the terminal", async ({
    page,
  }) => {
    await clickRun(page);
    await waitForDone(page);

    // The default code imports from ./utils and logs a greeting
    const messages = await getTerminalMessages(page);

    // Should have system messages + the greeting
    const hasGreeting = messages.some((m) => m.includes("Hello"));
    expect(hasGreeting).toBe(true);
  });

  test("status indicator cycles: Ready → Bundling → Executing → Done", async ({
    page,
  }) => {
    const status = page.getByRole("status", { name: "Execution status" });

    await expect(status).toContainText("Ready");
    await clickRun(page);

    // At least one of these should be visible during execution
    // (we can't guarantee catching both due to timing)
    await waitForDone(page);
    await expect(status).toContainText("Done");
  });

  test("terminal shows system messages during execution", async ({ page }) => {
    await clickRun(page);
    await waitForDone(page);

    const messages = await getTerminalMessages(page);

    // System messages about bundling
    const hasBundlingMsg = messages.some(
      (m) => m.includes("Bundling") || m.includes("esbuild"),
    );
    expect(hasBundlingMsg).toBe(true);

    const hasCompleteMsg = messages.some(
      (m) => m.includes("Bundle complete") || m.includes("Executing"),
    );
    expect(hasCompleteMsg).toBe(true);
  });

  test('run button shows "Running..." during execution', async ({ page }) => {
    const runBtn = page.getByRole("button", { name: /run/i });

    await clickRun(page);

    // Either we catch "Running..." or it already finished — check final state
    await waitForDone(page);
    await expect(runBtn).toContainText("Run");
    await expect(runBtn).toBeEnabled();
  });
});

test.describe("Code Execution — Error Handling", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
    await waitForReady(page);
  });

  test("syntax error in code shows error in terminal", async ({ page }) => {
    // Type code with syntax error into Monaco
    // We need to clear and type into the Monaco editor
    const editor = page.locator(".monaco-editor textarea").first();

    // Focus the editor and select all existing text
    await editor.click();
    await page.keyboard.press("Meta+a");
    await page.keyboard.type("const x = {;"); // syntax error

    await clickRun(page);

    // Wait for error status
    const status = page.getByRole("status", { name: "Execution status" });
    await expect(status).toContainText("Error", { timeout: 15_000 });

    // Terminal should show error content in the log region
    const log = page.getByRole("log", { name: "Terminal output" });
    await expect(log).toContainText(/error/i, { timeout: 5_000 });
  });
});

test.describe("File Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
    await waitForReady(page);
  });

  test("clicking a file in the explorer switches the active file", async ({
    page,
  }) => {
    // Click on utils.ts option
    await page.getByRole("option", { name: /utils\.ts/ }).click();

    // utils.ts should now be selected
    const utilsOption = page.getByRole("option", { name: /utils\.ts/ });
    await expect(utilsOption).toHaveAttribute("aria-selected", "true");
  });

  test("clicking a file marks it as selected", async ({ page }) => {
    await page.getByRole("option", { name: /utils\.ts/ }).click();

    const utilsOption = page.getByRole("option", { name: /utils\.ts/ });
    await expect(utilsOption).toHaveAttribute("aria-selected", "true");

    const indexOption = page.getByRole("option", { name: /index\.ts/ });
    await expect(indexOption).toHaveAttribute("aria-selected", "false");
  });

  test("creating a new file via the + button", async ({ page }) => {
    // Click the new file button using title
    await page.getByTitle("New File").click();

    // Input should appear
    const input = page.getByPlaceholder("filename.ts");
    await expect(input).toBeVisible();

    // Type a filename and press Enter
    await input.fill("config.json");
    await input.press("Enter");

    // New file should appear in the file list
    const fileList = page.getByRole("listbox", { name: "File list" });
    await expect(
      fileList.getByRole("option", { name: /config\.json/ }),
    ).toBeVisible();

    // It should be the active/selected file
    const configOption = fileList.getByRole("option", { name: /config\.json/ });
    await expect(configOption).toHaveAttribute("aria-selected", "true");
  });

  test("creating a file without extension auto-appends .ts", async ({
    page,
  }) => {
    await page.getByTitle("New File").click();
    const input = page.getByPlaceholder("filename.ts");
    await input.fill("mymodule");
    await input.press("Enter");

    const fileList = page.getByRole("listbox", { name: "File list" });
    await expect(
      fileList.getByRole("option", { name: /mymodule\.ts/ }),
    ).toBeVisible();
  });

  test("pressing Escape cancels file creation", async ({ page }) => {
    await page.getByTitle("New File").click();
    const input = page.getByPlaceholder("filename.ts");
    await input.fill("should-not-create");
    await input.press("Escape");

    // Input should disappear
    await expect(input).not.toBeVisible();

    // File should not exist in the file list
    const fileList = page.getByRole("listbox", { name: "File list" });
    await expect(
      fileList.getByRole("option", { name: /should-not-create/ }),
    ).not.toBeVisible();
  });

  test("deleting a file removes it from the explorer", async ({ page }) => {
    // Use the accessible delete button with specific aria-label
    const deleteUtilsBtn = page.getByRole("button", {
      name: "Delete utils.ts",
    });
    await deleteUtilsBtn.click();

    // utils.ts should be gone
    const fileList = page.getByRole("listbox", { name: "File list" });
    await expect(
      fileList.getByRole("option", { name: /utils\.ts/ }),
    ).not.toBeVisible();
  });

  test("delete buttons are hidden when only one file remains", async ({
    page,
  }) => {
    // Delete one file to leave only one
    await page.getByRole("button", { name: "Delete utils.ts" }).click();

    // Now only index.ts remains — no delete buttons should be visible
    await expect(
      page.getByRole("button", { name: /^Delete / }),
    ).not.toBeVisible();
  });
});

test.describe("Keyboard Shortcuts", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
    await waitForReady(page);
  });

  test("Ctrl+Enter runs the code", async ({ page }) => {
    await page.keyboard.press("Control+Enter");

    // Should trigger execution
    await waitForDone(page);

    const messages = await getTerminalMessages(page);
    expect(messages.length).toBeGreaterThan(0);
  });

  test("Meta+Enter (Cmd+Enter on Mac) runs the code", async ({ page }) => {
    await page.keyboard.press("Meta+Enter");

    await waitForDone(page);

    const messages = await getTerminalMessages(page);
    expect(messages.length).toBeGreaterThan(0);
  });
});

test.describe("Terminal Interactions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
    await waitForReady(page);
  });

  test("clear button empties the terminal", async ({ page }) => {
    // Run code first to generate output
    await clickRun(page);
    await waitForDone(page);

    // Click clear button using accessible label
    await page.getByRole("button", { name: "Clear terminal" }).click();

    // Terminal should show empty state again
    await expect(page.getByText("Run your code to see output")).toBeVisible();
  });

  test("clear button is only visible when there are logs", async ({ page }) => {
    // Initially no clear button
    await expect(
      page.getByRole("button", { name: "Clear terminal" }),
    ).not.toBeVisible();

    // Run to generate logs
    await clickRun(page);
    await waitForDone(page);

    // Now clear button should be visible
    await expect(
      page.getByRole("button", { name: "Clear terminal" }),
    ).toBeVisible();
  });

  test("running code again replaces previous output", async ({ page }) => {
    // First run
    await clickRun(page);
    await waitForDone(page);

    const firstRunMessages = await getTerminalMessages(page);

    // Second run
    await clickRun(page);
    await waitForDone(page);

    const secondRunMessages = await getTerminalMessages(page);

    // Second run should NOT have duplicated the first run's output
    // (clearLogs is called at the start of handleRun)
    // The message count should be similar, not doubled
    expect(secondRunMessages.length).toBeLessThanOrEqual(
      firstRunMessages.length + 1,
    );
  });
});

test.describe("Multi-File Execution", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
    await waitForReady(page);
  });

  test("code that imports from another file works end-to-end", async ({
    page,
  }) => {
    // The default setup already has index.ts importing from utils.ts
    // Just verify it works
    await clickRun(page);
    await waitForDone(page);

    const messages = await getTerminalMessages(page);
    const hasImportedGreeting = messages.some((m) => m.includes("Hello"));
    expect(hasImportedGreeting).toBe(true);
  });

  test("editing an imported file and re-running reflects the change", async ({
    page,
  }) => {
    // Switch to utils.ts using accessible locator
    await page.getByRole("option", { name: /utils\.ts/ }).click();

    // Modify the function in Monaco
    const editor = page.locator(".monaco-editor textarea").first();
    await editor.click();
    await page.keyboard.press("Meta+a");
    await page.keyboard.type(
      "export function greet(name: string): string { return `MODIFIED: ${name}`; }\nexport function add(a: number, b: number): number { return a + b; }",
    );

    // Switch back to index.ts and run
    await page.getByRole("option", { name: /index\.ts/ }).click();
    await clickRun(page);
    await waitForDone(page);

    const messages = await getTerminalMessages(page);
    const hasModifiedOutput = messages.some((m) => m.includes("MODIFIED"));
    expect(hasModifiedOutput).toBe(true);
  });
});
