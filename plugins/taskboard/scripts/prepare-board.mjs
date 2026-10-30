import { readFile,writeFile,cp,mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCreation } from './creation.mjs';
import { boardTemplateFiles } from './board-template.mjs';

const home = homedir();
const directory = process.env.TASKBOARD_DATA_DIR || join(home,'Library','Application Support','TaskBoard');
const creation = await readCreation(directory);
if (creation === null || creation.requestId !== process.argv[2]) throw new Error('Read the active TaskBoard setup request before preparing its Site.');
const root = creation.sourceDirectory;
const manifestPath = join(root,'.openai','hosting.json');
const manifestText = await readFile(manifestPath,'utf8');
const manifest = JSON.parse(manifestText);
if (creation.projectId && manifest.project_id && creation.projectId !== manifest.project_id) throw new Error('The saved Site identity does not match this board setup.');
if (creation.projectId) manifest.project_id = creation.projectId;
manifest.d1 = 'DB';
manifest.r2 = 'BUCKET';
const templateUrl = new URL('../site/',import.meta.url);
const template = fileURLToPath(templateUrl);
for (const file of boardTemplateFiles) {
 const source = join(template,file);
 const destination = join(root,file);
 const parent = dirname(destination);
 await mkdir(parent,{recursive:true});
 await cp(source,destination,{recursive:true});
}
const updated = JSON.stringify(manifest,null,2);
await writeFile(manifestPath,updated+'\n');
console.log('Prepared TaskBoard Site source at '+root);
