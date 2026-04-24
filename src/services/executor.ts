import { useSandboxStore, type LogEntry } from '../store/sandboxStore';
import { SANDBOX_SOURCE } from '../constants';

type LogType = LogEntry['type'];

const VALID_LOG_TYPES = new Set<string>(['log', 'warn', 'error', 'info', 'system']);

export function isLogType(value: unknown): value is LogType {
  return typeof value === 'string' && VALID_LOG_TYPES.has(value);
}

interface SandboxMessageBase {
  source: typeof SANDBOX_SOURCE;
}

interface SandboxLogMessage extends SandboxMessageBase {
  type: LogType;
  message: string;
}

interface SandboxDoneMessage extends SandboxMessageBase {
  type: 'done';
}

interface SandboxClearMessage extends SandboxMessageBase {
  type: 'clear';
}

type SandboxMessage = SandboxLogMessage | SandboxDoneMessage | SandboxClearMessage;

export function isSandboxMessage(data: unknown): data is SandboxMessage {
  if (typeof data !== 'object' || data === null) return false;
  const record = data as Record<string, unknown>;
  return record.source === SANDBOX_SOURCE && typeof record.type === 'string';
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
    
    // Signal that we're starting
    window.parent.postMessage({ source: '${SANDBOX_SOURCE}', type: 'system', message: '⚡ Execution started...' }, '*');
  <\/script>
  <script type="module">
    try {
      ${code}
      // Signal completion after sync code finishes
      // (async operations will still run and post messages)
      window.parent.postMessage({ source: '${SANDBOX_SOURCE}', type: 'done' }, '*');
    } catch (err) {
      window.parent.postMessage({
        source: '${SANDBOX_SOURCE}',
        type: 'error',
        message: err.stack || err.message || String(err),
      }, '*');
      window.parent.postMessage({ source: '${SANDBOX_SOURCE}', type: 'done' }, '*');
    }
  <\/script>
</body>
</html>`;
}
/* eslint-enable no-useless-escape */

let currentIframe: HTMLIFrameElement | null = null;
let messageHandler: ((e: MessageEvent) => void) | null = null;

/**
 * Execute bundled code in a sandboxed iframe.
 */
export function executeInSandbox(code: string): void {
  const store = useSandboxStore.getState();

  // Clean up previous sandbox
  destroySandbox();

  store.setExecutionStatus('running');

  // Create a new iframe
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.sandbox.add('allow-scripts');
  document.body.appendChild(iframe);
  currentIframe = iframe;

  // Listen for messages from the sandbox
  const timeoutId = setTimeout(() => {
    store.addLog({
      type: 'error',
      message: '⏱ Execution timeout (10s). Possible infinite loop detected. Sandbox terminated.',
    });
    store.setExecutionStatus('error');
    destroySandbox();
  }, 10000);

  messageHandler = (event: MessageEvent) => {
    const data: unknown = event.data;
    if (!isSandboxMessage(data)) return;

    if (data.type === 'done') {
      clearTimeout(timeoutId);
      store.setExecutionStatus('success');
      // Keep iframe alive for a bit to catch async logs
      setTimeout(() => destroySandbox(), 3000);
      return;
    }

    if (data.type === 'clear') {
      store.clearLogs();
      return;
    }

    store.addLog({
      type: isLogType(data.type) ? data.type : 'log',
      message: data.message,
    });
  };

  window.addEventListener('message', messageHandler);

  // Write the sandbox HTML
  const html = createSandboxHTML(code);
  const blob = new Blob([html], { type: 'text/html' });
  iframe.src = URL.createObjectURL(blob);
}

/**
 * Destroy the current sandbox iframe and clean up listeners.
 */
export function destroySandbox(): void {
  if (messageHandler) {
    window.removeEventListener('message', messageHandler);
    messageHandler = null;
  }
  if (currentIframe) {
    if (currentIframe.src.startsWith('blob:')) {
      URL.revokeObjectURL(currentIframe.src);
    }
    currentIframe.remove();
    currentIframe = null;
  }
}
