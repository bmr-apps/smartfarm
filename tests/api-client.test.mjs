import test from 'node:test';
import assert from 'node:assert/strict';
import {createApiClient} from '../src/api-client.js';
const appUrl='https://apps.bmrschool.net/smartfarm/';
function setup({signedIn=true}={}){
 const calls=[],authCalls=[];
 const supabase={auth:{
  getSession:async()=>({data:{session:signedIn?{access_token:'verified-user-token'}:null}}),
  signInWithPassword:async args=>{authCalls.push(args);return {error:null};},
  signOut:async args=>{authCalls.push(args);return {error:null};},
  resetPasswordForEmail:async(...args)=>{authCalls.push(args);return {error:null};}
 }};
 const api=createApiClient({supabase,appUrl,fnUrl:'https://project.supabase.co/functions/v1/smartfarm-fn',publishableKey:'public-key',
 fetcher:async(url,init)=>{calls.push({url,init});return Response.json({admin:true,owner:true});}});
 return {api,calls,authCalls};
}
test('dashboard requests stay in this app and pass the school session to the function',async()=>{
 const {api,calls}=setup();
 await api('/smartfarm/api/dashboard?range=week');
 assert.equal(calls[0].url,'https://project.supabase.co/functions/v1/smartfarm-fn/dashboard?range=week');
 assert.equal(calls[0].init.headers.get('Authorization'),'Bearer verified-user-token');
 assert.equal(calls[0].init.headers.get('apikey'),'public-key');
 assert.equal(calls[0].init.credentials,'omit');
 await assert.rejects(api('/hub/api/dashboard'));
 await assert.rejects(api('https://evil.example/smartfarm/api/dashboard'));
});
test('anonymous requests do not inherit an Authorization header',async()=>{
 const {api,calls}=setup({signedIn:false});
 await api('/smartfarm/api/dashboard',{headers:{Authorization:'Bearer must-not-forward'}});
 assert.equal(calls[0].init.headers.has('Authorization'),false);
});
test('email and password go to Supabase Auth, never to the dashboard function',async()=>{
 const {api,calls,authCalls}=setup();
 const result=await api('/smartfarm/api/session',{method:'POST',body:JSON.stringify({email:'1104@bmrschool.org',password:'example-password'})});
 assert.equal(result.status,200);assert.equal(authCalls[0].email,'1104@bmrschool.org');
 assert.equal(calls[0].url.endsWith('/access'),true);
 assert.equal(calls[0].init.body,'{}');
});
test('logout only ends this app session',async()=>{
 const {api,authCalls,calls}=setup();await api('/smartfarm/api/session',{method:'DELETE'});
 assert.deepEqual(authCalls,[{scope:'local'}]);assert.equal(calls.length,0);
});
test('bodyless chat test reaches the server without invalid JSON serialization',async()=>{
 const {api,calls}=setup();await api('/smartfarm/api/chat-test',{method:'POST'});
 assert.equal(calls[0].init.body,undefined);
 assert.equal(calls[0].url.endsWith('/chat-test'),true);
});
test('password recovery returns to this app path',async()=>{
 const {api,authCalls}=setup();await api('/smartfarm/api/password-reset-request',{method:'POST',body:JSON.stringify({email:'student@example.com'})});
 assert.equal(authCalls[0][1].redirectTo,appUrl+'?recovery=1');
});
