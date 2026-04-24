import { useState, useRef, type KeyboardEvent } from "react";
import {
  FilePlus,
  Trash2,
  FileCode2,
  FileJson,
  FileText,
  ChevronRight,
} from "lucide-react";
import { useSandboxStore } from "../store/sandboxStore";

function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
      return (
        <FileCode2
          size={15}
          className="h-[16px] w-[16px] shrink-0 text-[#3178c6]"
        />
      );
    case "js":
    case "jsx":
      return (
        <FileCode2
          size={15}
          className="h-[16px] w-[16px] shrink-0 text-[#f7df1e]"
        />
      );
    case "json":
      return (
        <FileJson
          size={15}
          className="text-neon-yellow h-[16px] w-[16px] shrink-0"
        />
      );
    default:
      return (
        <FileText
          size={15}
          className="text-text-tertiary h-[16px] w-[16px] shrink-0"
        />
      );
  }
}

export function FileExplorer() {
  const {
    files,
    activeFile,
    isCreatingFile,
    setActiveFile,
    createFile,
    deleteFile,
    setIsCreatingFile,
  } = useSandboxStore();

  const [newFileName, setNewFileName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const fileNames = Object.keys(files);

  const handleCreateStart = () => {
    setIsCreatingFile(true);
    setNewFileName("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleCreateSubmit = () => {
    const name = newFileName.trim();
    if (!name) {
      setIsCreatingFile(false);
      return;
    }
    // Add .ts extension if none provided
    const finalName = name.includes(".") ? name : `${name}.ts`;
    createFile(finalName);
    setNewFileName("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleCreateSubmit();
    } else if (e.key === "Escape") {
      setIsCreatingFile(false);
      setNewFileName("");
    }
  };

  const handleDelete = (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    deleteFile(name);
  };

  return (
    <aside className="bg-bg-secondary border-border-color sidebar relative flex w-[260px] shrink-0 flex-col border-r">
      <div className="border-border-color flex items-center justify-between border-b px-[14px] py-[12px]">
        <span className="text-text-secondary flex items-center font-mono text-[11px] font-[600] tracking-[1.5px] uppercase">
          <ChevronRight size={12} style={{ opacity: 0.5 }} /> Explorer
        </span>
        <div className="flex gap-[4px]">
          <button
            className="text-text-tertiary transition-fast hover:bg-bg-hover hover:text-neon-green flex h-[26px] w-[26px] cursor-pointer items-center justify-center rounded-sm border-none bg-transparent"
            onClick={handleCreateStart}
            title="New File"
          >
            <FilePlus size={15} />
          </button>
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto py-[6px]"
        role="listbox"
        aria-label="File list"
      >
        {fileNames.map((name) => (
          <div
            key={name}
            role="option"
            aria-selected={name === activeFile}
            className={`transition-fast hover:bg-bg-hover group relative flex animate-[fade-in_200ms_ease_forwards] cursor-pointer items-center gap-[8px] border-l-[2px] px-[14px] py-[6px] ${name === activeFile ? "bg-bg-tertiary border-neon-green" : "border-transparent"}`}
            onClick={() => setActiveFile(name)}
          >
            {getFileIcon(name)}
            <span
              className={`flex-1 overflow-hidden font-mono text-[13px] text-ellipsis whitespace-nowrap ${name === activeFile ? "text-text-primary" : "text-text-secondary"}`}
            >
              {name}
            </span>
            {fileNames.length > 1 && (
              <button
                className="text-text-muted transition-fast hover:text-neon-pink hover:bg-neon-pink-glow flex h-[20px] w-[20px] cursor-pointer items-center justify-center rounded-sm border-none bg-transparent opacity-0 group-hover:opacity-100"
                onClick={(e) => handleDelete(e, name)}
                title="Delete file"
                aria-label={`Delete ${name}`}
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ))}

        {isCreatingFile && (
          <div className="flex animate-[fade-in_150ms_ease] items-center gap-[8px] px-[14px] py-[4px]">
            <FileCode2
              size={15}
              className="h-[16px] w-[16px] shrink-0 text-[#3178c6]"
            />
            <input
              ref={inputRef}
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleCreateSubmit}
              placeholder="filename.ts"
              className="text-text-primary bg-bg-primary border-neon-green-dim placeholder:text-text-muted flex-1 rounded-sm border px-[8px] py-[4px] font-mono text-[13px] shadow-[0_0_8px_var(--color-neon-green-glow)] outline-none"
              spellCheck={false}
            />
          </div>
        )}
      </div>
    </aside>
  );
}
