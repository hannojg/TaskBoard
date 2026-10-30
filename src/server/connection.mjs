import { fileURLToPath } from 'node:url';
import { readConnectionFile,prepareConnection,saveConnection } from '../../scripts/connection.mjs';
import { Store } from './store.mjs';

export async function connectFromFile(directory,uri) {
 const selected = new URL(uri);
 if (selected.protocol !== 'file:') throw new Error('Choose a connection file saved on this Mac.');
 const path = fileURLToPath(selected);
 const input = await readConnectionFile(path);
 const connection = await prepareConnection(input,directory);
 const store = new Store(connection);
 const data = await store.read();
 await saveConnection(connection,directory);
 return {store,data};
}

export function connectionFileForm() {
 return {
  mode:'form',
  message:'Choose the private TaskBoard connection file exported from your connected Mac.',
  requestedSchema:{
   type:'object',
   properties:{connectionFile:{type:'string',title:'Connection file',format:'uri','x-openai-input':{type:'file',options:[],userOptions:{kind:'file',accept:['.json']}}}},
   required:['connectionFile'],
  },
 };
}
