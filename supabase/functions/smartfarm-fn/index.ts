import { ZodError } from 'npm:zod@4.6.5';
import { createHash, timingSafeEqual } from 'node:crypto';
import { checkHubAuth, healthJson, sendHubMail } from './lib/hub.ts';
import { ensureState, withState } from './lib/state.ts';
import { access, requestAccess, listMembers, changeMember } from './lib/access.ts';
import { dashboard, evaluateAndSendAlerts, getSettings, saveSettings, startDemoPump, ranges, type HistoryRange } from './lib/original-site-demo.ts';
import { getProject, setProject, getIncidents } from './lib/project-store.ts';
import { csvCell } from './lib/project-state.ts';
import { saveWater } from './lib/water-store.ts';
import { measureTank } from './lib/water-tank.ts';

const ORIGINS=['https://apps.bmrschool.net','http://localhost:5173','http://127.0.0.1:5173','http://localhost:4173','http://127.0.0.1:4173'];
function cors(req:Request):Record<string,string>{
 const origin=req.headers.get('origin')||'';
 return {'Access-Control-Allow-Origin':ORIGINS.includes(origin)?origin:ORIGINS[0],
 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
 'Access-Control-Allow-Methods':'GET, POST, PUT, DELETE, OPTIONS',
 'Access-Control-Expose-Headers':'Content-Disposition','Access-Control-Max-Age':'600',Vary:'Origin'};
}
const json=(req:Request,body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors(req),'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
function deviceAuthorized(req:Request){
 const token=Deno.env.get('SMARTFARM_ESP32_DEVICE_TOKEN'),given=req.headers.get('authorization')||'';
 if(!token||token.length<32||!given.startsWith('Bearer ')||given.length>512)return false;
 const hash=(s:string)=>createHash('sha256').update(s).digest();
 return timingSafeEqual(hash(token),hash(given.slice(7)));
}
async function bodyOf(req:Request){
 const raw=await req.text();
 if(raw.length>16384)throw new Error('payload_too_large');
 const value=raw.trim()?JSON.parse(raw):{};
 if(!value||typeof value!=='object'||Array.isArray(value))throw new SyntaxError('invalid_body');
 return value as Record<string,unknown>;
}
async function testChat(){
 const raw=Deno.env.get('SMARTFARM_GOOGLE_CHAT_WEBHOOK_URL');
 if(!raw)throw new Error('Google Chat 웹훅을 SMARTFARM_GOOGLE_CHAT_WEBHOOK_URL 비밀값에 설정해 주세요.');
 const url=new URL(raw);
 if(url.protocol!=='https:'||url.hostname!=='chat.googleapis.com'||!url.pathname.startsWith('/v1/spaces/'))throw new Error('Google Chat HTTPS 웹훅 URL을 확인해 주세요.');
 const result=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'✅ 지하 스마트팜 연결 테스트\nGoogle Chat 알림이 정상적으로 연결되었습니다.'}),signal:AbortSignal.timeout(4000)});
 if(!result.ok){await result.body?.cancel();throw new Error('Google Chat 전송에 실패했습니다.');}
 await result.body?.cancel();
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(req)});
 const origin=req.headers.get('origin');
 if(origin&&!ORIGINS.includes(origin))return json(req,{error:'허용되지 않은 출처입니다.'},403);
 const url=new URL(req.url),marker='/smartfarm-fn',index=url.pathname.indexOf(marker);
 const path=(index<0?url.pathname:url.pathname.slice(index+marker.length)).replace(/\/+$/,'')||'/';
 try{
  if(path==='/health'){await ensureState();return json(req,{...healthJson(true),dashboard_ready:true});}
  if(path==='/hello')return json(req,{app:'smartfarm',user:await checkHubAuth(req),time:new Date().toISOString()});
  if(path==='/device/water'&&req.method==='POST'){
   if(!deviceAuthorized(req))return json(req,{error:'등록된 장치의 인증 토큰이 필요합니다.'},401);
   const body=await bodyOf(req),distance=body.distanceCm;
   if(!Object.hasOwn(body,'distanceCm')||(distance!==null&&(typeof distance!=='number'||!Number.isFinite(distance)||distance<0||distance>400)))return json(req,{error:'distanceCm은 0~400 사이 숫자 또는 null이어야 합니다.'},400);
   return await withState(async()=>{
    const latest=await saveWater(distance as number|null),settings=await getSettings();
    return json(req,{ok:true,time:latest.time,measurement:measureTank(distance as number|null,settings.water)});
   });
  }
  const user=await checkHubAuth(req);
  return await withState(async()=>{
   const rights=await access(user);
   if(path==='/session'&&req.method==='GET')return json(req,rights);
   if(path==='/session'&&req.method==='DELETE')return json(req,{ok:true});
   if(path==='/access'&&req.method==='POST'){
    if(!user)return json(req,{error:'학교 앱 계정으로 로그인해 주세요.'},401);
    return json(req,await requestAccess(user));
   }
   if(path==='/dashboard'&&req.method==='GET'){
    const result=await dashboard(url.searchParams.get('range'),rights.admin);
    try{await evaluateAndSendAlerts(result.current);}catch{console.error('smartfarm alert delivery failed');}
    return json(req,result);
   }
   if(path==='/export'&&req.method==='GET'){
    const kind=url.searchParams.get('kind'),range=(ranges.includes(url.searchParams.get('range') as HistoryRange)?url.searchParams.get('range'):'30m') as HistoryRange;
    const kst=(time:number)=>new Date(time).toLocaleString('sv-SE',{timeZone:'Asia/Seoul'});
    let rows:unknown[][];
    if(kind==='incidents'){
     if(!rights.admin)return json(req,{error:'관리자 로그인이 필요합니다.'},401);
     const log=await getIncidents();
     rows=[['발생 시각(KST)','종료 시각(KST)','센서','상태','발생값','하한','상한','데이터 종류'],...log.events.map(e=>[kst(e.openedAt),e.closedAt===null?'':kst(e.closedAt),e.metric,e.reason==='recovered'?'정상 복구':e.reason==='paused'?'운영 중지로 종료':e.reason==='settings_changed'?'기준 변경으로 종료':'이상 지속',e.value,e.min,e.max,'시뮬레이션'])];
    }else{
     const result=await dashboard(range,false);
     rows=[['시각(KST)','pH','EC(mS/cm)','온도(°C)','습도(%)','잔여 물량(L)','데이터 종류'],...result.history.map(r=>[kst(r.time),r.ph,r.ec,r.temperature,r.humidity,r.water,'시뮬레이션'])];
    }
    return new Response('\uFEFF'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n'),{headers:{...cors(req),'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="smartfarm-${kind==='incidents'?'incidents':range}.csv"`,'Cache-Control':'no-store'}});
   }
   if(path==='/incidents'&&req.method==='GET'){
    if(!rights.admin)return json(req,{error:'관리자 로그인이 필요합니다.'},401);
    const raw=Number(url.searchParams.get('page')||0),page=Number.isSafeInteger(raw)&&raw>=0?raw:0;
    const log=await getIncidents();return json(req,{events:log.events.slice(page*50,(page+1)*50),total:log.events.length});
   }
   if(path==='/admins'&&req.method==='GET'){
    if(!rights.owner||!user)return json(req,{error:'최고 관리자만 사용할 수 있습니다.'},403);
    return json(req,{members:await listMembers(user)});
   }
   if(!['POST','PUT'].includes(req.method))return json(req,{error:'없는 경로입니다.'},404);
   if(!rights.admin)return json(req,{error:'승인된 관리자 로그인이 필요합니다.'},401);
   const body=await bodyOf(req);
   if(path==='/settings'){await saveSettings(body);return json(req,{ok:true});}
   if(path==='/chat-test'){await testChat();return json(req,{ok:true});}
   if(path==='/pumps'){
    if(body.pump!=='supply'&&body.pump!=='drain')return json(req,{error:'펌프를 확인해 주세요.'},400);
    if(!(await getProject()).running)return json(req,{error:'프로젝트 운영이 중지되어 있습니다.'},409);
    await startDemoPump(body.pump);return json(req,{ok:true,mode:'demo'});
   }
   if(path==='/sensor'){
    const result=await dashboard('30m',true);return json(req,{ok:true,mode:'demo',sent:await evaluateAndSendAlerts(result.current)});
   }
   if(path==='/project'){
    if(!rights.owner)return json(req,{error:'최고 관리자만 운영 상태를 바꿀 수 있습니다.'},403);
    if(typeof body.running!=='boolean'||!Number.isSafeInteger(body.expected))return json(req,{error:'운영 상태를 확인해 주세요.'},400);
    try{return json(req,{project:await setProject(body.running,body.expected as number)});}
    catch(error){if(error instanceof Error&&error.message==='state_conflict')return json(req,{error:'다른 화면에서 상태가 바뀌었습니다. 새로고침 후 다시 시도해 주세요.'},409);throw error;}
   }
   if(path==='/admins'){
    if(!rights.owner)return json(req,{error:'최고 관리자만 사용할 수 있습니다.'},403);
    const result=await changeMember(body);
    if('email' in result && typeof result.email === 'string'){
     try{await sendHubMail({to:result.email,subject:'지하 스마트팜 관리자 초대',text:'지하 스마트팜 관리자로 초대되었습니다. 학교 앱 계정으로 로그인해 주세요.\nhttps://apps.bmrschool.net/smartfarm/',from_name:'지하 스마트팜'});}
     catch{return json(req,{message:'관리자 권한은 저장했습니다. 메일은 보내지 못했으니 앱 주소를 직접 전달해 주세요.'});}
    }
    return json(req,result);
   }
   return json(req,{error:'없는 경로입니다.'},404);
  });
 }catch(error){
  if(error instanceof ZodError)return json(req,{error:'설정 값을 확인해 주세요.',fields:error.issues.map(i=>i.path.join('.'))},400);
  if(error instanceof SyntaxError)return json(req,{error:'JSON 형식이 올바르지 않습니다.'},400);
  if(error instanceof Error&&error.message==='payload_too_large')return json(req,{error:'요청이 너무 큽니다.'},413);
  // Never print DB URLs, webhook URLs, tokens or full dependency errors.
  console.error('smartfarm request failed',path);
  if(path==='/health')return json(req,healthJson(false),503);
  if(path==='/chat-test')return json(req,{error:Deno.env.get('SMARTFARM_GOOGLE_CHAT_WEBHOOK_URL')?'Google Chat 전송에 실패했습니다. 웹훅 설정을 확인해 주세요.':'SMARTFARM_GOOGLE_CHAT_WEBHOOK_URL 비밀값에 Google Chat 웹훅을 설정해 주세요.'},503);
  return json(req,{error:'요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'},503);
 }
});
