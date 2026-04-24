import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Automatic cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock URL.createObjectURL / revokeObjectURL (not available in happy-dom)
if (typeof globalThis.URL.createObjectURL === "undefined") {
  globalThis.URL.createObjectURL = vi.fn(() => "blob:mock-url");
}
if (typeof globalThis.URL.revokeObjectURL === "undefined") {
  globalThis.URL.revokeObjectURL = vi.fn();
}

// Mock Monaco Editor (heavy dependency, not suitable for unit tests)
vi.mock("@monaco-editor/react", () => ({
  __esModule: true,
  default: vi.fn(
    ({
      value,
      onChange,
      onMount,
    }: {
      value?: string;
      onChange?: (val: string) => void;
      onMount?: (editor: unknown) => void;
    }) => {
      // Simulate mount
      if (onMount) {
        setTimeout(() => onMount({ focus: vi.fn() }), 0);
      }
      return (
        <textarea
          data-testid="mock-monaco-editor"
          value={value ?? ""}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
            onChange?.(e.target.value)
          }
        />
      );
    },
  ),
}));
