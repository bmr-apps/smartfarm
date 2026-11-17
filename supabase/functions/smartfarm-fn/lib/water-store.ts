import { readState, writeState } from './state.ts';
export type WaterSample={time:number;distanceCm:number|null};
type WaterLog={latest:WaterSample;history:WaterSample[]};
export const readWater=()=>readState<WaterLog|null>('onsil:water-v1',()=>null);
export async function saveWater(distanceCm:number|null,now=Date.now()){
 const previous=await readWater(),latest={time:now,distanceCm};
 const history=[...(previous?.history??[]).filter(row=>row.time>now-86400000&&row.time<Math.floor(now/120000)*120000),latest].slice(-1441);
 await writeState('onsil:water-v1',{latest,history});return latest;
}
