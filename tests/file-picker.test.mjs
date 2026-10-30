import test from 'node:test';
import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chooseConnectionFile } from '../src/server/connection.mjs';

test('the macOS picker returns a file URI and forwards request cancellation',async t => {
 const path = '/Users/example/Downloads/Shared board ü.json';
 const controller = new AbortController();
 let request;
 t.mock.method(childProcess,'execFile',(command,args,options,callback) => {
  request = {command,args,options};
  callback(null,path+'\n','');
 });
 const selected = await chooseConnectionFile(controller.signal);
 const expected = pathToFileURL(path);
 assert.equal(selected,expected.href);
 assert.equal(request.command,'/usr/bin/osascript');
 assert.equal(request.options.signal,controller.signal);
 assert.match(request.args[1],/choose file/);
 assert.match(request.args[1],/of type \{"public\.json"\}/);
 assert.match(request.args[1],/on error number -128/);
});

test('the picker accepts the actual macOS type of a JSON connection file',{skip:process.platform !== 'darwin'},async t => {
 const temporary = tmpdir();
 const prefix = join(temporary,'taskboard-json-filter-');
 const directory = await mkdtemp(prefix);
 t.after(() => rm(directory,{recursive:true}));
 const path = join(directory,'TaskBoard-connection.json');
 await writeFile(path,'{}');
 const infoScript = 'on run argv\nset connectionFile to POSIX file (item 1 of argv)\nreturn type identifier of (info for connectionFile)\nend run';
 const info = childProcess.execFileSync('/usr/bin/osascript',['-e',infoScript,path],{encoding:'utf8'});
 const actualType = info.trim();
 let pickerScript;
 t.mock.method(childProcess,'execFile',(command,args,options,callback) => {
  pickerScript = args[1];
  callback(null,'\n','');
 });
 await chooseConnectionFile();
 const declaration = pickerScript.match(/of type \{([^}]+)\}/);
 assert.ok(declaration);
 const allowed = JSON.parse('['+declaration[1]+']');
 const selectable = allowed.includes(actualType);
 assert.equal(selectable,true,'The native picker filter must accept the file type reported by macOS: '+actualType);
});

test('cancelling the macOS picker returns no connection',async t => {
 t.mock.method(childProcess,'execFile',(command,args,options,callback) => {
  callback(null,'\n','');
 });
 const selected = await chooseConnectionFile();
 assert.equal(selected,null);
});

test('picker failures are actionable and do not expose subprocess output',async t => {
 const secret = 'private-subprocess-output';
 t.mock.method(childProcess,'execFile',(command,args,options,callback) => {
  const error = new Error(secret);
  callback(error,secret,secret);
 });
 const selected = chooseConnectionFile();
 await assert.rejects(selected,error => {
  assert.equal(error.message,'Could not open the macOS file picker. Try again.');
  const exposed = error.message.includes(secret);
  assert.equal(exposed,false);
  return true;
 });
});
