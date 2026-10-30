import { DatabaseSync } from 'node:sqlite';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { loadStore } from '../src/server/store.mjs';
import { migrateBoard } from '../src/server/chats.mjs';

const home = homedir();
const directory = process.env.TASKBOARD_DATA_DIR || join(home,'Library','Application Support','TaskBoard');
const path = join(directory,'taskboard.sqlite');
const local = new DatabaseSync(path,{readOnly:true});
let snapshot;
try {
 local.exec('BEGIN');
 const boardQuery = local.prepare('SELECT data FROM board WHERE id=1');
 const board = boardQuery.get();
 const catalogQuery = local.prepare('SELECT data FROM catalog WHERE id=1');
 const catalog = catalogQuery.get();
 const chatsQuery = local.prepare('SELECT data FROM chats WHERE id=1');
 const chats = chatsQuery.get();
 const decoded = JSON.parse(board.data);
 const state = migrateBoard(decoded);
 snapshot = {state,catalog:catalog ? JSON.parse(catalog.data) : [],chatCatalog:chats ? JSON.parse(chats.data) : []};
 local.exec('COMMIT');
} finally { local.close(); }
const store = await loadStore(directory);
const result = await store.importLocal(snapshot);
console.log('Migrated '+result.state.projects.length+' projects and '+result.state.tasks.length+' tasks to the shared board. The original local database is retained as a migration snapshot.');
