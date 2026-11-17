import { stateKV } from './state.ts';
import { getProject, recordIncidents } from './project-store.ts';
import { isOperatingAt, type ProjectState } from './project-state.ts';
import { supplyTiming, simulatedContactStart, simulatedDrainTiming } from './pump-timing.ts';
import { ZodError } from 'npm:zod@4.6.5';
import { defaults, settingsSchema, normalizeSettings } from './original-site-settings.ts';
import { measureTank, waterIsLow } from './water-tank.ts';
import { readWater } from './water-store.ts';
import { advanceAlertState, type AlertState } from './alert-state.ts';

export const ranges = ['30m', 'week', 'month', 'all'] as const;
export type HistoryRange = typeof ranges[number];
type Reading = { time: number; waterContact: boolean; ph: number; ec: number; temperature: number; humidity: number; water: number; distanceCm?: number; heightCm?: number };
export const cloudflareKV = async () => stateKV;

export function sample(time: number, drainAnchor?: number): Reading {
  const t = time / 60_000;
  const contactAt = simulatedContactStart(time, 120 * 60_000, drainAnchor);
  return { time, waterContact: contactAt !== null && time - contactAt < 60_000, ph: 6.08 + 0.16 * Math.sin(t / 37) + 0.06 * Math.cos(t / 11), ec: 1.68 + 0.13 * Math.sin(t / 49), temperature: 24.3 + 1.8 * Math.sin(t / 180), humidity: 66 + 5.4 * Math.cos(t / 73), water: 68 + 7 * Math.sin(t / 53) + 1.8 * Math.sin(t / 15) };
}

const aggregationMinutes: Record<HistoryRange, number> = { '30m': 1, week: 5, month: 60, all: 1440 };
const durationMinutes: Record<HistoryRange, number> = { '30m': 30, week: 7 * 1440, month: 30 * 1440, all: 60 * 1440 };
export function history(range: HistoryRange, now: number, project?: ProjectState): Reading[] {
  const step = aggregationMinutes[range];
  const end = Math.floor(now / (step * 60_000)) * step * 60_000;
  if (range === '30m') return Array.from({ length: 31 }, (_, i) => sample(end - (30 - i) * 60_000)).filter(row=>!project||isOperatingAt(row.time,project));
  const rows: Reading[] = [];
  for (let start = end - durationMinutes[range] * 60_000; start < end; start += step * 60_000) {
    const samples = Array.from({ length: step }, (_, i) => sample(start + i * 60_000)).filter(row=>!project||isOperatingAt(row.time,project));
    if(!samples.length)continue;
    const mean = (key: 'ph' | 'ec' | 'temperature' | 'humidity' | 'water') => samples.reduce((sum, row) => sum + row[key], 0) / samples.length;
    rows.push({ time: start, waterContact: samples.some(row => row.waterContact), ph: mean('ph'), ec: mean('ec'), temperature: mean('temperature'), humidity: mean('humidity'), water: mean('water') });
  }
  return rows;
}
function recentWater(now: number, drainAnchor?: number): Reading[] { const end = Math.floor(now / 60_000) * 60_000; return Array.from({ length: 1441 }, (_, i) => sample(end - (1440 - i) * 60_000, drainAnchor)); }

export async function getSettings() {
  const stored=await stateKV.get('onsil:settings');
  if(!stored)return structuredClone(defaults);
  try{return normalizeSettings(JSON.parse(stored));}
  catch(error){if(error instanceof ZodError)return structuredClone(defaults);throw error;}
}
export async function saveSettings(value:unknown) {
  const settings=settingsSchema.parse(value);
  await stateKV.put('onsil:settings',JSON.stringify(settings));return settings;
}

const metricLabels = { ph: 'pH', ec: 'EC', temperature: '온도', humidity: '습도', water: '잔여 물량' } as const;
type MetricKey = keyof typeof metricLabels;
async function readAlertState():Promise<AlertState> {
  const stored=await stateKV.get('onsil:alert-state');
  return stored?JSON.parse(stored):{lastSent:{},active:{}};
}
async function writeAlertState(state:AlertState){
  await stateKV.put('onsil:alert-state',JSON.stringify(state));
}

