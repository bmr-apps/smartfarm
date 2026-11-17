// Adapts only this dashboard's requests; never replaces the browser's fetch.
export function createApiClient({supabase,fnUrl,publishableKey,appUrl,fetcher=globalThis.fetch}){
 const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
 const endpoint=async(path,init={})=>{
  const {data:{session}}=await supabase.auth.getSession();
  const headers=new Headers(init.headers);
  headers.set('apikey',publishableKey);
  if(session?.access_token)headers.set('Authorization','Bearer '+session.access_token);
  else headers.delete('Authorization');
  if(init.body!==undefined&&!headers.has('Content-Type'))headers.set('Content-Type','application/json');
  return fetcher(fnUrl+path,{...init,headers,cache:'no-store',credentials:'omit',redirect:'error'});
 };
 async function api(input,init={}){
  const url=new URL(typeof input==='string'?input:input.url,appUrl);
  const base=new URL(appUrl);
  if(url.origin!==base.origin||!url.pathname.startsWith(base.pathname+'api/'))throw new Error('스마트팜 API 경로가 아닙니다.');
  const path='/'+url.pathname.slice((base.pathname+'api/').length)+url.search;
  const method=(init.method||'GET').toUpperCase();
  if(path==='/session'&&method==='POST'){
   let body;try{body=JSON.parse(init.body||'{}');}catch{return reply({error:'JSON 형식이 올바르지 않습니다.'},400);}
   const {error}=await supabase.auth.signInWithPassword({email:String(body.email||'').trim(),password:String(body.password||'')});
   if(error)return reply({error:'이메일 또는 비밀번호를 확인해 주세요.'},401);
   const result=await endpoint('/access',{method:'POST',body:'{}'});
   if(!result.ok)return result;
   const state=await result.json();
   return state.admin?reply(state):reply({error:state.status==='pending'?'관리자 승인을 기다리고 있습니다. 최고 관리자에게 요청해 주세요.':'이 계정에는 관리자 권한이 없습니다.'},403);
  }
  if(path==='/session'&&method==='DELETE'){
   const {error}=await supabase.auth.signOut({scope:'local'});
   return error?reply({error:'로그아웃하지 못했습니다.'},503):reply({ok:true});
  }
  if(path==='/password-reset-request'&&method==='POST'){
   let body;try{body=JSON.parse(init.body||'{}');}catch{return reply({error:'JSON 형식이 올바르지 않습니다.'},400);}
   const reset=new URL(appUrl);reset.searchParams.set('recovery','1');
   const {error}=await supabase.auth.resetPasswordForEmail(String(body.email||'').trim(),{redirectTo:reset.href});
   return error?reply({error:'재설정 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.'},400):reply({ok:true});
  }
  return endpoint(path,init);
 }
 api.requestAccess=()=>endpoint('/access',{method:'POST',body:'{}'});
 return api;
}
