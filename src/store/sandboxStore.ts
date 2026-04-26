import { create } from "zustand";
import { getStorageItem, setStorageItem, STORAGE_KEYS } from "../utils/storage";

// --- Types ---

export interface LogEntry {
  id: string;
  type: "log" | "warn" | "error" | "info" | "system";
  message: string;
  timestamp: number;
}

export type ExecutionStatus =
  | "idle"
  | "bundling"
  | "running"
  | "error"
  | "success";

interface SandboxState {
  // Virtual File System
  files: Record<string, string>;
  activeFile: string;

  // Terminal
  logs: LogEntry[];
  executionStatus: ExecutionStatus;

  // UI state
  isCreatingFile: boolean;
  isBundlerReady: boolean;
  layout: "vertical" | "horizontal";

  // Actions
  actions: {
    // File operations
    createFile: (name: string, content?: string) => void;
    deleteFile: (name: string) => void;
    setActiveFile: (name: string) => void;
    updateFileContent: (name: string, content: string) => void;
    renameFile: (oldName: string, newName: string) => void;

    // Terminal operations
    addLog: (entry: Omit<LogEntry, "id" | "timestamp">) => void;
    clearLogs: () => void;

    // Execution
    setExecutionStatus: (status: ExecutionStatus) => void;

    // UI
    setIsCreatingFile: (val: boolean) => void;
    setBundlerReady: (val: boolean) => void;
    setLayout: (layout: "vertical" | "horizontal") => void;
  };
}

// Unique ID generator
let logIdCounter = 0;
const generateId = () => `log-${Date.now()}-${logIdCounter++}`;

// Default starter files
const DEFAULT_FILES: Record<string, string> = {
  "index.ts": `// 🟢 Welcome to SandForge
// Write your TypeScript code here and hit RUN

import { greet } from './utils';

const message = greet('Hacker');
console.log(message);

// Try importing an npm package:
// import _ from 'lodash';
// console.log(_.chunk([1, 2, 3, 4, 5], 2));
`,
  "utils.ts": `export function greet(name: string): string {
  return \`⚡ Hello, \${name}! Welcome to the matrix.\`;
}

export function add(a: number, b: number): number {
  return a + b;
}
`,
};

const getInitialLayout = (): "vertical" | "horizontal" => {
  const val = getStorageItem(STORAGE_KEYS.ORIENTATION);
  return val === "vertical" ? "vertical" : "horizontal";
};

export const useSandboxStore = create<SandboxState>((set, get) => ({
  // Initial state
  files: { ...DEFAULT_FILES },
  activeFile: "index.ts",
  logs: [],
  executionStatus: "idle",
  isCreatingFile: false,
  isBundlerReady: false,
  layout: getInitialLayout(),

  actions: {
    // --- File operations ---
    createFile: (name: string, content = "") => {
      const { files } = get();
      if (files[name]) return; // already exists
      set({
        files: { ...files, [name]: content },
        activeFile: name,
        isCreatingFile: false,
      });
    },

    deleteFile: (name: string) => {
      const { files, activeFile } = get();
      const updated = { ...files };
      delete updated[name];

      const remaining = Object.keys(updated);
      set({
        files: updated,
        activeFile: name === activeFile ? (remaining[0] ?? "") : activeFile,
      });
    },

    setActiveFile: (name: string) => {
      set({ activeFile: name });
    },

    updateFileContent: (name: string, content: string) => {
      const { files } = get();
      set({ files: { ...files, [name]: content } });
    },

    renameFile: (oldName: string, newName: string) => {
      const { files, activeFile } = get();
      if (files[newName]) return;
      const content = files[oldName];
      const updated = { ...files };
      delete updated[oldName];
      updated[newName] = content;
      set({
        files: updated,
        activeFile: activeFile === oldName ? newName : activeFile,
      });
    },

    // --- Terminal ---
    addLog: (entry) => {
      set((state) => ({
        logs: [
          ...state.logs,
          { ...entry, id: generateId(), timestamp: Date.now() },
        ],
      }));
    },

    clearLogs: () => {
      set({ logs: [] });
    },

    // --- Execution ---
    setExecutionStatus: (status) => {
      set({ executionStatus: status });
    },

    // --- UI ---
    setIsCreatingFile: (val) => {
      set({ isCreatingFile: val });
    },

    setBundlerReady: (val) => {
      set({ isBundlerReady: val });
    },

    setLayout: (layout) => {
      setStorageItem(STORAGE_KEYS.ORIENTATION, layout);
      set({ layout });
    },
  },
}));