function violations(reading: Reading, settings: Awaited<ReturnType<typeof getSettings>>) {
  return (Object.keys(metricLabels) as MetricKey[]).filter(key => settings.alertEnabled[key] && (key === 'water' ? waterIsLow(reading.water, settings.thresholds.water.min) : (reading[key] < settings.thresholds[key].min || reading[key] > settings.thresholds[key].max)));
}
async function sendGoogleChat(text: string) {
  const webhook = Deno.env.get('SMARTFARM_GOOGLE_CHAT_WEBHOOK_URL');
  if (!webhook) return false;
  const url = new URL(webhook);
  if (url.protocol !== 'https:' || url.hostname !== 'chat.googleapis.com' || !url.pathname.startsWith('/v1/spaces/')) throw new Error('GOOGLE_CHAT_WEBHOOK_URL must be a Google Chat HTTPS webhook URL.');
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }), signal: AbortSignal.timeout(4000), cache: 'no-store' });
  if (!response.ok) throw new Error(`Google Chat webhook failed (${response.status}).`);
  return true;
}
export async function evaluateAndSendAlerts(reading: Reading, only?: MetricKey[]) {
  const project = await getProject();
  if (!project.running) return [];
  const settings = await getSettings();
  if (!settings.notifications || !Deno.env.get('SMARTFARM_GOOGLE_CHAT_WEBHOOK_URL')) return [];
  const now = Date.now();
  const previous = await readAlertState();
  const current = new Set(violations(reading, settings).filter(key => !only || only.includes(key)));
  const { state, due, changed } = advanceAlertState(only ?? Object.keys(metricLabels) as MetricKey[], current, previous, now, settings.cooldownMinutes);
  // Save the attempt time before delivery to prevent a broken webhook from being retried on every dashboard poll.
  if (changed) await writeAlertState(state);
  if (!due.length) return [];
  const sendable = due; // withState serializes cooldown claims across requests.
  if (!sendable.length) return [];
  const details = sendable.map(key => {
    const threshold = settings.thresholds[key]; const value = reading[key];
    if(key === 'water') return `• 잔여 물량 ${value.toFixed(1)}L · ${threshold.min}L 이하 — 물을 보충해 주세요.`;
    const direction = value < threshold.min ? '하한 미달' : '상한 초과';
    return `• ${metricLabels[key]} ${direction}: ${value.toFixed(key === 'temperature' || key === 'humidity' ? 1 : 2)} (설정 범위 ${threshold.min}–${threshold.max})`;
  });
  return await sendGoogleChat(`🚨 온실 스마트팜 센서 알림\n${details.join('\n')}\n확인 시각: ${new Date(now).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`) ? sendable : [];
}

