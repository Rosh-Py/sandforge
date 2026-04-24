import { useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, Trash2 } from 'lucide-react';
import { useSandboxStore, type LogEntry } from '../store/sandboxStore';

export function Terminal() {
  const { logs, clearLogs } = useSandboxStore();
  const outputRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [logs]);

  const getPrefix = (type: LogEntry['type']): string => {
    switch (type) {
      case 'log':
        return '›';
      case 'warn':
        return '⚠';
      case 'error':
        return '✖';
      case 'info':
        return 'ℹ';
      case 'system':
        return '⚡';
      default:
        return '›';
    }
  };

  return (
    <div className="terminal-container">
      <div className="terminal__header">
        <div className="terminal__title">
          <TerminalIcon size={13} className="terminal__title-icon" />
          Output
        </div>
        {logs.length > 0 && (
          <button className="terminal__clear-btn" onClick={clearLogs} aria-label="Clear terminal">
            <Trash2 size={10} style={{ marginRight: 4 }} />
            Clear
          </button>
        )}
      </div>

      <div className="terminal__output" ref={outputRef} role="log" aria-label="Terminal output">
        {logs.length === 0 ? (
          <div className="terminal__empty">
            <span>Run your code to see output</span>
            <span className="terminal__cursor" />
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className={`terminal__line terminal__line--${log.type}`}
            >
              <span className="terminal__prefix">{getPrefix(log.type)}</span>
              <span className="terminal__message">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
