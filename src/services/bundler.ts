import * as esbuild from 'esbuild-wasm';

let isInitialized = false;

/** Safely extract an error message from an unknown caught value. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Initialize the esbuild WebAssembly binary.
 * We load the WASM from unpkg CDN.
 */
export async function initBundler(): Promise<void> {
  if (isInitialized) return;

  try {
    await esbuild.initialize({
      wasmURL: 'https://unpkg.com/esbuild-wasm@latest/esbuild.wasm',
      worker: true,
    });
    isInitialized = true;
  } catch (err: unknown) {
    // esbuild throws if initialized more than once
    if (err instanceof Error && err.message.includes('Cannot call "initialize"')) {
      isInitialized = true;
    } else {
      throw err;
    }
  }
}

/**
 * Custom esbuild plugin: resolves NPM package imports via unpkg
 * and local (VFS) file imports from the in-memory file store.
 */
function createSandboxPlugin(files: Record<string, string>): esbuild.Plugin {
  // Cache fetched packages in memory to avoid repeated network calls
  const fetchCache = new Map<string, esbuild.OnLoadResult>();

  return {
    name: 'sandbox-plugin',
    setup(build) {
      // --- RESOLVE PHASE ---

      // Handle the entry point (index.ts)
      build.onResolve({ filter: /^index\.ts$/ }, () => {
        return { path: 'index.ts', namespace: 'vfs' };
      });

      // Handle relative imports (./utils, ../helpers)
      build.onResolve({ filter: /^\.+\// }, (args) => {
        // Resolve relative to the importer
        const importerDir = args.importer.includes('/')
          ? args.importer.substring(0, args.importer.lastIndexOf('/') + 1)
          : '';

        let resolvedPath = importerDir + args.path;

        // Remove leading ./
        resolvedPath = resolvedPath.replace(/^\.\//, '');

        // Try to find the file with extensions
        if (files[resolvedPath]) {
          return { path: resolvedPath, namespace: 'vfs' };
        }
        // Try adding common extensions
        const extensions = ['.ts', '.tsx', '.js', '.jsx', '.json'];
        for (const ext of extensions) {
          if (files[resolvedPath + ext]) {
            return { path: resolvedPath + ext, namespace: 'vfs' };
          }
        }

        // Also try index files
        for (const ext of extensions) {
          const indexPath = resolvedPath + '/index' + ext;
          if (files[indexPath]) {
            return { path: indexPath, namespace: 'vfs' };
          }
        }

        return { path: resolvedPath, namespace: 'vfs' };
      });

      // Handle NPM package imports (bare specifiers like 'lodash', 'react')
      build.onResolve({ filter: /.*/ }, (args) => {
        if (args.namespace === 'unpkg') {
          // This is a nested import from within an unpkg package
          const url = new URL(args.path, `https://unpkg.com${args.resolveDir}/`);
          return { path: url.href, namespace: 'unpkg' };
        }

        // Top-level npm import
        return {
          path: `https://unpkg.com/${args.path}`,
          namespace: 'unpkg',
        };
      });

      // --- LOAD PHASE ---

      // Load files from our Virtual File System
      build.onLoad({ filter: /.*/, namespace: 'vfs' }, (args) => {
        const content = files[args.path];
        if (content === undefined) {
          return {
            errors: [{ text: `File not found: ${args.path}` }],
          };
        }

        const ext = args.path.split('.').pop();
        let loader: esbuild.Loader = 'ts';
        if (ext === 'js') loader = 'js';
        if (ext === 'jsx') loader = 'jsx';
        if (ext === 'tsx') loader = 'tsx';
        if (ext === 'json') loader = 'json';
        if (ext === 'css') loader = 'css';

        return { contents: content, loader };
      });

      // Load files from unpkg (NPM packages)
      build.onLoad({ filter: /.*/, namespace: 'unpkg' }, async (args) => {
        // Check cache first
        const cached = fetchCache.get(args.path);
        if (cached) return cached;

        try {
          const response = await fetch(args.path);
          if (!response.ok) {
            return {
              errors: [{ text: `Failed to fetch ${args.path}: ${response.statusText}` }],
            };
          }

          const contents = await response.text();

          // Determine the resolve directory from the final URL
          // (unpkg may redirect, e.g., lodash -> lodash/lodash.js)
          const resolvedUrl = new URL(response.url);
          const resolveDir = resolvedUrl.pathname.substring(
            0,
            resolvedUrl.pathname.lastIndexOf('/') + 1
          );

          const result: esbuild.OnLoadResult = {
            contents,
            loader: 'js',
            resolveDir,
          };

          fetchCache.set(args.path, result);
          return result;
        } catch (err: unknown) {
          return {
            errors: [{ text: `Network error fetching ${args.path}: ${getErrorMessage(err)}` }],
          };
        }
      });
    },
  };
}

/**
 * Bundle all files starting from index.ts using esbuild-wasm.
 * Returns a single JavaScript string ready for execution.
 */
export async function bundle(files: Record<string, string>): Promise<{
  code: string;
  error: string | null;
}> {
  if (!isInitialized) {
    return { code: '', error: 'Bundler not initialized' };
  }

  try {
    const result = await esbuild.build({
      entryPoints: ['index.ts'],
      bundle: true,
      write: false,
      format: 'esm',
      target: 'es2020',
      plugins: [createSandboxPlugin(files)],
      define: {
        'process.env.NODE_ENV': '"development"',
      },
    });

    if (result.errors.length > 0) {
      const errorMessages = result.errors
        .map((e) => e.text)
        .join('\n');
      return { code: '', error: errorMessages };
    }

    const code = result.outputFiles?.[0]?.text ?? '';
    return { code, error: null };
  } catch (err: unknown) {
    return { code: '', error: getErrorMessage(err) };
  }
}
