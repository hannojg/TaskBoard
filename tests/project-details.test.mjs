import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { resolveProject,repositoryUrl } from '../src/server/project-details.mjs';
test('normalizes SSH origins and removes web credentials',() => {
 assert.equal(repositoryUrl('git@github.com:example/repo.git'),'https://github.com/example/repo.git');
 assert.equal(repositoryUrl('ssh://git@github.com/example/repo.git'),'https://github.com/example/repo.git');
 assert.equal(repositoryUrl('https://user:secret@github.com/example/repo.git'),'https://github.com/example/repo.git');
});
test('reads the selected confirmed project origin without changing Git',async t => {
 const base = tmpdir(); const path = mkdtempSync(join(base,'taskboard-origin-'));
 t.after(() => rmSync(path,{recursive:true}));
 execFileSync('git',['init','--quiet',path]);
 const catalog = [{projectId:'p',label:'Chosen project',path,hostId:'local',isGitRepository:true}];
 const absent = await resolveProject(catalog,'p','local'); assert.equal(absent.repoStatus,'no-origin');
 execFileSync('git',['-C',path,'remote','add','origin','git@github.com:example/repo.git']);
 const details = await resolveProject(catalog,'p','local');
 assert.equal(details.name,'Chosen project'); assert.equal(details.path,path); assert.equal(details.repo,'https://github.com/example/repo.git');
 await assert.rejects(resolveProject(catalog,'unknown','local'),/Refresh/);
 const remote = await resolveProject([{...catalog[0],hostId:'another-host'}],'p','another-host'); assert.equal(remote.repoStatus,'remote-host');
});
