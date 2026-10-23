import * as esbuild from 'esbuild';
const shim = { name: 'three-global', setup(b) { b.onResolve({ filter: /^three$/ }, () => ({ path: new URL('./three-shim.js', import.meta.url).pathname })); } };
const common = { bundle: true, minify: true, format: 'iife', legalComments: 'none', plugins: [shim], target: 'es2020' };
await esbuild.build({ ...common, entryPoints: ['extras-entry.js'], outfile: 'three-extras.iife.min.js' });
await esbuild.build({ ...common, entryPoints: ['pt-entry.js'], outfile: 'three-pathtracer.iife.min.js' });
