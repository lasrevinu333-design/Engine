import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const editions = ['manager', 'custodial', 'viewer'] as const;
const requestedEdition = String(process.env.MZ_APP_EDITION || 'manager').toLowerCase();
if (!editions.includes(requestedEdition as (typeof editions)[number])) {
  throw new Error(`Unknown Memphis Zoo app edition: ${requestedEdition}`);
}
const edition = requestedEdition as (typeof editions)[number];
const repositoryRoot = resolve(__dirname, '..');
const shellProof = /^(1|true|yes)$/i.test(String(process.env.MZ_SHELL_START || ''));
const custodialBrowserTestBuild = Boolean(process.env.MZ_MOBILE_DIST);

function packageIdentity(name: 'react' | 'react-dom') {
  const packagePath = resolve(repositoryRoot, 'node_modules', name, 'package.json');
  const bytes = readFileSync(packagePath);
  const parsed = JSON.parse(bytes.toString('utf8'));
  return {
    version: String(parsed.version),
    package_root: `node_modules/${name}`,
    package_json_sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

function normalizeModuleId(id: string): string {
  const normalized = id.replaceAll('\\', '/').replace(/^\0+/, '');
  const normalizedRepositoryRoot = repositoryRoot.replaceAll('\\', '/');
  const mobileNodeModulesRoot = `${normalizedRepositoryRoot}/mobile/node_modules/`;
  if (normalized.startsWith(mobileNodeModulesRoot)) {
    return `mobile/node_modules/${normalized.slice(mobileNodeModulesRoot.length)}`;
  }
  const rootNodeModulesRoot = `${normalizedRepositoryRoot}/node_modules/`;
  if (normalized.startsWith(rootNodeModulesRoot)) {
    return `node_modules/${normalized.slice(rootNodeModulesRoot.length)}`;
  }
  const nodeModules = normalized.lastIndexOf('/node_modules/');
  if (nodeModules >= 0) return `node_modules/${normalized.slice(nodeModules + '/node_modules/'.length)}`;
  const local = relative(repositoryRoot, normalized).replaceAll('\\', '/');
  return local.startsWith('../') ? normalized : local;
}

function editionModuleGraph(): Plugin {
  return {
    name: 'memphis-zoo-edition-module-graph',
    generateBundle(_options, bundle) {
      const modules = [...new Set(
        Object.values(bundle)
          .filter((item) => item.type === 'chunk')
          .flatMap((item) => Object.keys(item.modules ?? {}))
          .map(normalizeModuleId),
      )].sort();
      this.emitFile({
        type: 'asset',
        fileName: 'shell-edition-module-graph.json',
        source: `${JSON.stringify({
          schema_version: 1,
          edition,
          role_marker: `MZ_ROLE_${edition.toUpperCase()}_ONLY`,
          shell_proof: shellProof,
          runtime: {
            react: packageIdentity('react'),
            react_dom: packageIdentity('react-dom'),
          },
          modules,
        }, null, 2)}\n`,
      });
    },
  };
}

export default defineConfig({
  root: __dirname,
  base: './',
  publicDir: false,
  define: {
    __MZ_SHELL_PROOF__: JSON.stringify(shellProof),
    __MZ_CUSTODIAL_BROWSER_TEST__: JSON.stringify(custodialBrowserTestBuild),
  },
  plugins: [react(), editionModuleGraph()],
  resolve: {
    alias: [
      {
        find: '@memphis-zoo/edition-entry',
        replacement: resolve(__dirname, 'src', 'shell', 'roles', edition, 'entry.ts'),
      },
      {
        find: 'react-dom',
        replacement: resolve(repositoryRoot, 'node_modules', 'react-dom'),
      },
      {
        find: 'react',
        replacement: resolve(repositoryRoot, 'node_modules', 'react'),
      },
    ],
    dedupe: ['react', 'react-dom'],
  },
  build: {
    target: 'es2022',
    outDir: resolve(__dirname, 'mobile-dist'),
    emptyOutDir: false,
    copyPublicDir: false,
    manifest: 'shell-vite-manifest.json',
    assetsDir: 'shell-assets',
    sourcemap: false,
    reportCompressedSize: false,
    rolldownOptions: {
      input: resolve(__dirname, 'app-shell.html'),
      output: {
        entryFileNames: `shell-assets/${edition}-[name]-[hash].js`,
        chunkFileNames: `shell-assets/${edition}-[name]-[hash].js`,
        assetFileNames: `shell-assets/${edition}-[name]-[hash][extname]`,
      },
    },
  },
});