export async function dashboard(rangeValue: string | null, admin: boolean) {
  const range: HistoryRange = ranges.includes(rangeValue as HistoryRange) ? rangeValue as HistoryRange : '30m';
  const settings = await getSettings();
  const manual = await readManualPumps();
  const project = await getProject();
  const wallNow = Date.now();
  const now = project.running ? wallNow : project.changedAt;
  const drainAnchor = project.resumedAt !== null ? Math.max(manual.drain ?? 0, project.resumedAt) : manual.drain;
  const current = sample(now, drainAnchor);
  let waterLog = null, waterStorageError = false;
  try { waterLog = await readWater(); } catch { waterStorageError = true; }
  const latestWater = waterLog?.latest;
  const waterSource = latestWater || waterStorageError ? 'sensor' : 'demo';
  const stale = !!latestWater && wallNow - latestWater.time > 5 * 60000;
  const measured = latestWater ? measureTank(latestWater.distanceCm, settings.water) : measureTank(settings.water.sensorOffsetCm + settings.water.heightCm * (1 - current.water / 100), settings.water);
  const usable = !waterStorageError && !stale && measured;
  const waterTank = { source:waterSource, status:waterStorageError?'error':stale?'stale':!measured?'invalid':'ok', measuredAt:latestWater?.time ?? now, ...settings.water, ...(usable || {}) };
  if(usable) { current.water = usable.liters; current.distanceCm = usable.distanceCm; current.heightCm = usable.heightCm; }
  else { delete (current as Partial<Reading>).water; }

  const enabled = {...settings.alertEnabled, water: settings.alertEnabled.water};
  let incidentState: Awaited<ReturnType<typeof recordIncidents>> | undefined;
  let incidentLogError: string | null = null;
  try { incidentState = await recordIncidents(current as unknown as Record<string,number>, settings.thresholds, enabled, wallNow, project.running); }
  catch { incidentLogError = '이상 기록을 저장하지 못했습니다. 잠시 후 다시 확인해 주세요.'; }
  const activeAlerts = violations(current, settings).map(key => {
    const id = incidentState?.events.find(row=>row.metric===key&&row.closedAt===null)?.id ?? `threshold-${key}`;
    const t = settings.thresholds[key]; const value = current[key];
    if(key === 'water') return {id,key:'water',time:now,title:`잔여 물량 ${value.toFixed(1)}L · 물 부족`,detail:`${t.min}L 이하입니다. 물을 보충해 주세요.`,severity:'warning',at:new Date(now).toISOString(),delivery:Deno.env.get('SMARTFARM_GOOGLE_CHAT_WEBHOOK_URL')?'webhook':'none',acknowledged:false};
    return { key, time:now, id, title: `${metricLabels[key]} ${value < t.min ? '하한 미달' : '상한 초과'}`, detail: `현재 ${value.toFixed(2)} · 설정 범위 ${t.min}–${t.max}`, severity: 'warning', at: new Date(now).toISOString(), delivery: Deno.env.get('SMARTFARM_GOOGLE_CHAT_WEBHOOK_URL') ? 'webhook' : 'none', acknowledged: false };
  });
  if(waterSource === 'sensor' && !usable) activeAlerts.push({id:'water-sensor',key:'water-sensor',time:now,title:'물량 측정 확인 필요',detail:stale?'초음파센서 수신이 5분 이상 지연되었습니다.':waterStorageError?'물량 저장소에 연결하지 못했습니다.':'초음파센서 거리값이 유효하지 않습니다.',severity:'warning',at:new Date(now).toISOString(),delivery:'none',acknowledged:false});
  const waterHistory = recentWater(now, drainAnchor).filter(row=>isOperatingAt(row.time,project));
  const volumeHistory = waterSource === 'sensor' ? (waterLog?.history ?? []).filter(row=>isOperatingAt(row.time,project)).map(row=>({time:row.time,water:measureTank(row.distanceCm,settings.water)?.liters ?? null})) : waterHistory.map(row=>({...row,water:row.water / 100 * settings.water.capacityLiters}));
  const cycleMs = 120 * 60_000;
  const contacts = [...new Set([
    ...waterHistory.filter(row => row.waterContact).map(row => simulatedContactStart(row.time, cycleMs, drainAnchor)),
    ...(current.waterContact ? [simulatedContactStart(now, cycleMs, drainAnchor)] : []),
  ])].filter((start): start is number => start !== null);
  const supply = supplyTiming(now, settings.pumpSeconds, 30 * 60_000, project.resumedAt !== null ? Math.max(manual.supply ?? 0, project.resumedAt) : manual.supply);
  const lastContact = contacts.at(-1) ?? null;
  const drain = simulatedDrainTiming(now, 30, cycleMs, contacts, project.resumedAt !== null ? Math.max(manual.drain ?? 0, project.resumedAt) : manual.drain);
  if(project.resumedAt !== null){
    for(const [timing,key,interval] of [[supply,'supply',30*60_000],[drain,'drain',120*60_000]] as const){
      const manualStart=manual[key];
      if((manualStart??0)<project.resumedAt && now<project.resumedAt+interval){
        timing.running=false;timing.endsAt=null;timing.lastStartedAt=null as unknown as number;
      }
      timing.recentEndedAt=timing.recentEndedAt.filter(at=>at!==project.resumedAt!+timing.durationSeconds*1000);
    }
  }
  for(const timing of [supply,drain]) {
    timing.recentEndedAt = timing.recentEndedAt.filter(at=>isOperatingAt(at,project));
    timing.lastEndedAt = timing.recentEndedAt[0] ?? null;
    if(!project.running){timing.running=false;timing.endsAt=null;timing.nextStartedAt=null as unknown as number;}
  }
  return {
    project, incidentLogError, serverTime: wallNow, connection: {source:'demo', lastReceivedAt:current.time},
    waterTank, mode: 'demo', history: history(range, now, project).map(row=>({...row,water:row.water/100*settings.water.capacityLiters})), current, settings, pump: { pump: null, expiresAt: 0 }, pumpTelemetry: { supply, drain }, waterHistory:volumeHistory,
    waterCycle: { intervals: Array(10).fill(settings.water.cycleMinutes), lastTouch: lastContact, latest: current, recommendedMinutes: settings.water.cycleMinutes },
    alerts: project.running ? activeAlerts : [], admin, chatConfigured: !!Deno.env.get('SMARTFARM_GOOGLE_CHAT_WEBHOOK_URL'),
  };
}


type ManualPumps = { supply?: number; drain?: number };
async function readManualPumps():Promise<ManualPumps>{
 const raw=await stateKV.get('onsil:pumps');return raw?JSON.parse(raw):{};
}
export async function startDemoPump(pump:'supply'|'drain'){
 if(!(await getProject()).running)throw new Error('project_paused');
 const state=await readManualPumps();state[pump]=Date.now();
 await stateKV.put('onsil:pumps',JSON.stringify(state));
}
