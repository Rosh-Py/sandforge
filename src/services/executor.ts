import { useSandboxStore, type LogEntry } from "../store/sandboxStore";
import { SANDBOX_SOURCE } from "../constants";

type LogType = LogEntry["type"];

const VALID_LOG_TYPES = new Set<string>([
  "log",
  "warn",
  "error",
  "info",
  "system",
]);

export function isLogType(value: unknown): value is LogType {
  return typeof value === "string" && VALID_LOG_TYPES.has(value);
}

interface SandboxMessageBase {
  source: typeof SANDBOX_SOURCE;
}

interface SandboxLogMessage extends SandboxMessageBase {
  type: LogType;
  message: string;
}

interface SandboxDoneMessage extends SandboxMessageBase {
  type: "done";
}

interface SandboxClearMessage extends SandboxMessageBase {
  type: "clear";
}

interface SandboxPongMessage extends SandboxMessageBase {
  type: "pong";
}

type SandboxMessage =
  | SandboxLogMessage
  | SandboxDoneMessage
  | SandboxClearMessage
  | SandboxPongMessage;

export function isSandboxMessage(data: unknown): data is SandboxMessage {
  if (typeof data !== "object" || data === null) return false;
  const record = data as Record<string, unknown>;
  return record.source === SANDBOX_SOURCE && typeof record.type === "string";
}

/**
 * Create the HTML content for the sandbox iframe.
 * This includes a console proxy that sends logs back to the parent window.
 */
/* eslint-disable no-useless-escape -- `<\/script>` escapes are required to prevent premature tag closure in injected HTML */
function createSandboxHTML(code: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    body { margin: 0; background: #0a0e17; color: #e2e8f0; font-family: monospace; }
  </style>
</head>
<body>
  <script>
    // Override console methods to proxy to parent
    function sendToParent(type, args) {
      const message = args
        .map(arg => {
          if (typeof arg === 'object') {
            try { return JSON.stringify(arg, null, 2); }
            catch { return String(arg); }
          }
          return String(arg);
        })
        .join(' ');
      
      window.parent.postMessage({
        source: '${SANDBOX_SOURCE}',
        type: type,
        message: message,
      }, '*');
    }
    
    console.log = (...args) => { sendToParent('log', args); };
    console.warn = (...args) => { sendToParent('warn', args); };
    console.error = (...args) => { sendToParent('error', args); };
    console.info = (...args) => { sendToParent('info', args); };
    console.table = (...args) => { sendToParent('log', args); };
    console.dir = (...args) => { sendToParent('log', args); };
    console.clear = () => {
      window.parent.postMessage({ source: '${SANDBOX_SOURCE}', type: 'clear' }, '*');
    };
    
    // Catch uncaught errors
    window.onerror = (msg, url, line, col, error) => {
      sendToParent('error', [error ? error.stack || error.message : msg]);
      return true;
    };
    
    // Catch unhandled promise rejections
    window.onunhandledrejection = (event) => {
      sendToParent('error', ['Unhandled Promise Rejection: ' + (event.reason?.stack || event.reason?.message || event.reason)]);
    };

    // Heartbeat responder
    window.addEventListener('message', (e) => {
      if (e.data && e.data.source === '${SANDBOX_SOURCE}' && e.data.type === 'ping') {
        window.parent.postMessage({ source: '${SANDBOX_SOURCE}', type: 'pong' }, '*');
      }
    });
    
    // Signal that we're starting
    window.parent.postMessage({ source: '${SANDBOX_SOURCE}', type: 'system', message: '🏃 Execution started...' }, '*');
  <\/script>
  <script type="module">
    try {
      ${code}
      // Signal completion after sync code finishes
      // (async operations will still run and post messages)
    } catch (err) {
      window.parent.postMessage({
        source: '${SANDBOX_SOURCE}',
        type: 'error',
        message: err.stack || err.message || String(err),
      }, '*');
    } finally {
      window.parent.postMessage({ source: '${SANDBOX_SOURCE}', type: 'done' }, '*');
    }
  <\/script>
</body>
</html>`;
}
/* eslint-enable no-useless-escape */

let currentIframe: HTMLIFrameElement | null = null;
let messageHandler: ((e: MessageEvent) => void) | null = null;
let heartbeatInterval: number | null = null;
let lastPongAt = 0;
let isSandboxReady = false;

/**
 * Execute bundled code in a sandboxed iframe.
 */
export function executeInSandbox(code: string): void {
  const { actions } = useSandboxStore.getState();

  // Clean up previous sandbox
  destroySandbox();

  actions.setExecutionStatus("running");

  // Create a new iframe
  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  iframe.sandbox.add("allow-scripts");
  document.body.appendChild(iframe);
  currentIframe = iframe;

  // Track responsiveness with a heartbeat
  lastPongAt = Date.now();
  isSandboxReady = false; // Reset for new execution
  heartbeatInterval = window.setInterval(() => {
    if (currentIframe?.contentWindow) {
      currentIframe.contentWindow.postMessage(
        { source: SANDBOX_SOURCE, type: "ping" },
        "*",
      );

      // Use a more generous timeout during the initial boot (15s)
      // but switch to a strict heartbeat (5s) once the sandbox is responsive.
      const threshold = isSandboxReady ? 5000 : 15000;

      if (Date.now() - lastPongAt > threshold) {
        actions.addLog({
          type: "error",
          message: isSandboxReady
            ? "🛑 Execution stalled (Event loop blocked). Possible infinite loop detected."
            : "⏱ Sandbox failed to initialize in time (15s).",
        });
        actions.setExecutionStatus("error");
        destroySandbox();
      }
    }
  }, 2000);

  messageHandler = (event: MessageEvent) => {
    const data: unknown = event.data;
    if (!isSandboxMessage(data)) return;

    // Any valid message from the sandbox proves the event loop is alive
    lastPongAt = Date.now();

    if (data.type === "pong") {
      isSandboxReady = true;
      return;
    }

    if (data.type === "done") {
      const { executionStatus } = useSandboxStore.getState();
      if (executionStatus !== "error") {
        actions.setExecutionStatus("success");
      }
      return;
    }

    if (data.type === "clear") {
      actions.clearLogs();
      return;
    }

    if (data.type === "system") {
      isSandboxReady = true;
    }

    actions.addLog({
      type: isLogType(data.type) ? data.type : "log",
      message: data.message,
    });
  };

  window.addEventListener("message", messageHandler);

  // Write the sandbox HTML
  const html = createSandboxHTML(code);
  const blob = new Blob([html], { type: "text/html" });
  iframe.src = URL.createObjectURL(blob);
}

/**
 * Destroy the current sandbox iframe and clean up listeners.
 */
export function destroySandbox(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  if (messageHandler) {
    window.removeEventListener("message", messageHandler);
    messageHandler = null;
  }
  if (currentIframe) {
    if (currentIframe.src.startsWith("blob:")) {
      URL.revokeObjectURL(currentIframe.src);
    }
    currentIframe.remove();
    currentIframe = null;
  }
}
