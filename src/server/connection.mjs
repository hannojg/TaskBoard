import childProcess from 'node:child_process';
import { fileURLToPath,pathToFileURL } from 'node:url';
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

export async function chooseConnectionFile(signal) {
 const script = `try
 activate
 set connectionFile to choose file with prompt "Choose TaskBoard-connection.json to connect your shared board." of type {"public.json"} default location (path to downloads folder)
 return POSIX path of connectionFile
on error number -128
 return ""
end try`;
 const path = await new Promise((resolve,reject) => {
  childProcess.execFile('/usr/bin/osascript',['-e',script],{encoding:'utf8',signal},(error,stdout) => {
   if (error) {
    const failure = new Error('Could not open the macOS file picker. Try again.');
    reject(failure);
    return;
   }
   const selected = stdout.trimEnd();
   resolve(selected);
  });
 });
 if (path === '') return null;
 const uri = pathToFileURL(path);
 return uri.href;
}
