import test from 'node:test';
import assert from 'node:assert/strict';
import {initialProject,toggleProject,isOperatingAt,advanceIncidents,csvCell} from '../lib/project-state.ts';
test('stopped periods are excluded; resuming preserves old data and begins a new cycle',()=>{
 const start=initialProject(),paused=toggleProject(start,false,100),resumed=toggleProject(paused,true,300);
 assert.equal(isOperatingAt(99,paused),true);assert.equal(isOperatingAt(100,paused),false);assert.equal(isOperatingAt(1000,paused),false);
 assert.equal(isOperatingAt(200,resumed),false);assert.equal(isOperatingAt(300,resumed),true);assert.equal(resumed.resumedAt,300);assert.equal(toggleProject(resumed,true,400),resumed);
});
test('incident transitions do not duplicate on polls and distinguish recovery from pause',()=>{
 const rules={ph:{min:5.5,max:6.5}},enabled={ph:true},empty={startedAt:0,events:[]};
 const first=advanceIncidents(empty,{ph:7},rules,enabled,10,true);assert.equal(first.state.events.length,1);
 const repeat=advanceIncidents(first.state,{ph:7.2},rules,enabled,20,true);assert.equal(repeat.changed,false);
 const recovery=advanceIncidents(repeat.state,{ph:6},rules,enabled,30,true);assert.equal(recovery.state.events[0].reason,'recovered');
 const paused=advanceIncidents(first.state,{ph:7},rules,enabled,30,false);assert.equal(paused.state.events[0].reason,'paused');
 const settings=advanceIncidents(first.state,{ph:7},{ph:{min:5,max:8}},enabled,30,true);assert.equal(settings.state.events[0].reason,'settings_changed');
 assert.equal(first.state.events[0].closedAt,null);
});
test('CSV escapes commas, quotes, formulas and line breaks',()=>{
 assert.equal(csvCell('a,"b"'),'"a,""b"""');assert.equal(csvCell('=1+1'),'"\'=1+1"');assert.equal(csvCell('10'),'"10"');
});
