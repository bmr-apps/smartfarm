import { initialProject, toggleProject, advanceIncidents, type ProjectState, type IncidentState } from './project-state.ts';
import { readState, writeState } from './state.ts';
export const getProject=()=>readState<ProjectState>('onsil:project',initialProject);
export async function setProject(running:boolean,expected:number){
 const previous=await getProject();
 if(previous.changedAt!==expected)throw new Error('state_conflict');
 const next=toggleProject(previous,running,Math.max(Date.now(),previous.changedAt+1));
 if(next!==previous)await writeState('onsil:project',next);
 return next;
}
export const getIncidents=()=>readState<IncidentState>('onsil:incidents',()=>({startedAt:Date.now(),events:[]}));
export async function recordIncidents(values:Record<string,number>,rules:Record<string,{min:number;max:number}>,enabled:Record<string,boolean>,now:number,running:boolean){
 const previous=await getIncidents();const result=advanceIncidents(previous,values,rules,enabled,now,running);
 if(result.changed)await writeState('onsil:incidents',result.state);
 return result.state;
}
