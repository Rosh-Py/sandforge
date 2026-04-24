import { Play, Square, Zap } from 'lucide-react';
import { useSandboxStore } from '../store/sandboxStore';

export function Header() {
  const { executionStatus, isBundlerReady } = useSandboxStore();

  const getStatusText = () => {
    if (!isBundlerReady) return 'Initializing WASM...';
    switch (executionStatus) {
      case 'bundling':
        return 'Bundling...';
      case 'running':
        return 'Executing...';
      case 'error':
        return 'Error';
      case 'success':
        return 'Done';
      default:
        return 'Ready';
    }
  };

  const getStatusDotClass = () => {
    if (!isBundlerReady) return 'header__status-dot--running';
    switch (executionStatus) {
      case 'error':
        return 'header__status-dot--error';
      case 'bundling':
      case 'running':
        return 'header__status-dot--running';
      default:
        return '';
    }
  };

  return (
    <header className="header">
      <div className="header__logo">
        <div className="header__logo-icon">
          <span className="bracket">&lt;/&gt;</span>
        </div>
        <div>
          <div className="header__title">Codex</div>
          <div className="header__subtitle">sandbox v1.0</div>
        </div>
      </div>

      <div className="header__actions">
        <div className="header__status" role="status" aria-label="Execution status">
          <span className={`header__status-dot ${getStatusDotClass()}`} />
          {getStatusText()}
        </div>
      </div>
    </header>
  );
}

interface EditorToolbarProps {
  onRun: () => void;
}

export function EditorToolbar({ onRun }: EditorToolbarProps) {
  const { activeFile, executionStatus, isBundlerReady } = useSandboxStore();
  const isRunning = executionStatus === 'bundling' || executionStatus === 'running';

  return (
    <div className="editor-toolbar">
      <div className="editor-toolbar__tabs">
        {activeFile && (
          <button className="editor-tab editor-tab--active">
            <Zap size={12} />
            {activeFile}
          </button>
        )}
      </div>

      <button
        className={`editor-toolbar__run-btn ${isRunning ? 'editor-toolbar__run-btn--running' : ''}`}
        onClick={onRun}
        disabled={!isBundlerReady || isRunning}
        title={!isBundlerReady ? 'Bundler is initializing...' : 'Run code (Ctrl+Enter)'}
        aria-label={isRunning ? 'Running...' : 'Run'}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isRunning ? <Square size={13} /> : <Play size={13} />}
          {isRunning ? 'Running...' : 'Run'}
        </span>
      </button>
    </div>
  );
}
