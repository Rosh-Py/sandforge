import { useEffect, useCallback, useState } from "react";
import { Group, Panel } from "react-resizable-panels";
import { APP_NAME_UPPER } from "./constants";
import { Header, EditorToolbar } from "./components/Header";
import { FileExplorer } from "./components/FileExplorer";
import { CodeEditor } from "./components/CodeEditor";
import { Terminal } from "./components/Terminal";
import { ResizeHandleH, ResizeHandleV } from "./components/ResizeHandle";
import { useSandboxStore } from "./store/sandboxStore";
import { initBundler, bundle } from "./services/bundler";
import { executeInSandbox } from "./services/executor";

function LoadingScreen() {
  return (
    <div
      className="bg-bg-primary fixed inset-0 z-[10000] flex flex-col items-center justify-center gap-[24px]"
      role="status"
      aria-label="Loading"
    >
      <div className="font-display from-neon-green via-neon-cyan to-neon-purple bg-gradient-to-br bg-clip-text text-[28px] font-[800] tracking-[6px] text-transparent uppercase">
        {APP_NAME_UPPER}
      </div>
      <div className="bg-bg-tertiary h-[2px] w-[200px] overflow-hidden rounded-[1px]">
        <div className="from-neon-green to-neon-cyan h-full animate-[loading-bar_2s_ease-in-out_infinite] rounded-[1px] bg-gradient-to-r shadow-[0_0_8px_var(--color-neon-green-glow-strong)]" />
      </div>
      <div className="text-text-tertiary font-mono text-[12px] tracking-[2px]">
        Initializing WASM Engine...
      </div>
    </div>
  );
}

export default function App() {
  const files = useSandboxStore((s) => s.files);
  const isBundlerReady = useSandboxStore((s) => s.isBundlerReady);
  const { setBundlerReady, setExecutionStatus, addLog, clearLogs } =
    useSandboxStore((s) => s.actions);

  const [isLoading, setIsLoading] = useState(true);

  // Initialize the esbuild WASM bundler on mount
  useEffect(() => {
    const init = async () => {
      try {
        await initBundler();
        setBundlerReady(true);
        // Small delay for the splash screen effect
        setTimeout(() => setIsLoading(false), 800);
      } catch (err: unknown) {
        console.error("Failed to init bundler:", err);
        addLog({
          type: "error",
          message: `Failed to initialize bundler: ${err instanceof Error ? err.message : String(err)}`,
        });
        setIsLoading(false);
      }
    };
    init();
  }, [setBundlerReady, addLog]);

  // Run the code: bundle → execute
  const handleRun = useCallback(async () => {
    clearLogs();
    setExecutionStatus("bundling");

    addLog({
      type: "system",
      message: "🔧 Bundling with esbuild-wasm...",
    });

    const { code, error } = await bundle(files);

    if (error) {
      addLog({ type: "error", message: error });
      setExecutionStatus("error");
      return;
    }

    addLog({
      type: "system",
      message: "✅ Bundle complete. Executing in sandbox...",
    });

    executeInSandbox(code);
  }, [files, clearLogs, setExecutionStatus, addLog]);

  // Global keyboard shortcut: Ctrl/Cmd + Enter to run
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (isBundlerReady) {
          handleRun();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleRun, isBundlerReady]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  // ── localStorage persistence helpers ──
  const loadLayout = (key: string): Record<string, number> | undefined => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : undefined;
    } catch {
      return undefined;
    }
  };
  const saveLayout = (key: string, layout: Record<string, number>) => {
    try {
      localStorage.setItem(key, JSON.stringify(layout));
    } catch {
      /* quota */
    }
  };

  return (
    <div className="bg-bg-primary app-container relative flex h-screen w-screen flex-col overflow-hidden">
      <Header />
      <main className="min-h-0 flex-1 overflow-hidden" role="main">
        <Group
          id="sf-h"
          orientation="horizontal"
          defaultLayout={loadLayout("sf-h-2")}
          onLayoutChanged={(l) => saveLayout("sf-h-2", l)}
          className="h-full"
        >
          {/* ── Sidebar ── */}
          <Panel defaultSize="20%" minSize="12%" maxSize="35%" id="sidebar">
            <FileExplorer />
          </Panel>

          <ResizeHandleH />

          {/* ── Editor + Terminal column ── */}
          <Panel defaultSize="80%" minSize="40%" id="main-col">
            <Group
              id="sf-v"
              orientation="vertical"
              defaultLayout={loadLayout("sf-v-2")}
              onLayoutChanged={(l) => saveLayout("sf-v-2", l)}
              className="h-full"
            >
              <Panel defaultSize="70%" minSize="20%" id="editor">
                <div className="flex h-full min-h-0 flex-col overflow-hidden">
                  <EditorToolbar onRun={handleRun} />
                  <CodeEditor />
                </div>
              </Panel>

              <ResizeHandleV />

              <Panel
                defaultSize="30%"
                minSize="10%"
                maxSize="60%"
                id="terminal"
              >
                <Terminal />
              </Panel>
            </Group>
          </Panel>
        </Group>
      </main>
    </div>
  );
}
