import postgres from 'npm:postgres@3.4.5';
import { AsyncLocalStorage } from 'node:async_hooks';

const url = Deno.env.get('SMARTFARM_DB_URL');
const db = url ? postgres(url, { prepare:false, max:2, idle_timeout:20, connect_timeout:10, onnotice:()=>{} }) : null;
const scope = new AsyncLocalStorage<ReturnType<typeof postgres>>();
let ready: Promise<void> | undefined;

export async function ensureState() {
  if (!db) throw new Error('DB 연결 정보가 없습니다.');
  if (!ready) ready = db.begin(async tx => {
    await tx`select pg_advisory_xact_lock(hashtextextended('smartfarm:dashboard-schema', 0))`;
    await tx`create table if not exists smartfarm.dashboard_state (
      key text primary key, value jsonb not null, updated_at timestamptz not null default now()
    )`;
    await tx`alter table smartfarm.dashboard_state enable row level security`;
    await tx`revoke all on smartfarm.dashboard_state from anon, authenticated`;
  }).then(()=>undefined).catch(error=>{ready=undefined;throw error;});
  await ready;
}
export async function withState<T>(work:()=>Promise<T>):Promise<T> {
  await ensureState();
  return await db!.begin(async tx => {
    await tx`select pg_advisory_xact_lock(hashtextextended('smartfarm:dashboard-state', 0))`;
    return await scope.run(tx as unknown as ReturnType<typeof postgres>, work);
  }) as T;
}
function connection() {
  const tx=scope.getStore();
  if(!tx)throw new Error('State access requires a transaction.');
  return tx;
}
export const stateKV = {
  async get(key:string):Promise<string|null> {
    const tx=connection();
    const rows=await tx`select value from smartfarm.dashboard_state where key=${key}`;
    return rows.length ? JSON.stringify(rows[0].value) : null;
  },
  async put(key:string,value:string):Promise<void> {
    const tx=connection();
    await tx`insert into smartfarm.dashboard_state (key,value) values (${key},${tx.json(JSON.parse(value))})
      on conflict (key) do update set value=excluded.value,updated_at=now()`;
  }
};
export async function readState<T>(key:string,fallback:()=>T):Promise<T> {
  const raw=await stateKV.get(key);return raw===null?fallback():JSON.parse(raw);
}
export async function writeState(key:string,value:unknown) {
  await stateKV.put(key,JSON.stringify(value));
}
