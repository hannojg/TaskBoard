import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const directory = resolve('plugins','taskboard');
for (const args of [['plugin','marketplace','add',resolve('.')],['plugin','add','taskboard@taskboard-local']]) {
 const result = spawnSync('codex',args,{cwd:directory,stdio:'inherit'});
 if (result.error) throw result.error;
 if (result.status !== 0) throw new Error('Codex plugin installation failed.');
}
console.log('TaskBoard installed. Open TaskBoard from the Codex plugin sidebar. If the entry is stale, reload Codex to refresh plugin metadata.');
