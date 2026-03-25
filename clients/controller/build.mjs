import * as esbuild from 'esbuild';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: [resolve(__dirname, 'src/main.ts')],
  bundle: true,
  outfile: resolve(__dirname, 'dist/main.js'),
  format: 'esm',
  platform: 'browser',
  target: ['es2022'],
  sourcemap: true,
  minify: !watch,
  // Resolve workspace packages
  alias: {
    '@gloomhaven-command/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
    '@gloomhaven-command/client-lib': resolve(__dirname, '../shared/lib/index.ts'),
  },
  loader: {
    '.ts': 'ts',
  },
  logLevel: 'info',
};

if (watch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await esbuild.build(buildOptions);
}
