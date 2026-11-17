(() => {
 if(window.__onsilOperations)return;window.__onsilOperations=true;
 let data=null,range='30m',owner=false,admin=false,lastSuccess=0,failed=false,pending=false,dialog=null,localProject=null;
 const boot=Date.now();
 const labels={ph:'pH',ec:'EC',temperature:'온도',humidity:'습도',water:'잔여 물량'};
 const date=t=>new Date(t).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
 const style=document.createElement('style');style.textContent=`
 .onsil-project-bar{margin:18px 0;padding:16px 20px;display:flex;flex-wrap:wrap;align-items:center;gap:12px 22px;background:#fff;border:1px solid #dfe7db;border-radius:14px}.onsil-project-main{flex:1;min-width:180px}.onsil-project-main strong{display:block;font-size:15px;color:#31563c}.onsil-project-main small{display:block;margin-top:5px;font-size:12px;color:#71816b;line-height:1.6}.onsil-project-status{font-size:12px;color:#386945;line-height:1.8}.onsil-project-status[data-level=error]{color:#b14c38}.onsil-project-status[data-level=warning]{color:#91732c}.onsil-op-actions{display:flex;gap:8px;flex-wrap:wrap}.onsil-op-button{font:inherit;font-size:12px;padding:9px 13px;min-height:40px;border:1px solid #dbe5d5;background:#fff;color:#365d3e;border-radius:8px;cursor:pointer}.onsil-op-button:hover{background:#f1f6ed}.onsil-op-button:disabled{opacity:.5;cursor:wait}.onsil-op-button.primary{background:#326442;color:#fff;border-color:#326442}.onsil-op-button.danger{color:#a94e39}.onsil-op-button:focus-visible{outline:3px solid #85a876;outline-offset:3px}.onsil-op-message{width:100%;font-size:13px;color:#ad493b;margin:0}.onsil-op-dialog{width:min(760px,calc(100% - 28px));max-height:calc(100dvh - 40px);overflow:auto;border:1px solid #dfe7db;border-radius:20px;padding:26px;background:#fafcf8;color:#2d4334}.onsil-op-dialog::backdrop{background:#17302188;backdrop-filter:blur(4px)}.onsil-op-title{display:flex;justify-content:space-between;align-items:center;gap:12px}.onsil-op-title h2{margin:0;font-size:23px}.onsil-op-dialog p{font-size:13px;line-height:1.7;color:#72806e}.onsil-op-record{padding:14px 0;border-bottom:1px solid #e1e8dc;display:grid;grid-template-columns:1fr auto;gap:6px 14px}.onsil-op-record strong{font-size:14px}.onsil-op-record small{font-size:12px;color:#75816f;line-height:1.6}.onsil-op-record .detail{grid-column:1/-1}.onsil-op-badge{font-size:12px;color:#8e4d33}.onsil-op-badge.resolved{color:#3e7550}.onsil-op-dialog footer{display:flex;gap:10px;justify-content:space-between;margin-top:16px}.onsil-download-options{display:flex;flex-wrap:wrap;gap:8px}.onsil-op-dialog select{font:inherit;padding:9px;border:1px solid #dbe5d5;border-radius:8px;background:#fff}.onsil-op-dialog [hidden],.onsil-project-bar [hidden]{display:none!important}
 @media(max-width:600px){.onsil-project-bar{padding:14px;gap:12px}.onsil-op-actions{width:100%}.onsil-op-actions button{flex:1}.onsil-op-dialog{padding:20px}.onsil-op-record{grid-template-columns:1fr}.onsil-op-record .detail{grid-column:auto}}
 `;document.head.appendChild(style);
 function requestRefresh(){window.dispatchEvent(new Event('onsil-refresh'));}
 function close(){if(dialog){dialog.close();dialog.remove();dialog=null;}}
 function panel(title){close();const el=document.createElement('dialog');dialog=el;el.className='onsil-op-dialog';el.setAttribute('aria-labelledby','onsil-op-title');el.innerHTML='<div class="onsil-op-title"><h2 id="onsil-op-title"></h2><button class="onsil-op-button" aria-label="닫기">닫기</button></div>';el.querySelector('h2').textContent=title;el.querySelector('button').onclick=close;el.addEventListener('cancel',e=>{e.preventDefault();close()});document.body.append(el);el.showModal();return el;}
 async function download(url,button){button.disabled=true;try{const r=await window.smartfarmFetch(url,{cache:'no-store'});if(!r.ok){const e=await r.json();throw Error(e.error||'내려받지 못했습니다.');}const blob=await r.blob();const href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download=r.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1]||'onsil.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),1000);}catch(e){window.alert(e.message);}finally{button.disabled=false;}}
 function showDownloads(){const el=panel('데이터 내려받기');const p=document.createElement('p');p.textContent='현재 화면의 시뮬레이션 데이터를 CSV로 저장합니다. 운영 중지 시간은 제외되며, 엑셀에서 열 수 있습니다.';el.append(p);const row=document.createElement('div');row.className='onsil-download-options';row.innerHTML='<select aria-label="내려받을 기간"><option value="30m">최근 30분 · 1분 측정값</option><option value="week">최근 7일 · 5분 평균</option><option value="month">최근 한 달 · 1시간 평균</option><option value="all">전체 표시 기간(60일) · 1일 평균</option></select><button class="onsil-op-button primary">센서 CSV 내려받기</button>';row.querySelector('select').value=range;row.querySelector('button').onclick=e=>download('/smartfarm/api/export?range='+row.querySelector('select').value,e.currentTarget);el.append(row);if(admin){const b=document.createElement('button');b.className='onsil-op-button';b.style.marginTop='12px';b.textContent='이상·복구 기록 CSV';b.onclick=()=>download('/smartfarm/api/export?kind=incidents',b);el.append(b);}}
 async function showIncidents(page=0){const el=panel('이상 발생·복구 기록');const note=document.createElement('p');note.textContent='대시보드가 열려 데이터를 확인하는 동안의 시뮬레이션 기록입니다. 운영 중지와 기준 변경은 정상 복구와 구분합니다.';el.append(note);const list=document.createElement('div');list.textContent='불러오는 중…';el.append(list);
 try{const r=await window.smartfarmFetch('/smartfarm/api/incidents?page='+page,{cache:'no-store'}),body=await r.json();if(!r.ok)throw Error(body.error);if(!el.isConnected)return;list.replaceChildren();if(!body.events.length)list.textContent='아직 기록된 이상이 없습니다.';
 for(const e of body.events){const row=document.createElement('div');row.className='onsil-op-record';const title=document.createElement('strong');title.textContent=(labels[e.metric]||e.metric)+' 기준 이탈';const badge=document.createElement('span');badge.className='onsil-op-badge'+(e.reason==='recovered'?' resolved':'');badge.textContent=e.closedAt===null?'이상 지속':e.reason==='recovered'?'정상 복구':e.reason==='paused'?'운영 중지로 종료':'기준 변경으로 종료';const time=document.createElement('small');time.className='detail';const duration=e.closedAt===null?'':` · ${Math.max(1,Math.round((e.closedAt-e.openedAt)/60000))}분`;time.textContent=`${date(e.openedAt)} 발생${e.closedAt===null?'':' → '+date(e.closedAt)+' 종료'+duration}`;const value=document.createElement('small');value.className='detail';value.textContent=`발생값 ${Number(e.value).toFixed(2)} · 당시 기준 ${e.min}–${e.max}`;row.append(title,badge,time,value);list.append(row);}
 const foot=document.createElement('footer');const prev=document.createElement('button'),next=document.createElement('button');for(const b of [prev,next])b.className='onsil-op-button';prev.textContent='이전';prev.disabled=page===0;next.textContent='다음';next.disabled=(page+1)*50>=body.total;prev.onclick=()=>showIncidents(page-1);next.onclick=()=>showIncidents(page+1);const total=document.createElement('small');total.textContent=`총 ${body.total}건`;foot.append(prev,total,next);el.append(foot);
 }catch(e){list.textContent=e.message;}}
 async function toggle(){if(!owner||!data?.project||pending)return;const p=localProject||data.project;const running=!p.running;if(!window.confirm(running?'프로젝트 운영을 시작할까요? 급수·배수 주기를 새로 시작합니다.':'프로젝트 운영을 중지할까요? 시뮬레이션 펌프와 새 측정값 갱신을 멈추고 기존 기록은 보존합니다.'))return;pending=true;render();try{const r=await window.smartfarmFetch('/smartfarm/api/project',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({running,expected:p.changedAt})});const body=await r.json();if(!r.ok)throw Error(body.error);localProject=body.project;data.project=body.project;requestRefresh();}catch(e){const message=document.querySelector('.onsil-op-message');if(message)message.textContent=e.message;}finally{pending=false;render();}}
 function render(){
 const alertFooter=document.querySelector('.notification-foot');
 if(alertFooter&&!alertFooter.querySelector('.onsil-popup-preview')){
  const preview=document.createElement('button');preview.className='onsil-op-button onsil-popup-preview';preview.textContent='경고창 미리보기';
  preview.onclick=()=>showRiskPopup({id:'preview-only',title:'[미리보기] 잔여 물량 10.0L · 물 부족',detail:'10L 이하입니다. 물을 보충해 주세요. 이 창은 미리보기이며 실제 물량과 경고 기록을 변경하지 않습니다.'});
  alertFooter.append(preview);
 }
 let bar=document.querySelector('[data-onsil-project]');const host=document.querySelector('#overview');if(!host)return;if(!bar){bar=document.createElement('section');bar.dataset.onsilProject='true';bar.className='onsil-project-bar';bar.setAttribute('aria-label','프로젝트 운영 및 연결 상태');bar.innerHTML='<div class="onsil-project-main"><strong></strong><small></small></div><div class="onsil-project-status" role="status"></div><div class="onsil-op-actions"><button class="onsil-op-button" data-download>데이터 내려받기</button><button class="onsil-op-button" data-incidents>이상·복구 기록</button><button class="onsil-op-button primary" data-toggle></button></div><p class="onsil-op-message" role="alert"></p>';host.firstElementChild?.after(bar);bar.querySelector('[data-download]').onclick=showDownloads;bar.querySelector('[data-incidents]').onclick=()=>showIncidents();bar.querySelector('[data-toggle]').onclick=toggle;}
 if(data?.incidentLogError)bar.querySelector('.onsil-op-message').textContent=data.incidentLogError;
 const project=localProject||data?.project;const paused=project?.running===false;
 bar.querySelector('strong').textContent=project?(paused?'프로젝트 운영 중지':'프로젝트 운영 중'):'운영 상태 확인 중';
 bar.querySelector('.onsil-project-main small').textContent=paused?`${date(project.changedAt)}부터 중지 · 마지막 값과 기존 기록 표시`:'시뮬레이션 · 실제 센서 미연결 · 다른 화면 반영까지 최대 약 1분';
 const status=bar.querySelector('.onsil-project-status');const stale=Date.now()-(lastSuccess||boot)>15000;
 status.dataset.level=!navigator.onLine||stale?'error':failed?'warning':'normal';status.textContent=!navigator.onLine?'인터넷 연결 끊김':stale?'서버 연결 끊김 · 표시된 값은 최신이 아닙니다':failed?'서버 연결 확인 중…':lastSuccess?'서버 연결 정상 · '+date(lastSuccess):'서버 연결 확인 중…';
 const b=bar.querySelector('[data-toggle]');b.hidden=!owner;b.disabled=pending||!project||failed||!navigator.onLine||!!stale;b.textContent=pending?'변경 중…':paused?'운영 시작':'운영 중지';b.classList.toggle('danger',!paused);bar.querySelector('[data-incidents]').hidden=!admin;
 }
 async function auth(){try{const r=await window.smartfarmFetch('/smartfarm/api/session',{cache:'no-store'}),s=await r.json();owner=r.ok&&s.owner===true;admin=r.ok&&s.admin===true;}catch{owner=false;admin=false;}render();}

 // Dismiss only the current incident. Popups never depend on webhook delivery.
 const popupKey='smartfarm:onsil-risk-popup-v2';
 let popupState;
 try { popupState=JSON.parse(sessionStorage.getItem(popupKey)||'{}'); } catch { popupState={}; }
 if(!popupState||typeof popupState!=='object')popupState={};
 let riskDialog=null,riskId=null,returnFocus=null;
 function savePopupState(){try{sessionStorage.setItem(popupKey,JSON.stringify(popupState));}catch{}}
 function clearRisk(){if(riskDialog){riskDialog.close();riskDialog.remove();riskDialog=null;riskId=null;if(returnFocus?.isConnected)returnFocus.focus();}}
 function showRiskPopup(alert){
   if(riskDialog)return;
   const el=document.createElement('dialog');riskDialog=el;riskId=alert.id;returnFocus=document.activeElement;
   el.className='onsil-op-dialog onsil-risk-dialog';el.setAttribute('role','alertdialog');el.setAttribute('aria-modal','true');
   el.setAttribute('aria-labelledby','onsil-risk-title');el.setAttribute('aria-describedby','onsil-risk-detail');
   const icon=document.createElement('div');icon.className='onsil-risk-icon';icon.textContent='!';icon.setAttribute('aria-hidden','true');
   const eyebrow=document.createElement('strong');eyebrow.className='onsil-risk-eyebrow';eyebrow.textContent='지금 확인해 주세요';
   const heading=document.createElement('h2');heading.id='onsil-risk-title';heading.textContent=alert.title;
   const detail=document.createElement('p');detail.id='onsil-risk-detail';detail.textContent=alert.detail;
   const note=document.createElement('p');note.className='onsil-risk-note';note.textContent='확인은 경고창만 닫습니다. 이상 상태는 정상으로 돌아올 때까지 알림 센터에 남습니다.';
   const dismiss=document.createElement('button');dismiss.className='onsil-op-button primary';dismiss.textContent='경고 확인';
   function finish(){popupState[alert.id]='dismissed';savePopupState();clearRisk();showNextRisk();}
   dismiss.onclick=finish;el.addEventListener('cancel',e=>{e.preventDefault();finish()});
   el.append(icon,eyebrow,heading,detail,note,dismiss);document.body.append(el);el.showModal();dismiss.focus();
 }
 function showNextRisk(){
   if(riskDialog||!data||data.project?.running===false)return;
   const pending=(data.alerts||[]).find(a=>a.severity==='warning'&&popupState[a.id]==='pending');
   if(pending)showRiskPopup(pending);
 }
 function updateRiskPopups(){
   const alerts=data?.project?.running===false?[]:(data?.alerts||[]).filter(a=>a.severity==='warning');
   const active=new Set(alerts.map(a=>a.id));
   for(const id of Object.keys(popupState))if(!active.has(id))delete popupState[id];
   if(riskDialog&&riskId!=='preview-only'&&!active.has(riskId))clearRisk();
   for(const id of active)if(!popupState[id])popupState[id]='pending';
   savePopupState();showNextRisk();
 }
 function receive(event){const v=event.detail;if(!v?.data?.project)return;data=v.data;range=v.range;lastSuccess=Date.now();failed=false;if(localProject&&data.project.changedAt>=localProject.changedAt)localProject=null;
 if(localProject){data.project=localProject;if(!localProject.running)for(const timing of Object.values(data.pumpTelemetry||{})){timing.running=false;timing.endsAt=null;timing.nextStartedAt=null;}}
 render();updateRiskPopups();}
 window.addEventListener('onsil-dashboard',receive);window.addEventListener('onsil-dashboard-error',()=>{failed=true;render();});window.addEventListener('online',()=>{requestRefresh();render()});window.addEventListener('offline',render);window.addEventListener('focus',auth);
 new MutationObserver(()=>{if(!document.querySelector('[data-onsil-project]'))render();}).observe(document.body,{childList:true,subtree:true});
 document.addEventListener('click',e=>{const b=e.target instanceof Element?e.target.closest('button'):null;if(b?.textContent?.includes('관리자 나가기')){owner=false;admin=false;close();render();}},true);
 if(window.__onsilDashboard)receive({detail:window.__onsilDashboard});auth();setInterval(render,5000);setInterval(auth,60000);
})();
