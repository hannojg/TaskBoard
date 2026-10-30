import { readCreation,requireUnconnected,updateCreation } from '../../scripts/creation.mjs';
import { prepareConnection,saveConnection } from '../../scripts/connection.mjs';
import { Store } from './store.mjs';

export async function completeCreation(directory,input) {
 await requireUnconnected(directory);
 const creation = await readCreation(directory);
 if (creation === null || creation.requestId !== input.requestId) throw new Error('This board setup request is no longer active.');
 if (creation.projectId === null || creation.projectId !== input.projectId) throw new Error('Use the Site project ID recorded for this board setup.');
 const connection = await prepareConnection(input,directory);
 const store = new Store(connection);
 await store.read();
 await saveConnection(connection,directory);
 await updateCreation(directory,input.requestId,'complete');
}
