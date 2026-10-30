import test from 'node:test';
import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
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
 assert.match(request.args[1],/on error number -128/);
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
