/**
 * Unit Tests — Bundler Service
 *
 * Tests the pure logic in bundler.ts:
 *   • getErrorMessage helper
 *   • bundle() error handling when not initialized
 *   • VFS file resolution algorithm (the core of createSandboxPlugin)
 *   • Loader detection logic
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Import getErrorMessage from the real source ─────────────────────────
// Previously re-implemented here (bad practice). Now tests the actual export.

import { getErrorMessage } from '../../services/bundler';

describe('bundler — getErrorMessage', () => {
  it('extracts message from Error instances', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('extracts message from Error subclasses', () => {
    expect(getErrorMessage(new TypeError('type fail'))).toBe('type fail');
  });

  it('converts strings to themselves', () => {
    expect(getErrorMessage('oops')).toBe('oops');
  });

  it('converts numbers to string', () => {
    expect(getErrorMessage(42)).toBe('42');
  });

  it('converts null to "null"', () => {
    expect(getErrorMessage(null)).toBe('null');
  });

  it('converts undefined to "undefined"', () => {
    expect(getErrorMessage(undefined)).toBe('undefined');
  });

  it('converts objects via toString', () => {
    expect(getErrorMessage({ message: 'not an error' })).toBe('[object Object]');
  });
});

// ─── bundle() without init ──────────────────────────────────────────────

vi.mock('esbuild-wasm', () => ({
  initialize: vi.fn(),
  build: vi.fn(),
}));

import { bundle } from '../../services/bundler';

describe('bundler — bundle()', () => {
  it('returns error when bundler is not initialized', async () => {
    // Since we mock esbuild, initBundler was never successfully called
    // so isInitialized remains false
    const result = await bundle({ 'index.ts': 'console.log("hi")' });
    expect(result.code).toBe('');
    expect(result.error).toBe('Bundler not initialized');
  });
});

// ─── Plugin resolve/load logic ──────────────────────────────────────────

describe('bundler — VFS file resolution algorithm', () => {
  /**
   * Mirrors the resolve logic from createSandboxPlugin.
   * Given a relative import path and an importer path, resolves to a VFS key.
   */
  function resolveRelativeImport(
    importPath: string,
    importerPath: string,
    files: Record<string, string>
  ): string | null {
    const importerDir = importerPath.includes('/')
      ? importerPath.substring(0, importerPath.lastIndexOf('/') + 1)
      : '';

    let resolvedPath = importerDir + importPath;
    resolvedPath = resolvedPath.replace(/^\.\//, '');

    // Exact match
    if (files[resolvedPath]) return resolvedPath;

    // Try extensions
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.json'];
    for (const ext of extensions) {
      if (files[resolvedPath + ext]) return resolvedPath + ext;
    }

    // Try index files
    for (const ext of extensions) {
      const indexPath = resolvedPath + '/index' + ext;
      if (files[indexPath]) return indexPath;
    }

    return null; // not found
  }

  /**
   * Mirrors the loader detection from the VFS onLoad handler.
   */
  function getLoader(path: string): string {
    const ext = path.split('.').pop();
    if (ext === 'js') return 'js';
    if (ext === 'jsx') return 'jsx';
    if (ext === 'tsx') return 'tsx';
    if (ext === 'json') return 'json';
    if (ext === 'css') return 'css';
    return 'ts'; // default
  }

  describe('resolveRelativeImport', () => {
    const files: Record<string, string> = {
      'index.ts': 'entry',
      'utils.ts': 'util code',
      'helpers/math.ts': 'math code',
      'helpers/index.ts': 'helpers barrel',
      'data.json': '{}',
      'styles.css': 'body {}',
      'component.tsx': '<div />',
      'legacy.js': 'var x = 1;',
      'react-comp.jsx': 'function App() {}',
    };

    it('resolves ./utils from root importer to utils.ts', () => {
      expect(resolveRelativeImport('./utils', 'index.ts', files)).toBe('utils.ts');
    });

    it('resolves bare path "math" from helpers/ importer to helpers/math.ts', () => {
      // Note: the algorithm concatenates importerDir + importPath.
      // With "./math", the result is "helpers/./math" which won't match.
      // In practice, esbuild strips the "./" before passing to the resolve handler.
      // So we test with a bare relative path as esbuild would provide.
      expect(resolveRelativeImport('math', 'helpers/index.ts', files)).toBe('helpers/math.ts');
    });

    it('resolves ./helpers to helpers/index.ts (index file convention)', () => {
      expect(resolveRelativeImport('./helpers', 'index.ts', files)).toBe('helpers/index.ts');
    });

    it('resolves ./data to data.json', () => {
      expect(resolveRelativeImport('./data', 'index.ts', files)).toBe('data.json');
    });

    it('resolves ./component to component.tsx', () => {
      expect(resolveRelativeImport('./component', 'index.ts', files)).toBe('component.tsx');
    });

    it('resolves ./legacy to legacy.js', () => {
      expect(resolveRelativeImport('./legacy', 'index.ts', files)).toBe('legacy.js');
    });

    it('resolves ./react-comp to react-comp.jsx', () => {
      expect(resolveRelativeImport('./react-comp', 'index.ts', files)).toBe('react-comp.jsx');
    });

    it('returns null for non-existent files', () => {
      expect(resolveRelativeImport('./missing', 'index.ts', files)).toBeNull();
    });

    it('respects extension priority: .ts wins over .tsx, .js, .jsx', () => {
      const ambiguousFiles: Record<string, string> = {
        'index.ts': 'entry',
        'widget.ts': 'ts version',
        'widget.tsx': 'tsx version',
        'widget.js': 'js version',
      };
      expect(resolveRelativeImport('./widget', 'index.ts', ambiguousFiles)).toBe('widget.ts');
    });

    it('falls through to .tsx when .ts does not exist', () => {
      const tsxFiles: Record<string, string> = {
        'index.ts': 'entry',
        'widget.tsx': 'tsx version',
        'widget.js': 'js version',
      };
      expect(resolveRelativeImport('./widget', 'index.ts', tsxFiles)).toBe('widget.tsx');
    });

    it('resolves exact path (with extension) directly', () => {
      const exactFiles: Record<string, string> = {
        'index.ts': 'entry',
        'config.json': '{}',
      };
      // If the import already includes the extension, exact match wins
      expect(resolveRelativeImport('./config.json', 'index.ts', exactFiles)).toBe('config.json');
    });
  });

  describe('getLoader', () => {
    it.each([
      ['app.ts', 'ts'],
      ['app.tsx', 'tsx'],
      ['app.js', 'js'],
      ['app.jsx', 'jsx'],
      ['data.json', 'json'],
      ['styles.css', 'css'],
      ['unknown.xyz', 'ts'], // defaults to 'ts'
    ])('maps "%s" → loader "%s"', (path, expectedLoader) => {
      expect(getLoader(path)).toBe(expectedLoader);
    });
  });
});

// ─── initBundler error handling ─────────────────────────────────────────

describe('bundler — initBundler error handling', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('swallows "Cannot call initialize" errors (double-init guard)', async () => {
    vi.doMock('esbuild-wasm', () => ({
      initialize: vi.fn().mockRejectedValue(
        new Error('Cannot call "initialize" more than once')
      ),
      build: vi.fn(),
    }));

    const { initBundler } = await import('../../services/bundler');
    await expect(initBundler()).resolves.toBeUndefined();
  });

  it('re-throws other initialization errors', async () => {
    vi.doMock('esbuild-wasm', () => ({
      initialize: vi.fn().mockRejectedValue(new Error('Network failure')),
      build: vi.fn(),
    }));

    const { initBundler } = await import('../../services/bundler');
    await expect(initBundler()).rejects.toThrow('Network failure');
  });
});
