import { Separator } from "react-resizable-panels";

/** Grip dots — vertical (for the horizontal handle between sidebar and editor) */
function HGrip() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="flex flex-col gap-[3px] opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-neon-green h-[3px] w-[3px] rounded-full" />
        ))}
      </div>
    </div>
  );
}

/** Grip dots — horizontal (for the vertical handle between editor and terminal) */
function VGrip() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="flex flex-row gap-[3px] opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-neon-purple h-[3px] w-[3px] rounded-full"
          />
        ))}
      </div>
    </div>
  );
}

/** Vertical bar separating FileExplorer from the editor column */
export function ResizeHandleH() {
  return (
    <Separator
      id="sep-h"
      className="group bg-border-color hover:bg-neon-green-dim active:bg-neon-green-dim relative z-10 w-[4px] shrink-0 cursor-col-resize transition-colors duration-150 hover:shadow-[0_0_8px_var(--color-neon-green-glow-strong)] active:shadow-[0_0_12px_var(--color-neon-green-glow-strong)]"
    >
      <HGrip />
    </Separator>
  );
}

/** Horizontal bar separating CodeEditor from Terminal */
export function ResizeHandleV() {
  return (
    <Separator
      id="sep-v"
      className="group bg-border-color hover:bg-neon-purple-dim active:bg-neon-purple-dim relative z-10 h-[4px] shrink-0 cursor-row-resize transition-colors duration-150 hover:shadow-[0_0_8px_var(--color-neon-purple-glow)] active:shadow-[0_0_12px_var(--color-neon-purple-glow)]"
    >
      <VGrip />
    </Separator>
  );
}
