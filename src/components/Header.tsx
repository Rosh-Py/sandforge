import { Play, Square, Zap } from "lucide-react";
import { useSandboxStore } from "../store/sandboxStore";
import { APP_NAME } from "../constants";

export function Header() {
  const executionStatus = useSandboxStore((s) => s.executionStatus);
  const isBundlerReady = useSandboxStore((s) => s.isBundlerReady);

  const getStatusText = () => {
    if (!isBundlerReady) return "Initializing WASM...";
    switch (executionStatus) {
      case "bundling":
        return "Bundling...";
      case "running":
        return "Executing...";
      case "error":
        return "Error";
      case "success":
        return "Done";
      default:
        return "Ready";
    }
  };

  const getStatusDotClass = () => {
    if (!isBundlerReady)
      return "bg-neon-yellow shadow-[0_0_6px_var(--color-neon-yellow)]";
    switch (executionStatus) {
      case "error":
        return "bg-neon-pink shadow-[0_0_6px_var(--color-neon-pink)]";
      case "bundling":
      case "running":
        return "bg-neon-yellow shadow-[0_0_6px_var(--color-neon-yellow)]";
      default:
        return "bg-neon-green shadow-[0_0_6px_var(--color-neon-green)]";
    }
  };

  return (
    <header className="bg-bg-secondary border-border-color header relative z-10 flex h-[48px] shrink-0 items-center justify-between border-b px-[16px]">
      <div className="flex items-center gap-[10px]">
        <div className="relative flex h-[28px] w-[28px] items-center justify-center">
          <span className="text-neon-green font-mono text-[20px] font-[700] drop-shadow-[0_0_10px_var(--color-neon-green-glow-strong)]">
            &lt;/&gt;
          </span>
        </div>
        <div>
          <div className="font-display from-neon-green to-neon-cyan bg-gradient-to-br bg-clip-text text-[14px] font-[700] tracking-[3px] text-transparent uppercase">
            {APP_NAME}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-[8px]">
        <div
          className="text-text-secondary bg-bg-tertiary border-border-color flex items-center gap-[6px] rounded-sm border px-[10px] py-[4px] font-mono text-[11px]"
          role="status"
          aria-label="Execution status"
        >
          <span
            data-testid="status-dot"
            data-execution-status={!isBundlerReady ? "initializing" : executionStatus}
            className={`h-[6px] w-[6px] animate-[pulse-glow_2s_ease-in-out_infinite] rounded-full ${getStatusDotClass()}`}
          />
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
  const activeFile = useSandboxStore((s) => s.activeFile);
  const executionStatus = useSandboxStore((s) => s.executionStatus);
  const isBundlerReady = useSandboxStore((s) => s.isBundlerReady);
  const isRunning =
    executionStatus === "bundling" || executionStatus === "running";

  return (
    <div className="bg-bg-secondary border-border-color flex h-[40px] shrink-0 items-center justify-between border-b px-[12px]">
      <div className="flex items-center gap-[2px]">
        {activeFile && (
          <button className="text-text-primary bg-bg-primary border-neon-green flex items-center gap-[6px] rounded-t-sm border-b-[2px] px-[14px] py-[6px] font-mono text-[12px]">
            <Zap size={12} />
            {activeFile}
          </button>
        )}
      </div>

      <button
        data-testid="run-button"
        data-is-running={isRunning}
        className={`text-bg-primary from-neon-green to-neon-cyan group relative flex cursor-pointer items-center gap-[6px] overflow-hidden rounded-sm border-none bg-gradient-to-br px-[16px] py-[6px] font-mono text-[12px] font-[600] tracking-[1px] uppercase hover:-translate-y-[1px] hover:shadow-[0_0_16px_var(--color-neon-green-glow-strong),0_0_32px_var(--color-neon-green-glow)] active:translate-y-0 ${isRunning ? "from-neon-yellow to-neon-orange animate-[glow-pulse_1.5s_ease-in-out_infinite]" : ""}`}
        onClick={onRun}
        disabled={!isBundlerReady || isRunning}
        title={
          !isBundlerReady
            ? "Bundler is initializing..."
            : "Run code (Ctrl+Enter)"
        }
        aria-label={isRunning ? "Running..." : "Run"}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {isRunning ? <Square size={13} /> : <Play size={13} />}
          {isRunning ? "Running..." : "Run"}
        </span>
      </button>
    </div>
  );
}
