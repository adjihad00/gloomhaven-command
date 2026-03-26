import * as esbuild from 'esbuild';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes('--watch');

const sharedConfig = {
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2022'],
  sourcemap: true,
  minify: !watch,
  jsx: 'automatic',
  jsxImportSource: 'preact',
  loader: { '.ts': 'ts', '.tsx': 'tsx' },
  alias: {
    'react': 'preact/compat',
    'react-dom': 'preact/compat',
    '@gloomhaven-command/shared': resolve(__dirname, '../packages/shared/src/index.ts'),
  },
  logLevel: 'info',
};

const entryPoints = [
  { name: 'controller', entry: 'controller/main.tsx', out: 'controller/dist/main.js' },
  { name: 'phone',      entry: 'phone/main.tsx',      out: 'phone/dist/main.js' },
  { name: 'display',    entry: 'display/main.tsx',     out: 'display/dist/main.js' },
];

async function build() {
  for (const ep of entryPoints) {
    const config = {
      ...sharedConfig,
      entryPoints: [resolve(__dirname, ep.entry)],
      outfile: resolve(__dirname, ep.out),
    };

    if (watch) {
      const ctx = await esbuild.context(config);
      await ctx.watch();
      console.log(`Watching ${ep.name}...`);
    } else {
      await esbuild.build(config);
      console.log(`Built ${ep.name}`);
    }
  }
}

build().catch(err => { console.error(err); process.exit(1); });
