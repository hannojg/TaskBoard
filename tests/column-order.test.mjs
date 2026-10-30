import test from 'node:test';
import assert from 'node:assert/strict';
import { reorderColumns,statusIds } from '../src/column-order.js';
import { sharedFixture } from './support/shared.mjs';
test('moves columns before or after targets without mutating the original list',() => {
 const columns = [{id:'a'},{id:'b'},{id:'c'}];
 const before = reorderColumns(columns,'c','a',false);
 assert.deepEqual(before.map(item => item.id),['c','a','b']);
 const after = reorderColumns(columns,'a','c',true);
 assert.deepEqual(after.map(item => item.id),['b','c','a']);
 assert.deepEqual(columns.map(item => item.id),['a','b','c']);
 assert.equal(reorderColumns(columns,'a','a',false),columns);
});
test('both column orders persist without changing task assignments',async t => {
 const {client} = await sharedFixture(t); const store = client();
 const project = {id:'a',name:'A',repo:'',path:'',codexId:'',hostId:'local'};
 const second = {...project,id:'b',name:'B'};
 const task = {id:'t',title:'Keep assignments',description:'',priority:'None',due:'',projectId:'a',statusId:'backlog',chats:[]};
  const initial = await store.read(); assert.deepEqual(initial.state.statusOrder,statusIds);
  const order = [...statusIds]; const last = order.pop(); order.unshift(last);
  await store.save({version:3,projects:[second,project],tasks:[task],statusOrder:order},0);
  const reopened = client();
    const saved = await reopened.read(); assert.deepEqual(saved.state.statusOrder,order); assert.deepEqual(saved.state.projects.map(item => item.id),['b','a']);
   assert.equal(saved.state.tasks[0].projectId,'a'); assert.equal(saved.state.tasks[0].statusId,'backlog');

  await assert.rejects(store.save({version:3,projects:[project],tasks:[task],statusOrder:['todo','todo','todo','todo','todo','todo']},1),/each status once/);

});
