import './dashboard-base.css';
import './dashboard.css';
import './style.css';
import {supabase,FN_URL,PUBLISHABLE_KEY} from './supabase.js';
import {createApiClient} from './api-client.js';

const appUrl=new URL(import.meta.env.BASE_URL,location.origin).href;
const api=createApiClient({supabase,fnUrl:FN_URL,publishableKey:PUBLISHABLE_KEY,appUrl});
window.smartfarmFetch=api;
window.smartfarmLoginWithGoogle=async()=>{
 const {error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:appUrl}});
 if(error)window.alert('Google 로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.');
};

function syncBrand(){
 const wordmark=document.querySelector('.wordmark');
 if(wordmark?.firstChild?.nodeType===Node.TEXT_NODE&&wordmark.firstChild.textContent==='온실')wordmark.firstChild.textContent='지하';
 const subtitle=wordmark?.querySelector('span');if(subtitle?.textContent==='smart farm')subtitle.textContent='스마트팜';
 const logo=document.querySelector('.rail .logo');if(logo?.getAttribute('aria-label')==='온실 대시보드')logo.setAttribute('aria-label','지하 스마트팜 대시보드');
 for(const node of document.querySelector('.page-footer > span:first-child')?.childNodes??[]){
  if(node.nodeType===Node.TEXT_NODE&&node.textContent?.includes('온실'))node.textContent=node.textContent.replace('온실','지하');
 }
}
async function loadScript(name){await import(/* @vite-ignore */ new URL('site/'+name,appUrl).href);}
async function boot(){
 const {data:{session}}=await supabase.auth.getSession();
 if(new URL(location.href).searchParams.get('recovery')==='1'){
  document.getElementById('root').innerHTML='<main class="smartfarm-recovery"><h1>새 비밀번호 설정</h1><p>학교 앱 계정의 비밀번호를 변경합니다.</p><form><label for="new-password">새 비밀번호 (10자 이상)</label><input id="new-password" type="password" autocomplete="new-password" minlength="10" maxlength="256" required><button type="submit">비밀번호 저장</button><p role="status"></p></form><a href="'+appUrl+'">대시보드로 돌아가기</a></main>';
  const form=document.querySelector('form');
  form.onsubmit=async event=>{
   event.preventDefault();const button=form.querySelector('button'),message=form.querySelector('[role=status]');button.disabled=true;
   const {error}=await supabase.auth.updateUser({password:form.querySelector('input').value});
   message.textContent=error?'비밀번호를 바꾸지 못했습니다. 가장 최근 재설정 메일을 다시 열어 주세요.':'비밀번호를 변경했습니다. 대시보드로 돌아가 로그인해 주세요.';
   button.disabled=false;if(!error)form.querySelector('input').value='';
  };return;
 }
 let access;
 if(session)try{const result=await api.requestAccess();if(result.ok)access=await result.json();}catch{ /* Dashboard shows API connection errors. */ }
 new MutationObserver(syncBrand).observe(document.getElementById('root'),{subtree:true,childList:true,characterData:true});
 await loadScript('app.js');
 await loadScript('auth.js');
 await loadScript('admins.js');
 await loadScript('operations.js');
 syncBrand();
 if(access&&!access.admin){
  const notice=document.createElement('div');notice.className='smartfarm-access-notice';notice.setAttribute('role','status');
  notice.textContent=access.status==='pending'?'학교 계정 로그인 완료 · 관리자 승인 대기 중입니다.':'로그인한 계정의 관리자 권한이 없습니다.';
  document.body.append(notice);setTimeout(()=>notice.remove(),6500);
 }
}
boot().catch(()=>{
 const root=document.getElementById('root');
 root.textContent='대시보드를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.';
 root.setAttribute('role','alert');
});
