export type Pause = { start: number; end: number };
export type ProjectState = { running: boolean; changedAt: number; resumedAt: number | null; pauses: Pause[] };
export const initialProject = (): ProjectState => ({ running: true, changedAt: 0, resumedAt: null, pauses: [] });
export function isOperatingAt(time: number, project: ProjectState) {
 return (project.running || time < project.changedAt) && !project.pauses.some(p => time >= p.start && time < p.end);
}
export function toggleProject(previous: ProjectState, running: boolean, now: number): ProjectState {
 if (previous.running === running) return previous;
 return { running, changedAt: now, resumedAt: running ? now : previous.resumedAt, pauses: running ? [...previous.pauses, {start:previous.changedAt,end:now}] : previous.pauses };
}
export type Incident = { id: string; metric: string; openedAt: number; closedAt: number | null; reason: 'recovered'|'paused'|'settings_changed'|null; value: number; min: number; max: number; source: 'demo' };
export type IncidentState = { startedAt: number; events: Incident[] };
export function advanceIncidents(previous: IncidentState, values: Record<string,number>, rules: Record<string,{min:number;max:number}>, enabled: Record<string,boolean>, now: number, running: boolean) {
 const events = previous.events.map(row=>({...row})); let changed=false;
 for(const [metric,rule] of Object.entries(rules)) {
  let open=events.find(row=>row.metric===metric&&row.closedAt===null);
  if(open && (!running || !enabled[metric] || open.min!==rule.min || open.max!==rule.max)) {
   open.closedAt=now;open.reason=running?'settings_changed':'paused';changed=true;open=undefined;
  }
  const value=values[metric];
  if(!running||!enabled[metric]||!Number.isFinite(value))continue;
  if(metric==='water'?value<=rule.min:(value<rule.min||value>rule.max)) {
   if(!open){events.unshift({id:`${metric}-${now}`,metric,openedAt:now,closedAt:null,reason:null,value,min:rule.min,max:rule.max,source:'demo'});changed=true;}
  } else if(open){open.closedAt=now;open.reason='recovered';changed=true;}
 }
 return {state:{startedAt:previous.startedAt,events},changed};
}
export function csvCell(value: unknown) {
 let text=String(value??'');if(/^[=+@\-\t\r]/.test(text))text="'"+text;
 return '"'+text.replaceAll('"','""')+'"';
}
