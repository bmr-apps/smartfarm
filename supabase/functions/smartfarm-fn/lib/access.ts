import type { HubUser } from './hub.ts';
import { readState, writeState } from './state.ts';
export type Member={user_id:string;email:string;role:'owner'|'admin';status:'active'|'invited'|'pending'|'rejected'|'revoked';active:boolean;created_at:string};
const ownerEmail=()=> (Deno.env.get('SMARTFARM_OWNER_EMAIL')||'1104@bmrschool.org').trim().toLowerCase();
export const members=()=>readState<Member[]>('onsil:admins',()=>[]);
export async function access(user:HubUser|null){
 const email=user?.email?.toLowerCase();const owner=!!email&&email===ownerEmail();
 const rows=await members();const member=rows.find(m=>m.user_id===user?.id||m.email===email);
 return {admin:owner||!!member?.active&&['active','invited'].includes(member.status),owner};
}
export async function requestAccess(user:HubUser){
 const email=user.email?.toLowerCase();
 if(!email)throw new Error('이메일을 확인할 수 없습니다.');
 const rows=await members();let member=rows.find(m=>m.user_id===user.id||m.email===email);
 if(email===ownerEmail())return {admin:true,owner:true,status:'approved'};
 if(!member){member={user_id:user.id,email,role:'admin',status:'pending',active:false,created_at:new Date().toISOString()};rows.push(member);}
 else if(member.status==='invited'){member.user_id=user.id;member.status='active';member.active=true;}
 await writeState('onsil:admins',rows);
 return {admin:member.active&&member.status==='active',owner:false,status:member.active?'approved':member.status};
}
export async function listMembers(user:HubUser){
 return [{user_id:user.id,email:ownerEmail(),role:'owner',status:'active',active:true,created_at:''},...await members()];
}
export async function changeMember(body:Record<string,unknown>){
 const rows=await members(),action=String(body.action);
 if(action==='invite'){
  const email=String(body.email||'').trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw new Error('올바른 이메일을 입력해 주세요.');
  if(email===ownerEmail())throw new Error('이미 최고 관리자입니다.');
  const member=rows.find(m=>m.email===email);
  if(member){member.active=true;member.status=member.user_id.startsWith('invite:')?'invited':'active';}
  else rows.push({user_id:'invite:'+email,email,role:'admin',status:'invited',active:true,created_at:new Date().toISOString()});
  await writeState('onsil:admins',rows);
  return {message:'관리자로 초대했습니다. 학교 앱 계정으로 로그인하면 사용할 수 있습니다.',email};
 }
 const member=rows.find(m=>m.user_id===body.userId);
 if(!member)throw new Error('관리자를 찾을 수 없습니다.');
 if(action==='approve'){member.active=true;member.status='active';}
 else if(action==='reject'){member.active=false;member.status='rejected';}
 else if(action==='revoke'){member.active=false;member.status='revoked';}
 else if(action==='resend')return {message:'초대 메일을 다시 보냅니다.',email:member.email};
 else throw new Error('지원하지 않는 작업입니다.');
 await writeState('onsil:admins',rows);
 return {message:action==='approve'?'관리자 신청을 승인했습니다.':action==='reject'?'관리자 신청을 거절했습니다.':'관리자 권한을 회수했습니다.'};
}
