import {test} from 'node:test';
import assert from 'node:assert/strict';
import {measureTank,waterIsLow,tankDefaults} from '../lib/water-tank.ts';
import {normalizeSettings,defaults} from '../lib/original-site-settings.ts';
import {advanceIncidents} from '../lib/project-state.ts';
test('200L / 50cm converts raw centimeter distance and includes the 10L boundary',()=>{
 for(const [distance,liters] of [[25,100],[45,20],[47.5,10],[50,0]])assert.equal(measureTank(distance).liters,liters);
 assert.equal(waterIsLow(measureTank(47.5).liters),true);
 assert.equal(waterIsLow(measureTank(47.49).liters),false);
 assert.equal(waterIsLow(undefined),false);
});
test('installation offset, full/empty clamping, and sensor faults stay distinct',()=>{
 const cfg={...tankDefaults,sensorOffsetCm:3};
 assert.equal(measureTank(3,cfg).liters,200);
 assert.equal(measureTank(50.5,cfg).liters,10);
 assert.equal(measureTank(53,cfg).liters,0);
 for(const value of [null,0,-1,NaN,Infinity,100,401])assert.equal(measureTank(value),null);
});
test('old contact settings upgrade without discarding other thresholds',()=>{
 const old={...defaults,water:{mode:'contact',cycleMinutes:120,maxRise:15,maxFall:15,staleMinutes:60,tolerance:.5},thresholds:{...defaults.thresholds,ph:{min:5.8,max:6.8},water:{min:20,max:90}}};
 const next=normalizeSettings(old);assert.equal(next.water.mode,'continuous');assert.equal(next.water.capacityLiters,200);assert.equal(next.thresholds.water.min,10);assert.equal(next.thresholds.ph.min,5.8);
 assert.deepEqual(normalizeSettings(next),next);
});
test('water incident opens exactly at 10L and full tank is normal',()=>{
 const base={startedAt:0,events:[]},rules={water:{min:10,max:200}},enabled={water:true};
 const low=advanceIncidents(base,{water:10},rules,enabled,100,true);assert.equal(low.state.events.length,1);
 const recovered=advanceIncidents(low.state,{water:200},rules,enabled,200,true);assert.equal(recovered.state.events[0].reason,'recovered');
});
