/**
 * Unit Tests — CodeEditor utilities
 *
 * Tests the getLanguage mapping function used to determine
 * Monaco editor language from file extensions.
 */
import { describe, it, expect } from "vitest";

// ─── Import getLanguage from the real source ─────────────────────────
// Previously re-implemented here (bad practice). Now tests the actual export.

import { getLanguage } from "../../utils/editorUtils";

describe("getLanguage", () => {
  it.each([
    ["index.ts", "typescript"],
    ["App.tsx", "typescript"],
    ["main.js", "javascript"],
    ["Component.jsx", "javascript"],
    ["package.json", "json"],
    ["index.html", "html"],
    ["styles.css", "css"],
  ])('maps "%s" → "%s"', (filename, expected) => {
    expect(getLanguage(filename)).toBe(expected);
  });

  it("is case-insensitive for extensions", () => {
    expect(getLanguage("file.TS")).toBe("typescript");
    expect(getLanguage("file.JSX")).toBe("javascript");
    expect(getLanguage("file.JSON")).toBe("json");
  });

  it("returns plaintext for unknown extensions", () => {
    expect(getLanguage("readme.md")).toBe("plaintext");
    expect(getLanguage("Makefile")).toBe("plaintext");
    expect(getLanguage("image.png")).toBe("plaintext");
  });

  it("handles dotfiles and multi-dot filenames", () => {
    expect(getLanguage(".gitignore")).toBe("plaintext");
    expect(getLanguage("app.test.ts")).toBe("typescript");
    expect(getLanguage("tsconfig.build.json")).toBe("json");
  });
});
