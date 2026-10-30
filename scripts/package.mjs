import { cp,mkdir,rm,writeFile } from 'node:fs/promises';
import { join,resolve } from 'node:path';
import { boardTemplateFiles } from './board-template.mjs';
const destination = resolve('plugins','taskboard');
await rm(destination,{recursive:true,force:true});
await mkdir(destination,{recursive:true});
for (const file of ['plugin.json','.app.json','mcp.json','dist/app.html','dist/server.mjs','assets','skills','scripts/launch-mcp.sh','scripts/connect.mjs','scripts/connection.mjs','scripts/share-connection.mjs','scripts/creation.mjs','scripts/prepare-board.mjs','scripts/board-template.mjs','docs','README.md']) {
 const target = join(destination,file); await cp(file,target,{recursive:true});
}
await cp('dist/complete-creation.mjs',join(destination,'scripts','complete-creation.mjs'));
for (const file of boardTemplateFiles) {
 const source = join('site',file);
 const target = join(destination,'site',file);
 await cp(source,target,{recursive:true});
}
const catalog = {name:'taskboard-local',interface:{displayName:'TaskBoard'},plugins:[{name:'taskboard',source:{source:'local',path:'./plugins/taskboard'},policy:{installation:'AVAILABLE',authentication:'ON_INSTALL'},category:'Developer Tools'}]};
const catalogDirectory = resolve('.agents','plugins'); await mkdir(catalogDirectory,{recursive:true});
const json = JSON.stringify(catalog,null,2); await writeFile(join(catalogDirectory,'marketplace.json'),json+'\n');
console.log(destination);
