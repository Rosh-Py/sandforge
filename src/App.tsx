import { useEffect, useCallback, useState } from 'react';
import { Header, EditorToolbar } from './components/Header';
import { FileExplorer } from './components/FileExplorer';
import { CodeEditor } from './components/CodeEditor';
import { Terminal } from './components/Terminal';
import { useSandboxStore } from './store/sandboxStore';
import { initBundler, bundle } from './services/bundler';
import { executeInSandbox } from './services/executor';

function LoadingScreen() {
  return (
    <div className="loading-screen" role="status" aria-label="Loading">
      <div className="loading-screen__title">CODEX</div>
      <div className="loading-screen__bar">
        <div className="loading-screen__bar-fill" />
      </div>
      <div className="loading-screen__text">Initializing WASM Engine...</div>
    </div>
  );
}

export default function App() {
  const {
    files,
    isBundlerReady,
    setBundlerReady,
    setExecutionStatus,
    addLog,
    clearLogs,
  } = useSandboxStore();

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
        console.error('Failed to init bundler:', err);
        addLog({
          type: 'error',
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
    setExecutionStatus('bundling');

    addLog({
      type: 'system',
      message: '🔧 Bundling with esbuild-wasm...',
    });

    const { code, error } = await bundle(files);

    if (error) {
      addLog({ type: 'error', message: error });
      setExecutionStatus('error');
      return;
    }

    addLog({
      type: 'system',
      message: '✅ Bundle complete. Executing in sandbox...',
    });

    executeInSandbox(code);
  }, [files, clearLogs, setExecutionStatus, addLog]);

  // Global keyboard shortcut: Ctrl/Cmd + Enter to run
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (isBundlerReady) {
          handleRun();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRun, isBundlerReady]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="app-container">
      <Header />
      <main className="main-content" role="main">
        <FileExplorer />
        <div className="editor-area">
          <EditorToolbar onRun={handleRun} />
          <CodeEditor />
          <Terminal />
        </div>
      </main>
    </div>
  );
}
