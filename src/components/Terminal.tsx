import { useRef, useEffect } from "react";
import { Terminal as TerminalIcon, Trash2 } from "lucide-react";
import { useSandboxStore, type LogEntry } from "../store/sandboxStore";

export function Terminal() {
  const logs = useSandboxStore((s) => s.logs);
  const { clearLogs } = useSandboxStore((s) => s.actions);
  const outputRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [logs]);

  const getPrefix = (type: LogEntry["type"]): string => {
    switch (type) {
      case "log":
        return "›";
      case "warn":
        return "⚠";
      case "error":
        return "✖";
      case "info":
        return "ℹ";
      case "system":
        return "⚡";
      default:
        return "›";
    }
  };

  return (
    <div className="bg-bg-secondary border-border-color terminal-container relative flex h-[240px] shrink-0 flex-col border-t">
      <div className="border-border-color flex items-center justify-between border-b px-[14px] py-[8px]">
        <div className="text-text-secondary flex items-center gap-[8px] font-mono text-[11px] font-[600] tracking-[1.5px] uppercase">
          <TerminalIcon size={13} className="text-neon-green" />
          Output
        </div>
        {logs.length > 0 && (
          <button
            className="text-text-tertiary border-border-color transition-fast hover:text-neon-pink hover:border-neon-pink hover:bg-neon-pink-glow flex cursor-pointer items-center rounded-sm border bg-transparent px-[10px] py-[3px] font-mono text-[10px] tracking-[1px] uppercase"
            onClick={clearLogs}
            aria-label="Clear terminal"
          >
            <Trash2 size={10} style={{ marginRight: 4 }} />
            Clear
          </button>
        )}
      </div>

      <div
        className="flex-1 overflow-y-auto px-[14px] py-[10px] font-mono text-[13px] leading-[1.6]"
        ref={outputRef}
        role="log"
        aria-label="Terminal output"
      >
        {logs.length === 0 ? (
          <div className="text-text-muted flex h-full items-center justify-center gap-[6px] font-mono text-[12px]">
            <span>Run your code to see output</span>
            <span className="bg-neon-green inline-block h-[14px] w-[7px] animate-[typing-cursor_1s_step-end_infinite] opacity-[0.7]" />
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className={`terminal__line terminal__line--${log.type} mt-[2px] flex animate-[fade-in_100ms_ease] gap-[8px] first:mt-0 ${log.type === "system" ? "italic" : ""}`}
            >
              <span
                className={`terminal__prefix shrink-0 select-none ${log.type === "system" ? "text-neon-purple-dim" : "text-text-muted"}`}
              >
                {getPrefix(log.type)}
              </span>
              <span
                className={`terminal__message break-all whitespace-pre-wrap ${log.type === "warn" ? "text-terminal-warn" : log.type === "error" ? "text-terminal-error" : log.type === "info" ? "text-terminal-info" : log.type === "system" ? "text-neon-purple" : "text-terminal-log"}`}
              >
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
