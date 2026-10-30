import { build } from 'esbuild';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
await mkdir('dist',{recursive:true});
const app = await build({entryPoints:['src/ui/bridge.js'],bundle:true,write:false,format:'iife',platform:'browser',target:'chrome120',outfile:'app.js',loader:{'.woff2':'dataurl'},legalComments:'eof'});
const javascript = app.outputFiles.find(file => file.path.endsWith('.js'));
const stylesheet = app.outputFiles.find(file => file.path.endsWith('.css'));
const template = await readFile('src/ui/index.html','utf8');
const script = javascript.text.replace(/<\/script/gi,'<\\/script');
const html = template.replace('<!-- APP_STYLE -->',() => '<style>'+stylesheet.text+'</style>').replace('<!-- APP_SCRIPT -->',() => '<script>'+script+'</script>');
await writeFile('dist/app.html',html);
await build({entryPoints:['src/server/index.mjs'],outfile:'dist/server.mjs',bundle:true,format:'esm',platform:'node',target:'node22',banner:{js:"import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);"}});
console.log('Built TaskBoard plugin.');

await build({entryPoints:['src/cloud/board-api.mjs'],outfile:'site/lib/board-api.mjs',bundle:true,format:'esm',platform:'browser',target:'es2022'});
await build({entryPoints:['scripts/complete-creation.mjs'],outfile:'dist/complete-creation.mjs',bundle:true,format:'esm',platform:'node',target:'node22'});
