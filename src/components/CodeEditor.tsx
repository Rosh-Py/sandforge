import { useRef, useEffect } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useSandboxStore } from "../store/sandboxStore";
import { EDITOR_THEME } from "../constants";
import { getLanguage } from "../utils/editorUtils";


export function CodeEditor() {
  const files = useSandboxStore((s) => s.files);
  const activeFile = useSandboxStore((s) => s.activeFile);
  const { updateFileContent } = useSandboxStore((s) => s.actions);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const currentContent = files[activeFile] ?? "";

  const handleMount: OnMount = (editorInstance) => {
    editorRef.current = editorInstance;
    editorInstance.focus();
  };

  const handleChange = (value: string | undefined) => {
    if (value !== undefined && activeFile) {
      updateFileContent(activeFile, value);
    }
  };

  // Focus editor when switching files
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
  }, [activeFile]);

  if (!activeFile) {
    return (
      <div
        className="bg-bg-primary flex-1 overflow-hidden"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-mono)",
          fontSize: "14px",
          color: "var(--text-muted)",
        }}
      >
        Create or select a file to start coding
      </div>
    );
  }

  return (
    <div className="bg-bg-primary flex-1 overflow-hidden">
      <Editor
        key={activeFile}
        height="100%"
        language={getLanguage(activeFile)}
        value={currentContent}
        onChange={handleChange}
        onMount={handleMount}
        theme={EDITOR_THEME}
        beforeMount={(monaco) => {
          // Define custom theme
          monaco.editor.defineTheme(EDITOR_THEME, {
            base: "vs-dark",
            inherit: true,
            rules: [
              { token: "comment", foreground: "3d4556", fontStyle: "italic" },
              { token: "keyword", foreground: "b44aff" },
              { token: "string", foreground: "00ff9d" },
              { token: "number", foreground: "ffd600" },
              { token: "type", foreground: "00e5ff" },
              { token: "function", foreground: "00e5ff" },
              { token: "variable", foreground: "e2e8f0" },
              { token: "operator", foreground: "ff2d75" },
              { token: "delimiter", foreground: "8892a8" },
            ],
            colors: {
              "editor.background": "#0a0e17",
              "editor.foreground": "#e2e8f0",
              "editor.lineHighlightBackground": "#151b2b",
              "editor.selectionBackground": "#1e2740",
              "editorCursor.foreground": "#00ff9d",
              "editor.selectionHighlightBackground": "#00ff9d15",
              "editorLineNumber.foreground": "#3d4556",
              "editorLineNumber.activeForeground": "#8892a8",
              "editorIndentGuide.background1": "#1e2740",
              "editorIndentGuide.activeBackground1": "#3d4556",
              "editorWidget.background": "#0f1420",
              "editorWidget.border": "#1e2740",
              "editorSuggestWidget.background": "#0f1420",
              "editorSuggestWidget.border": "#1e2740",
              "editorSuggestWidget.selectedBackground": "#1e2740",
              "scrollbarSlider.background": "#1e274080",
              "scrollbarSlider.hoverBackground": "#3d4556",
              "minimap.background": "#0a0e17",
            },
          });

          // TypeScript compiler options for better intellisense
          monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
            target: monaco.languages.typescript.ScriptTarget.ESNext,
            module: monaco.languages.typescript.ModuleKind.ESNext,
            moduleResolution:
              monaco.languages.typescript.ModuleResolutionKind.NodeJs,
            allowSyntheticDefaultImports: true,
            esModuleInterop: true,
            jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
            strict: true,
          });
        }}
        options={{
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontLigatures: true,
          lineHeight: 22,
          padding: { top: 16, bottom: 16 },
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          renderLineHighlight: "all",
          renderWhitespace: "selection",
          bracketPairColorization: { enabled: true },
          guides: {
            bracketPairs: true,
            indentation: true,
          },
          suggest: {
            preview: true,
            showMethods: true,
            showFunctions: true,
            showVariables: true,
          },
          tabSize: 2,
          automaticLayout: true,
          wordWrap: "on",
        }}
      />
    </div>
  );
}
