import { useState, useRef, type KeyboardEvent } from 'react';
import {
  FilePlus,
  Trash2,
  FileCode2,
  FileJson,
  FileText,
  ChevronRight,
} from 'lucide-react';
import { useSandboxStore } from '../store/sandboxStore';

function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return <FileCode2 size={15} className="file-item__icon file-item__icon--ts" />;
    case 'js':
    case 'jsx':
      return <FileCode2 size={15} className="file-item__icon file-item__icon--js" />;
    case 'json':
      return <FileJson size={15} className="file-item__icon file-item__icon--json" />;
    default:
      return <FileText size={15} className="file-item__icon file-item__icon--default" />;
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

  const [newFileName, setNewFileName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const fileNames = Object.keys(files);

  const handleCreateStart = () => {
    setIsCreatingFile(true);
    setNewFileName('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleCreateSubmit = () => {
    const name = newFileName.trim();
    if (!name) {
      setIsCreatingFile(false);
      return;
    }
    // Add .ts extension if none provided
    const finalName = name.includes('.') ? name : `${name}.ts`;
    createFile(finalName);
    setNewFileName('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleCreateSubmit();
    } else if (e.key === 'Escape') {
      setIsCreatingFile(false);
      setNewFileName('');
    }
  };

  const handleDelete = (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    deleteFile(name);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        <span className="sidebar__title">
          <ChevronRight size={12} style={{ opacity: 0.5 }} />
          {' '}Explorer
        </span>
        <div className="sidebar__actions">
          <button
            className="sidebar__action-btn"
            onClick={handleCreateStart}
            title="New File"
          >
            <FilePlus size={15} />
          </button>
        </div>
      </div>

      <div className="sidebar__files" role="listbox" aria-label="File list">
        {fileNames.map((name) => (
          <div
            key={name}
            role="option"
            aria-selected={name === activeFile}
            className={`file-item ${name === activeFile ? 'file-item--active' : ''}`}
            onClick={() => setActiveFile(name)}
          >
            {getFileIcon(name)}
            <span className="file-item__name">{name}</span>
            {fileNames.length > 1 && (
              <button
                className="file-item__delete"
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
          <div className="new-file-input">
            <FileCode2 size={15} className="file-item__icon file-item__icon--ts" />
            <input
              ref={inputRef}
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleCreateSubmit}
              placeholder="filename.ts"
              spellCheck={false}
            />
          </div>
        )}
      </div>
    </aside>
  );
}
